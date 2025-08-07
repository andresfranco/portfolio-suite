"""description_of_change

Revision ID: ac89d8d1cf3e
Revises: da56a871e8e6
Create Date: 2025-04-07 11:11:22.087828

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac89d8d1cf3e'
down_revision: Union[str, None] = 'da56a871e8e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
