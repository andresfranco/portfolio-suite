"""add visibility to rag_chunk

Revision ID: 11abcde12345
Revises: 10abcf123456
Create Date: 2025-08-15 21:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '11abcde12345'
down_revision = '10abcf123456'
branch_labels = None
depends_on = None


def upgrade() -> None:
    ctx = op.get_context()
    # Add column with default
    with ctx.autocommit_block():
        op.execute("ALTER TABLE rag_chunk ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' NOT NULL")
    # Create index for visibility
    try:
        with ctx.autocommit_block():
            op.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunk_visibility ON rag_chunk(visibility)")
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.execute("DROP INDEX IF EXISTS idx_rag_chunk_visibility")
    except Exception:
        pass
    try:
        op.execute("ALTER TABLE rag_chunk DROP COLUMN IF EXISTS visibility")
    except Exception:
        pass


