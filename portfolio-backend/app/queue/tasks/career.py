"""Celery task: AI assessment for Career Operating System runs.

This module registers the ``run_career_ai_assessment`` task on the shared
Celery app.  It is imported by ``app.queue.tasks.__init__`` which in turn is
imported during Celery worker startup (triggered from ``celery_app.py``).
"""
from __future__ import annotations

import json
import logging
import re

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

from app.core.config import settings
from app.core.database import SessionLocal
from app.crud.career import (
    get_or_create_skill_by_name,
    update_run_ai_data_sync,
    update_run_ai_status_sync,
)
from app.models.career import (
    CareerAssessmentRun,
    CareerJob,
    CareerJobSkill,
)
from app.models.experience import Experience, ExperienceText
from app.models.language import Language
from app.models.portfolio import Portfolio, PortfolioAttachment, portfolio_experiences, portfolio_projects
from app.models.project import Project, ProjectText, project_skills
from app.models.skill import SkillText
from app.services.career_service import build_ai_context
from app.services.llm.providers import AnthropicProvider, ProviderConfig, RateLimitError, build_provider
from celery import shared_task

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"  # kept for backward-compat; task uses settings

SYSTEM_PROMPT = (
    "You are a career coach AI. Given a portfolio summary and job descriptions, "
    "return ONLY valid JSON matching this exact schema — no prose, no markdown fences:\n"
    "{\n"
    '  "resume_issues": [\n'
    '    { "job": "string", "issue": "string", "impact": "CRITICAL|HIGH|MEDIUM|LOW", "fix": "string" }\n'
    "  ],\n"
    '  "action_plan": [\n'
    '    { "job": "string", "week_range": "string", "focus": "string", "tasks": ["string"], "hours": "string" }\n'
    "  ]\n"
    "}\n"
    "For EACH job listed under JOBS BEING EVALUATED, produce specific resume issues and a prioritised action plan. "
    'Set \"job\" to the exact job title from the input. '
    'Use \"General\" only for cross-cutting issues that apply to every job equally. '
    "Identify resume issues based on skill gaps from the scorecard. "
    "Generate a 12-week prioritised action plan per job addressing CRITICAL and HIGH gaps first."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_run_with_jobs_and_skills(
    db,
    run_id: int,
) -> CareerAssessmentRun | None:
    """Load an assessment run with its jobs and each job's CareerJobSkill rows."""
    result = db.execute(
        select(CareerAssessmentRun)
        .options(
            selectinload(CareerAssessmentRun.jobs).selectinload(CareerJob.skills),
            joinedload(CareerAssessmentRun.objective),
        )
        .where(CareerAssessmentRun.id == run_id)
    )
    return result.scalars().first()


def _get_job_skill_names(db, run: CareerAssessmentRun) -> dict[int, dict[int, str]]:
    """Return {job_id: {skill_id: skill_name}} for all required skills in a run.

    Skill names come from SkillText (any language — first row per skill).
    """
    # Collect all (job_id, skill_id) pairs
    job_skill_pairs: list[tuple[int, int]] = [
        (js.job_id, js.skill_id)
        for job in run.jobs
        for js in job.skills
    ]
    if not job_skill_pairs:
        return {}

    all_skill_ids = list({pair[1] for pair in job_skill_pairs})

    # Fetch one name per skill (prefer default language)
    rows = db.execute(
        select(SkillText.skill_id, SkillText.name)
        .outerjoin(Language, Language.id == SkillText.language_id)
        .where(SkillText.skill_id.in_(all_skill_ids))
        .order_by(SkillText.skill_id, Language.is_default.desc())
        .distinct(SkillText.skill_id)
    ).all()
    skill_id_to_name: dict[int, str] = {row[0]: (row[1] or f"Skill {row[0]}") for row in rows}

    # Build {job_id: {skill_id: name}}
    result: dict[int, dict[int, str]] = {}
    for job_id, skill_id in job_skill_pairs:
        result.setdefault(job_id, {})[skill_id] = skill_id_to_name.get(
            skill_id, f"Skill {skill_id}"
        )
    return result


def _get_portfolio_name(db, portfolio_id: int) -> str:
    """Return the name of a portfolio, falling back to a safe default."""
    row = db.execute(
        select(Portfolio.name).where(Portfolio.id == portfolio_id)
    ).first()
    return row[0] if row else f"Portfolio {portfolio_id}"


def _get_project_summaries(db, portfolio_id: int) -> list[dict]:
    """Return [{name, skills}] for projects linked to the portfolio."""
    # Step 1: project id → name via ProjectText (prefer default language)
    project_rows = db.execute(
        select(Project.id, ProjectText.name)
        .join(portfolio_projects, portfolio_projects.c.project_id == Project.id)
        .outerjoin(ProjectText, ProjectText.project_id == Project.id)
        .outerjoin(Language, Language.id == ProjectText.language_id)
        .where(portfolio_projects.c.portfolio_id == portfolio_id)
        .order_by(Project.id, Language.is_default.desc())
        .distinct(Project.id)
    ).all()

    if not project_rows:
        return []

    project_id_to_name: dict[int, str] = {}
    for pid, pname in project_rows:
        if pid not in project_id_to_name:
            project_id_to_name[pid] = pname or f"Project {pid}"

    project_ids = list(project_id_to_name.keys())

    # Step 2: skill names for each project (prefer default language)
    skill_rows = db.execute(
        select(project_skills.c.project_id, SkillText.name)
        .join(SkillText, SkillText.skill_id == project_skills.c.skill_id)
        .outerjoin(Language, Language.id == SkillText.language_id)
        .where(project_skills.c.project_id.in_(project_ids))
        .order_by(project_skills.c.project_id, project_skills.c.skill_id, Language.is_default.desc())
        .distinct(project_skills.c.project_id, project_skills.c.skill_id)
    ).all()

    pid_to_skills: dict[int, list[str]] = {pid: [] for pid in project_ids}
    for pid, sname in skill_rows:
        if sname:
            pid_to_skills[pid].append(sname)

    return [
        {"name": project_id_to_name[pid], "skills": pid_to_skills[pid]}
        for pid in project_ids
    ]


def _get_experience_summaries(db, portfolio_id: int) -> list[dict]:
    """Return [{name, years}] for experiences linked to the portfolio."""
    rows = db.execute(
        select(Experience.id, Experience.years, ExperienceText.name)
        .join(portfolio_experiences, portfolio_experiences.c.experience_id == Experience.id)
        .outerjoin(ExperienceText, ExperienceText.experience_id == Experience.id)
        .outerjoin(Language, Language.id == ExperienceText.language_id)
        .where(portfolio_experiences.c.portfolio_id == portfolio_id)
        .order_by(Experience.id, Language.is_default.desc())
        .distinct(Experience.id)
    ).all()

    seen: set[int] = set()
    summaries: list[dict] = []
    for exp_id, years, name in rows:
        if exp_id not in seen:
            seen.add(exp_id)
            summaries.append({
                "name": name or f"Experience {exp_id}",
                "years": years or 0,
            })
    return summaries


def _get_resume_text(db, attachment_id: int | None) -> str:
    """Extract text from the resume PDF stored on disk.

    Returns an empty string if no attachment, file not found, or extraction fails.
    """
    if not attachment_id:
        return ""
    row = db.execute(
        select(PortfolioAttachment.file_path, PortfolioAttachment.file_name)
        .where(PortfolioAttachment.id == attachment_id)
    ).first()
    if not row:
        return ""
    file_path_str, file_name = row[0], row[1]
    try:
        import pypdf
        from pathlib import Path

        # DB stores paths as web URLs ("/uploads/...").  Resolve against the
        # filesystem uploads root; fall back to treating the value as-is.
        p = file_path_str
        if p.startswith("/uploads/"):
            p = p[len("/uploads/"):]  # strip the URL prefix
        full_path = settings.UPLOADS_DIR / p
        if not full_path.exists():
            # last-resort: try the raw value in case it's already absolute
            full_path = Path(file_path_str)
        if not full_path.exists():
            logger.warning("Resume file not found: %s", full_path)
            return f"[Resume: {file_name} — file not found on disk]"
        reader = pypdf.PdfReader(str(full_path))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages_text).strip()
        if not text:
            return f"[Resume: {file_name} — could not extract text]"
        # Truncate to ~4000 chars to keep prompt manageable
        return text[:4000]
    except Exception as exc:
        logger.warning("Failed to extract resume text from %s: %s", file_path_str, exc)
        return f"[Resume: {file_name} — extraction failed]"


def _build_job_summaries(
    run: CareerAssessmentRun,
    job_skill_names: dict[int, dict[int, str]],
) -> list[dict]:
    """Build job summary dicts from an already-loaded run.

    Parameters
    ----------
    run:
        Assessment run with ``jobs`` and ``jobs.skills`` eagerly loaded.
    job_skill_names:
        Mapping ``{job_id: {skill_id: skill_name}}`` produced by
        ``_get_job_skill_names``.
    """
    summaries = []
    for job in run.jobs:
        skill_map = job_skill_names.get(job.id, {})
        required_skills = [
            skill_map[js.skill_id]
            for js in job.skills
            if js.is_required and js.skill_id in skill_map
        ]
        summaries.append({
            "title": job.title,
            "company": job.company,
            "description": job.description or "",
            "required_skills": required_skills,
        })
    return summaries


# ---------------------------------------------------------------------------
# Provider factory
# ---------------------------------------------------------------------------

def _build_career_provider():
    """Return a ChatProvider based on CAREER_AI_* settings.

    Falls back to Anthropic Haiku when CAREER_AI_API_KEY is not set so that
    existing deployments keep working without changes.

    Quick-switch examples (set in .env):
      Groq Llama 3.3 70B (open-source, ~3x cheaper):
        CAREER_AI_PROVIDER=openai
        CAREER_AI_BASE_URL=https://api.groq.com/openai/v1
        CAREER_AI_MODEL=llama-3.3-70b-versatile
        CAREER_AI_API_KEY=<groq_key>

      Gemini 2.0 Flash Lite (~12x cheaper):
        CAREER_AI_PROVIDER=google
        CAREER_AI_MODEL=gemini-2.0-flash-lite
        CAREER_AI_API_KEY=<google_key>

      Groq Llama 3.1 8B (open-source, ~35x cheaper):
        CAREER_AI_PROVIDER=openai
        CAREER_AI_BASE_URL=https://api.groq.com/openai/v1
        CAREER_AI_MODEL=llama-3.1-8b-instant
        CAREER_AI_API_KEY=<groq_key>
    """
    api_key = settings.CAREER_AI_API_KEY or settings.ANTHROPIC_API_KEY
    provider_name = settings.CAREER_AI_PROVIDER or "anthropic"
    return build_provider(
        provider_name,
        api_key=api_key,
        base_url=settings.CAREER_AI_BASE_URL or None,
    )


def _build_career_fallback_provider():
    """Return the fallback ChatProvider used when the primary hits a 429.

    Returns None when no fallback is configured.
    """
    if not settings.CAREER_AI_FALLBACK_PROVIDER:
        return None, None
    api_key = settings.CAREER_AI_FALLBACK_API_KEY or settings.ANTHROPIC_API_KEY
    provider = build_provider(
        settings.CAREER_AI_FALLBACK_PROVIDER,
        api_key=api_key,
        base_url=settings.CAREER_AI_FALLBACK_BASE_URL or None,
    )
    model = settings.CAREER_AI_FALLBACK_MODEL or HAIKU_MODEL
    return provider, model


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------


@shared_task(
    name="app.queue.tasks.career.run_career_ai_assessment",
    bind=True,
    max_retries=0,
    time_limit=120,
    soft_time_limit=110,
)
def run_career_ai_assessment(self: Task, run_id: int) -> None:
    """Run the AI assessment for a CareerAssessmentRun.

    Sequence
    --------
    1. Mark run ``ai_status = "running"``.
    2. Load run with all relations needed for context building.
    3. Build portfolio / project / experience context strings.
    4. Call Haiku; parse JSON response.
    5. Persist ``resume_issues_json``, ``action_plan_json`` and
       ``ai_status = "complete"``.

    On any error the ``ai_status`` is set to ``"failed"``.
    """
    db = SessionLocal()
    try:
        # ── 1. Mark running ───────────────────────────────────────────────────
        update_run_ai_status_sync(db, run_id, "running")

        # ── 2. Load run ───────────────────────────────────────────────────────
        run = _load_run_with_jobs_and_skills(db, run_id)
        if run is None:
            logger.warning("Career AI task: run_id=%d not found — aborting", run_id)
            update_run_ai_status_sync(db, run_id, "failed")
            return

        portfolio_id = run.portfolio_id

        # ── 3. Build context ──────────────────────────────────────────────────
        portfolio_name = _get_portfolio_name(db, portfolio_id)
        project_summaries = _get_project_summaries(db, portfolio_id)
        experience_summaries = _get_experience_summaries(db, portfolio_id)
        resume_text = _get_resume_text(db, run.resume_attachment_id)
        objective_name = run.objective.name if run.objective else "Career Objective"
        job_skill_names = _get_job_skill_names(db, run)
        job_summaries = _build_job_summaries(run, job_skill_names)
        scorecard_json = run.scorecard_json or {"overall_readiness": 0.0, "skills": []}

        context = build_ai_context(
            portfolio_name=portfolio_name,
            project_summaries=project_summaries,
            experience_summaries=experience_summaries,
            resume_text=resume_text,
            objective_name=objective_name,
            job_summaries=job_summaries,
            scorecard_json=scorecard_json,
        )

        # ── 4. Call configured AI provider (with automatic fallback on 429) ──
        provider = _build_career_provider()
        model = settings.CAREER_AI_MODEL or HAIKU_MODEL
        try:
            result = provider.chat(
                model=model,
                system_prompt=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            )
        except RateLimitError:
            fallback_provider, fallback_model = _build_career_fallback_provider()
            if fallback_provider is None:
                raise  # no fallback configured — let the task fail
            logger.warning(
                "Primary provider rate-limited for run_id=%d; switching to fallback (%s / %s)",
                run_id, settings.CAREER_AI_FALLBACK_PROVIDER, fallback_model,
            )
            result = fallback_provider.chat(
                model=fallback_model,
                system_prompt=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            )

        # ── 5. Parse and persist ──────────────────────────────────────────────
        # Some models add noise around the JSON:
        #   • Qwen3 / DeepSeek: <think>...</think> reasoning block
        #   • Haiku / Llama: ```json ... ``` markdown fences
        # Strip both before parsing so any model works as primary or fallback.
        raw = result["text"].strip()
        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]   # drop opening fence line
            raw = raw.rsplit("```", 1)[0] # drop closing fence
            raw = raw.strip()
        payload = json.loads(raw)
        resume_issues = {"issues": payload.get("resume_issues", [])}
        action_plan = {"plan": payload.get("action_plan", [])}

        update_run_ai_data_sync(
            db,
            run_id,
            resume_issues=resume_issues,
            action_plan=action_plan,
            ai_status="complete",
        )
        logger.info(
            "Career AI task completed for run_id=%d (task=%s)",
            run_id,
            self.request.id,
        )

    except SoftTimeLimitExceeded:
        logger.error(
            "Career AI task timed out for run_id=%d (task=%s)",
            run_id,
            self.request.id,
        )
        update_run_ai_status_sync(db, run_id, "failed")
    except Exception:
        logger.exception("Career AI task failed for run_id=%d", run_id)
        update_run_ai_status_sync(db, run_id, "failed")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Skill extraction task
# ---------------------------------------------------------------------------

SKILL_EXTRACTION_PROMPT = (
    "You are a technical recruiter. Given a job description, extract all technical and soft skills required.\n"
    "Return ONLY a JSON array of skill name strings — no prose, no markdown fences:\n"
    '["skill1", "skill2", ...]\n'
    "Include programming languages, frameworks, tools, methodologies, and soft skills explicitly mentioned.\n"
    "Use short, standard names (e.g., 'Python', 'React', 'Docker', 'Agile', 'Communication').\n"
    "Return an empty array [] if no skills are found."
)


@shared_task(
    name="app.queue.tasks.career.extract_job_skills",
    bind=True,
    max_retries=0,
    time_limit=60,
    soft_time_limit=55,
)
def extract_job_skills(self: Task, job_id: int, user_id: int) -> None:
    """Extract required skills from a job description using AI and link them to the job.

    Sequence
    --------
    1. Load the job; skip if description is empty.
    2. Call configured AI provider to extract skill names.
    3. For each name: find existing skill (case-insensitive) or create it.
    4. Add new CareerJobSkill rows for skills not already linked.
    """
    db = SessionLocal()
    try:
        result = db.execute(
            select(CareerJob).where(CareerJob.id == job_id)
        )
        job = result.scalars().first()
        if job is None:
            logger.warning("extract_job_skills: job_id=%d not found — aborting", job_id)
            return

        description = (job.description or "").strip()
        if not description:
            logger.info("extract_job_skills: job_id=%d has no description — skipping", job_id)
            return

        # ── Call AI ──────────────────────────────────────────────────────────
        provider = _build_career_provider()
        model = settings.CAREER_AI_MODEL or HAIKU_MODEL
        try:
            ai_result = provider.chat(
                model=model,
                system_prompt=SKILL_EXTRACTION_PROMPT,
                messages=[{"role": "user", "content": description}],
            )
        except RateLimitError:
            fallback_provider, fallback_model = _build_career_fallback_provider()
            if fallback_provider is None:
                raise
            logger.warning(
                "extract_job_skills: primary rate-limited for job_id=%d; using fallback", job_id
            )
            ai_result = fallback_provider.chat(
                model=fallback_model,
                system_prompt=SKILL_EXTRACTION_PROMPT,
                messages=[{"role": "user", "content": description}],
            )

        # ── Parse ─────────────────────────────────────────────────────────────
        raw = ai_result["text"].strip()
        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0].strip()

        skill_names = json.loads(raw)
        if not isinstance(skill_names, list):
            logger.warning(
                "extract_job_skills: unexpected AI response for job_id=%d: %r", job_id, raw[:200]
            )
            return

        # ── Link skills ───────────────────────────────────────────────────────
        existing_ids = {
            row[0]
            for row in db.execute(
                select(CareerJobSkill.skill_id).where(CareerJobSkill.job_id == job_id)
            ).all()
        }

        added = 0
        for name in skill_names:
            if not isinstance(name, str) or not name.strip():
                continue
            skill_id, created = get_or_create_skill_by_name(db, name.strip(), user_id)
            if skill_id not in existing_ids:
                db.add(CareerJobSkill(
                    job_id=job_id,
                    skill_id=skill_id,
                    is_required=True,
                    years_required=None,
                ))
                existing_ids.add(skill_id)
                added += 1

        db.commit()
        logger.info(
            "extract_job_skills completed for job_id=%d: %d added from %d extracted",
            job_id, added, len(skill_names),
        )

    except SoftTimeLimitExceeded:
        logger.error("extract_job_skills timed out for job_id=%d", job_id)
    except Exception:
        logger.exception("extract_job_skills failed for job_id=%d", job_id)
    finally:
        db.close()
