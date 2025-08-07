"""add_is_active_to_users

Revision ID: d188e4cba86d
Revises: b1fdef107aea
Create Date: 2025-04-06 18:03:55.682151

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd188e4cba86d'
down_revision: Union[str, None] = 'b1fdef107aea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column to users table with default value of True
    # This ensures that all existing users will be active by default
    # which matches the current behavior of the is_active property method
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')))
    
    # Add an index on the is_active column for query performance
    op.create_index(op.f('ix_users_is_active'), 'users', ['is_active'], unique=False)


def downgrade() -> None:
    # Remove the index first
    op.drop_index(op.f('ix_users_is_active'), table_name='users')
    
    # Then remove the column
    op.drop_column('users', 'is_active')
