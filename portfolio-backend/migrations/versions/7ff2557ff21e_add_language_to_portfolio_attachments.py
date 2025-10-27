"""add_language_to_portfolio_attachments

Revision ID: 7ff2557ff21e
Revises: 035407e4a3e3
Create Date: 2025-10-27 18:32:59.975841

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ff2557ff21e'
down_revision: Union[str, None] = '035407e4a3e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add language_id column to portfolio_attachments table
    op.add_column('portfolio_attachments', sa.Column('language_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_portfolio_attachments_language_id',
        'portfolio_attachments',
        'languages',
        ['language_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_portfolio_attachments_language_id', 'portfolio_attachments', ['language_id'])


def downgrade() -> None:
    # Remove language_id column and related constraints
    op.drop_index('ix_portfolio_attachments_language_id', table_name='portfolio_attachments')
    op.drop_constraint('fk_portfolio_attachments_language_id', 'portfolio_attachments', type_='foreignkey')
    op.drop_column('portfolio_attachments', 'language_id')
