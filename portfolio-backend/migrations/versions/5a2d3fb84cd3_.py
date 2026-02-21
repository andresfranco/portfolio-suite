"""empty message

Revision ID: 5a2d3fb84cd3
Revises: 14deadbeef00, 20250820_01_agent_admin_tables
Create Date: 2025-08-22 22:07:29.063975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a2d3fb84cd3'
down_revision: Union[str, None] = ('14deadbeef00', '20250820_01_agent_admin_tables')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
