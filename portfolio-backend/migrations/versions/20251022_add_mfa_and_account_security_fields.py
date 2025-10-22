"""add MFA and account security fields to users

Revision ID: 20251022_mfa_security
Revises: da56a871e8e6
Create Date: 2025-10-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251022_mfa_security'
down_revision = 'aef82430e017'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add MFA and account security fields to users table."""
    
    # Multi-Factor Authentication (MFA) fields
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('mfa_secret', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('mfa_backup_codes', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('users', sa.Column('mfa_enrolled_at', sa.DateTime(timezone=True), nullable=True))
    
    # Account Security fields
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('account_locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_login_ip', sa.String(length=45), nullable=True))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    op.add_column('users', sa.Column('force_password_change', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('email_verification_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('email_verification_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('password_reset_sent_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create indexes for performance
    op.create_index(op.f('ix_users_mfa_enabled'), 'users', ['mfa_enabled'], unique=False)
    op.create_index(op.f('ix_users_last_login_at'), 'users', ['last_login_at'], unique=False)
    op.create_index(op.f('ix_users_email_verified'), 'users', ['email_verified'], unique=False)


def downgrade() -> None:
    """Remove MFA and account security fields from users table."""
    
    # Drop indexes
    op.drop_index(op.f('ix_users_email_verified'), table_name='users')
    op.drop_index(op.f('ix_users_last_login_at'), table_name='users')
    op.drop_index(op.f('ix_users_mfa_enabled'), table_name='users')
    
    # Drop columns
    op.drop_column('users', 'password_reset_sent_at')
    op.drop_column('users', 'password_reset_token')
    op.drop_column('users', 'email_verification_sent_at')
    op.drop_column('users', 'email_verification_token')
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'force_password_change')
    op.drop_column('users', 'password_changed_at')
    op.drop_column('users', 'last_login_ip')
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'account_locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'mfa_enrolled_at')
    op.drop_column('users', 'mfa_backup_codes')
    op.drop_column('users', 'mfa_secret')
    op.drop_column('users', 'mfa_enabled')

