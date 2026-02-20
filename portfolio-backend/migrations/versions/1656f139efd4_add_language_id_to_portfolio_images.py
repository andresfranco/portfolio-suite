"""add_language_id_to_portfolio_images

Revision ID: 1656f139efd4
Revises: 7ff2557ff21e
Create Date: 2025-10-27 21:10:19.139867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1656f139efd4'
down_revision: Union[str, None] = '7ff2557ff21e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add language_id column to portfolio_images
    op.add_column('portfolio_images', 
        sa.Column('language_id', sa.Integer(), nullable=True)
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_portfolio_images_language_id',
        'portfolio_images', 'languages',
        ['language_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_portfolio_images_language_id', 'portfolio_images', type_='foreignkey')
    
    # Drop language_id column
    op.drop_column('portfolio_images', 'language_id')
