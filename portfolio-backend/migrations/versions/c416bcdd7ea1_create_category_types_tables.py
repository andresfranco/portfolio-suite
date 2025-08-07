"""create_category_types_tables

Revision ID: c416bcdd7ea1
Revises: 6e1387843f3a
Create Date: 2025-03-14 11:01:49.475351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c416bcdd7ea1'
down_revision: Union[str, None] = '6e1387843f3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
