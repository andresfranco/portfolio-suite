"""create_skill_types_table

Revision ID: create_skill_types_table
Revises: None
Create Date: 2025-03-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'create_skill_types_table'
down_revision: Union[str, None] = None  # Start a new branch
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name):
    """Check if a table exists in the database."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    return column_name in [col['name'] for col in inspector.get_columns(table_name)]


def upgrade() -> None:
    # Check if skill_types table already exists
    if not table_exists('skill_types'):
        # Create the skill_types table
        op.create_table(
            'skill_types',
            sa.Column('code', sa.String(5), primary_key=True),
            sa.Column('name', sa.String()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=text('CURRENT_TIMESTAMP')),
            sa.Column('created_by', sa.String()),
            sa.Column('updated_by', sa.String())
        )
        
        # Create index for skill_types code
        op.create_index(op.f('ix_skill_types_code'), 'skill_types', ['code'], unique=True)
    
    # Check if skills table exists and type_code column doesn't exist
    if table_exists('skills') and not column_exists('skills', 'type_code'):
        # Add type_code column to skills table
        op.add_column('skills', sa.Column('type_code', sa.String(5), nullable=True))
        
        # Create foreign key constraint
        op.create_foreign_key(
            'fk_skills_type_code_skill_types',
            'skills',
            'skill_types',
            ['type_code'],
            ['code']
        )


def downgrade() -> None:
    # Check if skills table exists and type_code column exists
    if table_exists('skills') and column_exists('skills', 'type_code'):
        # Drop foreign key constraint
        op.drop_constraint('fk_skills_type_code_skill_types', 'skills', type_='foreignkey')
        
        # Drop type_code column
        op.drop_column('skills', 'type_code')
    
    # Check if skill_types table exists
    if table_exists('skill_types'):
        # Drop index
        op.drop_index(op.f('ix_skill_types_code'), table_name='skill_types')
        
        # Drop skill_types table
        op.drop_table('skill_types') 