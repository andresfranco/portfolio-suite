"""merge_heads

Revision ID: 6e1387843f3a
Revises: 7eca8b93e915, 8a9b0c1d2e3f
Create Date: 2025-03-14 11:01:36.691494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e1387843f3a'
down_revision: Union[str, None] = ('7eca8b93e915', '8a9b0c1d2e3f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
