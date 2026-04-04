"""add purpose, base_url, model_default, is_active, last_used_at, audit fields to agent_credentials

Revision ID: 20260403_01
Revises: 20260210_01
Create Date: 2026-04-03 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "20260403_01"
down_revision: Union[str, None] = "20260210_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new first-class columns to agent_credentials
    op.add_column("agent_credentials", sa.Column("base_url", sa.String(2048), nullable=True))
    op.add_column("agent_credentials", sa.Column("model_default", sa.String(100), nullable=True))
    op.add_column("agent_credentials", sa.Column("purpose", JSONB, nullable=True))
    op.add_column("agent_credentials", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("agent_credentials", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("agent_credentials", sa.Column("created_by", sa.Integer(), nullable=True))
    op.add_column("agent_credentials", sa.Column("updated_by", sa.Integer(), nullable=True))

    # Backfill base_url from extra->>'base_url' for existing rows
    op.execute(
        """
        UPDATE agent_credentials
        SET base_url = extra->>'base_url'
        WHERE extra IS NOT NULL AND extra->>'base_url' IS NOT NULL AND base_url IS NULL
        """
    )

    # Tag all existing credentials as general "chat" credentials
    op.execute(
        """
        UPDATE agent_credentials
        SET purpose = '["chat"]'::jsonb
        WHERE purpose IS NULL
        """
    )

    # GIN index on purpose for JSONB containment queries (@>)
    op.create_index(
        "ix_agent_credentials_purpose",
        "agent_credentials",
        ["purpose"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_agent_credentials_purpose", table_name="agent_credentials")
    op.drop_column("agent_credentials", "updated_by")
    op.drop_column("agent_credentials", "created_by")
    op.drop_column("agent_credentials", "last_used_at")
    op.drop_column("agent_credentials", "is_active")
    op.drop_column("agent_credentials", "purpose")
    op.drop_column("agent_credentials", "model_default")
    op.drop_column("agent_credentials", "base_url")
