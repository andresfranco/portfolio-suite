"""add code field to experiences

Revision ID: 7eca8b93e915
Revises: 7a8b9c0d1e2f
Create Date: 2025-03-10 16:12:33.864699

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7eca8b93e915'
down_revision: Union[str, None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
