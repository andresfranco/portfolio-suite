#!/usr/bin/env python3
"""
Backfill helpers for RAG:
1) populate embedding_vec from existing embedding text (for HNSW).
2) optional table backfill by calling index_record across IDs.

Usage:
  python -m scripts.backfill_rag populate_vec
  python -m scripts.backfill_rag reindex projects --limit 100 --offset 0
"""
from typing import Optional
import sys
from sqlalchemy import text
from app.core.database import SessionLocal
from app.rag.indexer import index_record


def populate_embedding_vec() -> int:
    """Populate embedding_vec from existing embedding text column."""
    with SessionLocal() as db:
        # Update rows where embedding_vec is null
        res = db.execute(text(
            """
            WITH upd AS (
              SELECT chunk_id, model, modality, embedding
              FROM rag_embedding
              WHERE embedding_vec IS NULL
            )
            UPDATE rag_embedding e
            SET embedding_vec = CAST(upd.embedding AS vector)
            FROM upd
            WHERE e.chunk_id = upd.chunk_id AND e.model = upd.model AND e.modality = upd.modality
            RETURNING 1
            """
        ))
        count = len(res.fetchall())
        db.commit()
        return count


def reindex_table(table: str, limit: Optional[int] = None, offset: int = 0) -> int:
    total = 0
    with SessionLocal() as db:
        q = f"SELECT id FROM {table} ORDER BY id"
        if limit is not None:
            rows = db.execute(text(q + " LIMIT :lim OFFSET :off"), {"lim": limit, "off": offset}).fetchall()
        else:
            rows = db.execute(text(q)).fetchall()
        for (rid,) in rows:
            index_record(db, table, str(rid))
            total += 1
    return total


def main(argv: list[str]) -> int:
    if not argv:
        print("Usage: backfill_rag.py populate_vec | reindex <table> [--limit N] [--offset N]")
        return 1
    cmd = argv[0]
    if cmd == "populate_vec":
        n = populate_embedding_vec()
        print(f"Updated embedding_vec for {n} rows")
        return 0
    if cmd == "reindex":
        if len(argv) < 2:
            print("Usage: backfill_rag.py reindex <table> [--limit N] [--offset N]")
            return 1
        table = argv[1]
        limit = None
        offset = 0
        for i, a in enumerate(argv[2:]):
            if a == "--limit" and i + 3 <= len(argv) and argv[2 + i + 1].isdigit():
                limit = int(argv[2 + i + 1])
            if a == "--offset" and i + 3 <= len(argv) and argv[2 + i + 1].isdigit():
                offset = int(argv[2 + i + 1])
        n = reindex_table(table, limit, offset)
        print(f"Reindexed {n} rows from {table}")
        return 0
    print("Unknown command")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
import argparse
import os
import sys
from sqlalchemy import text


# Ensure 'app' is importable when running this script directly
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.core.database import SessionLocal  # noqa: E402
from app.rag.indexer import index_record  # noqa: E402


def backfill_table(table: str, limit: int, offset: int):
    with SessionLocal() as db:
        rows = db.execute(
            text(f"SELECT id FROM {table} ORDER BY id LIMIT :lim OFFSET :off"),
            {"lim": limit, "off": offset},
        ).fetchall()
        print(f"Backfilling {table}: {len(rows)} rows")
        for (rid,) in rows:
            index_record(db, table, str(rid))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--table', type=str, default='categories')
    parser.add_argument('--limit', type=int, default=100)
    parser.add_argument('--offset', type=int, default=0)
    args = parser.parse_args()
    backfill_table(args.table, args.limit, args.offset)


if __name__ == '__main__':
    main()


