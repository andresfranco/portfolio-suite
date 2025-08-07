"""ensure_category_types_table

Revision ID: [this will already be filled in correctly]
Revises: c416bcdd7ea1
Create Date: [this will already be filled in correctly]

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
# These will already be filled in correctly - don't change them
revision = '...'  # This will have an auto-generated value
down_revision = 'c416bcdd7ea1'  # This should point to your current head
branch_labels = None
depends_on = None


def upgrade():
    # Create the category_types table
    op.create_table(
        'category_types',
        sa.Column('code', sa.String(5), primary_key=True),
        sa.Column('name', sa.String()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP')),
        sa.Column('created_by', sa.String()),
        sa.Column('updated_by', sa.String())
    )
    
    op.create_index(op.f('ix_category_types_code'), 'category_types', ['code'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_category_types_code'), table_name='category_types')
    op.drop_table('category_types')
