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


