import os
import threading
from typing import Dict, Any, Tuple


_timers: Dict[Tuple[str, str], threading.Timer] = {}
_lock = threading.Lock()


def _merge_events(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    # delete overrides everything
    if new.get("op") == "delete":
        return new
    if old.get("op") == "delete":
        return old
    # update overrides insert
    op = "update" if (old.get("op") == "update" or new.get("op") == "update") else "insert"
    merged = dict(new)
    merged["op"] = op
    # merge changed_fields unique
    cf = list({*(old.get("changed_fields") or []), *(new.get("changed_fields") or [])})
    merged["changed_fields"] = cf
    return merged


def schedule_event(ev: Dict[str, Any], dispatch_fn) -> None:
    """
    Debounce enqueueing index/delete jobs within a small window.
    If RAG_DEBOUNCE_SECONDS is 0 or missing, dispatch immediately.
    """
    window = float(os.getenv("RAG_DEBOUNCE_SECONDS", "0"))
    if window <= 0:
        dispatch_fn(ev)
        return
    key = (ev.get("source_table"), ev.get("source_id"))

    def _fire():
        with _lock:
            _timers.pop(key, None)
        dispatch_fn(ev)

    with _lock:
        t = _timers.get(key)
        if t:
            # Merge event and reset timer
            try:
                # type: ignore[attr-defined]
                t.ev = _merge_events(getattr(t, "ev"), ev)  # attach state to timer
            except Exception:
                pass
            t.cancel()
        new_timer = threading.Timer(window, _fire)
        setattr(new_timer, "ev", ev)
        _timers[key] = new_timer
        new_timer.start()


