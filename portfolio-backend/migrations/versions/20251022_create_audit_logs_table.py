"""create audit logs table

Revision ID: 20251022_audit_logs
Revises: 20251022_mfa_security
Create Date: 2025-10-22 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251022_audit_logs'
down_revision = '20251022_mfa_security'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create audit_logs table."""
    
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('event_category', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='info', nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('resource_type', sa.String(length=100), nullable=True),
        sa.Column('resource_id', sa.String(length=255), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('request_id', sa.String(length=36), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('success', sa.String(length=20), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('record_hash', sa.String(length=64), nullable=True),
        sa.Column('previous_hash', sa.String(length=64), nullable=True),
        sa.Column('retention_days', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_event_type'), 'audit_logs', ['event_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_event_category'), 'audit_logs', ['event_category'], unique=False)
    op.create_index(op.f('ix_audit_logs_severity'), 'audit_logs', ['severity'], unique=False)
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_username'), 'audit_logs', ['username'], unique=False)
    op.create_index(op.f('ix_audit_logs_resource_type'), 'audit_logs', ['resource_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_ip_address'), 'audit_logs', ['ip_address'], unique=False)
    op.create_index(op.f('ix_audit_logs_request_id'), 'audit_logs', ['request_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_success'), 'audit_logs', ['success'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_expires_at'), 'audit_logs', ['expires_at'], unique=False)
    
    # Composite indexes for common queries
    op.create_index('ix_audit_logs_user_event', 'audit_logs', ['user_id', 'event_type'], unique=False)
    op.create_index('ix_audit_logs_created_event', 'audit_logs', ['created_at', 'event_type'], unique=False)
    op.create_index('ix_audit_logs_category_severity', 'audit_logs', ['event_category', 'severity'], unique=False)
    op.create_index('ix_audit_logs_resource', 'audit_logs', ['resource_type', 'resource_id'], unique=False)
    op.create_index('ix_audit_logs_ip_created', 'audit_logs', ['ip_address', 'created_at'], unique=False)


def downgrade() -> None:
    """Drop audit_logs table."""
    
    # Drop composite indexes
    op.drop_index('ix_audit_logs_ip_created', table_name='audit_logs')
    op.drop_index('ix_audit_logs_resource', table_name='audit_logs')
    op.drop_index('ix_audit_logs_category_severity', table_name='audit_logs')
    op.drop_index('ix_audit_logs_created_event', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_event', table_name='audit_logs')
    
    # Drop single-column indexes
    op.drop_index(op.f('ix_audit_logs_expires_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_success'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_request_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_ip_address'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_resource_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_username'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_severity'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_event_category'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_event_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    
    # Drop table
    op.drop_table('audit_logs')

