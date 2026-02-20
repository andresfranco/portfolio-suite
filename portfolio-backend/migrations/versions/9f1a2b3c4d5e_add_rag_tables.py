"""add rag tables

Revision ID: 9f1a2b3c4d5e
Revises: 8c0a5f1e0b0a
Create Date: 2025-08-15 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '9f1a2b3c4d5e'
down_revision = '8c0a5f1e0b0a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        'rag_chunk',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('source_table', sa.Text(), nullable=False),
        sa.Column('source_id', sa.Text(), nullable=False),
        sa.Column('source_field', sa.Text(), nullable=True),
        sa.Column('source_uri', sa.Text(), nullable=True),
        sa.Column('modality', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.Text(), nullable=True),
        sa.Column('part_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('checksum', sa.Text(), nullable=True),
        sa.Column('lang', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('tsv', sa.TEXT(), nullable=True),
    )
    op.create_index('idx_rag_chunk_source', 'rag_chunk', ['source_table', 'source_id'])
    op.create_unique_constraint('uq_rag_chunk_logical', 'rag_chunk', ['source_table', 'source_id', 'source_field', 'part_index', 'version'])

    op.create_table(
        'rag_embedding',
        sa.Column('chunk_id', sa.BigInteger(), nullable=False),
        sa.Column('model', sa.Text(), nullable=False),
        sa.Column('modality', sa.Text(), nullable=False),
        sa.Column('dim', sa.Integer(), nullable=False),
        sa.Column('embedding', sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint('chunk_id', 'model', 'modality'),
        sa.ForeignKeyConstraint(['chunk_id'], ['rag_chunk.id'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    op.drop_table('rag_embedding')
    op.drop_constraint('uq_rag_chunk_logical', 'rag_chunk', type_='unique')
    op.drop_index('idx_rag_chunk_source', table_name='rag_chunk')
    op.drop_table('rag_chunk')


