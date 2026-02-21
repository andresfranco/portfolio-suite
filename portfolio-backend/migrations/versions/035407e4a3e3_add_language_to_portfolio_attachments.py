"""add_language_to_portfolio_attachments

Revision ID: 035407e4a3e3
Revises: 75e833f73ae4
Create Date: 2025-10-27 18:32:49.399548

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '035407e4a3e3'
down_revision: Union[str, None] = '75e833f73ae4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
