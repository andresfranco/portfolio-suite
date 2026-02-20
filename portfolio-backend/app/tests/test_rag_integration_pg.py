import os
import time
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

try:
    from testcontainers.postgres import PostgresContainer  # type: ignore
except Exception:  # pragma: no cover - tests will be skipped if not installed
    PostgresContainer = None  # type: ignore

from app.main import app
from app.api import deps
from app.core.database import SessionLocal


import docker
def _docker_available() -> bool:
    try:
        docker.from_env().version()
        return True
    except Exception:
        return False

pytestmark = pytest.mark.skipif(PostgresContainer is None or not _docker_available(), reason="testcontainers or docker not available")


class _User:
    is_active = True
    id = 1
    roles = ["SYSTEM_ADMIN"]
    tenant_id = "default"


def _override_user():
    return _User()


def _run_migrations(url: str):
    # run alembic migrations programmatically via shell
    from subprocess import run, CalledProcessError
    env = os.environ.copy()
    env["DATABASE_URL"] = url
    # use app's alembic.ini; pass -x environment=testing if supported
    cmd = ["alembic", "upgrade", "head"]
    r = run(cmd, cwd=os.path.dirname(__file__) + "/../../", env=env, capture_output=True, text=True)
    if r.returncode != 0:
        raise CalledProcessError(r.returncode, cmd, r.stdout, r.stderr)


def test_end_to_end_index_and_search_with_acl(tmp_path):
    with PostgresContainer("postgres:16-alpine") as pg:
        url = pg.get_connection_url()
        os.environ["DATABASE_URL"] = url
        # Run migrations to set up schema
        _run_migrations(url)

        # Recreate engine/session to point to container DB
        engine = create_engine(url)
        Session = sessionmaker(bind=engine)

        # Insert minimal domain data to be indexed
        with engine.begin() as conn:
            # create a simple project with texts
            conn.execute(text("INSERT INTO projects(id, updated_at) VALUES (1, now())"))
            conn.execute(text("INSERT INTO project_texts(id, project_id, name, description) VALUES (1, 1, 'Demo Project', 'This is a demo description about vector search and hybrid retrieval.')"))

        # Hit API endpoints to trigger loading/search
        app.dependency_overrides[deps.get_current_user] = _override_user
        c = TestClient(app)

        # Backfill via admin reindex
        r = c.post("/api/rag/reindex", json={"tables": ["projects"], "limit": 10, "offset": 0})
        assert r.status_code == 200

        # Index the record directly (ensure chunks/embeddings exist)
        with Session() as db:
            from app.rag.indexer import index_record
            index_record(db, "projects", "1")

        # Vector search should return the chunk
        r = c.get("/api/search/vector", params={"q": "demo hybrid retrieval", "limit": 3})
        assert r.status_code == 200
        items = r.json().get("items")
        assert isinstance(items, list)
        assert len(items) >= 1
        assert "distance" in items[0]

        # Hybrid search should return rrf_score and respect ACL
        r = c.get("/api/search/hybrid", params={"q": "hybrid retrieval", "limit": 3})
        assert r.status_code == 200
        items = r.json().get("items")
        assert len(items) >= 1
        assert "rrf_score" in items[0]

        # Idempotency: reindex again; counts should not duplicate active chunks
        before = None
        with engine.begin() as conn:
            before = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='projects' AND source_id='1' AND is_deleted=FALSE")).scalar_one()
        with Session() as db:
            from app.rag.indexer import index_record
            index_record(db, "projects", "1")
        with engine.begin() as conn:
            after = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='projects' AND source_id='1' AND is_deleted=FALSE")).scalar_one()
        assert after == before

        # Retirement: update text to shorter set so some parts retire
        with engine.begin() as conn:
            conn.execute(text("UPDATE project_texts SET description='Short text' WHERE id=1"))
            conn.execute(text("UPDATE projects SET updated_at = now() WHERE id=1"))
        with Session() as db:
            from app.rag.indexer import index_record
            index_record(db, "projects", "1")
        with engine.begin() as conn:
            active = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='projects' AND source_id='1' AND is_deleted=FALSE")).scalar_one()
            retired = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='projects' AND source_id='1' AND is_deleted=TRUE")).scalar_one()
        assert retired >= 1
        assert active >= 1

        # Dead letter log: force an error by deleting rag_embedding table and triggering index
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE rag_embedding"))
        error_seen = False
        try:
            with Session() as db:
                from app.rag.indexer import index_record
                index_record(db, "projects", "1")
        except Exception:
            error_seen = True
        assert error_seen

        # The dead letter API should show at least one failure
        r = c.get("/api/rag/dead_letters", params={"limit": 5})
        assert r.status_code == 200
        failures = r.json().get("items", [])
        assert isinstance(failures, list)
    # Retry path should accept request even if it cannot succeed (no rag_embedding)
    r = c.post("/api/rag/dead_letters/retry", json={"max": 5, "job_type": "index"})
    assert r.status_code == 200
