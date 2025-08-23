from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250820_01_agent_admin_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Ensure pgcrypto extension for encryption
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        'agent_credentials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('api_key_encrypted', sa.Text(), nullable=True),
        sa.Column('extra', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_agent_credentials_name', 'agent_credentials', ['name'], unique=True)

    op.create_table(
        'agents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('credential_id', sa.Integer(), sa.ForeignKey('agent_credentials.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('embedding_model', sa.String(100), nullable=False, server_default='text-embedding-3-small'),
        sa.Column('top_k', sa.Integer(), nullable=False, server_default='8'),
        sa.Column('score_threshold', sa.Float(), nullable=True),
        sa.Column('max_context_tokens', sa.Integer(), nullable=False, server_default='4000'),
        sa.Column('rerank_provider', sa.String(50), nullable=True),
        sa.Column('rerank_model', sa.String(100), nullable=True),
        sa.Column('chat_model', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_agents_name', 'agents', ['name'], unique=True)

    op.create_table(
        'agent_templates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('agent_id', sa.Integer(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('system_prompt', sa.Text(), nullable=False, server_default=sa.text("'You are a helpful assistant that answers strictly from the provided context. If the context does not contain the answer, say you don''t know.'")),
        sa.Column('user_prefix', sa.String(100), nullable=True),
        sa.Column('citation_format', sa.String(20), nullable=False, server_default='markdown'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ux_agent_templates_agent_id', 'agent_templates', ['agent_id'], unique=True)

    op.create_table(
        'agent_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('agent_id', sa.Integer(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'agent_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('agent_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('citations', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('tokens', sa.Integer(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'agent_test_runs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('agent_id', sa.Integer(), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('response', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='ok'),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('token_usage', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('citations', sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade():
    op.drop_table('agent_test_runs')
    op.drop_table('agent_messages')
    op.drop_table('agent_sessions')
    op.drop_index('ux_agent_templates_agent_id', table_name='agent_templates')
    op.drop_table('agent_templates')
    op.drop_index('ix_agents_name', table_name='agents')
    op.drop_table('agents')
    op.drop_index('ix_agent_credentials_name', table_name='agent_credentials')
    op.drop_table('agent_credentials')

