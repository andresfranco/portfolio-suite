"""add_language_id_to_project_images_and_attachments

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-10-28 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add language_id column to project_images (nullable, FK to languages)
    op.add_column('project_images', 
        sa.Column('language_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_project_images_language_id',
        'project_images', 'languages',
        ['language_id'], ['id']
    )
    
    # Add language_id column to project_attachments (nullable, FK to languages)
    op.add_column('project_attachments', 
        sa.Column('language_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_project_attachments_language_id',
        'project_attachments', 'languages',
        ['language_id'], ['id']
    )
    
    # Add category_id column to project_attachments (nullable, FK to categories)
    op.add_column('project_attachments', 
        sa.Column('category_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_project_attachments_category_id',
        'project_attachments', 'categories',
        ['category_id'], ['id']
    )


def downgrade() -> None:
    # Remove foreign keys and columns from project_attachments
    op.drop_constraint('fk_project_attachments_category_id', 'project_attachments', type_='foreignkey')
    op.drop_column('project_attachments', 'category_id')
    
    op.drop_constraint('fk_project_attachments_language_id', 'project_attachments', type_='foreignkey')
    op.drop_column('project_attachments', 'language_id')
    
    # Remove foreign key and column from project_images
    op.drop_constraint('fk_project_images_language_id', 'project_images', type_='foreignkey')
    op.drop_column('project_images', 'language_id')
