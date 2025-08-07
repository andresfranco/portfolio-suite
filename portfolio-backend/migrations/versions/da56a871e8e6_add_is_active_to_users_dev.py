"""add_is_active_to_users_dev

Revision ID: da56a871e8e6
Revises: d188e4cba86d
Create Date: 2025-04-06 18:19:29.347478

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'da56a871e8e6'
down_revision: Union[str, None] = 'd188e4cba86d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if we're targeting the development database
    from app.core.db_config import db_config
    if 'portfolioai_dev' not in db_config.url:
        print(f"Skipping migration: not running against development database. Current DB: {db_config.url}")
        return
    
    # Check if the column already exists before adding it
    conn = op.get_bind()
    insp = inspect(conn)
    has_column = False
    
    try:
        columns = [col['name'] for col in insp.get_columns('users')]
        has_column = 'is_active' in columns
    except Exception as e:
        print(f"Error checking for column: {e}")
    
    if not has_column:
        # Add the is_active column with default=True
        op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        
        # Create an index for the is_active column to improve query performance
        op.create_index(op.f('ix_users_is_active'), 'users', ['is_active'], unique=False)
    else:
        print("Column 'is_active' already exists, skipping creation")


def downgrade() -> None:
    # Check if we're targeting the development database
    from app.core.db_config import db_config
    if 'portfolioai_dev' not in db_config.url:
        print(f"Skipping migration: not running against development database. Current DB: {db_config.url}")
        return
    
    # Check if the column exists before dropping it
    conn = op.get_bind()
    insp = inspect(conn)
    has_column = False
    
    try:
        columns = [col['name'] for col in insp.get_columns('users')]
        has_column = 'is_active' in columns
    except Exception as e:
        print(f"Error checking for column: {e}")
    
    if has_column:
        # Drop the index first
        try:
            op.drop_index(op.f('ix_users_is_active'), table_name='users')
        except Exception as e:
            print(f"Error dropping index: {e}")
        
        # Then drop the column
        op.drop_column('users', 'is_active')
