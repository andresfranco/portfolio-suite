from __future__ import annotations
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.agent import Agent, AgentCredential, AgentTemplate, AgentSession, AgentMessage, AgentTestRun
from app.services.llm.providers import build_provider
from app.services.rag_service import embed_query, vector_search, assemble_context
import os


def _get_agent_bundle(db: Session, agent_id: int) -> Tuple[Agent, AgentCredential, AgentTemplate]:
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.is_active == True).first()
    if not agent:
        raise ValueError("Agent not found or inactive")
    cred = db.query(AgentCredential).filter(AgentCredential.id == agent.credential_id).first()
    if not cred:
        raise ValueError("Credential not found")
    tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent.id).first()
    if not tpl:
        # Provide a default one-off template when not configured
        tpl = AgentTemplate(agent_id=agent.id, system_prompt="You are a helpful assistant that answers strictly from the provided context. If the context does not contain the answer, say you don't know.")
    return agent, cred, tpl


def _decrypt_api_key(db: Session, encrypted: str) -> str:
    # Encrypted is base64 from pgp_sym_encrypt; decrypt via pg function using env-provided key
    kms_key = os.getenv("AGENT_KMS_KEY")
    if not kms_key:
        raise ValueError("AGENT_KMS_KEY env is not set on the backend process")
    row = db.execute(text("SELECT convert_from(pgp_sym_decrypt(decode(:b64, 'base64'), :k), 'utf8') AS api_key"), {
        "b64": encrypted,
        "k": kms_key,
    }).first()
    return row[0] if row and row[0] else ""


def run_agent_chat(db: Session, *, agent_id: int, user_message: str, session_id: int | None) -> Dict[str, Any]:
    agent, cred, tpl = _get_agent_bundle(db, agent_id)

    # Decrypt API key using pgcrypto; AGENT_KMS_KEY must be set in DB or provided as env setting applied to current session
    # If direct current_setting use is not configured, fall back to env var
    api_key: str
    try:
        api_key = _decrypt_api_key(db, cred.api_key_encrypted) if cred.api_key_encrypted else ""
    except Exception:
        api_key = os.getenv("OPENAI_API_KEY", "") if cred.provider.lower() in ("openai", "custom") else os.getenv("AGENT_PROVIDER_KEY", "")

    provider = build_provider(cred.provider, api_key=api_key, base_url=(cred.extra or {}).get("base_url"), extra=cred.extra or {})

    # Embed query and retrieve chunks
    qvec = embed_query(db, provider=provider, embedding_model=agent.embedding_model, query=user_message)
    chunks = vector_search(db, qvec=qvec, model=agent.embedding_model, k=agent.top_k, score_threshold=agent.score_threshold)
    context, citations = assemble_context(chunks, max_tokens=agent.max_context_tokens)

    # Prepare chat messages
    user_text = user_message if not tpl.user_prefix else f"{tpl.user_prefix} {user_message}"
    messages = [
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {user_text}"}
    ]

    # Choose low-cost default OpenAI chat model per your guidance
    chat_model = agent.chat_model or "gpt-4o-mini"  # default low-cost model; adjust as needed
    result = provider.chat(model=chat_model, system_prompt=tpl.system_prompt, messages=messages)

    # Persist minimal session/message if requested
    sess_id = session_id
    if not sess_id:
        s = AgentSession(agent_id=agent.id)
        db.add(s)
        db.flush()
        sess_id = s.id
    m_user = AgentMessage(session_id=sess_id, role="user", content=user_message)
    db.add(m_user)
    m_assist = AgentMessage(session_id=sess_id, role="assistant", content=result.get("text") or "", citations=citations, tokens=(result.get("usage") or {}).get("total_tokens"), latency_ms=result.get("latency_ms"))
    db.add(m_assist)
    db.commit()

    return {
        "answer": result.get("text") or "",
        "citations": citations,
        "token_usage": result.get("usage") or {},
        "latency_ms": result.get("latency_ms") or 0,
        "session_id": sess_id,
    }


def run_agent_test(db: Session, *, agent_id: int, prompt: str) -> Dict[str, Any]:
    out = run_agent_chat(db, agent_id=agent_id, user_message=prompt, session_id=None)
    tr = AgentTestRun(agent_id=agent_id, prompt=prompt, response=out.get("answer"), status="ok", latency_ms=out.get("latency_ms"), token_usage=out.get("token_usage"), citations=out.get("citations"))
    db.add(tr)
    db.commit()
    return {
        "test_run_id": tr.id,
        "status": tr.status,
        "latency_ms": tr.latency_ms or 0,
        "citations": out.get("citations") or [],
        "answer": out.get("answer") or "",
    }


