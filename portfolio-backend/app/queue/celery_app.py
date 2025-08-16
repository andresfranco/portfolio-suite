import os
import logging
from celery import Celery
from typing import Dict, Any


logger = logging.getLogger(__name__)


def _make_celery() -> Celery:
    broker_url = os.getenv("CELERY_BROKER_URL") or os.getenv("BROKER_URL")
    backend_url = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("RESULT_BACKEND")
    if not broker_url:
        raise RuntimeError("CELERY_BROKER_URL not set")
    app = Celery("portfolio_rag", broker=broker_url, backend=backend_url)
    # Reasonable defaults
    app.conf.update(
        task_acks_late=True,
        worker_prefetch_multiplier=4,
        task_time_limit=300,
        task_soft_time_limit=240,
        task_retry_backoff=True,
        task_retry_backoff_max=600,
        task_default_retry_delay=5,
    )
    return app


celery_app: Celery | None = None


def get_celery() -> Celery:
    global celery_app
    if celery_app is None:
        celery_app = _make_celery()
    return celery_app


def is_enabled() -> bool:
    return bool(os.getenv("CELERY_BROKER_URL") or os.getenv("BROKER_URL"))


# Define tasks
def _register_tasks(app: Celery) -> None:
    @app.task(bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 5})
    def task_index_record(self, ev: Dict[str, Any]) -> None:
        from app.core.database import SessionLocal
        from app.rag.indexer import index_record, _set_status  # type: ignore
        src_table = ev.get("source_table")
        src_id = ev.get("source_id")
        with SessionLocal() as db:
            try:
                index_record(db, src_table, src_id)
            except Exception as e:
                try:
                    _set_status(db, src_table, src_id, error=str(e))
                except Exception:
                    pass
                raise

    @app.task(bind=True, autoretry_for=(Exception,), retry_kwargs={"max_retries": 5})
    def task_retire_record(self, ev: Dict[str, Any]) -> None:
        from app.core.database import SessionLocal
        from app.rag.indexer import retire_record, _set_status  # type: ignore
        src_table = ev.get("source_table")
        src_id = ev.get("source_id")
        with SessionLocal() as db:
            try:
                retire_record(db, src_table, src_id)
            except Exception as e:
                try:
                    _set_status(db, src_table, src_id, error=str(e))
                except Exception:
                    pass
                raise


try:
    if is_enabled():
        _register_tasks(get_celery())
except Exception:
    # Do not fail app import if celery misconfigured
    pass


