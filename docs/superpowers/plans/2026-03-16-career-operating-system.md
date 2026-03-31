# Career Operating System — Implementation Plan

**Date:** 2026-03-16
**Spec:** `docs/superpowers/specs/2026-03-16-career-operating-system-design.md`
**Branch:** `dev` (all work here; PR to `test` when done)
**Approach:** Hybrid analysis engine — rule-based (synchronous) + AI narrative (Celery)

---

## Chunks Overview

| # | Name | Files | Key risk |
|---|------|-------|----------|
| 1 | Backend Models + Migration + Permissions | 5 | Migration chain correctness |
| 2 | Backend Schemas + CRUD | 2 | Ownership-scoped queries |
| 3 | Scoring Engine (TDD) | 2 | Scoring formula parity with spec |
| 4 | Career Service + Celery Task | 3 | AI call error handling, ai_status always written |
| 5 | API Endpoints + Integration Tests | 3 | Ownership checks, 85% coverage gate |
| 6 | Frontend Foundation | 5 | Polling loop max-duration guard |
| 7 | Frontend Pages | 8 | Progressive section loading UX |

---

## Chunk 1 — Backend Models + Migration + Permissions

### Purpose
Create the six new database tables, wire models into SQLAlchemy Base, add `ANTHROPIC_API_KEY` to config, seed the two new permissions, and extend the frontend authorization map.

### Files

#### 1a. `portfolio-backend/app/models/career.py` (NEW)

```python
"""SQLAlchemy ORM models for the Career Operating System module."""
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

# ── Association tables (no ORM class needed) ──────────────────────────────────

career_objective_job = Table(
    "career_objective_job",
    Base.metadata,
    Column("objective_id", Integer, ForeignKey("career_objective.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id",       Integer, ForeignKey("career_job.id",       ondelete="CASCADE"), primary_key=True),
    Column("added_at",     DateTime, default=datetime.utcnow),
)

career_assessment_run_job = Table(
    "career_assessment_run_job",
    Base.metadata,
    Column("run_id", Integer, ForeignKey("career_assessment_run.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id", Integer, ForeignKey("career_job.id",            ondelete="CASCADE"), primary_key=True),
)


# ── Core models ───────────────────────────────────────────────────────────────

class CareerObjective(Base):
    __tablename__ = "career_objective"

    id           = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String(255), nullable=False, default="Career Growth")
    description  = Column(Text, nullable=True)
    status       = Column(String(50), nullable=False, default="active")   # active | archived
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by   = Column(Integer, nullable=False)
    updated_by   = Column(Integer, nullable=False)

    portfolio = relationship("Portfolio", backref="career_objectives")
    jobs      = relationship("CareerJob", secondary=career_objective_job, back_populates="objectives")
    runs      = relationship("CareerAssessmentRun", back_populates="objective", cascade="all, delete-orphan")


class CareerJob(Base):
    __tablename__ = "career_job"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(255), nullable=False)
    company     = Column(String(255), nullable=False)
    salary_min  = Column(Integer, nullable=True)
    salary_max  = Column(Integer, nullable=True)
    currency    = Column(String(10), nullable=False, default="USD")
    location    = Column(String(255), nullable=True)
    is_remote   = Column(Boolean, nullable=False, default=False)
    url         = Column(String(2048), nullable=True)
    description = Column(Text, nullable=True)
    status      = Column(String(50), nullable=False, default="saved")  # saved|applied|interviewing|offer|rejected
    notes       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by  = Column(Integer, nullable=False)
    updated_by  = Column(Integer, nullable=False)

    skills     = relationship("CareerJobSkill", back_populates="job", cascade="all, delete-orphan")
    objectives = relationship("CareerObjective", secondary=career_objective_job, back_populates="jobs")


class CareerJobSkill(Base):
    __tablename__ = "career_job_skill"

    id             = Column(Integer, primary_key=True, index=True)
    job_id         = Column(Integer, ForeignKey("career_job.id", ondelete="CASCADE"), nullable=False, index=True)
    skill_id       = Column(Integer, ForeignKey("skills.id",     ondelete="CASCADE"), nullable=False)
    years_required = Column(Integer, nullable=True)
    is_required    = Column(Boolean, nullable=False, default=True)

    job   = relationship("CareerJob", back_populates="skills")
    skill = relationship("Skill")


class CareerAssessmentRun(Base):
    __tablename__ = "career_assessment_run"

    id                   = Column(Integer, primary_key=True, index=True)
    objective_id         = Column(Integer, ForeignKey("career_objective.id",     ondelete="CASCADE"), nullable=False, index=True)
    portfolio_id         = Column(Integer, ForeignKey("portfolios.id",           ondelete="CASCADE"), nullable=False)
    resume_attachment_id = Column(Integer, ForeignKey("portfolio_attachments.id", ondelete="SET NULL"), nullable=True)
    name                 = Column(String(255), nullable=True)
    scorecard_json       = Column(JSONB, nullable=True)
    job_fit_json         = Column(JSONB, nullable=True)
    resume_issues_json   = Column(JSONB, nullable=True)
    action_plan_json     = Column(JSONB, nullable=True)
    ai_status            = Column(String(20), nullable=False, default="pending")  # pending|running|complete|failed
    ai_task_id           = Column(String(255), nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by           = Column(Integer, nullable=False)

    objective = relationship("CareerObjective", back_populates="runs")
    jobs      = relationship("CareerJob", secondary=career_assessment_run_job)
```

#### 1b. `portfolio-backend/app/models/__init__.py` (EDIT)

Add import at the end of the file (after all existing imports):
```python
from app.models import career  # noqa: F401 — registers Career OS models with Base.metadata
```

#### 1c. `portfolio-backend/alembic/versions/add_career_os_tables.py` (NEW)

```python
"""add_career_os_tables

Revision ID: c1d2e3f4g5h6
Revises: b2c3d4e5f6g7
Create Date: 2026-03-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c1d2e3f4g5h6'
down_revision = 'b2c3d4e5f6g7'   # ← run `alembic heads` to confirm before executing
branch_labels = None
depends_on = None


def upgrade() -> None:
    # career_objective
    op.create_table(
        'career_objective',
        sa.Column('id',           sa.Integer(),     primary_key=True),
        sa.Column('portfolio_id', sa.Integer(),     sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name',         sa.String(255),   nullable=False, server_default='Career Growth'),
        sa.Column('description',  sa.Text(),        nullable=True),
        sa.Column('status',       sa.String(50),    nullable=False, server_default='active'),
        sa.Column('created_at',   sa.DateTime(),    server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',   sa.DateTime(),    server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',   sa.Integer(),     nullable=False),
        sa.Column('updated_by',   sa.Integer(),     nullable=False),
    )
    op.create_index('ix_career_objective_portfolio_id', 'career_objective', ['portfolio_id'])

    # career_job
    op.create_table(
        'career_job',
        sa.Column('id',          sa.Integer(),    primary_key=True),
        sa.Column('title',       sa.String(255),  nullable=False),
        sa.Column('company',     sa.String(255),  nullable=False),
        sa.Column('salary_min',  sa.Integer(),    nullable=True),
        sa.Column('salary_max',  sa.Integer(),    nullable=True),
        sa.Column('currency',    sa.String(10),   nullable=False, server_default='USD'),
        sa.Column('location',    sa.String(255),  nullable=True),
        sa.Column('is_remote',   sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('url',         sa.String(2048), nullable=True),
        sa.Column('description', sa.Text(),       nullable=True),
        sa.Column('status',      sa.String(50),   nullable=False, server_default='saved'),
        sa.Column('notes',       sa.Text(),       nullable=True),
        sa.Column('created_at',  sa.DateTime(),   server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',  sa.DateTime(),   server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',  sa.Integer(),    nullable=False),
        sa.Column('updated_by',  sa.Integer(),    nullable=False),
    )

    # career_job_skill
    op.create_table(
        'career_job_skill',
        sa.Column('id',             sa.Integer(), primary_key=True),
        sa.Column('job_id',         sa.Integer(), sa.ForeignKey('career_job.id', ondelete='CASCADE'), nullable=False),
        sa.Column('skill_id',       sa.Integer(), sa.ForeignKey('skills.id',     ondelete='CASCADE'), nullable=False),
        sa.Column('years_required', sa.Integer(), nullable=True),
        sa.Column('is_required',    sa.Boolean(), nullable=False, server_default='true'),
    )
    op.create_index('ix_career_job_skill_job_id', 'career_job_skill', ['job_id'])

    # career_objective_job (M2M)
    op.create_table(
        'career_objective_job',
        sa.Column('objective_id', sa.Integer(), sa.ForeignKey('career_objective.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('job_id',       sa.Integer(), sa.ForeignKey('career_job.id',       ondelete='CASCADE'), primary_key=True),
        sa.Column('added_at',     sa.DateTime(), server_default=sa.text('NOW()')),
    )

    # career_assessment_run
    op.create_table(
        'career_assessment_run',
        sa.Column('id',                   sa.Integer(),    primary_key=True),
        sa.Column('objective_id',         sa.Integer(),    sa.ForeignKey('career_objective.id',      ondelete='CASCADE'),   nullable=False),
        sa.Column('portfolio_id',         sa.Integer(),    sa.ForeignKey('portfolios.id',            ondelete='CASCADE'),   nullable=False),
        sa.Column('resume_attachment_id', sa.Integer(),    sa.ForeignKey('portfolio_attachments.id', ondelete='SET NULL'),  nullable=True),
        sa.Column('name',                 sa.String(255),  nullable=True),
        sa.Column('scorecard_json',       postgresql.JSONB(), nullable=True),
        sa.Column('job_fit_json',         postgresql.JSONB(), nullable=True),
        sa.Column('resume_issues_json',   postgresql.JSONB(), nullable=True),
        sa.Column('action_plan_json',     postgresql.JSONB(), nullable=True),
        sa.Column('ai_status',            sa.String(20),   nullable=False, server_default='pending'),
        sa.Column('ai_task_id',           sa.String(255),  nullable=True),
        sa.Column('created_at',           sa.DateTime(),   server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',           sa.Integer(),    nullable=False),
    )
    op.create_index('ix_career_assessment_run_objective_id', 'career_assessment_run', ['objective_id'])

    # career_assessment_run_job (M2M snapshot)
    op.create_table(
        'career_assessment_run_job',
        sa.Column('run_id', sa.Integer(), sa.ForeignKey('career_assessment_run.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('job_id', sa.Integer(), sa.ForeignKey('career_job.id',            ondelete='CASCADE'), primary_key=True),
    )

    # Seed new RBAC permissions
    op.execute("""
        INSERT INTO permissions (name, description)
        VALUES
            ('VIEW_CAREER',   'View career objectives, jobs, and assessment runs'),
            ('MANAGE_CAREER', 'Create and manage career objectives, jobs, and assessment runs')
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM permissions WHERE name IN ('VIEW_CAREER', 'MANAGE_CAREER')")
    op.drop_table('career_assessment_run_job')
    op.drop_table('career_assessment_run')
    op.drop_table('career_objective_job')
    op.drop_table('career_job_skill')
    op.drop_table('career_job')
    op.drop_table('career_objective')
```

> **Before running:** confirm `down_revision` with `alembic heads` in the activated venv. Update if the head differs from `b2c3d4e5f6g7`.

#### 1d. `portfolio-backend/app/core/config.py` (EDIT)

Add one field to the `Settings` class:
```python
ANTHROPIC_API_KEY: str = ""
```
This is read from the environment variable `ANTHROPIC_API_KEY`. The Celery task will access it via `settings.ANTHROPIC_API_KEY`.

#### 1e. `backend-ui/src/contexts/AuthorizationContext.js` (EDIT)

Two additions:

**In `MODULE_PERMISSIONS` object** — add:
```js
'career': ['VIEW_CAREER', 'MANAGE_CAREER'],
```

**In `managePermissions` object** — add:
```js
'MANAGE_CAREER': ['VIEW_CAREER', 'MANAGE_CAREER'],
```

### Verification
```bash
cd portfolio-backend && source venv/bin/activate
alembic heads           # confirm single current head
alembic upgrade head    # apply migration
alembic current         # confirm c1d2e3f4g5h6 is current
python -c "from app.models.career import CareerObjective; print('OK')"
```

---

## Chunk 2 — Backend Schemas + CRUD

### Purpose
Define all Pydantic request/response models and the repository layer (data access only — no business logic).

### Files

#### 2a. `portfolio-backend/app/schemas/career.py` (NEW)

```python
from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


# ── Job schemas ───────────────────────────────────────────────────────────────

class CareerJobSkillItem(BaseModel):
    skill_id: int
    years_required: Optional[int] = None
    is_required: bool = True

class CareerJobSkillOut(CareerJobSkillItem):
    id: int
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
    """Returned by section-specific endpoints when AI data is pending."""
    status: str   # "pending" | "running" | "complete" | "failed"
    data: Optional[dict] = None
```

#### 2b. `portfolio-backend/app/crud/career.py` (NEW)

Implement these async functions (all accept `db: AsyncSession`):

```python
# Jobs
async def create_job(db, data: CareerJobCreate, user_id: int) -> CareerJob
async def get_job(db, job_id: int) -> CareerJob | None
async def list_jobs(db, *, limit=50, offset=0, status=None, company=None) -> tuple[list[CareerJob], int]
async def update_job(db, job: CareerJob, data: CareerJobUpdate, user_id: int) -> CareerJob
async def delete_job(db, job: CareerJob) -> None
async def replace_job_skills(db, job: CareerJob, skills: list[CareerJobSkillItem]) -> CareerJob

# Objectives
async def create_objective(db, data: CareerObjectiveCreate, user_id: int) -> CareerObjective
async def get_objective(db, objective_id: int) -> CareerObjective | None
async def list_objectives(db, *, limit=50, offset=0) -> tuple[list[CareerObjective], int]
async def update_objective(db, obj: CareerObjective, data: CareerObjectiveUpdate, user_id: int) -> CareerObjective
async def delete_objective(db, obj: CareerObjective) -> None
async def link_job_to_objective(db, obj: CareerObjective, job: CareerJob) -> None
async def unlink_job_from_objective(db, obj: CareerObjective, job: CareerJob) -> None

# Assessment runs
async def create_run(db, objective: CareerObjective, data: AssessmentRunCreate, user_id: int) -> CareerAssessmentRun
    # Creates run record with ai_status="pending", links job_ids via career_assessment_run_job
async def get_run(db, run_id: int) -> CareerAssessmentRun | None
async def list_runs(db, objective_id: int) -> list[CareerAssessmentRun]
async def update_run_sync_data(db, run: CareerAssessmentRun, scorecard_json: dict, job_fit_json: dict) -> None
async def update_run_ai_data(db, run_id: int, *, resume_issues: dict, action_plan: dict, ai_status: str) -> None
async def update_run_ai_status(db, run_id: int, ai_status: str, ai_task_id: str | None = None) -> None
```

**Key implementation notes for CRUD:**
- `list_jobs` / `list_objectives`: use `select(func.count()).select_from(Model)` for total count, then separate paginated query
- `create_run`: validate `len(data.job_ids) > 0` — raise `ValueError("No jobs selected")` if empty (endpoint converts to HTTP 400)
- `replace_job_skills`: delete all existing `CareerJobSkill` for the job, then insert new ones in one operation
- `link_job_to_objective`: INSERT INTO `career_objective_job` via `op.execute` or direct insert — check for existing link first (idempotent)
- `update_run_ai_data` / `update_run_ai_status`: use direct UPDATE statement (not ORM load) to avoid session issues from Celery worker context

---

## Chunk 3 — Scoring Engine (TDD)

### Purpose
Pure functions for the rule-based analysis. Written test-first per the TDD skill.

### Files

#### 3a. `portfolio-backend/tests/unit/test_career_scoring.py` (NEW — write FIRST)

Write failing tests that specify exact scoring behavior from the spec:

```python
# Test cases that MUST pass after implementation:

# --- compute_skill_level ---
# level 5: 4+ projects AND total_experience_years >= 5
test_skill_level_5_four_projects_five_years()    # expect 5
test_skill_level_4_three_projects_three_years()  # expect 4
test_skill_level_3_three_projects_zero_years()   # expect 3
test_skill_level_2_two_projects()                # expect 2
test_skill_level_1_one_project()                 # expect 1
test_skill_level_0_no_projects()                 # expect 0

# --- assign_priority ---
test_priority_critical_level0_required()         # CRITICAL
test_priority_high_level0_optional()             # HIGH
test_priority_high_level1_required()             # HIGH
test_priority_medium_level2()                    # MEDIUM
test_priority_medium_level3()                    # MEDIUM
test_priority_low_level4()                       # LOW
test_priority_low_level5()                       # LOW

# --- compute_job_fit ---
# formula: (2*matched_required + matched_optional) / (2*total_required + total_optional) * 100
test_fit_score_all_required_matched()            # 100.0
test_fit_score_no_required_matched()             # 0.0
test_fit_score_mixed_required_optional()         # exact float
test_fit_score_no_skills_in_job()               # 100.0 (no requirements = no gaps)
test_fit_verdict_best_fit()                      # score >= 60 → "BEST FIT"
test_fit_verdict_stretch()                       # 40 <= score < 60 → "STRETCH"
test_fit_verdict_aspirational()                  # score < 40 → "ASPIRATIONAL"

# --- compute_scorecard ---
# Input: list of {skill_id, is_required, project_names}, total_experience_years
# Output: list of skill scorecard items with level, priority, evidence, gap
test_scorecard_evidence_text()                   # comma-separated project names
test_scorecard_gap_text_level_0()               # "Required but not found in any project"
test_scorecard_gap_text_levels_1_to_3()        # "Found in N project(s); target level for this role is 4+"

# --- compute_overall_readiness ---
test_readiness_average_of_job_fits()             # simple average
test_readiness_empty_jobs()                      # 0.0
```

All tests use pure Python data structures — NO database, NO fixtures.

#### 3b. `portfolio-backend/app/services/career_scoring.py` (NEW — write AFTER tests pass)

```python
"""Pure rule-based scoring functions for the Career OS analysis engine.

All functions are synchronous and dependency-free (no DB, no I/O).
Input data is passed as plain dicts/lists pre-fetched by the service layer.
"""
from typing import TypedDict


class SkillEvidence(TypedDict):
    skill_id: int
    skill_name: str
    project_names: list[str]   # projects in this portfolio that include this skill
    is_required: bool
    years_required: int | None


class ScorecardItem(TypedDict):
    skill_id: int
    skill_name: str
    level: int          # 0–5
    priority: str       # CRITICAL | HIGH | MEDIUM | LOW
    evidence: str       # comma-separated project names, "" if level=0
    gap: str            # gap description; "" if level >= 4


class JobFitResult(TypedDict):
    job_id: int
    job_title: str
    fit_score: float    # 0.0–100.0
    verdict: str        # BEST FIT | STRETCH | ASPIRATIONAL
    scorecard: list[ScorecardItem]


def compute_skill_level(project_count: int, total_experience_years: int) -> int:
    """Evaluate top-to-bottom, first match wins (spec §Analysis Engine)."""
    ...

def assign_priority(level: int, is_required: bool) -> str:
    """Evaluate top-to-bottom, first match wins."""
    ...

def compute_gap_text(level: int, project_count: int) -> str:
    ...

def compute_scorecard(
    skill_evidences: list[SkillEvidence],
    total_experience_years: int,
) -> list[ScorecardItem]:
    ...

def compute_job_fit(scorecard: list[ScorecardItem]) -> tuple[float, str]:
    """Returns (fit_score, verdict). Handles zero-skill edge case."""
    ...

def compute_overall_readiness(job_fits: list[JobFitResult]) -> float:
    """Simple average of per-job fit scores; returns 0.0 for empty list."""
    ...
```

### Run tests
```bash
cd portfolio-backend && source venv/bin/activate
pytest tests/unit/test_career_scoring.py -v --tb=short
```
All tests must be green before moving to Chunk 4.

---

## Chunk 4 — Career Service + Celery Task

### Purpose
Orchestrate DB queries + scoring engine, and implement the async AI assessment Celery task.

### Files

#### 4a. `portfolio-backend/app/services/career_service.py` (NEW)

```python
"""Career OS service layer — orchestrates DB fetching and scoring engine."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.career import get_run, update_run_sync_data
from app.services.career_scoring import (
    compute_scorecard, compute_job_fit, compute_overall_readiness, SkillEvidence
)


async def fetch_portfolio_skill_evidence(
    db: AsyncSession, portfolio_id: int, skill_ids: list[int]
) -> tuple[list[SkillEvidence], int]:
    """
    Returns (skill_evidence_list, total_experience_years).

    Query pattern:
    1. Get all projects linked to portfolio_id (via portfolio_projects association or Portfolio.projects)
    2. For each skill_id, count how many of those projects include it (via project_skills table)
       and collect project names
    3. Get total experience years: sum(e.years) for all experiences linked to this portfolio
       (via portfolio_experiences table, join to experiences)
    """
    ...

async def compute_and_store_sync_sections(
    db: AsyncSession,
    run_id: int,
    objective_id: int,
    portfolio_id: int,
) -> None:
    """
    Called immediately after run creation (synchronous path).
    1. Load run with its jobs (career_assessment_run_job → career_job → career_job_skill)
    2. Collect all unique skill_ids across all jobs in the run
    3. fetch_portfolio_skill_evidence()
    4. For each job: compute_scorecard() + compute_job_fit() → build job_fit entry
    5. Build scorecard_json and job_fit_json dicts
    6. update_run_sync_data(db, run, scorecard_json, job_fit_json)
    """
    ...

def build_ai_context(
    *,
    portfolio_name: str,
    project_summaries: list[dict],    # [{name, skills: [skill_name]}]
    experience_summaries: list[dict], # [{name, years}]
    resume_filename: str | None,
    objective_name: str,
    job_summaries: list[dict],        # [{title, company, description, required_skills: [name]}]
    scorecard_json: dict,
) -> str:
    """
    Builds the context string sent to Haiku. Returns a compact text block.
    Include: portfolio name, projects+skills, experiences, resume filename hint,
    objective name, job titles+descriptions+required skills, scorecard summary.
    """
    ...
```

**`scorecard_json` structure:**
```json
{
  "overall_readiness": 72.5,
  "skills": [
    {
      "skill_id": 1, "skill_name": "Python", "level": 4,
      "priority": "LOW", "evidence": "Project A, Project B",
      "gap": ""
    }
  ]
}
```

**`job_fit_json` structure:**
```json
{
  "jobs": [
    {
      "job_id": 1, "job_title": "Backend Engineer", "company": "Acme",
      "fit_score": 72.5, "verdict": "BEST FIT",
      "scorecard": [...]
    }
  ]
}
```

#### 4b. `portfolio-backend/app/queue/tasks/career.py` (NEW)

> **Note:** The current `tasks.py` is a single flat file. Create a `tasks/` subdirectory alongside it, or add this as a new module. Verify `celery_app.py` autodiscovery config — if it uses `include=["app.queue.tasks"]`, rename to `app.queue.tasks.main` and add `app.queue.tasks.career`. If autodiscovery uses `app.queue.tasks` as a package, create `app/queue/tasks/__init__.py` and `app/queue/tasks/career.py`.

```python
"""Celery task: AI assessment sections for a Career OS run."""
import json
import logging
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from app.core.config import settings
from app.core.database import SyncSessionLocal   # sync session for Celery workers
from app.crud.career import (
    get_run_sync, update_run_ai_data, update_run_ai_status
)
from app.services.career_service import build_ai_context
from app.services.llm.providers import AnthropicProvider, ProviderConfig
from app.queue.celery_app import celery_app

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"

SYSTEM_PROMPT = """You are a career coach AI. Given a portfolio summary and job descriptions,
return ONLY valid JSON with this exact schema — no prose, no markdown:
{
  "resume_issues": [
    { "issue": "string", "impact": "CRITICAL|HIGH|MEDIUM|LOW", "fix": "string" }
  ],
  "action_plan": [
    { "week_range": "string", "focus": "string", "tasks": ["string"], "hours": "string" }
  ]
}
Identify resume issues based on skill gaps. Generate a 12-week prioritised action plan
addressing CRITICAL and HIGH gaps first."""


@celery_app.task(
    name="app.queue.tasks.career.run_career_ai_assessment",
    bind=True,
    max_retries=0,
    task_time_limit=60,
    task_soft_time_limit=50,
)
def run_career_ai_assessment(self: Task, run_id: int) -> None:
    """
    1. Load run from DB (sync session)
    2. Load related objective, portfolio, jobs with skills, attachments
    3. build_ai_context()
    4. Call Haiku with SYSTEM_PROMPT
    5. Parse JSON response → resume_issues, action_plan
    6. update_run_ai_data() → ai_status="complete"
    If ANY exception: update_run_ai_status(run_id, "failed") in finally block
    """
    with SyncSessionLocal() as db:
        try:
            update_run_ai_status_sync(db, run_id, "running")

            # Load context data
            run = get_run_sync(db, run_id)
            if not run:
                return

            context = build_ai_context_from_run_sync(db, run)

            # Call Haiku
            provider = AnthropicProvider(
                ProviderConfig(name="anthropic", api_key=settings.ANTHROPIC_API_KEY)
            )
            result = provider.chat(
                model=HAIKU_MODEL,
                system_prompt=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            )

            # Parse response
            payload = json.loads(result["text"])
            resume_issues = {"issues": payload.get("resume_issues", [])}
            action_plan   = {"plan":   payload.get("action_plan",   [])}

            update_run_ai_data_sync(db, run_id,
                resume_issues=resume_issues,
                action_plan=action_plan,
                ai_status="complete",
            )

        except SoftTimeLimitExceeded:
            logger.error("Career AI task %s timed out for run_id=%d", self.request.id, run_id)
            update_run_ai_status_sync(db, run_id, "failed")
        except Exception:
            logger.exception("Career AI task failed for run_id=%d", run_id)
            update_run_ai_status_sync(db, run_id, "failed")
```

> **Sync helper note:** The Celery task uses a **synchronous** SQLAlchemy session (`SyncSessionLocal`). The career CRUD functions used inside the task must have `_sync` variants (or the main CRUD functions must be sync-compatible). Add `get_run_sync`, `update_run_ai_data_sync`, `update_run_ai_status_sync` to `crud/career.py` — these mirror the async versions but use a `Session` instead of `AsyncSession`.
>
> Check if `SyncSessionLocal` already exists in `app/core/database.py` (used by other Celery tasks). If not, add it:
> ```python
> from sqlalchemy import create_engine
> from sqlalchemy.orm import sessionmaker
> SyncSessionLocal = sessionmaker(
>     autocommit=False, autoflush=False,
>     bind=create_engine(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
> )
> ```

#### 4c. Celery autodiscovery fix

Check `portfolio-backend/app/queue/celery_app.py` for the `include` list. Add `"app.queue.tasks.career"` (or the equivalent module path). If `tasks.py` must be converted to a package, rename it first:

```bash
# Only if tasks.py is a single file:
mv app/queue/tasks.py app/queue/tasks_main.py
mkdir app/queue/tasks
mv app/queue/tasks_main.py app/queue/tasks/main.py
touch app/queue/tasks/__init__.py
# then create app/queue/tasks/career.py
```

---

## Chunk 5 — API Endpoints + Integration Tests

### Purpose
Expose all Career OS endpoints and verify them with integration tests against a real database.

### Files

#### 5a. `portfolio-backend/app/api/endpoints/career.py` (NEW)

One router file with all career routes. Group by tag:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core.security_decorators import require_permission
from app.schemas.career import (
    CareerJobCreate, CareerJobUpdate, CareerJobSkillsUpdate, CareerJobOut,
    CareerObjectiveCreate, CareerObjectiveUpdate, CareerObjectiveOut,
    AssessmentRunCreate, AssessmentRunOut, SectionStatusOut,
)
from app.crud import career as career_crud
from app.services.career_service import compute_and_store_sync_sections
from app.queue.tasks.career import run_career_ai_assessment

router = APIRouter()

# ── HELPER: ownership check ───────────────────────────────────────────────────
def _assert_owns_job(job, current_user, permission_checker):
    """Raise 403 if caller doesn't own the job and lacks MANAGE_CAREER."""
    ...

def _assert_owns_objective(obj, current_user, permission_checker):
    """Raise 403 if caller doesn't own the objective's portfolio and lacks MANAGE_CAREER."""
    ...

def _assert_owns_run(run, current_user, permission_checker):
    """Trace run → objective → portfolio → created_by. Raise 403 if no access."""
    ...

# ── JOBS ──────────────────────────────────────────────────────────────────────

@router.post("/jobs", response_model=CareerJobOut, status_code=status.HTTP_201_CREATED)
@require_permission("MANAGE_CAREER")
async def create_job(data: CareerJobCreate, ...):
    job = await career_crud.create_job(db, data, current_user.id)
    # Queue skill extraction (non-blocking): will be a second Celery task in v2
    # For v1: no async extraction; skills added via PUT /jobs/{id}/skills
    return job

@router.get("/jobs", response_model=dict)   # {items: [...], total: int}
@require_permission("VIEW_CAREER")
async def list_jobs(limit=50, offset=0, status=None, company=None, ...):
    jobs, total = await career_crud.list_jobs(db, limit=limit, offset=offset, status=status, company=company)
    return {"items": jobs, "total": total}

@router.get("/jobs/{job_id}", response_model=CareerJobOut)
@require_permission("VIEW_CAREER")
async def get_job(job_id: int, ...):
    job = await career_crud.get_job(db, job_id)
    if not job: raise HTTPException(404)
    return job

@router.put("/jobs/{job_id}", response_model=CareerJobOut)
@require_permission("MANAGE_CAREER")
async def update_job(job_id: int, data: CareerJobUpdate, ...):
    job = await career_crud.get_job(db, job_id)
    if not job: raise HTTPException(404)
    _assert_owns_job(job, current_user, permission_checker)
    return await career_crud.update_job(db, job, data, current_user.id)

@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("MANAGE_CAREER")
async def delete_job(job_id: int, ...):
    job = await career_crud.get_job(db, job_id)
    if not job: raise HTTPException(404)
    _assert_owns_job(job, current_user, permission_checker)
    await career_crud.delete_job(db, job)

@router.put("/jobs/{job_id}/skills", response_model=CareerJobOut)
@require_permission("MANAGE_CAREER")
async def update_job_skills(job_id: int, data: CareerJobSkillsUpdate, ...):
    job = await career_crud.get_job(db, job_id)
    if not job: raise HTTPException(404)
    _assert_owns_job(job, current_user, permission_checker)
    return await career_crud.replace_job_skills(db, job, data.skills)

# ── OBJECTIVES ────────────────────────────────────────────────────────────────

@router.post("/objectives", response_model=CareerObjectiveOut, status_code=201)
@router.get("/objectives", response_model=dict)
@router.get("/objectives/{objective_id}", response_model=CareerObjectiveOut)
@router.put("/objectives/{objective_id}", response_model=CareerObjectiveOut)
@router.delete("/objectives/{objective_id}", status_code=204)
@router.post("/objectives/{objective_id}/jobs/{job_id}", status_code=200)
@router.delete("/objectives/{objective_id}/jobs/{job_id}", status_code=204)
# (implement following same pattern as jobs above, with _assert_owns_objective)

# ── ASSESSMENT RUNS ───────────────────────────────────────────────────────────

@router.post("/objectives/{objective_id}/runs", response_model=AssessmentRunOut, status_code=201)
@require_permission("MANAGE_CAREER")
async def create_run(objective_id: int, data: AssessmentRunCreate, ...):
    obj = await career_crud.get_objective(db, objective_id)
    if not obj: raise HTTPException(404)
    _assert_owns_objective(obj, current_user, permission_checker)
    if not data.job_ids:
        raise HTTPException(400, detail="At least one job must be selected")

    run = await career_crud.create_run(db, obj, data, current_user.id)

    # Compute rule-based sections synchronously
    await compute_and_store_sync_sections(db, run.id, objective_id, obj.portfolio_id)
    await db.refresh(run)

    # Queue AI sections
    task = run_career_ai_assessment.delay(run.id)
    await career_crud.update_run_ai_status(db, run.id, "pending", task.id)

    return run

@router.get("/objectives/{objective_id}/runs", response_model=list[AssessmentRunOut])
@router.get("/objectives/{objective_id}/runs/{run_id}", response_model=AssessmentRunOut)

# ── FLAT RUN ENDPOINTS (progressive loading) ──────────────────────────────────

@router.get("/runs/{run_id}", response_model=AssessmentRunOut)
@router.get("/runs/{run_id}/scorecard")        # returns scorecard_json directly
@router.get("/runs/{run_id}/job-fit")          # returns job_fit_json directly
@router.get("/runs/{run_id}/resume-issues")    # returns {"status": ai_status} or {"status":"complete","data":...}
@router.get("/runs/{run_id}/action-plan")      # same pattern as resume-issues
```

**Ownership check for flat run endpoints:** trace `run → objective → portfolio → created_by`. Load `run` with `joinedload(CareerAssessmentRun.objective).joinedload(CareerObjective.portfolio)`.

#### 5b. `portfolio-backend/app/api/router.py` (EDIT)

Add career router import and registration:
```python
from app.api.endpoints import career

# In the include_router block:
api_router.include_router(career.router, prefix="/career", tags=["Career OS"])
```

#### 5c. `portfolio-backend/tests/integration/test_career_api.py` (NEW)

Use Testcontainers pattern matching existing integration tests. Key scenarios:

```python
# Coverage targets (must reach ≥85% of changed lines):

# Job lifecycle
test_create_job_success()
test_create_job_requires_manage_career()
test_get_job_not_found_returns_404()
test_update_job_ownership_required()
test_delete_job_cascades_to_objective_links()
test_replace_job_skills()

# Objective lifecycle
test_create_objective()
test_link_job_to_objective_idempotent()
test_unlink_job_from_objective()
test_delete_objective_cascades_runs()

# Assessment run lifecycle
test_create_run_empty_job_ids_returns_400()
test_create_run_computes_sync_sections_immediately()
    # Assert run.scorecard_json is not None right after creation
test_create_run_queues_celery_task()
    # Mock Celery task; assert it was called with correct run_id
test_get_run_section_pending_returns_status()
    # run.ai_status = "pending" → resume-issues returns {"status":"pending"}
test_get_run_section_complete_returns_data()
    # run.ai_status = "complete" + resume_issues_json set → returns {"status":"complete","data":{...}}

# Scoring engine integration (no mock — uses real scoring functions)
test_scorecard_empty_portfolio_all_zeros()
test_fit_score_no_required_skills_is_100()
test_overall_readiness_average()

# Authorization
test_view_career_cannot_create()
test_objective_ownership_enforced()
test_run_flat_endpoint_ownership_by_run_trace()
```

---

## Chunk 6 — Frontend Foundation

### Purpose
API service, context/state, polling hook, and route wiring.

### Files

#### 6a. `backend-ui/src/services/careerApi.js` (NEW)

```javascript
import api from '../api/axios';

// Jobs
export const createJob = (data) => api.post('/career/jobs', data);
export const listJobs  = (params) => api.get('/career/jobs', { params });
export const getJob    = (id) => api.get(`/career/jobs/${id}`);
export const updateJob = (id, data) => api.put(`/career/jobs/${id}`, data);
export const deleteJob = (id) => api.delete(`/career/jobs/${id}`);
export const updateJobSkills = (id, skills) => api.put(`/career/jobs/${id}/skills`, { skills });

// Objectives
export const createObjective  = (data) => api.post('/career/objectives', data);
export const listObjectives   = (params) => api.get('/career/objectives', { params });
export const getObjective     = (id) => api.get(`/career/objectives/${id}`);
export const updateObjective  = (id, data) => api.put(`/career/objectives/${id}`, data);
export const deleteObjective  = (id) => api.delete(`/career/objectives/${id}`);
export const linkJobToObjective   = (objId, jobId) => api.post(`/career/objectives/${objId}/jobs/${jobId}`);
export const unlinkJobFromObjective = (objId, jobId) => api.delete(`/career/objectives/${objId}/jobs/${jobId}`);

// Assessment runs
export const createRun   = (objectiveId, data) => api.post(`/career/objectives/${objectiveId}/runs`, data);
export const listRuns    = (objectiveId) => api.get(`/career/objectives/${objectiveId}/runs`);
export const getRun      = (runId) => api.get(`/career/runs/${runId}`);
export const getScorecard    = (runId) => api.get(`/career/runs/${runId}/scorecard`);
export const getJobFit       = (runId) => api.get(`/career/runs/${runId}/job-fit`);
export const getResumeIssues = (runId) => api.get(`/career/runs/${runId}/resume-issues`);
export const getActionPlan   = (runId) => api.get(`/career/runs/${runId}/action-plan`);
```

#### 6b. `backend-ui/src/contexts/CareerContext.js` (NEW)

```javascript
// State shape:
// { objectives, jobs, totalObjectives, totalJobs, loading, error }
// Methods: fetchObjectives, createObjective, updateObjective, deleteObjective,
//          fetchJobs, createJob, updateJob, deleteJob, linkJob, unlinkJob

// Pre-fetches both objectives and jobs on mount.
// Assessment run data is NOT stored here.
```

#### 6c. `backend-ui/src/hooks/useAssessmentRun.js` (NEW)

```javascript
// Fetches full run on mount.
// Polls getResumeIssues and getActionPlan every 3s while ai_status ∈ {pending, running}.
// Stops polling when ai_status ∈ {complete, failed}.
// Hard timeout: 5 minutes (300s) from first mount → sets error state, stops polling.
// Returns: { run, scorecard, jobFit, resumeIssues, actionPlan, loading, error, aiStatus }
```

#### 6d. `backend-ui/src/App.js` (EDIT)

Add career routes (lazy-loaded):
```javascript
const CareerIndex        = React.lazy(() => import('./components/career/CareerIndex'));
const JobIndex           = React.lazy(() => import('./components/career/JobIndex'));
const JobDetailPage      = React.lazy(() => import('./components/career/JobDetailPage'));
const ObjectiveDetailPage = React.lazy(() => import('./components/career/ObjectiveDetailPage'));
const AssessmentRunPage  = React.lazy(() => import('./components/career/AssessmentRunPage'));

// Routes:
<Route path="/career"                              element={<CareerIndex />} />
<Route path="/career/jobs"                         element={<JobIndex />} />
<Route path="/career/jobs/:jobId"                  element={<JobDetailPage />} />
<Route path="/career/objectives/:objectiveId"      element={<ObjectiveDetailPage />} />
<Route path="/career/runs/:runId"                  element={<AssessmentRunPage />} />
```

Wrap routes with `canAccessModule('career')` guard (matching existing pattern for other protected modules).

#### 6e. Sidebar + Dashboard card

**Sidebar (`backend-ui/src/components/layout/Sidebar.js` or equivalent):**
Add a "Career" section with sub-items "Objectives" (`/career`) and "Jobs" (`/career/jobs`). Use `canAccessModule('career')` to show/hide. Match existing nav item style.

**Dashboard (`backend-ui/src/pages/Dashboard.js` or equivalent):**
Add a summary card linking to `/career`. Show count of active objectives and most recent run readiness % if available. Match existing dashboard card pattern.

---

## Chunk 7 — Frontend Pages

### Purpose
Build all Career OS UI components following the MUI v6 theme and the `career_assessment.jsx` prototype.

### Files

#### 7a. `backend-ui/src/components/career/CareerIndex.js`

- List of objectives using MUI `Table` or `Card` grid
- Columns: name, portfolio, status (MUI `Chip`), # jobs, # runs, created date
- "New Objective" button → opens `ObjectiveForm` dialog
- Clicking a row navigates to `/career/objectives/:objectiveId`
- Empty state: illustrated empty state with "Create your first objective" CTA

#### 7b. `backend-ui/src/components/career/ObjectiveForm.js`

Dialog/drawer form with:
- `name` field (required)
- `description` multiline
- `portfolio_id` select (load from portfolios API)
- `status` select: active / archived
- Uses React Hook Form; submits via `CareerContext.createObjective / updateObjective`

#### 7c. `backend-ui/src/components/career/ObjectiveDetailPage.js`

3-tab MUI `Tabs` page:

**Tab 1 — Overview:** name, description, portfolio name, status chip, "Run Assessment" button
**Tab 2 — Jobs:** linked jobs table with fit % badge per job (from most recent run); "Add Job" search-and-link dialog; "Remove" icon per row
**Tab 3 — Runs:** list of past runs (newest first), columns: name, date, readiness %, AI status chip; click opens `/career/runs/:runId`

"Run Assessment" button: opens `AssessmentRunCreate` dialog:
- Multi-select of linked jobs (check all by default)
- Optional resume attachment select (load from portfolio attachments)
- Optional run name field
- On submit: calls `createRun()` → navigates to new run page

#### 7d. `backend-ui/src/components/career/JobIndex.js`

Paginated MUI `DataGrid` or `Table`:
- Columns: title, company, salary range, location, remote (icon), status chip, # objectives
- Filters: status, company (text search)
- "New Job" button → navigates to create form

#### 7e. `backend-ui/src/components/career/JobForm.js`

Full-page form (not dialog — JD textarea needs space):
- All job fields from spec
- Large `description` textarea (Haiku uses this for context)
- On create: POST then navigate to job detail page

#### 7f. `backend-ui/src/components/career/JobDetailPage.js`

2-tab page:

**Tab 1 — Overview:** all job fields, inline edit via "Edit" button → opens `JobForm` populated
**Tab 2 — Required Skills:** tag list of AI-extracted skills; "Edit Skills" button opens skill-search-and-toggle dialog; uses `updateJobSkills()`

#### 7g. `backend-ui/src/components/career/AssessmentRunPage.js`

5-tab dashboard:

**Tab 1 — Overview:**
- Large readiness % number with color coding (≥60% green, 40–59% amber, <40% red)
- MUI `Alert` for feasibility: BEST FIT → info, STRETCH → warning, ASPIRATIONAL → error
- Stats grid: # jobs evaluated, # skill gaps, # critical gaps
- Top bottlenecks list (top 3 CRITICAL/HIGH skills from scorecard)

**Tab 2 — Skills Scorecard:** (always available)
- MUI `Table` with skill name, level bar (`LinearProgress`), priority chip, evidence text, gap text
- Color map: CRITICAL → `error`, HIGH → `warning`, MEDIUM → `info`, LOW → `success`
- Sort by priority (CRITICAL first by default)

**Tab 3 — Job Fit Analysis:** (always available)
- One MUI `Card` per job
- Header: job title + company + fit % + verdict `Chip`
- Expandable: per-skill scorecard rows within that job

**Tab 4 — Resume Issues:** (AI, polls until complete)
- While pending: `MUI Skeleton` rows
- When complete: expandable `Accordion` per issue (title, impact chip, fix text)
- If failed: `Alert severity="error"` with retry suggestion

**Tab 5 — Action Plan:** (AI, polls until complete)
- While pending: `MUI Skeleton` rows
- When complete: timeline or stepper showing 12-week plan items
- week_range, focus, tasks bullet list, hours badge
- If failed: `Alert severity="error"`

**Polling UX:**
- Show `LinearProgress` (indeterminate) at top of tabs 4 and 5 while `aiStatus ∈ {pending, running}`
- After 5-minute timeout: show `Alert severity="warning"` explaining the AI assessment is taking longer than expected

### i18n

Add ALL new string keys to every supported language file simultaneously. Minimum keys needed:

```
career.title, career.objectives, career.jobs,
career.objective.new, career.objective.name, career.objective.description,
career.objective.status.active, career.objective.status.archived,
career.job.new, career.job.title, career.job.company, career.job.salary,
career.job.status.saved, career.job.status.applied, career.job.status.interviewing,
career.job.status.offer, career.job.status.rejected,
career.run.new, career.run.readiness, career.run.scorecard, career.run.jobFit,
career.run.resumeIssues, career.run.actionPlan,
career.run.ai.pending, career.run.ai.running, career.run.ai.complete, career.run.ai.failed,
career.run.ai.timeout,
career.verdict.bestFit, career.verdict.stretch, career.verdict.aspirational,
career.priority.critical, career.priority.high, career.priority.medium, career.priority.low
```

---

## End-to-End Verification Checklist

After all chunks are complete:

```bash
# Backend
cd portfolio-backend && source venv/bin/activate
pytest tests/ -v --tb=short --cov=app --cov-report=term-missing
# Confirm ≥85% coverage on changed lines

ruff check app/ && black app/ --check
mypy app/

# Frontend
cd backend-ui && npm run lint && npx tsc --noEmit
npm run build   # NODE_OPTIONS=--max-old-space-size=4096 if OOM

# Manual smoke test
# 1. Create a job with description text
# 2. Manually add skills via PUT /jobs/{id}/skills
# 3. Create an objective linked to a portfolio with projects
# 4. Link the job to the objective
# 5. Create an assessment run → verify scorecard_json populated immediately
# 6. Poll /runs/{id}/resume-issues → wait for complete status
# 7. Navigate to /career/runs/{id} in the UI → verify all 5 tabs render
```

---

## Key Decisions & Constraints

| Decision | Rationale |
|----------|-----------|
| `ANTHROPIC_API_KEY` as env var (not DB) | Celery workers need it before DB is reachable; env var is simpler |
| No retries on Celery task | Avoid duplicate API charges; fail fast |
| `finally` block always writes `ai_status` | Frontend polling must always terminate |
| Sync CRUD variants for Celery | Celery workers are synchronous; can't use async SQLAlchemy |
| Job skills editable after creation | AI extraction is v2; v1 requires manual skill entry via PUT endpoint |
| No run deletion in v1 | Runs are immutable audit records; deletion deferred |
| Jobs are global, not per-objective | One job can target multiple objectives; reduces duplication |
| `down_revision = 'b2c3d4e5f6g7'` | **Verify with `alembic heads` before applying** |
