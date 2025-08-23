from __future__ import annotations

from typing import Any, Dict, List, Optional

import os


# Simple stub DB session with no-op methods
class StubDB:
    def add(self, _obj: Any) -> None:
        return None

    def flush(self) -> None:
        return None

    def commit(self) -> None:
        return None


class FakeProvider:
    def __init__(self) -> None:
        pass

    def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        # Extract context and question
        content = messages[-1]["content"] if messages else ""
        # Very naive parse: after "Context:\n...\n\nQuestion: ..."
        ctx_marker = "Context:\n"
        q_marker = "\n\nQuestion: "
        answer = ""
        if ctx_marker in content and q_marker in content:
            ctx = content.split(ctx_marker, 1)[1]
            ctx, _q = ctx.split(q_marker, 1)
            ctx = ctx.strip()
            # If no context, follow instruction
            if not ctx:
                answer = "I don't know based on the provided context."
            else:
                # Return first sentence-like chunk to keep it simple
                answer = ctx.split("\n\n---\n\n")[0].split(".")[0].strip()
        else:
            answer = "I don't know based on the provided context."
        return {"text": answer, "usage": {"total_tokens": 0}, "latency_ms": 1}

    def embed(self, *, model: str, texts: List[str]) -> List[List[float]]:
        # Return a small fixed-dim vector per input
        return [[0.1, 0.2, 0.3] for _ in texts]


def _install_fakes():
    # Inject fake provider and retrieval functions
    from app.services import llm as _llm
    from app.services.llm import providers as prov_mod
    from app.services import rag_service as rag

    # Swap provider builder
    def fake_build_provider(provider: str, *, api_key: str, base_url: Optional[str] = None, extra: Optional[Dict[str, Any]] = None):
        return FakeProvider()

    prov_mod.build_provider = fake_build_provider  # type: ignore

    # Track last query
    state: Dict[str, Any] = {"last_query": ""}

    def fake_embed_query(db, *, provider, embedding_model: str, query: str) -> List[float]:  # type: ignore
        state["last_query"] = query
        return [0.1, 0.2, 0.3]

    def fake_vector_search(db, *, qvec, model: str, k: int, score_threshold: Optional[float], portfolio_id: Optional[int] = None):  # type: ignore
        q = state.get("last_query", "").lower()
        items: List[Dict[str, Any]] = []
        if "snowflake" in q:
            items.append({
                "chunk_id": 1,
                "source_table": "experiences",
                "source_id": "101",
                "source_field": "body",
                "part_index": 0,
                "version": 1,
                "text": "Snowflake: 3 years building data warehouses and ELT pipelines.",
                "score": 0.92,
            })
        elif "mulesoft" in q:
            items.append({
                "chunk_id": 2,
                "source_table": "portfolio_attachments",
                "source_id": "55",
                "source_field": "doc",
                "part_index": 0,
                "version": 1,
                "text": "Resume excerpt: Mulesoft integrations across Salesforce and SAP; designed APIs and RAML.",
                "score": 0.88,
            })
        else:
            # No relevant chunks
            items = []
        return items

    rag.embed_query = fake_embed_query  # type: ignore
    rag.vector_search = fake_vector_search  # type: ignore


def test_chat_snowflake_experience():
    os.environ["OPENAI_API_KEY"] = "test"
    _install_fakes()

    from app.services.chat_service import run_agent_chat

    # Stub bundle by setting portfolio_id and providing a session id to avoid session creation
    db = StubDB()
    # Also stub _get_agent_bundle to avoid ORM usage
    import app.services.chat_service as cs

    class _Agent:
        id = 1
        embedding_model = "text-embedding-3-small"
        top_k = 5
        score_threshold = None
        max_context_tokens = 4000
        chat_model = "gpt-4o-mini"

    class _Cred:
        provider = "openai"
        api_key_encrypted: Optional[str] = None
        extra: Dict[str, Any] = {}

    class _Tpl:
        system_prompt = "You are a helpful assistant that answers from provided context only."
        user_prefix = None

    def fake_bundle(_db, _agent_id: int, _tpl_id: Optional[int] = None):
        return _Agent(), _Cred(), _Tpl()

    cs._get_agent_bundle = fake_bundle  # type: ignore

    out = run_agent_chat(db, agent_id=1, user_message="Tell me about your experience in Snowflake", session_id=1, template_id=None, portfolio_id=42)
    assert "Snowflake" in out["answer"]
    assert isinstance(out.get("citations"), list)


def test_chat_mulesoft_summary():
    os.environ["OPENAI_API_KEY"] = "test"
    _install_fakes()

    from app.services.chat_service import run_agent_chat
    import app.services.chat_service as cs

    class _Agent:
        id = 1
        embedding_model = "text-embedding-3-small"
        top_k = 5
        score_threshold = None
        max_context_tokens = 4000
        chat_model = "gpt-4o-mini"

    class _Cred:
        provider = "openai"
        api_key_encrypted: Optional[str] = None
        extra: Dict[str, Any] = {}

    class _Tpl:
        system_prompt = "You are a helpful assistant that answers from provided context only."
        user_prefix = None

    def fake_bundle(_db, _agent_id: int, _tpl_id: Optional[int] = None):
        return _Agent(), _Cred(), _Tpl()

    cs._get_agent_bundle = fake_bundle  # type: ignore

    db = StubDB()
    out = run_agent_chat(db, agent_id=1, user_message="Give a summary of your experience in Mulesoft.", session_id=1, template_id=None, portfolio_id=42)
    assert "Mulesoft" in out["answer"]
    assert isinstance(out.get("citations"), list)


def test_chat_unknown_returns_dont_know():
    os.environ["OPENAI_API_KEY"] = "test"
    _install_fakes()

    from app.services.chat_service import run_agent_chat
    import app.services.chat_service as cs

    class _Agent:
        id = 1
        embedding_model = "text-embedding-3-small"
        top_k = 5
        score_threshold = None
        max_context_tokens = 4000
        chat_model = "gpt-4o-mini"

    class _Cred:
        provider = "openai"
        api_key_encrypted: Optional[str] = None
        extra: Dict[str, Any] = {}

    class _Tpl:
        system_prompt = "You are a helpful assistant that answers from provided context only."
        user_prefix = None

    def fake_bundle(_db, _agent_id: int, _tpl_id: Optional[int] = None):
        return _Agent(), _Cred(), _Tpl()

    cs._get_agent_bundle = fake_bundle  # type: ignore

    db = StubDB()
    out = run_agent_chat(db, agent_id=1, user_message="What about Kubernetes on Mars?", session_id=1, template_id=None, portfolio_id=42)
    assert "don't know" in out["answer"].lower()
    assert isinstance(out.get("citations"), list)


