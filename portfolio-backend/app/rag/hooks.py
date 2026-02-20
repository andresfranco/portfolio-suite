from sqlalchemy.orm import Session
from sqlalchemy import event


def register_after_commit_hook(SessionClass):
    @event.listens_for(SessionClass, "after_commit")
    def _after_commit(session: Session):
        events = session.info.pop("rag_events", [])
        for ev in events:
            # Import lazily to avoid cycles
            try:
                from app.queue.tasks import enqueue_index_job, enqueue_delete_job
                from app.rag.debounce import schedule_event
                if ev.get("op") in ("insert", "update"):
                    schedule_event(ev, enqueue_index_job)
                elif ev.get("op") == "delete":
                    schedule_event(ev, enqueue_delete_job)
            except Exception:
                pass


