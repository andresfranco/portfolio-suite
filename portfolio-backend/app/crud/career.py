"""CRUD repository layer for the Career Operating System module.

Async functions use AsyncSession (SQLAlchemy 2.x async engine).
Sync variants (suffixed _sync) use Session and are intended for Celery tasks.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.logging import setup_logger
from app.models.career import (
    CareerAssessmentRun,
    CareerJob,
    CareerJobSkill,
    CareerObjective,
    career_assessment_run_job,
    career_objective_job,
)
from app.schemas.career import (
    AssessmentRunCreate,
    CareerJobCreate,
    CareerJobSkillItem,
    CareerJobUpdate,
    CareerObjectiveCreate,
    CareerObjectiveUpdate,
)

logger = setup_logger("app.crud.career")


# ── Jobs ──────────────────────────────────────────────────────────────────────

async def create_job(
    db: AsyncSession,
    data: CareerJobCreate,
    user_id: int,
) -> CareerJob:
    """Create a new career job record."""
    logger.debug(f"Creating career job: title={data.title!r}, company={data.company!r}")
    job = CareerJob(
        title=data.title,
        company=data.company,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        currency=data.currency,
        location=data.location,
        is_remote=data.is_remote,
        url=data.url,
        description=data.description,
        status=data.status,
        notes=data.notes,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    logger.debug(f"Career job created with ID {job.id}")
    return job


async def get_job(db: AsyncSession, job_id: int) -> Optional[CareerJob]:
    """Fetch a single career job by ID, with skills eagerly loaded."""
    logger.debug(f"Fetching career job ID {job_id}")
    result = await db.execute(
        select(CareerJob)
        .options(selectinload(CareerJob.skills))
        .where(CareerJob.id == job_id)
    )
    return result.scalars().first()


async def list_jobs(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    company: Optional[str] = None,
) -> Tuple[List[CareerJob], int]:
    """Return a paginated list of career jobs and the total count.

    Optionally filter by status and/or company (case-insensitive substring).
    """
    filters = []
    if status is not None:
        filters.append(CareerJob.status == status)
    if company is not None:
        filters.append(CareerJob.company.ilike(f"%{company}%"))

    count_stmt = select(func.count()).select_from(CareerJob)
    if filters:
        count_stmt = count_stmt.where(*filters)
    count_result = await db.execute(count_stmt)
    total: int = count_result.scalar_one()

    items_stmt = (
        select(CareerJob)
        .options(selectinload(CareerJob.skills))
        .order_by(CareerJob.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if filters:
        items_stmt = items_stmt.where(*filters)
    items_result = await db.execute(items_stmt)
    items = list(items_result.scalars().all())

    logger.debug(f"list_jobs → {len(items)} items, total={total}")
    return items, total


async def update_job(
    db: AsyncSession,
    job: CareerJob,
    data: CareerJobUpdate,
    user_id: int,
) -> CareerJob:
    """Partially update a career job — only fields that are not None in data."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return job
    update_data["updated_by"] = user_id
    for field, value in update_data.items():
        setattr(job, field, value)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    logger.debug(f"Career job {job.id} updated by user {user_id}")
    return job


async def delete_job(db: AsyncSession, job: CareerJob) -> None:
    """Delete a career job record."""
    logger.debug(f"Deleting career job ID {job.id}")
    await db.delete(job)
    await db.commit()


async def replace_job_skills(
    db: AsyncSession,
    job: CareerJob,
    skills: List[CareerJobSkillItem],
) -> CareerJob:
    """Replace all skills for a job: delete existing, then insert new ones."""
    logger.debug(f"Replacing skills for career job ID {job.id} with {len(skills)} items")
    await db.execute(
        delete(CareerJobSkill).where(CareerJobSkill.job_id == job.id)
    )
    for item in skills:
        db.add(CareerJobSkill(
            job_id=job.id,
            skill_id=item.skill_id,
            years_required=item.years_required,
            is_required=item.is_required,
        ))
    await db.commit()
    # Reload with skills eager-loaded
    result = await db.execute(
        select(CareerJob)
        .options(selectinload(CareerJob.skills))
        .where(CareerJob.id == job.id)
    )
    return result.scalars().one()


# ── Objectives ────────────────────────────────────────────────────────────────

async def create_objective(
    db: AsyncSession,
    data: CareerObjectiveCreate,
    user_id: int,
) -> CareerObjective:
    """Create a new career objective."""
    logger.debug(f"Creating career objective: name={data.name!r}")
    obj = CareerObjective(
        portfolio_id=data.portfolio_id,
        name=data.name,
        description=data.description,
        status=data.status,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    logger.debug(f"Career objective created with ID {obj.id}")
    return obj


async def get_objective(
    db: AsyncSession,
    objective_id: int,
) -> Optional[CareerObjective]:
    """Fetch a single career objective by ID, with jobs (and their skills) loaded."""
    logger.debug(f"Fetching career objective ID {objective_id}")
    result = await db.execute(
        select(CareerObjective)
        .options(
            selectinload(CareerObjective.jobs).selectinload(CareerJob.skills)
        )
        .where(CareerObjective.id == objective_id)
    )
    return result.scalars().first()


async def list_objectives(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[CareerObjective], int]:
    """Return a paginated list of career objectives and the total count."""
    count_result = await db.execute(
        select(func.count()).select_from(CareerObjective)
    )
    total: int = count_result.scalar_one()

    items_result = await db.execute(
        select(CareerObjective)
        .order_by(CareerObjective.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = list(items_result.scalars().all())
    logger.debug(f"list_objectives → {len(items)} items, total={total}")
    return items, total


async def update_objective(
    db: AsyncSession,
    obj: CareerObjective,
    data: CareerObjectiveUpdate,
    user_id: int,
) -> CareerObjective:
    """Partially update a career objective — only fields that are not None."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        return obj
    update_data["updated_by"] = user_id
    for field, value in update_data.items():
        setattr(obj, field, value)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    logger.debug(f"Career objective {obj.id} updated by user {user_id}")
    return obj


async def delete_objective(db: AsyncSession, obj: CareerObjective) -> None:
    """Delete a career objective record."""
    logger.debug(f"Deleting career objective ID {obj.id}")
    await db.delete(obj)
    await db.commit()


async def link_job_to_objective(
    db: AsyncSession,
    obj: CareerObjective,
    job: CareerJob,
) -> None:
    """Associate a job with an objective (idempotent — ON CONFLICT DO NOTHING)."""
    logger.debug(f"Linking job {job.id} to objective {obj.id}")
    stmt = (
        pg_insert(career_objective_job)
        .values(objective_id=obj.id, job_id=job.id)
        .on_conflict_do_nothing()
    )
    await db.execute(stmt)
    await db.commit()


async def unlink_job_from_objective(
    db: AsyncSession,
    obj: CareerObjective,
    job: CareerJob,
) -> None:
    """Remove the association between a job and an objective."""
    logger.debug(f"Unlinking job {job.id} from objective {obj.id}")
    await db.execute(
        delete(career_objective_job).where(
            career_objective_job.c.objective_id == obj.id,
            career_objective_job.c.job_id == job.id,
        )
    )
    await db.commit()


# ── Assessment runs ───────────────────────────────────────────────────────────

async def create_run(
    db: AsyncSession,
    objective: CareerObjective,
    data: AssessmentRunCreate,
    user_id: int,
) -> CareerAssessmentRun:
    """Create an assessment run and associate it with the requested jobs."""
    logger.debug(
        f"Creating assessment run for objective {objective.id} "
        f"with {len(data.job_ids)} jobs"
    )
    run = CareerAssessmentRun(
        objective_id=objective.id,
        portfolio_id=objective.portfolio_id,
        resume_attachment_id=data.resume_attachment_id,
        name=data.name,
        ai_status="pending",
        created_by=user_id,
    )
    db.add(run)
    await db.flush()  # Populate run.id before inserting associations

    if data.job_ids:
        await db.execute(
            insert(career_assessment_run_job),
            [{"run_id": run.id, "job_id": jid} for jid in data.job_ids],
        )

    await db.commit()
    await db.refresh(run)
    logger.debug(f"Assessment run created with ID {run.id}")
    return run


async def get_run(db: AsyncSession, run_id: int) -> Optional[CareerAssessmentRun]:
    """Fetch a single assessment run with jobs and objective loaded."""
    logger.debug(f"Fetching assessment run ID {run_id}")
    result = await db.execute(
        select(CareerAssessmentRun)
        .options(
            selectinload(CareerAssessmentRun.jobs),
            joinedload(CareerAssessmentRun.objective),
        )
        .where(CareerAssessmentRun.id == run_id)
    )
    return result.scalars().first()


async def list_runs(
    db: AsyncSession,
    objective_id: int,
) -> List[CareerAssessmentRun]:
    """Return all assessment runs for a given objective, newest first."""
    logger.debug(f"Listing assessment runs for objective {objective_id}")
    result = await db.execute(
        select(CareerAssessmentRun)
        .where(CareerAssessmentRun.objective_id == objective_id)
        .order_by(CareerAssessmentRun.created_at.desc())
    )
    return list(result.scalars().all())


async def update_run_sync_data(
    db: AsyncSession,
    run: CareerAssessmentRun,
    scorecard_json: dict,
    job_fit_json: dict,
) -> None:
    """Persist synchronous scorecard/job-fit data using a direct UPDATE statement."""
    logger.debug(f"Updating sync data for assessment run {run.id}")
    await db.execute(
        update(CareerAssessmentRun)
        .where(CareerAssessmentRun.id == run.id)
        .values(scorecard_json=scorecard_json, job_fit_json=job_fit_json)
    )
    await db.commit()


async def update_run_ai_data(
    db: AsyncSession,
    run_id: int,
    *,
    resume_issues: dict,
    action_plan: dict,
    ai_status: str,
) -> None:
    """Persist AI-generated data using a direct UPDATE statement (no ORM load)."""
    logger.debug(f"Updating AI data for assessment run {run_id}, status={ai_status!r}")
    await db.execute(
        update(CareerAssessmentRun)
        .where(CareerAssessmentRun.id == run_id)
        .values(
            resume_issues_json=resume_issues,
            action_plan_json=action_plan,
            ai_status=ai_status,
        )
    )
    await db.commit()


async def update_run_ai_status(
    db: AsyncSession,
    run_id: int,
    ai_status: str,
    ai_task_id: Optional[str] = None,
) -> None:
    """Update only the AI status (and optionally task ID) for an assessment run."""
    logger.debug(f"Updating AI status for run {run_id} → {ai_status!r}")
    values: dict = {"ai_status": ai_status}
    if ai_task_id is not None:
        values["ai_task_id"] = ai_task_id
    await db.execute(
        update(CareerAssessmentRun)
        .where(CareerAssessmentRun.id == run_id)
        .values(**values)
    )
    await db.commit()


# ── Sync variants for Celery tasks ────────────────────────────────────────────

def get_run_sync(db: Session, run_id: int) -> Optional[CareerAssessmentRun]:
    """Synchronous fetch of an assessment run for use inside Celery tasks.

    Loads run with jobs, objective, and portfolio via joinedload.
    """
    logger.debug(f"[sync] Fetching assessment run ID {run_id}")
    return (
        db.query(CareerAssessmentRun)
        .options(
            joinedload(CareerAssessmentRun.jobs),
            joinedload(CareerAssessmentRun.objective).joinedload(
                CareerObjective.portfolio
            ),
        )
        .filter(CareerAssessmentRun.id == run_id)
        .first()
    )


def update_run_ai_data_sync(
    db: Session,
    run_id: int,
    *,
    resume_issues: dict,
    action_plan: dict,
    ai_status: str,
) -> None:
    """Synchronous update of AI data fields (for Celery tasks)."""
    logger.debug(f"[sync] Updating AI data for run {run_id}, status={ai_status!r}")
    db.execute(
        update(CareerAssessmentRun)
        .where(CareerAssessmentRun.id == run_id)
        .values(
            resume_issues_json=resume_issues,
            action_plan_json=action_plan,
            ai_status=ai_status,
        )
    )
    db.commit()


def update_run_ai_status_sync(
    db: Session,
    run_id: int,
    ai_status: str,
) -> None:
    """Synchronous update of AI status field (for Celery tasks)."""
    logger.debug(f"[sync] Updating AI status for run {run_id} → {ai_status!r}")
    db.execute(
        update(CareerAssessmentRun)
        .where(CareerAssessmentRun.id == run_id)
        .values(ai_status=ai_status)
    )
    db.commit()
