"""Remove unique constraint from identifier and add unique constraint to translation_languages

Revision ID: 62b987ae72f3
Revises: 8411cdecc74c
Create Date: 2025-03-09 22:39:31.398291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.schema import UniqueConstraint


# revision identifiers, used by Alembic.
revision: str = '62b987ae72f3'
down_revision: Union[str, None] = '8411cdecc74c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Using batch mode for SQLite compatibility ###
    
    # Recreate translation_languages table with unique constraint
    with op.batch_alter_table('translation_languages') as batch_op:
        batch_op.create_unique_constraint('uix_translation_language', ['translation_id', 'language_id'])
    
    # Recreate translations table without unique constraint on identifier
    with op.batch_alter_table('translations') as batch_op:
        batch_op.drop_index('ix_translations_identifier')
        batch_op.create_index(op.f('ix_translations_identifier'), ['identifier'], unique=False)


def downgrade() -> None:
    # ### Using batch mode for SQLite compatibility ###
    
    # Restore unique constraint on identifier
    with op.batch_alter_table('translations') as batch_op:
        batch_op.drop_index(op.f('ix_translations_identifier'))
        batch_op.create_index('ix_translations_identifier', ['identifier'], unique=True)
    
    # Remove unique constraint from translation_languages
    with op.batch_alter_table('translation_languages') as batch_op:
        batch_op.drop_constraint('uix_translation_language', type_='unique')
