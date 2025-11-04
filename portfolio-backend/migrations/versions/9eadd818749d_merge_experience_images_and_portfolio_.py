"""merge experience_images and portfolio_links heads

Revision ID: 9eadd818749d
Revises: 481594d84e06, c1f7823b08c1
Create Date: 2025-11-04 13:44:13.418338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9eadd818749d'
down_revision: Union[str, None] = ('481594d84e06', 'c1f7823b08c1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
