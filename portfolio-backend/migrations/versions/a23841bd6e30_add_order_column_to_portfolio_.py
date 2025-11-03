"""Add order column to portfolio association tables

Revision ID: a23841bd6e30
Revises: c8c2653e4157
Create Date: 2025-11-03 13:14:10.470145

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a23841bd6e30'
down_revision: Union[str, None] = 'c8c2653e4157'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add order column to portfolio_experiences
    op.add_column('portfolio_experiences', sa.Column('order', sa.Integer(), nullable=True))
    
    # Add order column to portfolio_projects
    op.add_column('portfolio_projects', sa.Column('order', sa.Integer(), nullable=True))
    
    # Add order column to portfolio_sections
    op.add_column('portfolio_sections', sa.Column('order', sa.Integer(), nullable=True))
    
    # Set default order values based on existing rows (assign sequential order)
    # For experiences
    op.execute("""
        UPDATE portfolio_experiences
        SET "order" = subquery.row_num
        FROM (
            SELECT portfolio_id, experience_id, 
                   ROW_NUMBER() OVER (PARTITION BY portfolio_id ORDER BY experience_id) as row_num
            FROM portfolio_experiences
        ) AS subquery
        WHERE portfolio_experiences.portfolio_id = subquery.portfolio_id
          AND portfolio_experiences.experience_id = subquery.experience_id
    """)
    
    # For projects
    op.execute("""
        UPDATE portfolio_projects
        SET "order" = subquery.row_num
        FROM (
            SELECT portfolio_id, project_id, 
                   ROW_NUMBER() OVER (PARTITION BY portfolio_id ORDER BY project_id) as row_num
            FROM portfolio_projects
        ) AS subquery
        WHERE portfolio_projects.portfolio_id = subquery.portfolio_id
          AND portfolio_projects.project_id = subquery.project_id
    """)
    
    # For sections
    op.execute("""
        UPDATE portfolio_sections
        SET "order" = subquery.row_num
        FROM (
            SELECT portfolio_id, section_id, 
                   ROW_NUMBER() OVER (PARTITION BY portfolio_id ORDER BY section_id) as row_num
            FROM portfolio_sections
        ) AS subquery
        WHERE portfolio_sections.portfolio_id = subquery.portfolio_id
          AND portfolio_sections.section_id = subquery.section_id
    """)
    
    # Make order NOT NULL after setting default values
    op.alter_column('portfolio_experiences', 'order', nullable=False)
    op.alter_column('portfolio_projects', 'order', nullable=False)
    op.alter_column('portfolio_sections', 'order', nullable=False)


def downgrade() -> None:
    # Remove order column from portfolio_experiences
    op.drop_column('portfolio_experiences', 'order')
    
    # Remove order column from portfolio_projects
    op.drop_column('portfolio_projects', 'order')
    
    # Remove order column from portfolio_sections
    op.drop_column('portfolio_sections', 'order')
