from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Job schemas ───────────────────────────────────────────────────────────────

class CareerJobSkillItem(BaseModel):
    skill_id: int
    years_required: Optional[int] = None
    is_required: bool = True


class CareerJobSkillOut(CareerJobSkillItem):
    id: int
    name: Optional[str] = None
    model_config = {"from_attributes": True}


class CareerJobCreate(BaseModel):
    title: str
    company: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: str = "USD"
    location: Optional[str] = None
    is_remote: bool = False
    url: Optional[str] = None
    description: Optional[str] = None
    status: str = "saved"
    notes: Optional[str] = None


class CareerJobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: Optional[str] = None
    location: Optional[str] = None
    is_remote: Optional[bool] = None
    url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CareerJobSkillsUpdate(BaseModel):
    skills: List[CareerJobSkillItem]


class CareerJobOut(BaseModel):
    id: int
    title: str
    company: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    currency: str
    location: Optional[str]
    is_remote: bool
    url: Optional[str]
    description: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: int
    skills: List[CareerJobSkillOut] = []
    model_config = {"from_attributes": True}


# ── Objective schemas ─────────────────────────────────────────────────────────

class CareerObjectiveCreate(BaseModel):
    portfolio_id: int
    name: str = "Career Growth"
    description: Optional[str] = None
    status: str = "active"


class CareerObjectiveUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class CareerObjectiveOut(BaseModel):
    id: int
    portfolio_id: int
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: int
    jobs: List[CareerJobOut] = []
    model_config = {"from_attributes": True}


# ── Assessment run schemas ────────────────────────────────────────────────────

class AssessmentRunCreate(BaseModel):
    job_ids: List[int]
    resume_attachment_id: Optional[int] = None
    name: Optional[str] = None


class AssessmentRunOut(BaseModel):
    id: int
    objective_id: int
    portfolio_id: int
    resume_attachment_id: Optional[int]
    name: Optional[str]
    scorecard_json: Optional[dict]
    job_fit_json: Optional[dict]
    resume_issues_json: Optional[dict]
    action_plan_json: Optional[dict]
    ai_status: str
    ai_task_id: Optional[str]
    created_at: datetime
    created_by: int
    model_config = {"from_attributes": True}


class SectionStatusOut(BaseModel):
    """Returned by section endpoints when AI data is pending."""
    status: str  # "pending" | "running" | "complete" | "failed"
    data: Optional[dict] = None


# ── Paginated list schemas ────────────────────────────────────────────────────

class CareerJobListOut(BaseModel):
    items: List[CareerJobOut]
    total: int


class CareerObjectiveListOut(BaseModel):
    items: List[CareerObjectiveOut]
    total: int


# ── Skill search / ensure schemas ─────────────────────────────────────────────

class SkillEnsureRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class SkillSearchItem(BaseModel):
    id: int
    name: str


class SkillEnsureOut(BaseModel):
    id: int
    name: str
    created: bool


class AnthropicDiagnosticsOut(BaseModel):
    success: bool
    latency_ms: Optional[int] = None
    response: Optional[str] = None
    error: Optional[str] = None


# ── Pre-run readiness schemas ──────────────────────────────────────────────────

class ReadinessCheck(BaseModel):
    key: str
    label: str
    passed: bool
    detail: Optional[str] = None


class RunReadinessOut(BaseModel):
    ready: bool
    checks: List[ReadinessCheck]
