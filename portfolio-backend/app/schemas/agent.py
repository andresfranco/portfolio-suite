from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


class AgentCredentialBase(BaseModel):
    name: str
    provider: str  # openai | anthropic | google | mistral | custom
    extra: Optional[Dict[str, Any]] = None


class AgentCredentialCreate(AgentCredentialBase):
    api_key: str = Field(..., min_length=1)


class AgentCredentialOut(AgentCredentialBase):
    id: int

    class Config:
        from_attributes = True


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


class AgentOut(AgentBase):
    id: int

    class Config:
        from_attributes = True


class AgentTemplateCreate(BaseModel):
    agent_id: int
    name: Optional[str] = None
    is_default: Optional[bool] = False
    system_prompt: str
    user_prefix: Optional[str] = None
    citation_format: str = "markdown"


class AgentTemplateOut(AgentTemplateCreate):
    id: int

    class Config:
        from_attributes = True


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


