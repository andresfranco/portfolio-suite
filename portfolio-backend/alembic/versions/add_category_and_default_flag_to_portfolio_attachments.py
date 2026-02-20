"""add_category_and_default_flag_to_portfolio_attachments

Revision ID: a1b2c3d4e5f6
Revises: 75e833f73ae4
Create Date: 2025-10-27 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '75e833f73ae4'
branch_labels = None
depends_on = None


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
    # Drop index
    op.drop_index('ix_portfolio_attachments_portfolio_id_is_default', 'portfolio_attachments')
    
    # Drop columns
    op.drop_constraint('fk_portfolio_attachments_category_id', 'portfolio_attachments', type_='foreignkey')
    op.drop_column('portfolio_attachments', 'category_id')
    op.drop_column('portfolio_attachments', 'is_default')
