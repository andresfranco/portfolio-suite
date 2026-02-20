"""add_category_and_default_flag_to_portfolio_attachments

Revision ID: 75e833f73ae4
Revises: 1936ba1e1c1e
Create Date: 2025-10-27 17:29:24.418233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75e833f73ae4'
down_revision: Union[str, None] = '1936ba1e1c1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add category_id column (nullable, FK to categories)
    op.add_column('portfolio_attachments', 
        sa.Column('category_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_portfolio_attachments_category_id',
        'portfolio_attachments', 'categories',
        ['category_id'], ['id']
    )
    
    # Add is_default column (not null, default False)
    op.add_column('portfolio_attachments',
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    
    # Create index for faster lookups of default resumes
    op.create_index(
        'ix_portfolio_attachments_portfolio_id_is_default',
        'portfolio_attachments',
        ['portfolio_id', 'is_default']
    )


def downgrade() -> None:
    # Drop index (if exists)
    op.drop_index('ix_portfolio_attachments_portfolio_id_is_default', 'portfolio_attachments', if_exists=True)
    
    # Drop foreign key constraint (if exists)
    op.drop_constraint('fk_portfolio_attachments_category_id', 'portfolio_attachments', type_='foreignkey', if_exists=True)
    
    # Drop columns (if exist)
    with op.batch_alter_table('portfolio_attachments') as batch_op:
        try:
            batch_op.drop_column('category_id')
        except:
            pass
        try:
            batch_op.drop_column('is_default')
        except:
            pass
