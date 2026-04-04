"""merge_career_os_and_credential_columns

Revision ID: adc3d18db10d
Revises: 20260403_01, c1d2e3f4g5h6
Create Date: 2026-04-03 17:59:06.586218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'adc3d18db10d'
down_revision: Union[str, None] = ('20260403_01', 'c1d2e3f4g5h6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
