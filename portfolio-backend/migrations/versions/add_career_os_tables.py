"""add_career_os_tables

Revision ID: c1d2e3f4g5h6
Revises: 20260210_01
Create Date: 2026-03-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c1d2e3f4g5h6'
down_revision = '20260210_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # career_objective
    op.create_table(
        'career_objective',
        sa.Column('id',           sa.Integer(),   primary_key=True, autoincrement=True),
        sa.Column('portfolio_id', sa.Integer(),   sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name',         sa.String(255), nullable=False, server_default='Career Growth'),
        sa.Column('description',  sa.Text(),      nullable=True),
        sa.Column('status',       sa.String(50),  nullable=False, server_default='active'),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',   sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',   sa.Integer(),   nullable=False),
        sa.Column('updated_by',   sa.Integer(),   nullable=False),
    )
    op.create_index('ix_career_objective_portfolio_id', 'career_objective', ['portfolio_id'])

    # career_job
    op.create_table(
        'career_job',
        sa.Column('id',          sa.Integer(),    primary_key=True, autoincrement=True),
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
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',  sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',  sa.Integer(),    nullable=False),
        sa.Column('updated_by',  sa.Integer(),    nullable=False),
    )

    # career_job_skill
    op.create_table(
        'career_job_skill',
        sa.Column('id',             sa.Integer(), primary_key=True, autoincrement=True),
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
        sa.Column('added_at',     sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # career_assessment_run
    op.create_table(
        'career_assessment_run',
        sa.Column('id',                   sa.Integer(),  primary_key=True, autoincrement=True),
        sa.Column('objective_id',         sa.Integer(),  sa.ForeignKey('career_objective.id',      ondelete='CASCADE'),  nullable=False),
        sa.Column('portfolio_id',         sa.Integer(),  sa.ForeignKey('portfolios.id',            ondelete='CASCADE'),  nullable=False),
        sa.Column('resume_attachment_id', sa.Integer(),  sa.ForeignKey('portfolio_attachments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name',                 sa.String(255), nullable=True),
        sa.Column('scorecard_json',       postgresql.JSONB(), nullable=True),
        sa.Column('job_fit_json',         postgresql.JSONB(), nullable=True),
        sa.Column('resume_issues_json',   postgresql.JSONB(), nullable=True),
        sa.Column('action_plan_json',     postgresql.JSONB(), nullable=True),
        sa.Column('ai_status',            sa.String(20),  nullable=False, server_default='pending'),
        sa.Column('ai_task_id',           sa.String(255), nullable=True),
        sa.Column('created_at',           sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by',           sa.Integer(),   nullable=False),
    )
    op.create_index('ix_career_assessment_run_objective_id', 'career_assessment_run', ['objective_id'])
    op.create_index('ix_career_assessment_run_portfolio_id', 'career_assessment_run', ['portfolio_id'])

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
    op.drop_index('ix_career_assessment_run_portfolio_id', table_name='career_assessment_run')
    op.drop_index('ix_career_assessment_run_objective_id', table_name='career_assessment_run')
    op.drop_table('career_assessment_run')
    op.drop_table('career_objective_job')
    op.drop_index('ix_career_job_skill_job_id', table_name='career_job_skill')
    op.drop_table('career_job_skill')
    op.drop_table('career_job')
    op.drop_index('ix_career_objective_portfolio_id', table_name='career_objective')
    op.drop_table('career_objective')
