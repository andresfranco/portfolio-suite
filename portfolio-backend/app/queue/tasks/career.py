"""Celery task: AI assessment for Career Operating System runs.

This module registers the ``run_career_ai_assessment`` task on the shared
Celery app.  It is imported by ``app.queue.tasks.__init__`` which in turn is
imported during Celery worker startup (triggered from ``celery_app.py``).
"""
from __future__ import annotations

import json
import logging

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

from app.core.config import settings
from app.core.database import SessionLocal
from app.crud.career import (
    update_run_ai_data_sync,
    update_run_ai_status_sync,
)
from app.models.career import (
    CareerAssessmentRun,
    CareerJob,
    CareerJobSkill,
)
from app.models.experience import Experience, ExperienceText
from app.models.portfolio import Portfolio, PortfolioAttachment, portfolio_experiences, portfolio_projects
from app.models.project import Project, ProjectText, project_skills
from app.models.skill import SkillText
from app.services.career_service import build_ai_context
from app.services.llm.providers import AnthropicProvider, ProviderConfig
from app.queue.celery_app import get_celery

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = (
    "You are a career coach AI. Given a portfolio summary and job descriptions, "
    "return ONLY valid JSON matching this exact schema — no prose, no markdown fences:\n"
    "{\n"
    '  "resume_issues": [\n'
    '    { "issue": "string", "impact": "CRITICAL|HIGH|MEDIUM|LOW", "fix": "string" }\n'
    "  ],\n"
    '  "action_plan": [\n'
    '    { "week_range": "string", "focus": "string", "tasks": ["string"], "hours": "string" }\n'
    "  ]\n"
    "}\n"
    "Identify resume issues based on skill gaps from the scorecard. "
    "Generate a 12-week prioritised action plan addressing CRITICAL and HIGH gaps first."
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

    # Fetch one name per skill (any language)
    rows = db.execute(
        select(SkillText.skill_id, SkillText.name)
        .where(SkillText.skill_id.in_(all_skill_ids))
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
    # Step 1: project id → name via ProjectText (first text row per project)
    project_rows = db.execute(
        select(Project.id, ProjectText.name)
        .join(portfolio_projects, portfolio_projects.c.project_id == Project.id)
        .outerjoin(ProjectText, ProjectText.project_id == Project.id)
        .where(portfolio_projects.c.portfolio_id == portfolio_id)
        .distinct(Project.id)
    ).all()

    if not project_rows:
        return []

    project_id_to_name: dict[int, str] = {}
    for pid, pname in project_rows:
        if pid not in project_id_to_name:
            project_id_to_name[pid] = pname or f"Project {pid}"

    project_ids = list(project_id_to_name.keys())

    # Step 2: skill names for each project
    skill_rows = db.execute(
        select(project_skills.c.project_id, SkillText.name)
        .join(SkillText, SkillText.skill_id == project_skills.c.skill_id)
        .where(project_skills.c.project_id.in_(project_ids))
        .distinct(project_skills.c.project_id, SkillText.skill_id)
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
        .where(portfolio_experiences.c.portfolio_id == portfolio_id)
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


def _get_resume_filename(db, attachment_id: int | None) -> str | None:
    """Return the file_name for a portfolio attachment, or None."""
    if not attachment_id:
        return None
    row = db.execute(
        select(PortfolioAttachment.file_name).where(PortfolioAttachment.id == attachment_id)
    ).first()
    return row[0] if row else None


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
# Task
# ---------------------------------------------------------------------------

celery_app = get_celery()


@celery_app.task(
    name="app.queue.tasks.career.run_career_ai_assessment",
    bind=True,
    max_retries=0,
    time_limit=60,
    soft_time_limit=50,
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
        resume_filename = _get_resume_filename(db, run.resume_attachment_id)
        objective_name = run.objective.name if run.objective else "Career Objective"
        job_skill_names = _get_job_skill_names(db, run)
        job_summaries = _build_job_summaries(run, job_skill_names)
        scorecard_json = run.scorecard_json or {"overall_readiness": 0.0, "skills": []}

        context = build_ai_context(
            portfolio_name=portfolio_name,
            project_summaries=project_summaries,
            experience_summaries=experience_summaries,
            resume_filename=resume_filename,
            objective_name=objective_name,
            job_summaries=job_summaries,
            scorecard_json=scorecard_json,
        )

        # ── 4. Call Haiku ─────────────────────────────────────────────────────
        provider = AnthropicProvider(
            ProviderConfig(name="anthropic", api_key=settings.ANTHROPIC_API_KEY)
        )
        result = provider.chat(
            model=HAIKU_MODEL,
            system_prompt=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": context}],
        )

        # ── 5. Parse and persist ──────────────────────────────────────────────
        payload = json.loads(result["text"])
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
