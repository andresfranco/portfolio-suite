"""Career Operating System — API endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import models
from app.api import deps
from app.core.security_decorators import permission_checker, require_permission
from app.crud import career as career_crud
from app.queue.tasks.career import run_career_ai_assessment
from app.schemas.career import (
    AssessmentRunCreate,
    AssessmentRunOut,
    CareerJobCreate,
    CareerJobOut,
    CareerJobSkillsUpdate,
    CareerJobUpdate,
    CareerObjectiveCreate,
    CareerObjectiveOut,
    CareerObjectiveUpdate,
    SectionStatusOut,
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


# ── Job endpoints ─────────────────────────────────────────────────────────────


@router.post("/jobs", response_model=CareerJobOut, status_code=status.HTTP_201_CREATED)
@require_permission("VIEW_CAREER")
def create_job(
    data: CareerJobCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Create a new career job."""
    return career_crud.create_job(db, data, current_user.id)


@router.get("/jobs", response_model=dict)
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
    return {"items": items, "total": total}


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
    return career_crud.update_job(db, job, data, current_user.id)


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
    return career_crud.replace_job_skills(db, job, data.skills)


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


@router.get("/objectives", response_model=dict)
@require_permission("VIEW_CAREER")
def list_objectives(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """List career objectives."""
    items, total = career_crud.list_objectives(db, limit=limit, offset=offset)
    return {"items": items, "total": total}


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
    return career_crud.get_objective(db, objective_id)


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
    task = run_career_ai_assessment.delay(run.id)
    career_crud.update_run_ai_status(db, run.id, "pending", str(task.id))
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
