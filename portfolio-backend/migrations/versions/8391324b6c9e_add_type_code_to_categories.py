"""add_type_code_to_categories

Revision ID: 8391324b6c9e
Revises: ...
Create Date: 2025-03-14 15:10:54.158494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from alembic.operations import Operations
from alembic.operations.ops import MigrationScript


# revision identifiers, used by Alembic.
revision: str = '8391324b6c9e'
down_revision: Union[str, None] = '...'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add type_code column to categories table
    op.add_column('categories', sa.Column('type_code', sa.String(5), nullable=True))
    
    # Set default value for existing records
    op.execute("UPDATE categories SET type_code = 'GEN' WHERE type_code IS NULL")
    
    # For SQLite, we need to use batch operations to add foreign key constraints
    with op.batch_alter_table('categories') as batch_op:
        # Make the column not nullable after setting default values
        batch_op.alter_column('type_code', nullable=False)
        
        # Create foreign key constraint
        batch_op.create_foreign_key(
            'fk_categories_type_code_category_types',
            'category_types',
            ['type_code'],
            ['code']
        )


def downgrade() -> None:
    # For SQLite, we need to use batch operations to drop foreign key constraints
    with op.batch_alter_table('categories') as batch_op:
        # Drop foreign key constraint
        batch_op.drop_constraint('fk_categories_type_code_category_types', type_='foreignkey')
    
    # Drop type_code column
    op.drop_column('categories', 'type_code')
