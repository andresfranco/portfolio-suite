"""Career Operating System — API endpoints."""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

logger = logging.getLogger(__name__)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.api import deps
from app.core.security_decorators import permission_checker, require_permission
from app.crud import career as career_crud
from app.models.language import Language
from app.models.skill import Skill, SkillText
from app.queue.celery_app import is_enabled as _celery_is_enabled
from app.queue.tasks.career import extract_job_skills, run_career_ai_assessment
from app.schemas.career import (
    AnthropicDiagnosticsOut,
    ProviderDiagnosticsOut,
    AssessmentRunCreate,
    AssessmentRunOut,
    CareerJobCreate,
    CareerJobListOut,
    CareerJobOut,
    CareerJobSkillsUpdate,
    CareerJobUpdate,
    CareerObjectiveCreate,
    CareerObjectiveListOut,
    CareerObjectiveOut,
    CareerObjectiveUpdate,
    ReadinessCheck,
    RunReadinessOut,
    SectionStatusOut,
    SkillEnsureOut,
    SkillEnsureRequest,
    SkillSearchItem,
)
from app.services.career_service import compute_and_store_sync_sections

router = APIRouter()


# ── Ownership helpers ─────────────────────────────────────────────────────────


def _assert_owns_job(job, current_user, allow_override=True):
    """Raise 403 if caller doesn't own the job (unless system admin)."""
    if allow_override and permission_checker.is_system_admin(current_user):
        return
    if job.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this job",
        )


def _assert_owns_objective(obj, current_user):
    if permission_checker.is_system_admin(current_user):
        return
    if obj.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this objective",
        )


def _assert_owns_run(run, current_user):
    if permission_checker.is_system_admin(current_user):
        return
    if run.objective and run.objective.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this run",
        )


def _enrich_skill_names(db: Session, jobs) -> None:
    """Set .name on each CareerJobSkill instance for Pydantic serialisation.

    Pydantic reads from ORM attributes at serialisation time, so setting
    .name directly on the ORM instance is picked up by CareerJobSkillOut.
    """
    skill_ids = list({js.skill_id for job in jobs for js in (job.skills or [])})
    if not skill_ids:
        return
    # ORDER BY is_default DESC so DISTINCT ON picks the default-language row
    # first; falls back to any available language when no default text exists.
    rows = db.execute(
        select(SkillText.skill_id, SkillText.name)
        .join(Language, Language.id == SkillText.language_id)
        .where(SkillText.skill_id.in_(skill_ids))
        .order_by(SkillText.skill_id, Language.is_default.desc())
        .distinct(SkillText.skill_id)
    ).all()
    name_map = {row[0]: row[1] for row in rows}
    for job in jobs:
        for js in (job.skills or []):
            js.name = name_map.get(js.skill_id) or f"Skill {js.skill_id}"


# ── Job endpoints ─────────────────────────────────────────────────────────────


@router.post("/jobs", response_model=CareerJobOut, status_code=status.HTTP_201_CREATED)
@require_permission("VIEW_CAREER")
def create_job(
    data: CareerJobCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create a new career job and auto-extract required skills from description."""
    job = career_crud.create_job(db, data, current_user.id)
    if (data.description or "").strip():
        if _celery_is_enabled():
            extract_job_skills.delay(job.id, current_user.id)
        else:
            extract_job_skills(job.id, current_user.id)
        db.refresh(job)
    _enrich_skill_names(db, [job])
    return job


@router.get("/jobs", response_model=CareerJobListOut)
@require_permission("VIEW_CAREER")
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """List career jobs with optional filters."""
    items, total = career_crud.list_jobs(
        db, limit=limit, offset=offset, status=status, company=company
    )
    _enrich_skill_names(db, items)
    return CareerJobListOut(items=items, total=total)


@router.get("/jobs/{job_id}", response_model=CareerJobOut)
@require_permission("VIEW_CAREER")
def get_job(
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Fetch a single career job by ID."""
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _enrich_skill_names(db, [job])
    return job


@router.put("/jobs/{job_id}", response_model=CareerJobOut)
@require_permission("VIEW_CAREER")
def update_job(
    job_id: int,
    data: CareerJobUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Update a career job (ownership required)."""
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_job(job, current_user)
    job = career_crud.update_job(db, job, data, current_user.id)
    _enrich_skill_names(db, [job])
    return job


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("VIEW_CAREER")
def delete_job(
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Delete a career job (ownership required)."""
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_job(job, current_user)
    career_crud.delete_job(db, job)


@router.put("/jobs/{job_id}/skills", response_model=CareerJobOut)
@require_permission("VIEW_CAREER")
def replace_job_skills(
    job_id: int,
    data: CareerJobSkillsUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Replace all skills for a career job (ownership required)."""
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_job(job, current_user)
    job = career_crud.replace_job_skills(db, job, data.skills)
    _enrich_skill_names(db, [job])
    return job


@router.post("/jobs/{job_id}/extract-skills", response_model=CareerJobOut)
@require_permission("MANAGE_CAREER")
def trigger_extract_job_skills(
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Re-run AI skill extraction on a job description and merge results into required skills."""
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_job(job, current_user)
    if not (job.description or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job has no description to extract skills from",
        )
    # Always run synchronously so the response contains the updated skill list
    extract_job_skills(job.id, current_user.id)
    db.expire_all()
    job = career_crud.get_job(db, job_id)
    _enrich_skill_names(db, [job])
    return job


# ── Objective endpoints ───────────────────────────────────────────────────────


@router.post(
    "/objectives", response_model=CareerObjectiveOut, status_code=status.HTTP_201_CREATED
)
@require_permission("VIEW_CAREER")
def create_objective(
    data: CareerObjectiveCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create a new career objective."""
    return career_crud.create_objective(db, data, current_user.id)


@router.get("/objectives", response_model=CareerObjectiveListOut)
@require_permission("VIEW_CAREER")
def list_objectives(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """List career objectives."""
    items, total = career_crud.list_objectives(db, limit=limit, offset=offset)
    return CareerObjectiveListOut(items=items, total=total)


@router.get("/objectives/{objective_id}", response_model=CareerObjectiveOut)
@require_permission("VIEW_CAREER")
def get_objective(
    objective_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Fetch a single career objective by ID."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    if obj.jobs:
        _enrich_skill_names(db, obj.jobs)
    return obj


@router.put("/objectives/{objective_id}", response_model=CareerObjectiveOut)
@require_permission("VIEW_CAREER")
def update_objective(
    objective_id: int,
    data: CareerObjectiveUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Update a career objective (ownership required)."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    _assert_owns_objective(obj, current_user)
    return career_crud.update_objective(db, obj, data, current_user.id)


@router.delete("/objectives/{objective_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("VIEW_CAREER")
def delete_objective(
    objective_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Delete a career objective (ownership required)."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    _assert_owns_objective(obj, current_user)
    career_crud.delete_objective(db, obj)


@router.post(
    "/objectives/{objective_id}/jobs/{job_id}", response_model=CareerObjectiveOut
)
@require_permission("VIEW_CAREER")
def link_job_to_objective(
    objective_id: int,
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Link a job to an objective (ownership of objective required)."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_objective(obj, current_user)
    career_crud.link_job_to_objective(db, obj, job)
    obj = career_crud.get_objective(db, objective_id)
    if obj and obj.jobs:
        _enrich_skill_names(db, obj.jobs)
    return obj


@router.delete(
    "/objectives/{objective_id}/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT
)
@require_permission("VIEW_CAREER")
def unlink_job_from_objective(
    objective_id: int,
    job_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Unlink a job from an objective."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    _assert_owns_objective(obj, current_user)
    career_crud.unlink_job_from_objective(db, obj, job)


# ── Assessment run endpoints (objective-scoped) ───────────────────────────────


@router.post(
    "/objectives/{objective_id}/runs",
    response_model=AssessmentRunOut,
    status_code=status.HTTP_201_CREATED,
)
@require_permission("VIEW_CAREER")
def create_run(
    objective_id: int,
    data: AssessmentRunCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create an assessment run for an objective and trigger AI evaluation."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    _assert_owns_objective(obj, current_user)
    if not data.job_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one job_id is required",
        )
    run = career_crud.create_run(db, obj, data, current_user.id)
    compute_and_store_sync_sections(db, run.id, objective_id, obj.portfolio_id)
    db.refresh(run)
    if _celery_is_enabled():
        task = run_career_ai_assessment.delay(run.id)
        career_crud.update_run_ai_status(db, run.id, "pending", str(task.id))
    else:
        # Celery unavailable — run synchronously so the user still gets results
        logger.warning("Celery not available; running AI assessment synchronously for run_id=%d", run.id)
        run_career_ai_assessment(run.id)
    db.refresh(run)
    return run


@router.get("/objectives/{objective_id}/runs", response_model=List[AssessmentRunOut])
@require_permission("VIEW_CAREER")
def list_runs(
    objective_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """List all assessment runs for an objective."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found"
        )
    return career_crud.list_runs(db, objective_id)


@router.get(
    "/objectives/{objective_id}/runs/{run_id}", response_model=AssessmentRunOut
)
@require_permission("VIEW_CAREER")
def get_run_for_objective(
    objective_id: int,
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Fetch a specific assessment run under an objective."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    if run.objective_id != objective_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found for this objective"
        )
    return run


# ── Assessment run endpoints (flat) ──────────────────────────────────────────


@router.get("/runs/{run_id}", response_model=AssessmentRunOut)
@require_permission("VIEW_CAREER")
def get_run(
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Fetch a single assessment run by ID."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    _assert_owns_run(run, current_user)
    return run


@router.get("/runs/{run_id}/scorecard")
@require_permission("VIEW_CAREER")
def get_run_scorecard(
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return the scorecard JSON for an assessment run."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    _assert_owns_run(run, current_user)
    return run.scorecard_json or {}


@router.get("/runs/{run_id}/job-fit")
@require_permission("VIEW_CAREER")
def get_run_job_fit(
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return the job-fit JSON for an assessment run."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    _assert_owns_run(run, current_user)
    return run.job_fit_json or {}


@router.get("/runs/{run_id}/resume-issues", response_model=SectionStatusOut)
@require_permission("VIEW_CAREER")
def get_run_resume_issues(
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return resume issues, respecting AI processing status."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    _assert_owns_run(run, current_user)
    if run.ai_status in {"pending", "running"}:
        return SectionStatusOut(status=run.ai_status)
    if run.ai_status == "complete":
        return SectionStatusOut(status="complete", data=run.resume_issues_json or {})
    return SectionStatusOut(status="failed")


@router.get("/runs/{run_id}/action-plan", response_model=SectionStatusOut)
@require_permission("VIEW_CAREER")
def get_run_action_plan(
    run_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return the action plan, respecting AI processing status."""
    run = career_crud.get_run(db, run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Run not found"
        )
    _assert_owns_run(run, current_user)
    if run.ai_status in {"pending", "running"}:
        return SectionStatusOut(status=run.ai_status)
    if run.ai_status == "complete":
        return SectionStatusOut(status="complete", data=run.action_plan_json or {})
    return SectionStatusOut(status="failed")


# ── Skill search & ensure ──────────────────────────────────────────────────────


@router.get("/skills/search", response_model=List[SkillSearchItem])
@require_permission("VIEW_CAREER")
def search_skills(
    q: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Full-text search of skills by name. Returns [{id, name}]."""
    # Match names across all languages, but deduplicate by skill id and prefer
    # the default-language name (ORDER BY is_default DESC before DISTINCT ON).
    stmt = (
        select(Skill.id, SkillText.name)
        .join(SkillText, SkillText.skill_id == Skill.id)
        .join(Language, Language.id == SkillText.language_id)
        .where(SkillText.name.ilike(f"%{q}%"))
        .order_by(Skill.id, Language.is_default.desc())
        .distinct(Skill.id)
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [{"id": row[0], "name": row[1] or f"Skill {row[0]}"} for row in rows]


@router.post("/skills/ensure", response_model=SkillEnsureOut, status_code=status.HTTP_200_OK)
@require_permission("MANAGE_CAREER")
def ensure_skill(
    data: SkillEnsureRequest,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Find an existing skill by name (case-insensitive) or create it.

    Returns {id, name, created}.
    """
    # Try to find existing skill with this name
    row = db.execute(
        select(Skill.id, SkillText.name)
        .join(SkillText, SkillText.skill_id == Skill.id)
        .where(SkillText.name.ilike(data.name.strip()))
        .limit(1)
    ).first()

    if row:
        return {"id": row[0], "name": row[1], "created": False}

    # Get default language (first available)
    lang = db.execute(select(Language.id).limit(1)).scalar_one_or_none()
    if lang is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No languages configured — cannot create skill",
        )

    # Create new skill
    skill = Skill(type="hard", created_by=current_user.id, updated_by=current_user.id)
    db.add(skill)
    db.flush()
    skill_text = SkillText(
        skill_id=skill.id,
        language_id=lang,
        name=data.name.strip(),
        description="",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(skill_text)
    db.commit()
    return {"id": skill.id, "name": data.name.strip(), "created": True}


# ── Pre-run readiness check ────────────────────────────────────────────────────


@router.get("/objectives/{objective_id}/run-readiness", response_model=RunReadinessOut)
@require_permission("VIEW_CAREER")
def get_run_readiness(
    objective_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return a readiness checklist for running an assessment on an objective."""
    from app.core.config import settings as _settings

    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found")

    checks: list[dict] = []

    # 1. Objective has linked jobs
    has_jobs = len(obj.jobs or []) > 0
    checks.append({
        "key": "has_jobs",
        "label": "Objective has at least one linked job",
        "passed": has_jobs,
        "detail": None if has_jobs else "Link at least one job to this objective before running.",
    })

    # 2. All linked jobs have at least one required skill
    jobs_missing_skills = [j.title for j in (obj.jobs or []) if not j.skills]
    checks.append({
        "key": "jobs_have_skills",
        "label": "All jobs have required skills defined",
        "passed": len(jobs_missing_skills) == 0,
        "detail": (
            None
            if not jobs_missing_skills
            else f"Missing skills on: {', '.join(jobs_missing_skills)}"
        ),
    })

    # 3. Anthropic API key configured
    api_key_ok = bool(_settings.ANTHROPIC_API_KEY)
    checks.append({
        "key": "api_key_configured",
        "label": "Anthropic API key is configured",
        "passed": api_key_ok,
        "detail": None if api_key_ok else "Set ANTHROPIC_API_KEY in the backend environment.",
    })

    # 4. Celery enabled (advisory only — not blocking)
    celery_ok = _celery_is_enabled()
    checks.append({
        "key": "celery_enabled",
        "label": "AI processing queue (Celery) is running",
        "passed": celery_ok,
        "detail": None if celery_ok else "AI analysis will be queued but won't run until Celery is started.",
    })

    # Ready = first 3 checks must pass (Celery is advisory)
    ready = all(c["passed"] for c in checks[:3])
    return RunReadinessOut(ready=ready, checks=[ReadinessCheck(**c) for c in checks])


# ── AI Diagnostics ─────────────────────────────────────────────────────────────


@router.post("/diagnostics/anthropic", response_model=AnthropicDiagnosticsOut)
@require_permission("VIEW_CAREER")
def test_anthropic_connectivity(
    current_user: models.User = Depends(deps.get_current_user),
):
    """Send a minimal test message to Anthropic and return latency/status."""
    import time as _time
    from app.core.config import settings as _settings
    from app.services.llm.providers import AnthropicProvider, ProviderConfig

    if not _settings.ANTHROPIC_API_KEY:
        return {
            "success": False,
            "error": "ANTHROPIC_API_KEY is not configured",
            "latency_ms": None,
        }

    started = _time.time()
    try:
        provider = AnthropicProvider(
            ProviderConfig(name="anthropic", api_key=_settings.ANTHROPIC_API_KEY)
        )
        result = provider.chat(
            model="claude-haiku-4-5-20251001",
            system_prompt="You are a test assistant. Reply with exactly: OK",
            messages=[{"role": "user", "content": "ping"}],
        )
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": True,
            "response": result["text"][:100],
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": False,
            "error": str(exc),
            "latency_ms": latency_ms,
        }


@router.post("/diagnostics/career-provider", response_model=ProviderDiagnosticsOut)
@require_permission("VIEW_CAREER")
def test_career_provider_connectivity(
    current_user: models.User = Depends(deps.get_current_user),
):
    """Test connectivity to the configured career AI provider (CAREER_AI_* settings)."""
    import time as _time
    from app.core.config import settings as _settings
    from app.services.llm.providers import build_provider

    provider_name = _settings.CAREER_AI_PROVIDER or "anthropic"
    model = _settings.CAREER_AI_MODEL or "claude-haiku-4-5-20251001"
    api_key = _settings.CAREER_AI_API_KEY or _settings.ANTHROPIC_API_KEY
    base_url = _settings.CAREER_AI_BASE_URL or None

    if not api_key:
        return {
            "provider": provider_name,
            "model": model,
            "success": False,
            "error": "No API key configured (CAREER_AI_API_KEY / ANTHROPIC_API_KEY)",
        }

    started = _time.time()
    try:
        provider = build_provider(provider_name, api_key=api_key, base_url=base_url)
        result = provider.chat(
            model=model,
            system_prompt="You are a test assistant. Reply with exactly: OK",
            messages=[{"role": "user", "content": "ping"}],
        )
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "provider": provider_name,
            "model": model,
            "success": True,
            "response": result["text"][:100],
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "provider": provider_name,
            "model": model,
            "success": False,
            "error": str(exc),
            "latency_ms": latency_ms,
        }
