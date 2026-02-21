from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
import os


def embed_query(db: Session, *, provider, embedding_model: str, query: str) -> List[float]:
    """Return a normalized embedding for the query.

    Attempts provider.embed first. If the active chat provider does not
    implement embeddings, falls back to an OpenAI-compatible embeddings
    provider using OPENAI_API_KEY (or decrypts the first OpenAI credential
    from the database if available and AGENT_KMS_KEY is set).
    """
    try:
        vec = provider.embed(model=embedding_model, texts=[query])[0]
    except Exception:
        # Fallback: try OpenAI embeddings safely
        from app.services.llm.providers import build_provider  # local import to avoid cycles

        api_key = os.getenv("OPENAI_API_KEY") or ""
        if not api_key:
            # Best-effort: decrypt first OpenAI credential
            try:
                kms_key = os.getenv("AGENT_KMS_KEY")
                if kms_key:
                    row = db.execute(text(
                        """
                        SELECT encode(pgp_sym_decrypt(decode(ac.api_key_encrypted,'base64'), :k), 'escape') AS k
                        FROM agent_credentials ac
                        WHERE ac.provider='openai' AND ac.api_key_encrypted IS NOT NULL
                        ORDER BY ac.id ASC
                        LIMIT 1
                        """
                    ), {"k": kms_key}).first()
                    if row and row[0]:
                        api_key = row[0]
            except Exception:
                # Rollback if query failed
                try:
                    db.rollback()
                except Exception:
                    pass
                api_key = api_key or ""

        if not api_key:
            raise RuntimeError("No embedding provider available: set OPENAI_API_KEY or configure an OpenAI credential")

        fallback = build_provider("openai", api_key=api_key)
        vec = fallback.embed(model=embedding_model, texts=[query])[0]

    # Normalize for cosine if needed: pg uses cosine ops; upstream vectors may not be unit length
    norm = sum(x * x for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def vector_search(db: Session, *, qvec: List[float], model: str, k: int, score_threshold: Optional[float], portfolio_id: Optional[int] = None, tables_filter: Optional[List[str]] = None, language_code: Optional[str] = None) -> List[Dict[str, Any]]:
    # Ensure query vector is cast to the correct dimensional type to match stored vectors
    dim = max(1, len(qvec))
    portfolio_filter = ""
    if portfolio_id is not None:
        # Restrict to chunks sourced from this portfolio's entities or attachments
        portfolio_filter = (
            """
            AND (
                (c.source_table = 'portfolios' AND c.source_id = CAST(:pid AS TEXT))
             OR (c.source_table = 'experiences' AND c.source_id IN (
                    SELECT CAST(e.id AS TEXT) FROM portfolio_experiences pe JOIN experiences e ON e.id = pe.experience_id WHERE pe.portfolio_id = :pid
                ))
             OR (c.source_table = 'projects' AND c.source_id IN (
                    SELECT CAST(p.id AS TEXT) FROM portfolio_projects pp JOIN projects p ON p.id = pp.project_id WHERE pp.portfolio_id = :pid
                ))
             OR (c.source_table = 'sections' AND c.source_id IN (
                    SELECT CAST(s.id AS TEXT) FROM portfolio_sections ps JOIN sections s ON s.id = ps.section_id WHERE ps.portfolio_id = :pid
                ))
             OR (c.source_table = 'portfolio_attachments' AND c.source_id IN (
                    SELECT CAST(pa.id AS TEXT) FROM portfolio_attachments pa WHERE pa.portfolio_id = :pid
                ))
             OR (c.source_table = 'project_attachments' AND c.source_id IN (
                    SELECT CAST(pa.id AS TEXT) FROM project_attachments pa WHERE pa.project_id IN (
                        SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = :pid
                    )
                ))
            )
            """
        )

    # Optional filter by source_table (whitelist to avoid SQL injection)
    table_filter_sql = ""
    if tables_filter:
        allowed = {
            "portfolios",
            "experiences",
            "projects",
            "sections",
            "portfolio_attachments",
            "project_attachments",
            "skills",
            "skill_types",
            "category_types",
            "languages",
            "translations",
        }
        safe_tables = [t for t in tables_filter if t in allowed]
        if safe_tables:
            quoted = ", ".join([f"'{t}'" for t in safe_tables])
            table_filter_sql = f"\n          AND c.source_table IN ({quoted})\n        "

    # Optional filter by language code
    language_filter_sql = ""
    if language_code:
        language_filter_sql = "\n          AND (c.lang = :lang_code OR c.lang IS NULL)\n        "

    sql = text(
        f"""  # nosec B608 - all interpolated fragments are hardcoded SQL or built from a validated whitelist, no user data
        WITH q AS (SELECT CAST(:q AS vector({dim})) AS qvec)
        SELECT c.id as chunk_id, c.source_table, c.source_id, c.source_field, c.part_index, c.version,
               c.text, (COALESCE(e.embedding_vec, e.embedding::vector) <=> q.qvec) AS distance
        FROM rag_embedding e
        JOIN rag_chunk c ON c.id = e.chunk_id
        JOIN q ON TRUE
        WHERE e.model = :m
          AND e.modality = 'text'
          AND e.dim = :d
          AND c.is_deleted = FALSE
          {portfolio_filter}
          {table_filter_sql}
          {language_filter_sql}
        ORDER BY distance
        LIMIT :k
        """
    )
    qparam = "[" + ", ".join(str(x) for x in qvec) + "]"
    params = {"q": qparam, "m": model, "k": k, "d": dim}
    if portfolio_id is not None:
        params["pid"] = portfolio_id
    if language_code:
        params["lang_code"] = language_code
    
    try:
        rows = db.execute(sql, params).mappings().all()
    except Exception as e:
        # If vector search fails, rollback and return empty results
        try:
            db.rollback()
        except Exception:
            pass
        return []
    
    items: List[Dict[str, Any]] = []
    for r in rows:
        score = 1.0 - float(r["distance"])  # cosine similarity proxy
        if score_threshold is not None and score < score_threshold:
            continue
        items.append({
            "chunk_id": r["chunk_id"],
            "source_table": r["source_table"],
            "source_id": r["source_id"],
            "source_field": r["source_field"],
            "part_index": r["part_index"],
            "version": r["version"],
            "text": r["text"],
            "score": score,
        })
    return items


def assemble_context(chunks: List[Dict[str, Any]], *, max_tokens: int) -> Tuple[str, List[Dict[str, Any]]]:
    # Approximate by characters (rough heuristic 1 token ~ 4 chars)
    budget_chars = max(200, int(max_tokens * 4 * 0.9))
    used = 0
    context_parts: List[str] = []
    citations: List[Dict[str, Any]] = []
    for ch in chunks:
        txt = ch.get("text") or ""
        if not txt:
            continue
        take = min(len(txt), max(0, budget_chars - used))
        if take <= 0:
            break
        context_parts.append(txt[:take])
        used += take
        citations.append({
            "chunk_id": ch["chunk_id"],
            "source_table": ch["source_table"],
            "source_id": ch["source_id"],
            "score": ch["score"],
        })
    return "\n\n---\n\n".join(context_parts), citations


