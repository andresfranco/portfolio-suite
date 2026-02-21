"""add tenant_id to rag_chunk

Revision ID: 12abcde67890
Revises: 11abcde12345
Create Date: 2025-08-15 21:12:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '12abcde67890'
down_revision = '11abcde12345'
branch_labels = None
depends_on = None


def upgrade() -> None:
    ctx = op.get_context()
    with ctx.autocommit_block():
        op.execute("ALTER TABLE rag_chunk ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' NOT NULL")
    try:
        with ctx.autocommit_block():
            op.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunk_tenant ON rag_chunk(tenant_id)")
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.execute("DROP INDEX IF EXISTS idx_rag_chunk_tenant")
    except Exception:
        pass
    try:
        op.execute("ALTER TABLE rag_chunk DROP COLUMN IF EXISTS tenant_id")
    except Exception:
        pass


