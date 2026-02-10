"""add default_agent_id to portfolios

Revision ID: 20260210_01
Revises: 9eadd818749d
Create Date: 2026-02-10 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260210_01"
down_revision: Union[str, None] = "9eadd818749d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("portfolios", sa.Column("default_agent_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_portfolios_default_agent_id"), "portfolios", ["default_agent_id"], unique=False)
    op.create_foreign_key(
        "fk_portfolios_default_agent_id_agents",
        "portfolios",
        "agents",
        ["default_agent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_portfolios_default_agent_id_agents", "portfolios", type_="foreignkey")
    op.drop_index(op.f("ix_portfolios_default_agent_id"), table_name="portfolios")
    op.drop_column("portfolios", "default_agent_id")
