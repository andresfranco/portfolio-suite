from app.api import deps
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app import models


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return list(self._rows)


class _FakeDB:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, *_args, **_kwargs):
        return _FakeResult(self._rows)


class _User:
    is_active = True
    id = 1
    username = "systemadmin"  # triggers system admin path
    roles = []


def _override_user():
    return _User()


def test_metrics_summary_normalizes_active_by_finished_and_age(monkeypatch):
    now = datetime.now(timezone.utc)
    started = (now - timedelta(minutes=20)).isoformat()
    finished = (now - timedelta(minutes=19)).isoformat()

    rows = [
        ("rag.last_reindex_started_at", started),
        ("rag.last_reindex_finished_at", finished),
        ("rag.reindex_active", "true"),  # stuck true
    ]
    fake_db = _FakeDB(rows)

    # Override deps for user (real model) and db
    app.dependency_overrides = {}
    app.dependency_overrides[deps.get_current_user] = lambda: models.User(username="systemadmin", is_active=True)
    def _fake_get_db():
        yield fake_db
    app.dependency_overrides[deps.get_db] = _fake_get_db
    c = TestClient(app)
    out = c.get("/api/rag/metrics_summary").json()
    assert out.get("reindex_active") is False, "Should self-heal to inactive when finished >= started or too old"

    # Case: too old start, no finished
    started2 = (now - timedelta(minutes=30)).isoformat()
    rows2 = [
        ("rag.last_reindex_started_at", started2),
        ("rag.reindex_active", "true"),
    ]
    fake_db2 = _FakeDB(rows2)
    def _fake_get_db2():
        yield fake_db2
    app.dependency_overrides[deps.get_db] = _fake_get_db2
    out2 = c.get("/api/rag/metrics_summary").json()
    assert out2.get("reindex_active") is False, "Should mark inactive if active too old"

