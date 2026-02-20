"""add_language_id_to_project_images_and_attachments

Revision ID: d79f10af21da
Revises: 1656f139efd4
Create Date: 2025-10-28 10:53:17.602206

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd79f10af21da'
down_revision: Union[str, None] = '1656f139efd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add language_id column to project_images
    op.add_column('project_images', sa.Column('language_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'project_images_language_id_fkey',
        'project_images', 'languages',
        ['language_id'], ['id']
    )
    
    # Add category_id column to project_attachments
    op.add_column('project_attachments', sa.Column('category_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'project_attachments_category_id_fkey',
        'project_attachments', 'categories',
        ['category_id'], ['id']
    )
    
    # Add language_id column to project_attachments
    op.add_column('project_attachments', sa.Column('language_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'project_attachments_language_id_fkey',
        'project_attachments', 'languages',
        ['language_id'], ['id']
    )


def downgrade() -> None:
    # Drop foreign keys and columns from project_attachments
    op.drop_constraint('project_attachments_language_id_fkey', 'project_attachments', type_='foreignkey')
    op.drop_constraint('project_attachments_category_id_fkey', 'project_attachments', type_='foreignkey')
    op.drop_column('project_attachments', 'language_id')
    op.drop_column('project_attachments', 'category_id')
    
    # Drop foreign key and column from project_images
    op.drop_constraint('project_images_language_id_fkey', 'project_images', type_='foreignkey')
    op.drop_column('project_images', 'language_id')
