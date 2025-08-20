from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text


def embed_query(db: Session, *, provider, embedding_model: str, query: str) -> List[float]:
    # Use provider embeddings
    vec = provider.embed(model=embedding_model, texts=[query])[0]
    # Normalize for cosine if needed: pg uses cosine ops; upstream vectors may not be unit length
    norm = sum(x * x for x in vec) ** 0.5 or 1.0
    return [x / norm for x in vec]


def vector_search(db: Session, *, qvec: List[float], model: str, k: int, score_threshold: Optional[float]) -> List[Dict[str, Any]]:
    # Use embedding_vec if present; else fallback to embedding text column cast
    sql = text(
        """
        WITH q AS (SELECT CAST(:q AS vector) AS qvec)
        SELECT c.id as chunk_id, c.source_table, c.source_id, c.source_field, c.part_index, c.version,
               c.text, (e.embedding_vec <=> q.qvec) AS distance
        FROM rag_embedding e
        JOIN rag_chunk c ON c.id = e.chunk_id
        JOIN q ON TRUE
        WHERE e.model = :m
          AND e.modality = 'text'
          AND c.is_deleted = FALSE
        ORDER BY distance
        LIMIT :k
        """
    )
    qparam = "[" + ", ".join(str(x) for x in qvec) + "]"
    rows = db.execute(sql, {"q": qparam, "m": model, "k": k}).mappings().all()
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


