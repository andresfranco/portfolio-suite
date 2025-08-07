"""seed_category_types

Revision ID: a2000594cd09
Revises: 8391324b6c9e
Create Date: 2025-03-14 15:14:05.691904

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from datetime import datetime


# revision identifiers, used by Alembic.
revision: str = 'a2000594cd09'
down_revision: Union[str, None] = '8391324b6c9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Define table structure for bulk insert
    category_types_table = table('category_types',
        column('code', sa.String),
        column('name', sa.String),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime)
    )
    
    # Current timestamp for created_at and updated_at
    now = datetime.utcnow()
    
    # Insert default category types
    op.bulk_insert(
        category_types_table,
        [
            {'code': 'GEN', 'name': 'General', 'created_at': now, 'updated_at': now},
            {'code': 'SKILL', 'name': 'Skill', 'created_at': now, 'updated_at': now},
            {'code': 'PROJ', 'name': 'Project', 'created_at': now, 'updated_at': now},
            {'code': 'EDU', 'name': 'Education', 'created_at': now, 'updated_at': now},
            {'code': 'EXP', 'name': 'Experience', 'created_at': now, 'updated_at': now}
        ]
    )


def downgrade() -> None:
    # Remove the seeded data
    op.execute("DELETE FROM category_types WHERE code IN ('GEN', 'SKILL', 'PROJ', 'EDU', 'EXP')")
