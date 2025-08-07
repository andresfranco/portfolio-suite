"""merge_heads

Revision ID: b1fdef107aea
Revises: a2000594cd09, seed_skill_types
Create Date: 2025-04-06 18:03:47.830839

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1fdef107aea'
down_revision: Union[str, None] = ('a2000594cd09', 'seed_skill_types')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
