"""add_is_default_to_portfolio

Revision ID: 1936ba1e1c1e
Revises: 20251022_audit_logs
Create Date: 2025-10-25 12:37:02.510923

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1936ba1e1c1e'
down_revision: Union[str, None] = '20251022_audit_logs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_default column to portfolios table
    op.add_column('portfolios', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'))
    
    # Create unique partial index to ensure only one default portfolio
    op.create_index(
        'idx_single_default_portfolio',
        'portfolios',
        ['is_default'],
        unique=True,
        postgresql_where=sa.text('is_default = true')
    )
    
    # Set the first portfolio as default if one exists
    op.execute("""
        UPDATE portfolios 
        SET is_default = true 
        WHERE id = (SELECT MIN(id) FROM portfolios)
    """)


def downgrade() -> None:
    # Drop the unique index first
    op.drop_index('idx_single_default_portfolio', table_name='portfolios')
    
    # Drop the is_default column
    op.drop_column('portfolios', 'is_default')
