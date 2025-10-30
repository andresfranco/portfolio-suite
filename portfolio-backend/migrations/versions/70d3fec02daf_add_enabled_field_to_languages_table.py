"""Add enabled field to languages table

Revision ID: 70d3fec02daf
Revises: c776336f2e2d
Create Date: 2025-10-30 18:01:05.443190

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '70d3fec02daf'
down_revision: Union[str, None] = 'c776336f2e2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add enabled column to languages table with default value True
    op.add_column('languages', sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    # Remove enabled column from languages table
    op.drop_column('languages', 'enabled')
