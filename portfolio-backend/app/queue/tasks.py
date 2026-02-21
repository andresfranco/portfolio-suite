from typing import Dict, Any, Tuple
from app.core.database import SessionLocal
from app.rag.indexer import index_record, retire_record
from app.queue.celery_app import is_enabled as celery_enabled
from time import perf_counter
import time
import os
try:
    from prometheus_client import Counter, Histogram
except Exception:  # optional dependency
    Counter = Histogram = None  # type: ignore
from app.observability.metrics import rag_index_jobs, rag_retire_jobs
from sqlalchemy import text

_in_flight: set[Tuple[str, str, str]] = set()


def _dead_letter(job_type: str, ev: Dict[str, Any], error: str, retries: int = 0) -> None:
    try:
        with SessionLocal() as db:
            db.execute(text(
                """
                INSERT INTO rag_dead_letter (job_type, source_table, source_id, payload, error, retries)
                VALUES (:jt, :t, :i, :p, :e, :r)
                """
            ), {
                "jt": job_type,
                "t": ev.get('source_table'),
                "i": ev.get('source_id'),
                "p": str(ev)[:4000],
                "e": error[:4000],
                "r": retries,
            })
            db.commit()
    except Exception:
        # best-effort only
        pass

# Optional celery imports guarded at call-time
def _enqueue_celery(ev: Dict[str, Any], task_name: str) -> bool:
    try:
        if not celery_enabled():
            return False
        from app.queue.celery_app import get_celery
        app = get_celery()
        if task_name == "index":
            app.send_task("app.queue.celery_app.task_index_record", args=[ev])
        elif task_name == "retire":
            app.send_task("app.queue.celery_app.task_retire_record", args=[ev])
        else:
            return False
        return True
    except Exception:
        return False


def enqueue_index_job(ev: Dict[str, Any]) -> None:
    # Try celery; fallback to inline
    if _enqueue_celery(ev, "index"):
        return
    start = perf_counter()
    source_table = ev.get('source_table')
    source_id = ev.get('source_id')
    key = ("index", str(source_table), str(source_id))
    if key in _in_flight:
        return
    _in_flight.add(key)
    try:
        max_retries = int(os.getenv("RAG_INLINE_MAX_RETRIES", "2"))
        backoff = float(os.getenv("RAG_INLINE_BACKOFF_SECONDS", "0.2"))
        attempt = 0
        while True:
            try:
                with SessionLocal() as db:
                    index_record(db, source_table, source_id)
                break
            except Exception as e:
                if attempt >= max_retries:
                    _dead_letter('index', ev, str(e), retries=attempt)
                    raise
                attempt += 1
                time.sleep(backoff * attempt)
    except Exception as e:
        raise
    dur = perf_counter() - start
    if Histogram:
        _h = Histogram('rag_index_seconds', 'Time spent indexing a record')
        _h.observe(dur)
    if rag_index_jobs:
        rag_index_jobs.inc()
    _in_flight.discard(key)


def enqueue_delete_job(ev: Dict[str, Any]) -> None:
    if _enqueue_celery(ev, "retire"):
        return
    start = perf_counter()
    source_table = ev.get('source_table')
    source_id = ev.get('source_id')
    key = ("retire", str(source_table), str(source_id))
    if key in _in_flight:
        return
    _in_flight.add(key)
    try:
        max_retries = int(os.getenv("RAG_INLINE_MAX_RETRIES", "2"))
        backoff = float(os.getenv("RAG_INLINE_BACKOFF_SECONDS", "0.2"))
        attempt = 0
        while True:
            try:
                with SessionLocal() as db:
                    retire_record(db, source_table, source_id)
                break
            except Exception as e:
                if attempt >= max_retries:
                    _dead_letter('retire', ev, str(e), retries=attempt)
                    raise
                attempt += 1
                time.sleep(backoff * attempt)
    except Exception:
        raise
    dur = perf_counter() - start
    if Histogram:
        _h = Histogram('rag_retire_seconds', 'Time spent retiring a record')
        _h.observe(dur)
    if rag_retire_jobs:
        rag_retire_jobs.inc()
    _in_flight.discard(key)


