"""create system settings table

Revision ID: 8c0a5f1e0b0a
Revises: b1fdef107aea
Create Date: 2025-08-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8c0a5f1e0b0a'
down_revision = 'f173da99a68e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_system_settings_key')
    )
    op.create_index('ix_system_settings_id', 'system_settings', ['id'])
    op.create_index('ix_system_settings_key', 'system_settings', ['key'])

    # Seed defaults
    conn = op.get_bind()
    conn.execute(sa.text(
        """
        INSERT INTO system_settings (key, value, description)
        VALUES 
          ('auth.access_token_expire_minutes', '30', 'Access token expiry in minutes'),
          ('auth.refresh_token_expire_minutes', '10080', 'Refresh token expiry in minutes (7 days)'),
          ('frontend.idle_timeout_minutes', '30', 'Frontend idle timeout in minutes')
        ON CONFLICT (key) DO NOTHING
        """
    ))


def downgrade() -> None:
    op.drop_index('ix_system_settings_id', table_name='system_settings')
    op.drop_index('ix_system_settings_key', table_name='system_settings')
    op.drop_table('system_settings')


