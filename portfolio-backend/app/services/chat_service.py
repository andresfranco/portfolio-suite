from __future__ import annotations
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.agent import Agent, AgentCredential, AgentTemplate, AgentSession, AgentMessage, AgentTestRun
from app.services.llm.providers import build_provider
from app.services.rag_service import embed_query, vector_search, assemble_context
import os


def _get_agent_bundle(db: Session, agent_id: int, template_id: Optional[int] = None) -> Tuple[Agent, AgentCredential, AgentTemplate]:
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.is_active == True).first()
    if not agent:
        raise ValueError("Agent not found or inactive")
    cred = db.query(AgentCredential).filter(AgentCredential.id == agent.credential_id).first()
    if not cred:
        raise ValueError("Credential not found")
    tpl: Optional[AgentTemplate] = None
    if template_id:
        tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent.id, AgentTemplate.id == template_id).first()
    if not tpl:
        # Prefer default template if exists
        tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent.id, AgentTemplate.is_default == True).first()
    if not tpl:
        tpl = db.query(AgentTemplate).filter(AgentTemplate.agent_id == agent.id).order_by(AgentTemplate.id.asc()).first()
    if not tpl:
        # Provide a default one-off template when not configured
        tpl = AgentTemplate(agent_id=agent.id, system_prompt="You are a helpful assistant that answers strictly from the provided context. If the context does not contain the answer, say you don't know.")
    return agent, cred, tpl


def _decrypt_api_key(db: Session, encrypted: str) -> str:
    # Encrypted is base64 from pgp_sym_encrypt; decrypt via pg function using env-provided key
    kms_key = os.getenv("AGENT_KMS_KEY")
    if not kms_key:
        raise ValueError("AGENT_KMS_KEY env is not set on the backend process")
    row = db.execute(text("SELECT pgp_sym_decrypt(decode(:b64, 'base64'), :k) AS api_key"), {
        "b64": encrypted,
        "k": kms_key,
    }).first()
    return row[0] if row and row[0] else ""


def run_agent_chat(db: Session, *, agent_id: int, user_message: str, session_id: int | None, template_id: Optional[int] = None, portfolio_id: Optional[int] = None) -> Dict[str, Any]:
    agent, cred, tpl = _get_agent_bundle(db, agent_id, template_id)

    # Decrypt API key using pgcrypto; AGENT_KMS_KEY must be set in DB or provided as env setting applied to current session
    # If direct current_setting use is not configured, fall back to env var
    api_key: str
    try:
        api_key = _decrypt_api_key(db, cred.api_key_encrypted) if cred.api_key_encrypted else ""
    except Exception:
        api_key = ""
    # Fallback to env if decryption failed or produced empty key
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY", "") if cred.provider.lower() in ("openai", "custom") else os.getenv("AGENT_PROVIDER_KEY", "")
    # If still missing, fail fast with a clear message (handled as 400 by ValueError handler)
    if not api_key:
        raise ValueError(
            "No API key configured for provider. Either create a credential (requires AGENT_KMS_KEY) or set OPENAI_API_KEY/AGENT_PROVIDER_KEY."
        )

    provider = build_provider(cred.provider, api_key=api_key, base_url=(cred.extra or {}).get("base_url"), extra=cred.extra or {})

    # Embed query and retrieve chunks
    qvec = embed_query(db, provider=provider, embedding_model=agent.embedding_model, query=user_message)
    chunks = vector_search(db, qvec=qvec, model=agent.embedding_model, k=agent.top_k, score_threshold=agent.score_threshold, portfolio_id=portfolio_id)
    context, citations = assemble_context(chunks, max_tokens=agent.max_context_tokens)
    # Short-circuit if no context was found to avoid slow external calls
    if not context.strip():
        # Persist session messages even on no-context for traceability
        sess_id = session_id
        if not sess_id:
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        m_user = AgentMessage(session_id=sess_id, role="user", content=user_message)
        db.add(m_user)
        fallback = "I don't know based on the provided context. Please upload or link your resume, or add experiences to the portfolio."
        m_assist = AgentMessage(session_id=sess_id, role="assistant", content=fallback, citations=[], tokens=0, latency_ms=0)
        db.add(m_assist)
        db.commit()
        return {
            "answer": fallback,
            "citations": [],
            "token_usage": {},
            "latency_ms": 0,
            "session_id": sess_id,
        }

    # Prepare chat messages
    user_text = user_message if not tpl.user_prefix else f"{tpl.user_prefix} {user_message}"
    # Strengthen system prompt for simple, context-only answers
    system_prompt = (tpl.system_prompt or "").strip() or (
        "You are a helpful portfolio chatbot. Answer in simple, clear language. "
        "Use only the provided context from the portfolio database and its attachments (like resumes). "
        "If the answer is not in the context, say you don't know and suggest what info to provide."
    )
    messages = [
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {user_text}"}
    ]

    # Choose low-cost default OpenAI chat model per your guidance
    chat_model = agent.chat_model or "gpt-4o-mini"  # default low-cost model; adjust as needed
    try:
        result = provider.chat(model=chat_model, system_prompt=system_prompt, messages=messages)
    except Exception as e:
        # Return a graceful error that fits the API envelope to avoid frontend timeouts
        fail_text = "I couldn't complete the request in time. Please try again in a moment."
        sess_id = session_id
        if not sess_id:
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
        db.add(AgentMessage(session_id=sess_id, role="assistant", content=fail_text, citations=[], tokens=0, latency_ms=0))
        db.commit()
        return {
            "answer": fail_text,
            "citations": [],
            "token_usage": {},
            "latency_ms": 0,
            "session_id": sess_id,
        }

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


def run_agent_test(db: Session, *, agent_id: int, prompt: str, template_id: Optional[int] = None, portfolio_id: Optional[int] = None) -> Dict[str, Any]:
    out = run_agent_chat(db, agent_id=agent_id, user_message=prompt, session_id=None, template_id=template_id, portfolio_id=portfolio_id)
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


