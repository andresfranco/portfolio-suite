"""add_agent_usage_and_budget_tracking

Revision ID: aef82430e017
Revises: 3e23d929df47
Create Date: 2025-10-04 15:39:24.761721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aef82430e017'
down_revision: Union[str, None] = '3e23d929df47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add usage tracking and budget limit columns to agents table
    op.add_column('agents', sa.Column('usage_limit', sa.Integer(), nullable=True))
    op.add_column('agents', sa.Column('budget_limit', sa.Float(), nullable=True))
    op.add_column('agents', sa.Column('current_usage', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('agents', sa.Column('current_cost', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('agents', sa.Column('usage_reset_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove usage tracking and budget limit columns from agents table
    op.drop_column('agents', 'usage_reset_at')
    op.drop_column('agents', 'current_cost')
    op.drop_column('agents', 'current_usage')
    op.drop_column('agents', 'budget_limit')
    op.drop_column('agents', 'usage_limit')
