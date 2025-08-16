from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any

from app.api import deps
from app.observability.metrics import rag_vector_search_seconds, rag_hybrid_search_seconds, rag_embedding_list_seconds
from time import perf_counter

router = APIRouter()


@router.get("/embedding")
def search_embedding(
    q: str = Query("", description="Query text (placeholder)"),
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
) -> Any:
    # Phase 1: return latest non-deleted chunks for sanity check
    tenant_id = getattr(current_user, 'tenant_id', 'default') if current_user else 'default'
    t0 = perf_counter()
    rows = db.execute(text(
        """
        SELECT id, source_table, source_id, source_field, part_index, text
        FROM rag_chunk
        WHERE is_deleted = FALSE AND visibility IN ('public','internal') AND tenant_id = :tid
        ORDER BY updated_at DESC
        LIMIT :l
        """
    ), {"l": limit, "tid": tenant_id}).mappings().all()
    if rag_embedding_list_seconds:
        rag_embedding_list_seconds.observe(perf_counter() - t0)
    return {"items": [dict(r) for r in rows]}


@router.get("/vector")
def vector_search(
    q: str = Query(..., description="Query text to embed and search"),
    limit: int = Query(5, ge=1, le=50),
    model: str = Query("text-embedding-3-small", description="Embedding model to search against"),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
) -> Any:
    from app.rag.embedding import embed_text_batch
    try:
        vec = embed_text_batch([q])[0]
    except Exception:
        raise HTTPException(status_code=500, detail="Embedding provider not available")
    vec_str = f"[{', '.join(str(x) for x in vec)}]"
    # TODO: enforce ACLs by tenant/visibility if those columns exist on rag_chunk
    tenant_id = getattr(current_user, 'tenant_id', 'default') if current_user else 'default'
    t0 = perf_counter()
    if model not in {"text-embedding-3-small", "text-embedding-3-large"}:
        raise HTTPException(status_code=400, detail="Unsupported model")
    rows = db.execute(text(
        """
        WITH q AS (SELECT CAST(:q AS vector) AS qvec)
        SELECT c.id, c.source_table, c.source_id, c.source_field, c.part_index, c.text,
               (COALESCE(e.embedding_vec, e.embedding::vector) <=> q.qvec) AS distance
        FROM rag_embedding e
        JOIN rag_chunk c ON c.id = e.chunk_id
        JOIN q ON TRUE
        WHERE e.model = :m AND e.modality = 'text' AND c.is_deleted = FALSE AND c.visibility IN ('public','internal') AND c.tenant_id = :tid
        ORDER BY distance
        LIMIT :l
        """
    ), {"q": vec_str, "m": model, "l": limit, "tid": tenant_id}).mappings().all()
    if rag_vector_search_seconds:
        rag_vector_search_seconds.observe(perf_counter() - t0)
    return {"model": model, "items": [{**dict(r), "distance": float(r["distance"]) if r.get("distance") is not None else None} for r in rows]}


@router.get("/hybrid")
def hybrid_search(
    q: str = Query(..., description="Query text for hybrid search (FTS + vector)"),
    limit: int = Query(5, ge=1, le=50),
    model: str = Query("text-embedding-3-small"),
    rrf_k: int = Query(60, ge=1, le=200, description="RRF constant for fusion"),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user),
) -> Any:
    from app.rag.embedding import embed_text_batch
    try:
        vec = embed_text_batch([q])[0]
    except Exception:
        raise HTTPException(status_code=500, detail="Embedding provider not available")
    vec_str = f"[{', '.join(str(x) for x in vec)}]"
    tenant_id = getattr(current_user, 'tenant_id', 'default') if current_user else 'default'
    t0 = perf_counter()
    if model not in {"text-embedding-3-small", "text-embedding-3-large"}:
        raise HTTPException(status_code=400, detail="Unsupported model")
    rows = db.execute(text(
        """
        WITH
        q AS (SELECT CAST(:q AS vector) AS qvec),
        fts AS (
          SELECT id, source_table, source_id, source_field, part_index, text,
                 ts_rank_cd(tsv, websearch_to_tsquery('english', :term)) AS fts_score
          FROM rag_chunk
          WHERE is_deleted = FALSE AND visibility IN ('public','internal') AND tenant_id = :tid AND tsv @@ websearch_to_tsquery('english', :term)
          ORDER BY fts_score DESC
          LIMIT :l
        ),
        vs AS (
          SELECT c.id, c.source_table, c.source_id, c.source_field, c.part_index, c.text,
                 (COALESCE(e.embedding_vec, e.embedding::vector) <=> q.qvec) AS distance
          FROM rag_embedding e
          JOIN rag_chunk c ON c.id = e.chunk_id
          JOIN q ON TRUE
          WHERE e.model = :m AND e.modality = 'text' AND c.is_deleted = FALSE AND c.visibility IN ('public','internal') AND c.tenant_id = :tid
          ORDER BY distance
          LIMIT :l
        ),
        unioned AS (
          SELECT id, source_table, source_id, source_field, part_index, text,
                 (1.0 / (:k + ROW_NUMBER() OVER (ORDER BY fts_score DESC))) AS rrf
          FROM fts
          UNION ALL
          SELECT id, source_table, source_id, source_field, part_index, text,
                 (1.0 / (:k + ROW_NUMBER() OVER (ORDER BY distance ASC))) AS rrf
          FROM vs
        )
        SELECT id, source_table, source_id, source_field, part_index, text,
               SUM(rrf) AS rrf_score
        FROM unioned
        GROUP BY id, source_table, source_id, source_field, part_index, text
        ORDER BY rrf_score DESC
        LIMIT :l
        """
    ), {"q": vec_str, "m": model, "l": limit, "term": q, "tid": tenant_id, "k": rrf_k}).mappings().all()
    if rag_hybrid_search_seconds:
        rag_hybrid_search_seconds.observe(perf_counter() - t0)
    return {"model": model, "k": rrf_k, "items": [{**dict(r), "rrf_score": float(r["rrf_score"]) if r.get("rrf_score") is not None else None} for r in rows]}


