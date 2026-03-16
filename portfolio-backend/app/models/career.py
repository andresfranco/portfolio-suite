"""SQLAlchemy ORM models for the Career Operating System module."""
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

# ── Association tables ─────────────────────────────────────────────────────────

career_objective_job = Table(
    "career_objective_job",
    Base.metadata,
    Column("objective_id", Integer, ForeignKey("career_objective.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id",       Integer, ForeignKey("career_job.id",       ondelete="CASCADE"), primary_key=True),
    Column("added_at",     DateTime(timezone=True), server_default=func.now()),
)

career_assessment_run_job = Table(
    "career_assessment_run_job",
    Base.metadata,
    Column("run_id", Integer, ForeignKey("career_assessment_run.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id", Integer, ForeignKey("career_job.id",            ondelete="CASCADE"), primary_key=True),
)


# ── Core models ────────────────────────────────────────────────────────────────

class CareerObjective(Base):
    __tablename__ = "career_objective"

    id           = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String(255), nullable=False, default="Career Growth")
    description  = Column(Text, nullable=True)
    status       = Column(String(50), nullable=False, default="active")   # active | archived
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
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
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
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
    objective_id         = Column(Integer, ForeignKey("career_objective.id",      ondelete="CASCADE"), nullable=False, index=True)
    portfolio_id         = Column(Integer, ForeignKey("portfolios.id",            ondelete="CASCADE"), nullable=False)
    resume_attachment_id = Column(Integer, ForeignKey("portfolio_attachments.id", ondelete="SET NULL"), nullable=True)
    name                 = Column(String(255), nullable=True)
    scorecard_json       = Column(JSONB, nullable=True)
    job_fit_json         = Column(JSONB, nullable=True)
    resume_issues_json   = Column(JSONB, nullable=True)
    action_plan_json     = Column(JSONB, nullable=True)
    ai_status            = Column(String(20), nullable=False, default="pending")  # pending|running|complete|failed
    ai_task_id           = Column(String(255), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by           = Column(Integer, nullable=False)

    objective = relationship("CareerObjective", back_populates="runs")
    jobs      = relationship("CareerJob", secondary=career_assessment_run_job)
