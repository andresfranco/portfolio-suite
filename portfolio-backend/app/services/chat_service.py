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
from app.services.cache_service import cache_service
from app.services.query_complexity import analyze_query_complexity
import os
import re


# Language-specific translations for common phrases
TRANSLATIONS = {
    "en": {
        "projects_found": "Projects found in the portfolio:",
        "projects": "Projects:",
        "no_context": "I don't have enough information in this portfolio to answer that.",
        "prompt_injection_blocked": "I can only help with portfolio questions. Please ask about projects, experience, skills, or attached documents.",
        "assistant_scope": "Hello. I can help with this portfolio's projects, experience, skills, and attached documents. Ask me a specific question and I will answer from available data.",
        "provider_error": "I couldn't complete the request right now. Please try again in a moment.",
    },
    "es": {
        "projects_found": "Proyectos encontrados en el portafolio:",
        "projects": "Proyectos:",
        "no_context": "No tengo suficiente informacion en este portafolio para responder eso.",
        "prompt_injection_blocked": "Solo puedo ayudarte con preguntas del portafolio. Pregunta por proyectos, experiencia, habilidades o documentos adjuntos.",
        "assistant_scope": "Hola. Puedo ayudarte con proyectos, experiencia, habilidades y documentos adjuntos de este portafolio. Haz una pregunta especifica y respondere con los datos disponibles.",
        "provider_error": "No pude completar la solicitud en este momento. Intentalo de nuevo en unos segundos.",
    },
}

PORTFOLIO_CONTENT_KEYWORDS = [
    "project", "projects", "proyecto", "proyectos",
    "experience", "experiences", "experiencia", "experiencias",
    "skill", "skills", "habilidad", "habilidades",
    "portfolio", "portafolio", "resume", "cv", "document", "documents",
    "attachment", "attachments", "adjunto", "adjuntos",
    "trabajo", "trabajos", "education", "educacion", "certificate", "certificado",
]

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?)", re.IGNORECASE),
    re.compile(r"disregard\s+.*(instructions|rules|system)", re.IGNORECASE),
    re.compile(r"reveal\s+.*(system|developer)\s+(prompt|instructions?)", re.IGNORECASE),
    re.compile(r"(jailbreak|dan\s+mode|developer\s+mode|override\s+policy)", re.IGNORECASE),
    re.compile(r"\bact\s+as\s+(a\s+)?(system|developer|admin|root)\b", re.IGNORECASE),
    re.compile(r"\byou\s+are\s+now\b", re.IGNORECASE),
    re.compile(r"prompt\s+injection", re.IGNORECASE),
    re.compile(r"ignora\s+.*instrucciones", re.IGNORECASE),
    re.compile(r"revela\s+.*(prompt|instrucciones)", re.IGNORECASE),
]

SPANISH_HINTS = [
    "hola", "gracias", "por favor", "proyecto", "experiencia", "habilidad",
    "portafolio", "adjunto", "curriculum", "que", "como", "cual", "donde",
]

CONTEXT_META_PATTERNS = [
    re.compile(r"\bprovided context\b", re.IGNORECASE),
    re.compile(r"\bcontext above\b", re.IGNORECASE),
    re.compile(r"\bfrom (the )?context\b", re.IGNORECASE),
    re.compile(r"\bbased on (the )?context\b", re.IGNORECASE),
    re.compile(r"\baccording to (the )?context\b", re.IGNORECASE),
    re.compile(r"\bcontext does not\b", re.IGNORECASE),
    re.compile(r"\bcontext (doesn't|does not|is missing)\b", re.IGNORECASE),
    re.compile(r"\bfrom the database\b", re.IGNORECASE),
    re.compile(r"\bretrieval\b", re.IGNORECASE),
    re.compile(r"\bchunk(s)?\b", re.IGNORECASE),
]

INSUFFICIENT_INFO_PATTERNS = [
    re.compile(r"\bi don't have enough information\b", re.IGNORECASE),
    re.compile(r"\bi do not have enough information\b", re.IGNORECASE),
    re.compile(r"\bi don't have that information\b", re.IGNORECASE),
    re.compile(r"\bi do not have that information\b", re.IGNORECASE),
    re.compile(r"\bno tengo suficiente informacion\b", re.IGNORECASE),
    re.compile(r"\bno tengo esa informacion\b", re.IGNORECASE),
]


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
    
    Returns True if the query is a conversational opener.
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


def _contains_portfolio_intent(user_message: str) -> bool:
    lower_msg = (user_message or "").lower()
    return any(keyword in lower_msg for keyword in PORTFOLIO_CONTENT_KEYWORDS)


def _looks_like_prompt_injection(user_message: str) -> bool:
    text_value = (user_message or "").strip()
    if not text_value:
        return False
    return any(pattern.search(text_value) for pattern in PROMPT_INJECTION_PATTERNS)


def _extract_safe_user_query(user_message: str) -> Optional[str]:
    """
    Keep only safe, portfolio-focused parts from a potentially malicious prompt.
    Returns None when the request is purely prompt-injection.
    """
    raw = (user_message or "").strip()
    if not raw:
        return None

    if not _looks_like_prompt_injection(raw):
        return raw

    segments = re.split(r"[\n\r.!?;]+", raw)
    safe_segments: List[str] = []
    for segment in segments:
        candidate = segment.strip()
        if not candidate:
            continue
        if _looks_like_prompt_injection(candidate):
            continue
        if _contains_portfolio_intent(candidate):
            safe_segments.append(candidate)

    if not safe_segments:
        return None

    return " ".join(safe_segments)[:1000]


def _infer_language_code(user_message: str, default: str = "en") -> str:
    lower_msg = (user_message or "").lower()
    spanish_hits = sum(1 for hint in SPANISH_HINTS if hint in lower_msg)
    if spanish_hits >= 2:
        return "es"
    return default


def _sanitize_agent_answer(answer_text: str, language_code: str = "en") -> str:
    """
    Remove internal/meta "context" wording from model answers.
    Keep only user-facing content. If nothing remains, return localized
    insufficient-information response.
    """
    text_value = (answer_text or "").strip()
    if not text_value:
        return _get_translation("no_context", language_code)

    normalized = re.sub(r"\s+", " ", text_value).strip()
    sentence_candidates = [s.strip() for s in re.split(r"(?<=[.!?])\s+", normalized) if s.strip()]
    if not sentence_candidates:
        sentence_candidates = [normalized]

    cleaned_sentences: List[str] = []
    for sentence in sentence_candidates:
        if any(p.search(sentence) for p in CONTEXT_META_PATTERNS):
            continue
        cleaned_sentences.append(sentence)

    if cleaned_sentences:
        return " ".join(cleaned_sentences).strip()

    if any(p.search(normalized) for p in INSUFFICIENT_INFO_PATTERNS):
        return _get_translation("no_context", language_code)

    return normalized


def _tokenize_query_terms(user_message: str) -> List[str]:
    terms = re.findall(r"[a-zA-Z0-9]{4,}", (user_message or "").lower())
    stop = {
        "what", "which", "with", "from", "about", "this", "that", "there",
        "portfolio", "project", "projects", "experience", "experiences", "skills",
        "tell", "give", "summary", "list", "have", "has", "andres", "franco",
    }
    out: List[str] = []
    for term in terms:
        if term in stop:
            continue
        if term not in out:
            out.append(term)
    return out[:8]


def _query_intent_flags(user_message: str) -> Dict[str, bool]:
    lower_q = (user_message or "").lower()
    return {
        "projects": any(k in lower_q for k in ["project", "projects", "proyecto", "proyectos"]),
        "experience": any(k in lower_q for k in ["experience", "experiences", "experiencia", "experiencias", "work", "trabajo"]),
        "skills": any(k in lower_q for k in ["skill", "skills", "habilidad", "habilidades", "technology", "technologies", "tecnologia", "tecnologias"]),
        "attachments": any(k in lower_q for k in ["attachment", "attachments", "document", "documents", "resume", "cv", "adjunto", "adjuntos", "documento"]),
        "sections": any(k in lower_q for k in ["section", "sections", "seccion", "secciones"]),
    }


def _build_structured_portfolio_context(
    db: Session,
    *,
    portfolio_id: int,
    user_message: str,
    language_id: Optional[int],
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Build grounded context directly from structured portfolio tables.
    Used as a fallback when vector RAG retrieval returns no chunks.
    """
    intent = _query_intent_flags(user_message)
    if not any(intent.values()):
        # Broad query: include all major sections.
        intent = {"projects": True, "experience": True, "skills": True, "attachments": True, "sections": True}
    # Cross-include related content classes so broad career questions are answerable
    # even when the portfolio stores details in different tables.
    if intent.get("experience"):
        intent["projects"] = True
        intent["sections"] = True
    if intent.get("skills"):
        intent["projects"] = True
    if intent.get("projects"):
        intent["sections"] = True

    terms = _tokenize_query_terms(user_message)
    blocks: List[Tuple[int, str, Dict[str, Any]]] = []

    def _score(text_value: str) -> int:
        if not terms:
            return 1
        low = (text_value or "").lower()
        return sum(1 for t in terms if t in low)

    if intent.get("projects"):
        try:
            rows = db.execute(
                text(
                    """
                    SELECT
                      p.id,
                      COALESCE(
                        (SELECT pt1.name
                         FROM project_texts pt1
                         WHERE pt1.project_id = p.id AND (:lang_id IS NOT NULL AND pt1.language_id = :lang_id)
                         ORDER BY pt1.id ASC
                         LIMIT 1),
                        (SELECT pt2.name
                         FROM project_texts pt2
                         WHERE pt2.project_id = p.id
                         ORDER BY pt2.id ASC
                         LIMIT 1),
                        ''
                      ) AS name,
                      COALESCE(
                        (SELECT pt1.description
                         FROM project_texts pt1
                         WHERE pt1.project_id = p.id AND (:lang_id IS NOT NULL AND pt1.language_id = :lang_id)
                         ORDER BY pt1.id ASC
                         LIMIT 1),
                        (SELECT pt2.description
                         FROM project_texts pt2
                         WHERE pt2.project_id = p.id
                         ORDER BY pt2.id ASC
                         LIMIT 1),
                        ''
                      ) AS description
                    FROM portfolio_projects pp
                    JOIN projects p ON p.id = pp.project_id
                    WHERE pp.portfolio_id = :pid
                    ORDER BY pp."order" ASC NULLS LAST, p.id ASC
                    LIMIT 60
                    """
                ),
                {"pid": portfolio_id, "lang_id": language_id},
            ).mappings().all()

            for row in rows:
                name = (row.get("name") or "").strip()
                desc = (row.get("description") or "").strip()
                if not name and not desc:
                    continue
                snippet = f"Project: {name}\nDescription: {desc}".strip()
                score = _score(f"{name}\n{desc}")
                blocks.append(
                    (
                        score,
                        snippet,
                        {"source_table": "projects", "source_id": str(row["id"]), "score": 1.0},
                    )
                )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if intent.get("experience"):
        try:
            rows = db.execute(
                text(
                    """
                    SELECT
                      e.id,
                      COALESCE(
                        (SELECT et1.name
                         FROM experience_texts et1
                         WHERE et1.experience_id = e.id AND (:lang_id IS NOT NULL AND et1.language_id = :lang_id)
                         ORDER BY et1.id ASC
                         LIMIT 1),
                        (SELECT et2.name
                         FROM experience_texts et2
                         WHERE et2.experience_id = e.id
                         ORDER BY et2.id ASC
                         LIMIT 1),
                        ''
                      ) AS name,
                      COALESCE(
                        (SELECT et1.description
                         FROM experience_texts et1
                         WHERE et1.experience_id = e.id AND (:lang_id IS NOT NULL AND et1.language_id = :lang_id)
                         ORDER BY et1.id ASC
                         LIMIT 1),
                        (SELECT et2.description
                         FROM experience_texts et2
                         WHERE et2.experience_id = e.id
                         ORDER BY et2.id ASC
                         LIMIT 1),
                        ''
                      ) AS description,
                      COALESCE(e.years, 0) AS years
                    FROM portfolio_experiences pe
                    JOIN experiences e ON e.id = pe.experience_id
                    WHERE pe.portfolio_id = :pid
                    ORDER BY pe."order" ASC NULLS LAST, e.id ASC
                    LIMIT 60
                    """
                ),
                {"pid": portfolio_id, "lang_id": language_id},
            ).mappings().all()

            for row in rows:
                name = (row.get("name") or "").strip()
                desc = (row.get("description") or "").strip()
                years = int(row.get("years") or 0)
                if not name and not desc:
                    continue
                years_txt = f"Years: {years}" if years > 0 else ""
                snippet = f"Experience: {name}\n{years_txt}\nDescription: {desc}".strip()
                score = _score(f"{name}\n{desc}\n{years_txt}")
                blocks.append(
                    (
                        score,
                        snippet,
                        {"source_table": "experiences", "source_id": str(row["id"]), "score": 1.0},
                    )
                )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if intent.get("skills"):
        try:
            rows = db.execute(
                text(
                    """
                    SELECT DISTINCT
                      s.id,
                      COALESCE(
                        (SELECT st1.name
                         FROM skill_texts st1
                         WHERE st1.skill_id = s.id AND (:lang_id IS NOT NULL AND st1.language_id = :lang_id)
                         ORDER BY st1.id ASC
                         LIMIT 1),
                        (SELECT st2.name
                         FROM skill_texts st2
                         WHERE st2.skill_id = s.id
                         ORDER BY st2.id ASC
                         LIMIT 1),
                        ''
                      ) AS name,
                      COALESCE(
                        (SELECT st1.description
                         FROM skill_texts st1
                         WHERE st1.skill_id = s.id AND (:lang_id IS NOT NULL AND st1.language_id = :lang_id)
                         ORDER BY st1.id ASC
                         LIMIT 1),
                        (SELECT st2.description
                         FROM skill_texts st2
                         WHERE st2.skill_id = s.id
                         ORDER BY st2.id ASC
                         LIMIT 1),
                        ''
                      ) AS description
                    FROM portfolio_projects pp
                    JOIN project_skills ps ON ps.project_id = pp.project_id
                    JOIN skills s ON s.id = ps.skill_id
                    WHERE pp.portfolio_id = :pid
                    LIMIT 100
                    """
                ),
                {"pid": portfolio_id, "lang_id": language_id},
            ).mappings().all()

            for row in rows:
                name = (row.get("name") or "").strip()
                desc = (row.get("description") or "").strip()
                if not name and not desc:
                    continue
                snippet = f"Skill: {name}\nDescription: {desc}".strip()
                score = _score(f"{name}\n{desc}")
                blocks.append(
                    (
                        score,
                        snippet,
                        {"source_table": "skills", "source_id": str(row["id"]), "score": 1.0},
                    )
                )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if intent.get("sections"):
        try:
            rows = db.execute(
                text(
                    """
                    SELECT DISTINCT
                      s.id,
                      COALESCE(s.code, '') AS code,
                      COALESCE(
                        (SELECT st1.text
                         FROM section_texts st1
                         WHERE st1.section_id = s.id AND (:lang_id IS NOT NULL AND st1.language_id = :lang_id)
                         ORDER BY st1.id ASC
                         LIMIT 1),
                        (SELECT st2.text
                         FROM section_texts st2
                         WHERE st2.section_id = s.id
                         ORDER BY st2.id ASC
                         LIMIT 1),
                        ''
                      ) AS body
                    FROM sections s
                    WHERE s.id IN (
                        SELECT ps.section_id
                        FROM portfolio_sections ps
                        WHERE ps.portfolio_id = :pid
                        UNION
                        SELECT pjs.section_id
                        FROM project_sections pjs
                        WHERE pjs.project_id IN (
                            SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = :pid
                        )
                    )
                    ORDER BY s.id ASC
                    LIMIT 80
                    """
                ),
                {"pid": portfolio_id, "lang_id": language_id},
            ).mappings().all()

            for row in rows:
                code = (row.get("code") or "").strip()
                body = (row.get("body") or "").strip()
                if not code and not body:
                    continue
                snippet = f"Section: {code}\nContent: {body}".strip()
                score = _score(f"{code}\n{body}")
                blocks.append(
                    (
                        score,
                        snippet,
                        {"source_table": "sections", "source_id": str(row["id"]), "score": 1.0},
                    )
                )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if intent.get("attachments"):
        try:
            rows = db.execute(
                text(
                    """
                    SELECT CAST(pa.id AS TEXT) AS source_id, 'portfolio_attachments' AS source_table, pa.file_name
                    FROM portfolio_attachments pa
                    WHERE pa.portfolio_id = :pid
                    UNION ALL
                    SELECT CAST(pa2.id AS TEXT) AS source_id, 'project_attachments' AS source_table, pa2.file_name
                    FROM project_attachments pa2
                    WHERE pa2.project_id IN (
                        SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = :pid
                    )
                    UNION ALL
                    SELECT CAST(sa.id AS TEXT) AS source_id, 'section_attachments' AS source_table, sa.file_name
                    FROM section_attachments sa
                    WHERE sa.section_id IN (
                        SELECT ps.section_id
                        FROM portfolio_sections ps
                        WHERE ps.portfolio_id = :pid
                        UNION
                        SELECT pjs.section_id
                        FROM project_sections pjs
                        WHERE pjs.project_id IN (
                            SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = :pid
                        )
                    )
                    LIMIT 40
                    """
                ),
                {"pid": portfolio_id},
            ).mappings().all()

            for row in rows:
                name = (row.get("file_name") or "").strip()
                if not name:
                    continue
                snippet = f"Document: {name}"
                score = _score(name)
                blocks.append(
                    (
                        score,
                        snippet,
                        {
                            "source_table": row["source_table"],
                            "source_id": row["source_id"],
                            "score": 1.0,
                        },
                    )
                )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if not blocks:
        return "", []

    # Prefer snippets that match query terms. If no term match, keep top entries by insertion order.
    blocks.sort(key=lambda item: item[0], reverse=True)
    selected = blocks[:30]
    context_parts = [snippet for _, snippet, _cite in selected]
    citations = [cite for _score_val, _snippet, cite in selected]
    return "\n\n---\n\n".join(context_parts), citations


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


def run_agent_chat(
    db: Session,
    *,
    agent_id: int,
    user_message: str,
    session_id: int | None,
    template_id: Optional[int] = None,
    portfolio_id: Optional[int] = None,
    portfolio_query: Optional[str] = None,
    language_id: Optional[int] = None,
    raise_on_provider_error: bool = False,
) -> Dict[str, Any]:
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
    else:
        language_code = _infer_language_code(user_message, default="en")
        language_name = "Spanish" if language_code == "es" else "English"

    # Defensive prompt-injection handling:
    # - If the message is malicious and has no valid portfolio intent, reject safely.
    # - If it mixes malicious + valid intent, keep only the safe portfolio query.
    safe_user_message = _extract_safe_user_query(user_message)
    if safe_user_message is None:
        blocked_answer = _get_translation("prompt_injection_blocked", language_code)
        sess_id = session_id
        if not sess_id:
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
        db.add(AgentMessage(session_id=sess_id, role="assistant", content=blocked_answer, citations=[], tokens=0, latency_ms=0))
        db.commit()
        return {
            "answer": blocked_answer,
            "citations": [],
            "token_usage": {},
            "latency_ms": 0,
            "session_id": sess_id,
        }

    user_message = safe_user_message

    # Resolve portfolio id from free-text if provided
    effective_portfolio_id = _resolve_portfolio_id(db, portfolio_id, portfolio_query)

    # Analyze query complexity for dynamic context sizing
    _complexity, top_k_dynamic, max_context_dynamic = analyze_query_complexity(user_message)
    
    # Check cache first for ALL queries (including trivial greetings)
    # Caching greetings provides instant responses (<5ms) on repeat
    cached_response = cache_service.get_agent_response(
        agent_id=agent_id,
        user_message=user_message,
        portfolio_id=effective_portfolio_id,
        language_id=language_id
    )
    if cached_response:
        # Return cached response immediately
        answer = _sanitize_agent_answer(cached_response.get("answer", ""), language_code)
        citations = cached_response.get("citations", [])

        # Save to database session
        sess_id = session_id
        if not sess_id:
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
        db.add(AgentMessage(session_id=sess_id, role="assistant", content=answer, citations=citations, tokens=0, latency_ms=5))
        db.commit()

        return {
            "answer": answer,
            "citations": citations,
            "token_usage": {},
            "latency_ms": 5,  # Cache hit is ~5ms
            "session_id": sess_id,
            "cached": True
        }

    # Note: We intentionally do NOT filter RAG retrieval by language_code here.
    # The agent should be able to access content in ANY language, regardless of which 
    # language the user selected for the response. The language_id is only used to 
    # enforce the OUTPUT language via the prompt (see language_name below).
    # This ensures the agent can work effectively even when content exists primarily 
    # in one language but the user requests a response in another language.

    # Conversational queries are handled deterministically and safely.
    # This avoids non-grounded LLM answers for greetings/meta questions.
    is_conversational = _is_conversational_query(user_message)
    asks_for_content = _contains_portfolio_intent(user_message)
    if is_conversational and not asks_for_content:
        scope_answer = _get_translation("assistant_scope", language_code)
        sess_id = session_id
        if not sess_id:
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
        db.add(AgentMessage(session_id=sess_id, role="assistant", content=scope_answer, citations=[], tokens=0, latency_ms=0))
        db.commit()

        cache_service.set_agent_response(
            agent_id=agent_id,
            user_message=user_message,
            response={"answer": scope_answer, "citations": []},
            portfolio_id=effective_portfolio_id,
            language_id=language_id,
            ttl_seconds=3600,
        )

        return {
            "answer": scope_answer,
            "citations": [],
            "token_usage": {},
            "latency_ms": 0,
            "session_id": sess_id,
        }

    # Embed query and retrieve chunks with dynamic context sizing
    qvec = embed_query(db, provider=provider, embedding_model=agent.embedding_model, query=user_message)

    # If the user asks about projects, keep the signal for deterministic fallback retrieval.
    lower_q = (user_message or "").lower()
    is_project_query = any(keyword in lower_q for keyword in ["project", "proyecto"])
    
    # Use dynamic top_k and max_context_tokens based on query complexity
    effective_top_k = top_k_dynamic or agent.top_k
    effective_max_tokens = max_context_dynamic or agent.max_context_tokens
    
    # Retrieve across all indexed portfolio tables/attachments.
    # Do NOT pass language_code: retrieve source facts in any language and answer in target output language.
    chunks = vector_search(
        db,
        qvec=qvec,
        model=agent.embedding_model,
        k=effective_top_k,
        score_threshold=agent.score_threshold,
        portfolio_id=effective_portfolio_id,
        tables_filter=None,
        language_code=None,
    )
    context, citations = assemble_context(chunks, max_tokens=effective_max_tokens)
    if not context.strip():
        # Retry vector search with a relaxed threshold before giving up.
        # This improves recall for portfolio attachments and sparse chunks.
        retry_k = max(12, effective_top_k)
        retry_chunks = vector_search(
            db,
            qvec=qvec,
            model=agent.embedding_model,
            k=retry_k,
            score_threshold=None,
            portfolio_id=effective_portfolio_id,
            tables_filter=None,
            language_code=None,
        )
        context, citations = assemble_context(retry_chunks, max_tokens=effective_max_tokens)

    if not context.strip() and effective_portfolio_id is not None and is_project_query:
        # Deterministic fallback for project-oriented questions when semantic retrieval is empty.
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
                for row in rows:
                    txt = (row.get("text") or "").strip()
                    if txt:
                        ctx_parts.append(txt)
                        cits.append({
                            "chunk_id": row["chunk_id"],
                            "source_table": "projects",
                            "source_id": row["source_id"],
                            "score": 1.0,
                        })
                context = "\n\n---\n\n".join(ctx_parts)
                citations = cits
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if not context.strip() and effective_portfolio_id is not None:
        # Structured relational fallback when RAG index misses or is stale.
        try:
            context, citations = _build_structured_portfolio_context(
                db,
                portfolio_id=effective_portfolio_id,
                user_message=user_message,
                language_id=language_id,
            )
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass

    if not context.strip():
        # Persist session messages even on no-context for traceability
        sess_id = session_id
        if not sess_id:
            try:
                db.rollback()
            except Exception:
                pass
            s = AgentSession(agent_id=agent.id)
            db.add(s)
            db.flush()
            sess_id = s.id
        db.add(AgentMessage(session_id=sess_id, role="user", content=user_message))
        fallback = build_fallback_prompt(user_message, language_code=language_code)
        db.add(AgentMessage(session_id=sess_id, role="assistant", content=fallback, citations=[], tokens=0, latency_ms=0))
        db.commit()
        return {
            "answer": fallback,
            "citations": [],
            "token_usage": {},
            "latency_ms": 0,
            "session_id": sess_id,
        }

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
        if raise_on_provider_error:
            raise RuntimeError(f"Provider chat call failed for agent {agent_id}: {e}") from e
        # If we have context, synthesize a deterministic, grounded fallback answer
        if context.strip():
            synthesized = _sanitize_agent_answer(
                _build_context_only_answer(user_message, context, citations, language_code),
                language_code,
            )
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
        fail_text = _get_translation("provider_error", language_code)
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
    assistant_text = _sanitize_agent_answer(result.get("text") or "", language_code)
    m_assist = AgentMessage(session_id=sess_id, role="assistant", content=assistant_text, citations=enriched_citations, tokens=(result.get("usage") or {}).get("total_tokens"), latency_ms=result.get("latency_ms"))
    db.add(m_assist)
    db.commit()

    # Cache the response for future queries (cache ALL responses including greetings)
    # This ensures second "Hello" takes <5ms instead of 4+ seconds
    cache_service.set_agent_response(
        agent_id=agent_id,
        user_message=user_message,
        response={"answer": assistant_text, "citations": enriched_citations},
        portfolio_id=effective_portfolio_id,
        language_id=language_id,
        ttl_seconds=3600  # 1 hour
    )

    return {
        "answer": assistant_text,
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
