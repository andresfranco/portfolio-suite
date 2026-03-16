"""Career Operating System — service layer.

Orchestrates rule-based scoring (synchronous) and builds the AI context string
consumed by the Haiku prompt in the Celery analysis task.

All DB operations use a synchronous SQLAlchemy Session to match the rest of
the codebase.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.logging import setup_logger
from app.crud.career import get_run, update_run_sync_data
from app.models.career import CareerJobSkill
from app.models.experience import Experience
from app.models.portfolio import portfolio_experiences, portfolio_projects
from app.models.project import Project, ProjectText, project_skills
from app.models.skill import Skill, SkillText
from app.services.career_scoring import (
    SkillEvidence,
    compute_job_fit,
    compute_overall_readiness,
    compute_scorecard,
)

logger = setup_logger("app.services.career_service")


# ── 1. fetch_portfolio_skill_evidence ─────────────────────────────────────────

def fetch_portfolio_skill_evidence(
    db: Session,
    portfolio_id: int,
    skill_ids: list[int],
) -> tuple[list[SkillEvidence], int]:
    """Return skill evidences and total experience years for a portfolio.

    For each skill_id, collects the names of portfolio projects that include
    that skill.  Also sums experience years linked to the portfolio.

    Returns
    -------
    (skill_evidence_list, total_experience_years)
    """
    logger.debug(
        f"fetch_portfolio_skill_evidence: portfolio_id={portfolio_id}, "
        f"skill_count={len(skill_ids)}"
    )

    if not skill_ids:
        return [], _sum_experience_years(db, portfolio_id)

    # ── Step 1: portfolio's projects (id → name) ──────────────────────────────
    # Project name lives in ProjectText (first available, language-agnostic).
    # We LEFT JOIN project_texts so projects without a text row still appear.
    project_rows = db.execute(
        select(Project.id, ProjectText.name)
        .join(portfolio_projects, portfolio_projects.c.project_id == Project.id)
        .outerjoin(
            ProjectText,
            (ProjectText.project_id == Project.id),
        )
        .where(portfolio_projects.c.portfolio_id == portfolio_id)
        .distinct(Project.id)
    ).all()

    # Build {project_id: name} — use project id as fallback name if text absent
    project_id_to_name: dict[int, str] = {}
    for row in project_rows:
        pid, pname = row[0], row[1]
        if pid not in project_id_to_name:
            project_id_to_name[pid] = pname or f"Project {pid}"

    project_ids = list(project_id_to_name.keys())

    # ── Step 2: skill names (from skill_texts, any language) ─────────────────
    skill_name_rows = db.execute(
        select(Skill.id, SkillText.name)
        .outerjoin(SkillText, SkillText.skill_id == Skill.id)
        .where(Skill.id.in_(skill_ids))
        .distinct(Skill.id)
    ).all()
    skill_id_to_name: dict[int, str] = {
        row[0]: (row[1] or f"Skill {row[0]}") for row in skill_name_rows
    }

    # ── Step 3: for each skill, find matching project ids ────────────────────
    skill_evidence_list: list[SkillEvidence] = []

    if project_ids:
        # Bulk query: all (project_id, skill_id) pairs in scope
        assoc_rows = db.execute(
            select(project_skills.c.project_id, project_skills.c.skill_id)
            .where(project_skills.c.project_id.in_(project_ids))
            .where(project_skills.c.skill_id.in_(skill_ids))
        ).all()

        # Build {skill_id: [project_name, ...]}
        skill_to_projects: dict[int, list[str]] = {sid: [] for sid in skill_ids}
        for proj_id, skill_id in assoc_rows:
            skill_to_projects[skill_id].append(project_id_to_name[proj_id])
    else:
        skill_to_projects = {sid: [] for sid in skill_ids}

    for skill_id in skill_ids:
        skill_evidence_list.append(
            SkillEvidence(
                skill_id=skill_id,
                skill_name=skill_id_to_name.get(skill_id, f"Skill {skill_id}"),
                project_names=skill_to_projects.get(skill_id, []),
                # is_required and years_required are job-specific; caller sets them
                is_required=False,
                years_required=None,
            )
        )

    total_experience_years = _sum_experience_years(db, portfolio_id)

    logger.debug(
        f"fetch_portfolio_skill_evidence: found {len(skill_evidence_list)} skills, "
        f"total_exp_years={total_experience_years}"
    )
    return skill_evidence_list, total_experience_years


def _sum_experience_years(db: Session, portfolio_id: int) -> int:
    """Sum the `years` of all experiences linked to a portfolio."""
    result = db.execute(
        select(func.coalesce(func.sum(Experience.years), 0))
        .join(portfolio_experiences, portfolio_experiences.c.experience_id == Experience.id)
        .where(portfolio_experiences.c.portfolio_id == portfolio_id)
    ).scalar_one()
    return int(result)


# ── 2. compute_and_store_sync_sections ────────────────────────────────────────

def compute_and_store_sync_sections(
    db: Session,
    run_id: int,
    objective_id: int,
    portfolio_id: int,
) -> None:
    """Orchestrate rule-based scoring and persist results for a run.

    Steps
    -----
    1. Load the run with its jobs (via get_run).
    2. Collect all unique skill_ids across all jobs.
    3. Fetch portfolio skill evidence + total experience years once.
    4. For each job: build per-job skill evidences, compute scorecard + fit.
    5. Aggregate: overall_readiness = avg fit; deduplicated skill scorecard.
    6. Persist via update_run_sync_data.
    """
    logger.debug(
        f"compute_and_store_sync_sections: run_id={run_id}, "
        f"objective_id={objective_id}, portfolio_id={portfolio_id}"
    )

    run = get_run(db, run_id)
    if run is None:
        logger.error(f"compute_and_store_sync_sections: run {run_id} not found")
        return

    jobs = run.jobs  # list[CareerJob], loaded by get_run via selectinload

    # ── Collect skill requirements per job ───────────────────────────────────
    # job_skill_reqs: {job_id: [(skill_id, is_required, years_required)]}
    job_ids = [j.id for j in jobs]

    if not job_ids:
        logger.warning(f"Run {run_id} has no jobs — storing empty scorecard")
        update_run_sync_data(
            db,
            run,
            {"overall_readiness": 0.0, "skills": []},
            {"jobs": []},
        )
        return

    # Load CareerJobSkill rows for all jobs in one query
    skill_rows = db.execute(
        select(
            CareerJobSkill.job_id,
            CareerJobSkill.skill_id,
            CareerJobSkill.is_required,
            CareerJobSkill.years_required,
        )
        .where(CareerJobSkill.job_id.in_(job_ids))
    ).all()

    # {job_id: [(skill_id, is_required, years_required)]}
    job_skill_map: dict[int, list[tuple[int, bool, int | None]]] = {
        jid: [] for jid in job_ids
    }
    for row in skill_rows:
        job_skill_map[row.job_id].append(
            (row.skill_id, row.is_required, row.years_required)
        )

    all_skill_ids: list[int] = list(
        {row.skill_id for row in skill_rows}
    )

    # ── Fetch evidence once for all skills ───────────────────────────────────
    base_evidence_list, total_experience_years = fetch_portfolio_skill_evidence(
        db, portfolio_id, all_skill_ids
    )
    # Build lookup: {skill_id: SkillEvidence (base, without job-specific fields)}
    base_evidence_by_id: dict[int, SkillEvidence] = {
        ev["skill_id"]: ev for ev in base_evidence_list
    }

    # ── Score each job ───────────────────────────────────────────────────────
    from app.services.career_scoring import JobFitResult  # local import to avoid circular

    job_fit_results: list[JobFitResult] = []

    for job in jobs:
        skill_reqs = job_skill_map.get(job.id, [])

        # Build per-job SkillEvidence with job-specific is_required / years_required
        per_job_evidence: list[SkillEvidence] = []
        for skill_id, is_required, years_required in skill_reqs:
            base = base_evidence_by_id.get(
                skill_id,
                SkillEvidence(
                    skill_id=skill_id,
                    skill_name=f"Skill {skill_id}",
                    project_names=[],
                    is_required=is_required,
                    years_required=years_required,
                ),
            )
            per_job_evidence.append(
                SkillEvidence(
                    skill_id=base["skill_id"],
                    skill_name=base["skill_name"],
                    project_names=base["project_names"],
                    is_required=is_required,
                    years_required=years_required,
                )
            )

        scorecard = compute_scorecard(per_job_evidence, total_experience_years)
        fit_score, verdict = compute_job_fit(scorecard)

        job_fit_results.append(
            JobFitResult(
                job_id=job.id,
                job_title=job.title,
                fit_score=fit_score,
                verdict=verdict,
                scorecard=scorecard,
            )
        )

    # ── Build aggregate scorecard (deduplicated by skill_id, highest level) ──
    merged: dict[int, Any] = {}
    for jfr in job_fit_results:
        for item in jfr["scorecard"]:
            sid = item["skill_id"]
            if sid not in merged or item["level"] > merged[sid]["level"]:
                merged[sid] = item

    merged_skills = list(merged.values())

    overall_readiness = compute_overall_readiness(job_fit_results)

    scorecard_json: dict = {
        "overall_readiness": overall_readiness,
        "skills": [
            {
                "skill_id": s["skill_id"],
                "skill_name": s["skill_name"],
                "level": s["level"],
                "priority": s["priority"],
                "evidence": s["evidence"],
                "gap": s["gap"],
                "is_required": s["is_required"],
            }
            for s in merged_skills
        ],
    }

    job_fit_json: dict = {
        "jobs": [
            {
                "job_id": jfr["job_id"],
                "job_title": jfr["job_title"],
                "company": next(
                    (j.company for j in jobs if j.id == jfr["job_id"]), ""
                ),
                "fit_score": jfr["fit_score"],
                "verdict": jfr["verdict"],
                "scorecard": [
                    {
                        "skill_id": s["skill_id"],
                        "skill_name": s["skill_name"],
                        "level": s["level"],
                        "priority": s["priority"],
                        "evidence": s["evidence"],
                        "gap": s["gap"],
                        "is_required": s["is_required"],
                    }
                    for s in jfr["scorecard"]
                ],
            }
            for jfr in job_fit_results
        ]
    }

    update_run_sync_data(db, run, scorecard_json, job_fit_json)

    logger.debug(
        f"compute_and_store_sync_sections: run {run_id} scored "
        f"{len(job_fit_results)} jobs, overall_readiness={overall_readiness:.1f}"
    )


# ── 3. build_ai_context ───────────────────────────────────────────────────────

def build_ai_context(
    *,
    portfolio_name: str,
    project_summaries: list[dict],
    experience_summaries: list[dict],
    resume_filename: str | None,
    objective_name: str,
    job_summaries: list[dict],
    scorecard_json: dict,
) -> str:
    """Return a compact text block suitable for the Haiku analysis prompt.

    Parameters
    ----------
    portfolio_name:
        Display name of the portfolio.
    project_summaries:
        List of dicts with keys ``name`` and ``skills`` (list of skill name strings).
    experience_summaries:
        List of dicts with keys ``name`` and ``years`` (int).
    resume_filename:
        Filename of the attached resume, or None / empty string if not provided.
    objective_name:
        Name of the career objective being assessed.
    job_summaries:
        List of dicts with keys ``title``, ``company``, ``description`` (str),
        ``required_skills`` (list of str).
    scorecard_json:
        The aggregated scorecard dict produced by compute_and_store_sync_sections,
        with keys ``overall_readiness`` and ``skills`` (list of ScorecardItem dicts).
    """
    lines: list[str] = []

    # Portfolio
    lines.append(f"PORTFOLIO: {portfolio_name}")
    lines.append("")

    # Projects and skills
    lines.append("PROJECTS AND SKILLS:")
    for proj in project_summaries:
        skills_str = ", ".join(proj.get("skills", [])) or "none"
        lines.append(f"- {proj.get('name', 'Unnamed')}: {skills_str}")
    lines.append("")

    # Experiences
    lines.append("EXPERIENCES:")
    for exp in experience_summaries:
        lines.append(f"- {exp.get('name', 'Unnamed')}: {exp.get('years', 0)} years")
    lines.append("")

    # Resume
    resume_display = resume_filename if resume_filename else "Not provided"
    lines.append(f"RESUME: {resume_display}")
    lines.append("")

    # Objective
    lines.append(f"OBJECTIVE: {objective_name}")
    lines.append("")

    # Jobs
    lines.append("JOBS BEING EVALUATED:")
    for idx, job in enumerate(job_summaries, start=1):
        title = job.get("title", "Untitled")
        company = job.get("company", "Unknown")
        description = (job.get("description") or "")[:500]
        required_skills = ", ".join(job.get("required_skills", [])) or "none"
        lines.append(f"--- Job {idx}: {title} at {company} ---")
        lines.append(f"Description: {description}")
        lines.append(f"Required Skills: {required_skills}")
    lines.append("")

    # Skill scorecard summary (CRITICAL and HIGH only)
    lines.append("SKILL SCORECARD SUMMARY:")
    high_priority = {"CRITICAL", "HIGH"}
    skills = scorecard_json.get("skills", [])
    shown = 0
    for skill in skills:
        if skill.get("priority") in high_priority:
            lines.append(
                f"- {skill.get('skill_name', 'Unknown')}: "
                f"level={skill.get('level', 0)}, "
                f"priority={skill.get('priority', '')}, "
                f"gap={skill.get('gap', '')}"
            )
            shown += 1
    if shown == 0:
        lines.append("(No CRITICAL or HIGH gaps — good coverage)")
    lines.append("")
    lines.append("Only CRITICAL and HIGH gaps shown for brevity.")

    return "\n".join(lines)
