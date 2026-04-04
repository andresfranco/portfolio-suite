from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class AgentCredentialBase(BaseModel):
    name: str
    provider: str  # openai | anthropic | google | mistral | custom
    extra: Optional[Dict[str, Any]] = None


class AgentCredentialCreate(AgentCredentialBase):
    api_key: str = Field(..., min_length=1)
    model_default: Optional[str] = None
    base_url: Optional[str] = None
    purpose: Optional[List[str]] = None  # e.g. ["chat", "career_primary", "embedding"]


class AgentCredentialUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    model_default: Optional[str] = None
    base_url: Optional[str] = None
    purpose: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AgentCredentialRotate(BaseModel):
    """Replace the API key on an existing credential without recreating it."""
    api_key: str = Field(..., min_length=1)


class CredentialAssignments(BaseModel):
    """Maps system roles to credential IDs and optional model overrides.

    Each field corresponds to a ``system_settings`` key:
    - ``career_credential_id``   → ``career.credential_id``
    - ``career_model``           → ``career.model``
    - ``career_fallback_id``     → ``career.fallback_credential_id``
    - ``career_fallback_model``  → ``career.fallback_model``
    - ``embed_credential_id``    → ``embed.credential_id``
    - ``anthropic_credential_id`` → ``anthropic.credential_id``
    """
    career_credential_id: Optional[int] = None
    career_model: Optional[str] = None
    career_fallback_id: Optional[int] = None
    career_fallback_model: Optional[str] = None
    embed_credential_id: Optional[int] = None
    anthropic_credential_id: Optional[int] = None


class AgentCredentialOut(AgentCredentialBase):
    id: int
    model_default: Optional[str] = None
    base_url: Optional[str] = None
    purpose: Optional[List[str]] = None
    is_active: bool = True
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None
    credential_id: int
    embedding_model: str = "text-embedding-3-small"
    top_k: int = 8
    score_threshold: Optional[float] = None
    max_context_tokens: int = 4000
    rerank_provider: Optional[str] = None
    rerank_model: Optional[str] = None
    chat_model: Optional[str] = None
    is_active: bool = True
    usage_limit: Optional[int] = None
    budget_limit: Optional[float] = None


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    credential_id: Optional[int] = None
    embedding_model: Optional[str] = None
    top_k: Optional[int] = None
    score_threshold: Optional[float] = None
    max_context_tokens: Optional[int] = None
    rerank_provider: Optional[str] = None
    rerank_model: Optional[str] = None
    chat_model: Optional[str] = None
    is_active: Optional[bool] = None
    usage_limit: Optional[int] = None
    budget_limit: Optional[float] = None


class AgentOut(AgentBase):
    id: int
    current_usage: int = 0
    current_cost: float = 0.0
    usage_reset_at: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class AgentTemplateCreate(BaseModel):
    agent_id: int
    name: Optional[str] = None
    is_default: Optional[bool] = False
    system_prompt: str
    user_prefix: Optional[str] = None
    citation_format: str = "markdown"


class AgentTemplateOut(AgentTemplateCreate):
    id: int
    
    model_config = ConfigDict(from_attributes=True)


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    portfolio_id: Optional[int] = None
    # Optional free-text portfolio name or query; backend will attempt to resolve to an ID
    portfolio_query: Optional[str] = None
    language_id: Optional[int] = None


class ChatResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]] = []
    token_usage: Dict[str, Any] = {}
    latency_ms: int


class AgentTestRequest(BaseModel):
    agent_id: int
    prompt: str
    template_id: Optional[int] = None
    portfolio_id: Optional[int] = None
    # Optional free-text portfolio name or query; backend will attempt to resolve to an ID
    portfolio_query: Optional[str] = None


class AgentTestResponse(BaseModel):
    test_run_id: int
    status: str
    latency_ms: int
    citations: List[Dict[str, Any]] = []
    answer: str


