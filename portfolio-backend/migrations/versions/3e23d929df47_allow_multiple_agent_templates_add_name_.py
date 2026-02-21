"""allow multiple agent templates; add name and is_default

Revision ID: 3e23d929df47
Revises: 5a2d3fb84cd3
Create Date: 2025-08-22 22:32:39.177378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e23d929df47'
down_revision: Union[str, None] = '5a2d3fb84cd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop unique index on agent_templates.agent_id to allow multiple templates per agent
    with op.batch_alter_table('agent_templates') as batch_op:
        batch_op.drop_index('ux_agent_templates_agent_id')
        batch_op.add_column(sa.Column('name', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('is_default', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    # Create a composite unique constraint to prevent duplicate names per agent
    op.create_unique_constraint('ux_agent_templates_agent_id_name', 'agent_templates', ['agent_id', 'name'])

    # Backfill names for existing rows (set to 'default') and mark as default
    op.execute("UPDATE agent_templates SET name = 'default', is_default = true WHERE name IS NULL")


def downgrade() -> None:
    # Remove composite unique constraint
    op.drop_constraint('ux_agent_templates_agent_id_name', 'agent_templates', type_='unique')

    # Drop added columns and recreate unique index on agent_id
    with op.batch_alter_table('agent_templates') as batch_op:
        batch_op.drop_column('is_default')
        batch_op.drop_column('name')
        batch_op.create_index('ux_agent_templates_agent_id', ['agent_id'], unique=True)
