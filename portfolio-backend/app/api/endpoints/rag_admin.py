from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Body, Query
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Any, Dict, List, Optional

from app.api import deps
from app.core.database import SessionLocal
from app.core.security_decorators import require_system_admin
from app.rag.indexer import index_record
from app import models
from pydantic import BaseModel
from app.observability.metrics import rag_index_jobs, rag_retire_jobs, rag_chunks_retired
try:
    from prometheus_client import CollectorRegistry, REGISTRY  # type: ignore
    try:
        from prometheus_client import multiprocess  # type: ignore
    except Exception:  # pragma: no cover
        multiprocess = None  # type: ignore
except Exception:  # Optional dependency
    CollectorRegistry = None  # type: ignore
    REGISTRY = None  # type: ignore
    multiprocess = None  # type: ignore
from app.queue.tasks import enqueue_index_job, enqueue_delete_job


router = APIRouter()
logger = logging.getLogger(__name__)


RAG_KEYS = {
    "rag.default_tenant_id": "default",
    "rag.default_visibility": "public",
    "rag.chunk_chars": "4000",
    "rag.chunk_overlap": "500",
    "rag.debounce_seconds": "0",
    "rag.allow_fields": "",
    "rag.redact_regex": "",
    "embed.provider": "",
    "embed.model": "text-embedding-3-small",
}


def _get_settings_map(db: Session) -> Dict[str, str]:
    rows = db.execute(text("SELECT key, value FROM system_settings WHERE key LIKE 'rag.%' OR key LIKE 'embed.%'"))
    m: Dict[str, str] = {}
    for k, v in rows:
        m[k] = v
    return m


@router.get("/settings")
@require_system_admin()
def get_rag_settings(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    existing = _get_settings_map(db)
    out = {}
    for k, default in RAG_KEYS.items():
        out[k] = existing.get(k, default)
    return {"settings": out}


@router.put("/settings")
@require_system_admin()
def put_rag_settings(
    payload: Dict[str, str] = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be a key/value object")
    for k, v in payload.items():
        if k not in RAG_KEYS:
            continue
        db.execute(text(
            """
            INSERT INTO system_settings(key, value)
            VALUES (:k, :v)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
            """
        ), {"k": k, "v": str(v)})
    db.commit()
    return {"ok": True}



def _reindex_table(db: Session, table: str, limit: Optional[int], offset: int) -> int:
    total = 0
    q = f"SELECT id FROM {table} ORDER BY id"
    if limit is not None:
        q += " LIMIT :lim OFFSET :off"
        rows = db.execute(text(q), {"lim": limit, "off": offset}).fetchall()
    else:
        rows = db.execute(text(q)).fetchall()
    for (rid,) in rows:
        index_record(db, table, str(rid))
        total += 1
        # Reflect processed jobs in metrics when running inline
        try:
            if rag_index_jobs:
                rag_index_jobs.inc()
        except Exception:
            pass
    return total


def _background_reindex(tables: List[str], limit: Optional[int], offset: int) -> None:
    with SessionLocal() as db:
        for t in tables:
            try:
                _reindex_table(db, t, limit, offset)
            except Exception:
                # continue with other tables
                pass


class ReindexRequest(BaseModel):
    tables: Optional[List[str]] = None
    limit: Optional[int] = None
    offset: int = 0


@router.post("/reindex")
@require_system_admin()
def reindex_all(
    background_tasks: BackgroundTasks,
    req: ReindexRequest = Body(default=ReindexRequest()),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    supported = [
        "categories",
        "projects",
        "portfolios",
        "sections",
        "experiences",
        "languages",
        "translations",
        "skills",
        "skill_types",
        "project_attachments",
        "portfolio_attachments",
    ]
    to_run = req.tables or supported
    for t in to_run:
        if t not in supported:
            raise HTTPException(status_code=400, detail=f"unsupported table: {t}")
    background_tasks.add_task(_background_reindex, to_run, req.limit, req.offset)
    return {"scheduled": to_run, "limit": req.limit, "offset": req.offset}


@router.get("/status")
@require_system_admin()
def get_status(
    source_table: str,
    source_id: str,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    row = db.execute(text(
        "SELECT source_table, source_id, last_indexed_at, last_error, updated_at FROM rag_index_status WHERE source_table=:t AND source_id=:i"
    ), {"t": source_table, "i": source_id}).mappings().first()
    if not row:
        return {"source_table": source_table, "source_id": source_id, "status": "unknown"}
    return {"status": "ok" if not row["last_error"] else "error", **dict(row)}


@router.get("/dead_letters")
@require_system_admin()
def list_dead_letters(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    try:
        rows = db.execute(text(
            """
            SELECT id, created_at, job_type, source_table, source_id, error
            FROM rag_dead_letter
            ORDER BY created_at DESC
            LIMIT :l
            """
        ), {"l": limit}).mappings().all()
        return {"items": [dict(r) for r in rows]}
    except Exception as e:
        # Graceful fallback (e.g., table not created yet) to avoid breaking the Admin UI
        try:
            logger.warning(f"dead_letters unavailable: {e}")
        except Exception:
            pass
        return {"items": []}


class RetryRequest(BaseModel):
    ids: Optional[List[int]] = None
    job_type: Optional[str] = None  # "index" | "retire" | None for any
    max: int = 20


@router.post("/dead_letters/retry")
@require_system_admin()
def retry_dead_letters(
    req: RetryRequest,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    # Fetch entries
    if req.ids:
        rows = db.execute(text(
            """
            SELECT id, job_type, source_table, source_id
            FROM rag_dead_letter
            WHERE id = ANY(:ids)
            ORDER BY created_at ASC
            """
        ), {"ids": req.ids}).mappings().all()
    else:
        params = {"l": req.max}
        sql = "SELECT id, job_type, source_table, source_id FROM rag_dead_letter"
        if req.job_type in ("index", "retire"):
            sql += " WHERE job_type = :jt"
            params["jt"] = req.job_type
        sql += " ORDER BY created_at ASC LIMIT :l"
        rows = db.execute(text(sql), params).mappings().all()
    retried: List[int] = []
    for r in rows:
        ev = {"source_table": r["source_table"], "source_id": r["source_id"]}
        try:
            if r["job_type"] == "retire":
                enqueue_delete_job(ev)
            else:
                enqueue_index_job(ev)
            retried.append(r["id"])
            # Delete after requeue to avoid duplicates; failures will create new entries
            db.execute(text("DELETE FROM rag_dead_letter WHERE id=:i"), {"i": r["id"]})
            db.commit()
        except Exception:
            # keep entry; continue
            pass
    return {"retried": retried}


@router.get("/metrics_summary")
@require_system_admin()
def metrics_summary(
    # Inject current_user so the system admin decorator can authenticate properly
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Summarize RAG metrics. If PROMETHEUS_MULTIPROC_DIR is set and prometheus_client is available,
    aggregate counters across processes; otherwise fall back to local in-process counters.
    """
    def _from_registry(name: str) -> float | None:
        try:
            if CollectorRegistry is None or REGISTRY is None:
                return None
            # Use multiprocess registry if configured
            if multiprocess and os.getenv("PROMETHEUS_MULTIPROC_DIR"):
                reg = CollectorRegistry()
                multiprocess.MultiProcessCollector(reg)
            else:
                reg = REGISTRY
            val = reg.get_sample_value(name)
            if val is not None:
                return float(val)
            # fallback scan
            for metric in reg.collect():
                for s in metric.samples:
                    if s.name == name:
                        return float(s.value or 0.0)
        except Exception:
            return None
        return None

    def _local_counter(c) -> float | None:
        try:
            return float(c._value.get())  # type: ignore[attr-defined]
        except Exception:
            return None

    names = {
        "index_jobs_total": "rag_index_jobs_total",
        "retire_jobs_total": "rag_retire_jobs_total",
        "chunks_retired_total": "rag_chunks_retired_total",
    }
    out: Dict[str, float] = {}
    for key, prom_name in names.items():
        v = _from_registry(prom_name)
        if v is None:
            # fallback to local in-process counter
            if key == "index_jobs_total":
                v = _local_counter(rag_index_jobs)
            elif key == "retire_jobs_total":
                v = _local_counter(rag_retire_jobs)
            else:
                v = _local_counter(rag_chunks_retired)
        out[key] = float(v or 0.0)
    return out


