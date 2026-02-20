"""add rag_dead_letter table

Revision ID: 14deadbeef00
Revises: 13abcde99999
Create Date: 2025-08-16 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '14deadbeef00'
down_revision = '13abcde99999'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'rag_dead_letter',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('job_type', sa.Text(), nullable=False),  # 'index' | 'retire'
        sa.Column('source_table', sa.Text(), nullable=True),
        sa.Column('source_id', sa.Text(), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('retries', sa.Integer(), server_default='0', nullable=False),
    )
    try:
        op.create_index('idx_rag_dead_letter_created', 'rag_dead_letter', ['created_at'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index('idx_rag_dead_letter_created', table_name='rag_dead_letter')
    except Exception:
        pass
    op.drop_table('rag_dead_letter')
