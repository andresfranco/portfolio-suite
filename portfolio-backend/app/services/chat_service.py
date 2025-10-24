from __future__ import annotations
from typing import Dict, Any, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.agent import Agent, AgentCredential, AgentTemplate, AgentSession, AgentMessage, AgentTestRun
from app.models.language import Language
from app.services.llm.providers import build_provider
from app.services.rag_service import embed_query, vector_search, assemble_context
from app.services.prompt_builder import build_rag_prompt, build_fallback_prompt, extract_conversational_history
from app.services.citation_service import enrich_citations, deduplicate_citations
import os


# Language-specific translations for common phrases
TRANSLATIONS = {
    "en": {
        "projects_found": "Projects found in the portfolio:",
        "projects": "Projects:",
        "no_context": "I don't know based on the provided context.",
    },
    "es": {
        "projects_found": "Proyectos encontrados en el portafolio:",
        "projects": "Proyectos:",
        "no_context": "No lo sé basado en el contexto proporcionado.",
    },
}


def _get_translation(key: str, language_code: str = "en") -> str:
    """Get translated string for a given key and language code."""
    lang_code = (language_code or "en").lower()[:2]  # Normalize to 2-letter code
    if lang_code not in TRANSLATIONS:
        lang_code = "en"  # Default to English
    return TRANSLATIONS[lang_code].get(key, TRANSLATIONS["en"][key])


def _is_conversational_query(user_message: str) -> bool:
    """
    Detect if a query is conversational/general and should reach the LLM even without RAG context.
    
    Conversational queries include:
    - Greetings (hello, hi, hey)
    - Confirmations (are you working, test, check)
    - General questions about the assistant itself
    - Meta questions (what can you do, how do you work)
    
    Returns True if the query should proceed to LLM without RAG context.
    """
    lower_msg = user_message.lower().strip()
    
    # Greetings and basic interactions
    greeting_patterns = [
        "hello", "hi ", "hey", "good morning", "good afternoon", "good evening",
        "hola", "buenos días", "buenas tardes", "buenas noches",
        "how are you", "what's up", "wassup",
        "cómo estás", "qué tal", "como estas"
    ]
    
    # Confirmation and test queries
    confirmation_patterns = [
        "are you working", "are you there", "can you help", "do you work",
        "test", "testing", "check", "verify", "confirm",
        "estás funcionando", "estas funcionando", "puedes ayudar",
        "prueba", "verificar", "confirmar"
    ]
    
    # Meta questions about the assistant
    meta_patterns = [
        "what can you do", "what do you do", "who are you", "what are you",
        "how do you work", "what is your purpose", "help me", "what can i ask",
        "qué puedes hacer", "que puedes hacer", "quién eres", "quien eres",
        "cómo funcionas", "como funcionas", "ayúdame", "ayudame", "qué puedo preguntar"
    ]
    
    # Check if the message matches any conversational pattern
    all_patterns = greeting_patterns + confirmation_patterns + meta_patterns
    
    # Direct match for short messages
    if len(lower_msg) < 50:  # Short messages are more likely conversational
        for pattern in all_patterns:
            if pattern in lower_msg:
                return True
    
    # For slightly longer messages, check if they start with conversational patterns
    for pattern in all_patterns:
        if lower_msg.startswith(pattern):
            return True
    
    return False


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


def _build_context_only_answer(user_message: str, context_text: str, citations: List[Dict[str, Any]], language_code: str = "en") -> str:
    """Fallback composition when the LLM call fails.

    Parses the assembled context to extract simple, grounded facts. For portfolio queries,
    it will list project names detected from lines like "Project: <name>". Otherwise,
    it returns the first few sentences from the context.
    
    Args:
        user_message: The user's question
        context_text: Assembled context from RAG
        citations: List of citation metadata
        language_code: Language code (e.g., 'en', 'es') for translated responses
    """
    text = (context_text or "").strip()
    if not text:
        return _get_translation("no_context", language_code)
    lower_q = (user_message or "").lower()
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    projects: List[str] = []
    for ln in lines:
        if ln.lower().startswith("project:") or ln.lower().startswith("proyecto:"):
            name = ln.split(":", 1)[1].strip()
            if name:
                projects.append(name)
    projects = list(dict.fromkeys(projects))  # de-duplicate preserving order
    if projects and any(kw in lower_q for kw in ["project", "projects", "proyecto", "proyectos"]):
        head = _get_translation("projects_found", language_code)
        bullets = "\n".join([f"- {p}" for p in projects[:20]])
        return f"{head}\n{bullets}"
    # Generic fallback: return first paragraph up to ~400 chars
    para = " ".join(lines[:6])
    return para[:400]


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


def _resolve_portfolio_id(db: Session, provided_id: Optional[int], portfolio_query: Optional[str]) -> Optional[int]:
    if provided_id is not None:
        return provided_id
    if not portfolio_query:
        return None
    try:
        # Case-insensitive, diacritics-insensitive match by name with simple normalization
        row = db.execute(text(
            """
            SELECT id
            FROM portfolios
            WHERE lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) = lower(regexp_replace(:q, '[^a-z0-9]+', '', 'g'))
            ORDER BY id ASC
            LIMIT 1
            """
        ), {"q": portfolio_query}).first()
        if row and row[0]:
            return int(row[0])
    except Exception:
        return None
    return None


def run_agent_chat(db: Session, *, agent_id: int, user_message: str, session_id: int | None, template_id: Optional[int] = None, portfolio_id: Optional[int] = None, portfolio_query: Optional[str] = None, language_id: Optional[int] = None) -> Dict[str, Any]:
    # Always ensure we begin in a clean transaction state
    try:
        db.rollback()
    except Exception:
        pass
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

    # Fetch language information early so we can use it in all responses
    language_name = None
    language_code = "en"  # Default to English
    if language_id:
        try:
            language = db.query(Language).filter(Language.id == language_id).first()
            if language:
                language_name = language.name
                language_code = language.code if hasattr(language, 'code') and language.code else "en"
        except Exception:
            # If language fetch fails, continue with defaults
            try:
                db.rollback()
            except Exception:
                pass

    # Note: We intentionally do NOT filter RAG retrieval by language_code here.
    # The agent should be able to access content in ANY language, regardless of which 
    # language the user selected for the response. The language_id is only used to 
    # enforce the OUTPUT language via the prompt (see language_name below).
    # This ensures the agent can work effectively even when content exists primarily 
    # in one language but the user requests a response in another language.

    # Detect conversational queries BEFORE RAG search to avoid unnecessary embedding/retrieval
    lower_msg = (user_message or "").lower().strip()
    conversational_indicators = [
        "hello", "hi ", "hey", "good morning", "good afternoon", "good evening",
        "hola", "buenos días", "buenas tardes", "buen día",
        "how are you", "what's up", "cómo estás", "qué tal", "como estas",
        "are you working", "are you there", "can you help", "test", "testing",
        "what can you do", "who are you", "help me", "can you confirm"
    ]
    # Content keywords that indicate the user wants actual portfolio information
    content_keywords = [
        "project", "proyecto", "experience", "experiencia", "skill", "habilidad",
        "work", "trabajo", "resume", "cv", "portfolio", "portafolio",
        "education", "educación", "certificate", "certificado"
    ]
    is_conversational = any(indicator in lower_msg for indicator in conversational_indicators)
    asks_for_content = any(keyword in lower_msg for keyword in content_keywords)
    
    # For conversational queries without content requests, skip RAG search
    # This makes greetings instant even when portfolio/language is selected
    if is_conversational and not asks_for_content:
        # Build conversational-only prompt
        from app.services.prompt_builder import CONVERSATIONAL_SYSTEM_PROMPT
        messages = [
            {"role": "system", "content": CONVERSATIONAL_SYSTEM_PROMPT}
        ]
        
        # Load conversation history if available
        conversation_history = []
        if session_id:
            try:
                recent_msgs = db.query(AgentMessage)\
                    .filter(AgentMessage.session_id == session_id)\
                    .order_by(AgentMessage.id.desc())\
                    .limit(6)\
                    .all()
                conversation_history = extract_conversational_history(list(reversed(recent_msgs)), max_turns=3)
                messages.extend(conversation_history)
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
        
        # Add user message
        messages.append({"role": "user", "content": user_message})
        
        # Call LLM
        chat_model = agent.chat_model or "gpt-4o-mini"
        try:
            system_prompt = messages[0]['content']
            chat_messages = messages[1:]
            result = provider.chat(model=chat_model, system_prompt=system_prompt, messages=chat_messages)
            
            # Save to database
            sess_id = session_id
            if not sess_id:
                s = AgentSession(agent_id=agent.id)
                db.add(s)
                db.flush()
                sess_id = s.id
            db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
            db.add(AgentMessage(session_id=sess_id, role="assistant", content=result.get("text") or "", citations=[], tokens=(result.get("usage") or {}).get("total_tokens"), latency_ms=result.get("latency_ms")))
            db.commit()
            
            return {
                "answer": result.get("text") or "",
                "citations": [],
                "token_usage": result.get("usage") or {},
                "latency_ms": result.get("latency_ms") or 0,
                "session_id": sess_id,
            }
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            # Fallback
            fallback_text = "Hello! I'm your portfolio assistant. I can help you find information about projects, work experience, skills, and other portfolio content. What would you like to know?"
            sess_id = session_id
            if not sess_id:
                s = AgentSession(agent_id=agent.id)
                db.add(s)
                db.flush()
                sess_id = s.id
            db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
            db.add(AgentMessage(session_id=sess_id, role="assistant", content=fallback_text, citations=[], tokens=0, latency_ms=0))
            db.commit()
            return {
                "answer": fallback_text,
                "citations": [],
                "token_usage": {},
                "latency_ms": 0,
                "session_id": sess_id,
            }

    # Embed query and retrieve chunks
    qvec = embed_query(db, provider=provider, embedding_model=agent.embedding_model, query=user_message)
    # Resolve portfolio id from free-text if provided
    effective_portfolio_id = _resolve_portfolio_id(db, portfolio_id, portfolio_query)
    
    # If the user asks about "project"/"projects" in any language, restrict retrieval primarily to projects
    lower_q = (user_message or "").lower()
    # Check for project keywords in multiple languages (English, Spanish, etc.)
    is_project_query = any(keyword in lower_q for keyword in ["project", "proyecto"])
    tables_filter = ["projects"] if is_project_query else None
    # Do NOT pass language_code to vector_search - we want to retrieve content in all languages
    chunks = vector_search(db, qvec=qvec, model=agent.embedding_model, k=agent.top_k, score_threshold=agent.score_threshold, portfolio_id=effective_portfolio_id, tables_filter=tables_filter, language_code=None)
    context, citations = assemble_context(chunks, max_tokens=agent.max_context_tokens)

    # Intent-specific deterministic handling for project names when a portfolio is known
    if effective_portfolio_id is not None and is_project_query:
        try:
            rows = db.execute(text(
                """
                SELECT p.id, p.name
                FROM portfolio_projects pp
                JOIN projects p ON p.id = pp.project_id
                WHERE pp.portfolio_id = :pid
                ORDER BY p.id
                """
            ), {"pid": effective_portfolio_id}).mappings().all()
            names = [r["name"] for r in rows if (r.get("name") or "").strip()]
            if names:
                answer = _get_translation("projects", language_code) + " " + ", ".join(names)
                # Persist session
                sess_id = session_id
                if not sess_id:
                    s = AgentSession(agent_id=agent.id)
                    db.add(s)
                    db.flush()
                    sess_id = s.id
                db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
                db.add(AgentMessage(session_id=sess_id, role="assistant", content=answer, citations=[{"source_table":"projects","source_id":str(r["id"]),"score":1.0} for r in rows], tokens=0, latency_ms=0))
                db.commit()
                return {
                    "answer": answer,
                    "citations": [{"source_table":"projects","source_id":str(r["id"]),"score":1.0} for r in rows],
                    "token_usage": {},
                    "latency_ms": 0,
                    "session_id": sess_id,
                }
        except Exception:
            # Rollback to clear any failed transaction state
            try:
                db.rollback()
            except Exception:
                pass
    # Short-circuit if no context was found to avoid slow external calls
    if not context.strip():
        # Deterministic DB fallback for common questions when portfolio scope is known
        if effective_portfolio_id is not None and is_project_query:
            # Try to build context from existing rag_chunk rows for projects
            try:
                rows = db.execute(text(
                    """
                    SELECT c.id as chunk_id, c.text, c.source_id
                    FROM rag_chunk c
                    WHERE c.source_table='projects'
                      AND c.source_id IN (
                        SELECT CAST(p.id AS TEXT)
                        FROM portfolio_projects pp JOIN projects p ON p.id = pp.project_id
                        WHERE pp.portfolio_id = :pid
                      )
                      AND c.is_deleted=FALSE
                    ORDER BY c.source_id, c.part_index
                    LIMIT 50
                    """
                ), {"pid": effective_portfolio_id}).mappings().all()
                if rows:
                    ctx_parts: List[str] = []
                    cits: List[Dict[str, Any]] = []
                    for r in rows:
                        txt = (r.get("text") or "").strip()
                        if txt:
                            ctx_parts.append(txt)
                            cits.append({
                                "chunk_id": r["chunk_id"],
                                "source_table": "projects",
                                "source_id": r["source_id"],
                                "score": 1.0,
                            })
                    context = "\n\n---\n\n".join(ctx_parts)
                    citations = cits
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass

            # If still empty, read project names directly as a last resort
            if not context.strip():
                try:
                    names = db.execute(text(
                        """
                        SELECT p.id, p.name, COALESCE(p.description,'') AS description
                        FROM portfolio_projects pp
                        JOIN projects p ON p.id = pp.project_id
                        WHERE pp.portfolio_id = :pid
                        ORDER BY p.id
                        """
                    ), {"pid": effective_portfolio_id}).mappings().all()
                    if names:
                        ctx_parts: List[str] = []
                        cits: List[Dict[str, Any]] = []
                        for n in names:
                            line = f"Project: {n['name']}\n\n{n['description']}".strip()
                            ctx_parts.append(line)
                            cits.append({
                                "chunk_id": 0,
                                "source_table": "projects",
                                "source_id": str(n["id"]),
                                "score": 1.0,
                            })
                        context = "\n\n---\n\n".join(ctx_parts)
                        citations = cits
                except Exception:
                    try:
                        db.rollback()
                    except Exception:
                        pass

        # If still no context, persist and return the canonical fallback
        # UNLESS it's a conversational query that should reach the LLM
        if not _is_conversational_query(user_message):
            # Persist session messages even on no-context for traceability
            sess_id = session_id
            if not sess_id:
                # Clear any prior failed state to avoid aborted transaction
                try:
                    db.rollback()
                except Exception:
                    pass
                s = AgentSession(agent_id=agent.id)
                db.add(s)
                db.flush()
                sess_id = s.id
            m_user = AgentMessage(session_id=sess_id, role="user", content=user_message)
            db.add(m_user)
            # Use smart fallback from prompt_builder
            fallback = build_fallback_prompt(user_message)
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
        
        # Conversational query with no context: proceed to LLM with empty context
        # The LLM will handle it as a general conversation
        context = ""
        citations = []

    # Enrich citations with metadata for user-friendly display
    # Use a savepoint (nested transaction) to isolate enrichment queries
    # This prevents metadata query failures from aborting the main transaction
    enriched_citations = citations  # Default to basic citations
    savepoint = None
    try:
        # Create a savepoint (nested transaction)
        savepoint = db.begin_nested()
        enriched_citations = enrich_citations(db, citations, language_id=language_id)
        # Deduplicate to avoid showing same source multiple times
        enriched_citations = deduplicate_citations(enriched_citations)
        # Commit the savepoint if enrichment succeeded
        savepoint.commit()
    except Exception as e:
        # If enrichment fails, rollback ONLY the savepoint (not the main transaction)
        print(f"Warning: Citation enrichment failed, using basic citations: {e}")
        if savepoint:
            try:
                savepoint.rollback()
            except Exception:
                pass
        # Use basic citations without enrichment
        enriched_citations = citations
    
    # Load conversation history for context (if session exists)
    conversation_history = []
    if session_id:
        try:
            recent_msgs = db.query(AgentMessage)\
                .filter(AgentMessage.session_id == session_id)\
                .order_by(AgentMessage.id.desc())\
                .limit(6)\
                .all()
            conversation_history = extract_conversational_history(list(reversed(recent_msgs)), max_turns=3)
        except Exception:
            # If history fetch fails, continue without it
            try:
                db.rollback()
            except Exception:
                pass
            conversation_history = []
    
    # Build optimized RAG prompt using prompt_builder service
    # (Note: language_name and language_code are already fetched earlier in the function)
    # Determine template style from agent template (default to 'conversational')
    template_style = tpl.citation_format if hasattr(tpl, 'citation_format') and tpl.citation_format else 'conversational'
    if template_style not in ['conversational', 'technical', 'summary']:
        template_style = 'conversational'
    
    user_text = user_message if not tpl.user_prefix else f"{tpl.user_prefix} {user_message}"
    messages = build_rag_prompt(
        user_message=user_text,
        context=context,
        citations=enriched_citations,
        template_style=template_style,
        conversation_history=conversation_history,
        language_name=language_name,
        custom_system_prompt=tpl.system_prompt if hasattr(tpl, 'system_prompt') and tpl.system_prompt else None
    )

    # Choose low-cost default OpenAI chat model per your guidance
    chat_model = agent.chat_model or "gpt-4o-mini"  # default low-cost model; adjust as needed
    try:
        # Extract system prompt from messages if present
        system_prompt = None
        chat_messages = messages
        if messages and messages[0].get('role') == 'system':
            system_prompt = messages[0]['content']
            chat_messages = messages[1:]
        
        result = provider.chat(model=chat_model, system_prompt=system_prompt, messages=chat_messages)
    except Exception as e:
        # Ensure we don't continue in an aborted transaction state
        try:
            db.rollback()
        except Exception:
            pass
        # If we have context, synthesize a deterministic, grounded fallback answer
        if context.strip():
            synthesized = _build_context_only_answer(user_message, context, citations, language_code)
            sess_id = session_id
            if not sess_id:
                s = AgentSession(agent_id=agent.id)
                db.add(s)
                db.flush()
                sess_id = s.id
            db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
            db.add(AgentMessage(session_id=sess_id, role="assistant", content=synthesized, citations=enriched_citations, tokens=0, latency_ms=0))
            db.commit()
            return {
                "answer": synthesized,
                "citations": enriched_citations,
                "token_usage": {},
                "latency_ms": 0,
                "session_id": sess_id,
            }
        # Otherwise, return a graceful error that fits the API envelope to avoid frontend timeouts
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
    m_assist = AgentMessage(session_id=sess_id, role="assistant", content=result.get("text") or "", citations=enriched_citations, tokens=(result.get("usage") or {}).get("total_tokens"), latency_ms=result.get("latency_ms"))
    db.add(m_assist)
    db.commit()

    return {
        "answer": result.get("text") or "",
        "citations": enriched_citations,
        "token_usage": result.get("usage") or {},
        "latency_ms": result.get("latency_ms") or 0,
        "session_id": sess_id,
    }


def run_agent_test(db: Session, *, agent_id: int, prompt: str, template_id: Optional[int] = None, portfolio_id: Optional[int] = None, portfolio_query: Optional[str] = None) -> Dict[str, Any]:
    out = run_agent_chat(db, agent_id=agent_id, user_message=prompt, session_id=None, template_id=template_id, portfolio_id=portfolio_id, portfolio_query=portfolio_query)
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


