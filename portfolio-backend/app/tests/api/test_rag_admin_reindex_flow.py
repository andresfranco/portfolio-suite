import os
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api import deps
from app import models


def _override_user():
    # Return a real models.User instance so security decorator recognizes it
    return models.User(username="systemadmin", is_active=True)


def test_reindex_handles_skill_types_pk_and_sets_finish_flags(tmp_path, monkeypatch):
    # Use a temporary sqlite DB file for simulating system_settings only
    url = f"sqlite:///{tmp_path}/test.db"
    engine = create_engine(url, future=True)
    Session = sessionmaker(bind=engine, future=True)

    # Create minimal tables referenced by reindex/status code paths
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE system_settings(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                description TEXT,
                created_at TEXT,
                updated_at TEXT
            )
            """
        ))
        # Two domain tables: one with id (projects), one with code (skill_types)
        conn.execute(text("CREATE TABLE projects(id INTEGER PRIMARY KEY, updated_at TEXT)"))
        conn.execute(text("CREATE TABLE skill_types(code TEXT PRIMARY KEY, name TEXT)"))
        # Minimal rag tables used in indexer writes
        conn.execute(text(
            """
            CREATE TABLE rag_chunk(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_table TEXT NOT NULL,
                source_id TEXT NOT NULL,
                source_field TEXT,
                part_index INTEGER NOT NULL DEFAULT 0,
                version INTEGER NOT NULL DEFAULT 1,
                modality TEXT NOT NULL,
                text TEXT,
                checksum TEXT,
                is_deleted BOOLEAN NOT NULL DEFAULT 0,
                updated_at TEXT,
                visibility TEXT DEFAULT 'public' NOT NULL,
                tenant_id TEXT DEFAULT 'default' NOT NULL,
                UNIQUE(source_table, source_id, source_field, part_index, version)
            )
            """
        ))
        conn.execute(text(
            """
            CREATE TABLE rag_embedding(
                chunk_id INTEGER NOT NULL,
                model TEXT NOT NULL,
                modality TEXT NOT NULL,
                dim INTEGER NOT NULL,
                embedding TEXT NOT NULL,
                embedding_vec TEXT,
                PRIMARY KEY(chunk_id, model, modality)
            )
            """
        ))

        # Seed a project and a skill_type
        conn.execute(text("INSERT INTO projects(id, updated_at) VALUES (1, '2025-08-16T00:00:00Z')"))
        conn.execute(text("INSERT INTO skill_types(code, name) VALUES ('FE', 'Frontend')"))

    # Override DB session to use our sqlite engine
    def _fake_get_db():
        with Session() as s:
            yield s

    app.dependency_overrides = {}
    app.dependency_overrides[deps.get_db] = _fake_get_db
    app.dependency_overrides[deps.get_current_user] = _override_user

    # Run the background function inline by calling it directly using the same session
    # Import within test scope to avoid circulars
    from app.api.endpoints import rag_admin as _rag_admin
    from app.rag import indexer as _indexer
    # Patch SessionLocal used inside background task to our sqlite Session
    _rag_admin.SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
    # Monkeypatch retire_missing_chunks to avoid SQLite-specific syntax issues
    _indexer.retire_missing_chunks = lambda *args, **kwargs: 0  # type: ignore
    _background_reindex = _rag_admin._background_reindex
    _background_reindex(["projects", "skill_types"], None, 0)

    # Verify that finish flags are set and not stuck active
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT key, value FROM system_settings")).fetchall()
        m = {k: v for k, v in rows}
    assert m.get('rag.reindex_active') == 'false'
    assert 'rag.last_reindex_finished_at' in m
    # Confirm chunks exist for both records (skill_types used code PK)
    with engine.begin() as conn:
        n_projects = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='projects' AND source_id='1'")) .scalar_one()
        n_skills = conn.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='skill_types' AND source_id='FE'")) .scalar_one()
    assert n_projects >= 1
    assert n_skills >= 1
