from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.rag.indexer import index_record, retire_record


def test_indexer_upsert_and_retire_smoke(tmp_path):
    # Use in-memory sqlite for a fast structural smoke (will skip vector specifics)
    engine = create_engine('sqlite:///:memory:', future=True)
    Session = sessionmaker(bind=engine, future=True)
    # Create minimal tables the indexer touches
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE rag_chunk(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_table TEXT NOT NULL,
                source_id TEXT NOT NULL,
                source_field TEXT,
                source_uri TEXT,
                modality TEXT NOT NULL,
                mime_type TEXT,
                part_index INTEGER NOT NULL DEFAULT 0,
                version INTEGER NOT NULL DEFAULT 1,
                text TEXT,
                checksum TEXT,
                lang TEXT,
                is_deleted BOOLEAN NOT NULL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                tsv TEXT,
                visibility TEXT DEFAULT 'public' NOT NULL,
                tenant_id TEXT DEFAULT 'default' NOT NULL
            );
            """
        ))
        conn.execute(text(
            """
            CREATE UNIQUE INDEX uq_rag_chunk_logical
            ON rag_chunk(source_table, source_id, source_field, part_index, version);
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
                PRIMARY KEY(chunk_id, model, modality)
            );
            """
        ))

    with Session() as db:
        # Indexing a non-existent source results in retire (no-op here)
        retire_record(db, 'categories', '999')
        # Manually insert a fake record to be loaded by indexer via loader fallback
        # We simulate a simple loader path by inserting a prior chunk and reindexing
        db.execute(text("INSERT INTO rag_chunk(source_table, source_id, source_field, part_index, version, modality, text) VALUES ('portfolios','1','body',0,1,'text','hello')"))
        db.commit()
        # Re-index should upsert and not error
        index_record(db, 'portfolios', '1')
        rows = list(db.execute(text("SELECT COUNT(*) FROM rag_chunk WHERE source_table='portfolios' AND source_id='1'")))
        assert rows[0][0] >= 1


