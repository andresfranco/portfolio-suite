"""add rag_index_status table

Revision ID: 13abcde99999
Revises: 12abcde67890
Create Date: 2025-08-15 21:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '13abcde99999'
down_revision = '12abcde67890'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'rag_index_status',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('source_table', sa.Text(), nullable=False),
        sa.Column('source_id', sa.Text(), nullable=False),
        sa.Column('last_indexed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_unique_constraint('uq_rag_index_status_src', 'rag_index_status', ['source_table', 'source_id'])


def downgrade() -> None:
    try:
        op.drop_constraint('uq_rag_index_status_src', 'rag_index_status', type_='unique')
    except Exception:
        pass
    op.drop_table('rag_index_status')


