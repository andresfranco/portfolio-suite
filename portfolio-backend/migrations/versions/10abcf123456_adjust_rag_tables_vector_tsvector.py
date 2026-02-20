"""adjust rag tables to use vector and tsvector

Revision ID: 10abcf123456
Revises: 9f1a2b3c4d5e
Create Date: 2025-08-15 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '10abcf123456'
down_revision = '9f1a2b3c4d5e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    ctx = op.get_context()
    conn = op.get_bind()

    # Ensure vector extension (autocommit block)
    try:
        with ctx.autocommit_block():
            op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    except Exception:
        pass

    # Adjust rag_chunk.tsv to be generated tsvector
    try:
        with ctx.autocommit_block():
            op.execute("DROP INDEX IF EXISTS idx_rag_chunk_tsv")
    except Exception:
        pass
    insp = sa.inspect(conn)
    cols = [c['name'] for c in insp.get_columns('rag_chunk')]
    if 'tsv' in cols:
        try:
            with ctx.autocommit_block():
                op.execute("ALTER TABLE rag_chunk DROP COLUMN tsv")
        except Exception:
            pass
    try:
        with ctx.autocommit_block():
            op.execute("ALTER TABLE rag_chunk ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(text,''))) STORED")
            op.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunk_tsv ON rag_chunk USING GIN(tsv)")
    except Exception:
        pass

    # Add vector column for embeddings
    cols_emb = [c['name'] for c in insp.get_columns('rag_embedding')]
    if 'embedding_vec' not in cols_emb:
        try:
            with ctx.autocommit_block():
                op.execute("ALTER TABLE rag_embedding ADD COLUMN embedding_vec vector")
        except Exception:
            pass
    # Create HNSW index if possible
    try:
        with ctx.autocommit_block():
            op.execute("CREATE INDEX IF NOT EXISTS idx_rag_embedding_hnsw ON rag_embedding USING hnsw (embedding_vec vector_cosine_ops)")
    except Exception:
        pass


def downgrade() -> None:
    # Drop hnsw index and vector column
    try:
        op.execute("DROP INDEX IF EXISTS idx_rag_embedding_hnsw")
    except Exception:
        pass
    try:
        op.execute("ALTER TABLE rag_embedding DROP COLUMN IF EXISTS embedding_vec")
    except Exception:
        pass
    # Drop tsv index and column, recreate simple tsv TEXT column
    try:
        op.execute("DROP INDEX IF EXISTS idx_rag_chunk_tsv")
    except Exception:
        pass
    try:
        op.execute("ALTER TABLE rag_chunk DROP COLUMN IF EXISTS tsv")
        op.execute("ALTER TABLE rag_chunk ADD COLUMN tsv TEXT")
    except Exception:
        pass


