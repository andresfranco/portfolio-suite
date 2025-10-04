from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AgentCredential(Base):
    __tablename__ = "agent_credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    provider = Column(String(50), nullable=False)  # openai | anthropic | google | mistral | custom
    # Store encrypted API key as bytea; encryption/decryption handled via pgcrypto in CRUD/service
    api_key_encrypted = Column(String, nullable=True)  # base64-encoded bytea string
    # Optional extras such as base_url, org, project, account_id, scopes, headers
    extra = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    agents = relationship("Agent", back_populates="credential")


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    credential_id = Column(Integer, ForeignKey("agent_credentials.id", ondelete="RESTRICT"), nullable=False)

    # Retrieval configuration
    embedding_model = Column(String(100), nullable=False, default="text-embedding-3-small")
    top_k = Column(Integer, nullable=False, default=8)
    score_threshold = Column(Float, nullable=True)
    max_context_tokens = Column(Integer, nullable=False, default=4000)
    rerank_provider = Column(String(50), nullable=True)  # optional, stubbed
    rerank_model = Column(String(100), nullable=True)

    # Generation configuration
    chat_model = Column(String(100), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Usage tracking and limits
    usage_limit = Column(Integer, nullable=True)  # Monthly request limit
    budget_limit = Column(Float, nullable=True)  # Monthly budget limit in USD
    current_usage = Column(Integer, nullable=False, default=0)  # Current month requests
    current_cost = Column(Float, nullable=False, default=0.0)  # Current month cost in USD
    usage_reset_at = Column(DateTime(timezone=True), nullable=True)  # When usage was last reset

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    credential = relationship("AgentCredential", back_populates="agents")
    template = relationship("AgentTemplate", back_populates="agent", uselist=False)


class AgentTemplate(Base):
    __tablename__ = "agent_templates"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    system_prompt = Column(Text, nullable=False, default="You are a helpful assistant that answers strictly from the provided context. If the context does not contain the answer, say you don't know.")
    user_prefix = Column(String(100), nullable=True)
    citation_format = Column(String(20), nullable=False, default="markdown")  # markdown | text | json
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    agent = relationship("Agent", back_populates="template")


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)
    citations = Column(JSONB, nullable=True)
    tokens = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentTestRun(Base):
    __tablename__ = "agent_test_runs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ok")  # ok | error
    latency_ms = Column(Integer, nullable=True)
    token_usage = Column(JSONB, nullable=True)
    citations = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


