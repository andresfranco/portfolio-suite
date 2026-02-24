#!/usr/bin/env python3
"""
Generate a production-ready SQL import script from the development database.

Usage:
    # Via DATABASE_URL (recommended)
    DATABASE_URL=postgresql://admindb:password@localhost:5432/portfolioai_dev \\
        python scripts/generate_import_sql.py

    # Or via individual env vars
    DB_HOST=localhost DB_USER=admindb DB_PASSWORD=secret DB_NAME=portfolioai_dev \\
        python scripts/generate_import_sql.py

Output:
    scripts/database/import_production_data.sql

To test locally WITHOUT touching dev data, run against the test DB:
    PGPASSWORD=<password> psql -h localhost -U admindb -d portfolioai_test \\
         -v ON_ERROR_STOP=1 -f scripts/database/import_production_data.sql

To run against production:
    psql $PROD_DATABASE_URL -v ON_ERROR_STOP=1 -f scripts/database/import_production_data.sql
"""

import os
import sys
import json
import psycopg2
from urllib.parse import urlparse
from datetime import datetime, timezone


def _build_db_config() -> dict:
    """
    Build psycopg2 connection kwargs from environment variables.

    Reads (in priority order):
      1. DATABASE_URL  – full DSN, e.g. postgresql://user:pass@host:5432/dbname
      2. Individual vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

    Raises SystemExit if no credentials are found.
    """
    url = os.environ.get("DATABASE_URL")
    if url:
        p = urlparse(url)
        return {
            "host": p.hostname or "localhost",
            "port": int(p.port or 5432),
            "dbname": p.path.lstrip("/"),
            "user": p.username,
            "password": p.password,
        }

    host = os.environ.get("DB_HOST")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    if not (host and user and password):
        print(
            "ERROR: Database credentials not found in environment.\n"
            "Set DATABASE_URL or DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT.",
            file=sys.stderr,
        )
        sys.exit(1)

    return {
        "host": host,
        "port": int(os.environ.get("DB_PORT", 5432)),
        "dbname": os.environ.get("DB_NAME", "portfolioai_dev"),
        "user": user,
        "password": password,
    }


# ── Source: dev database (credentials from environment) ─────────────────────
DB_CONFIG = _build_db_config()

OUTPUT_FILE = os.path.join(
    os.path.dirname(__file__), "database", "import_production_data.sql"
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def esc(val):
    """Escape a Python value into a SQL literal."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, (dict, list)):
        # Serialize dicts/lists (JSONB columns) as valid JSON
        s = json.dumps(val, ensure_ascii=False).replace("'", "''")
        return f"'{s}'"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def get_columns(cursor, table):
    cursor.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = %s AND table_schema = 'public'
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in cursor.fetchall()]


def dump_table(cursor, table, order_by="id"):
    cols = get_columns(cursor, table)
    query = f"SELECT * FROM {table}"
    if order_by:
        query += f" ORDER BY {order_by}"
    cursor.execute(query)
    rows = cursor.fetchall()
    return cols, rows


def inserts(table, cols, rows, conflict_cols, update_cols=None):
    """
    Return a list of INSERT … ON CONFLICT lines.
    - If update_cols is given  → ON CONFLICT DO UPDATE SET …
    - Otherwise                → ON CONFLICT DO NOTHING
    """
    lines = []
    if not rows:
        lines.append(f"-- (no rows in {table})")
        return lines

    col_list = ", ".join(f'"{c}"' for c in cols)
    conflict = ", ".join(f'"{c}"' for c in conflict_cols)

    for row in rows:
        vals = ", ".join(esc(v) for v in row)
        if update_cols:
            updates = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
            stmt = (
                f"INSERT INTO {table} ({col_list}) VALUES ({vals})"
                f" ON CONFLICT ({conflict}) DO UPDATE SET {updates};"
            )
        else:
            stmt = (
                f"INSERT INTO {table} ({col_list}) VALUES ({vals})"
                f" ON CONFLICT ({conflict}) DO NOTHING;"
            )
        lines.append(stmt)
    return lines


def delete_then_insert(table, cols, rows):
    """
    DELETE all rows then re-INSERT for junction tables that have no unique
    or primary-key constraint (so ON CONFLICT cannot be used).
    Safe inside a transaction: the whole block is atomic.
    """
    lines = [f"DELETE FROM {table};"]
    if not rows:
        lines.append(f"-- (no rows in {table})")
        return lines
    col_list = ", ".join(f'"{c}"' for c in cols)
    for row in rows:
        vals = ", ".join(esc(v) for v in row)
        lines.append(f"INSERT INTO {table} ({col_list}) VALUES ({vals});")
    return lines


def seq_reset(table, col="id"):
    return (
        f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), "
        f"COALESCE((SELECT MAX({col}) FROM {table}), 0) + 1, false);"
    )


def section(title):
    bar = "-- " + "=" * 60
    return [bar, f"-- {title}", bar]


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print("Connecting to dev database (read-only extraction)…")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print("Connected. Generating SQL…")

    out = []

    # ── Header ──────────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc).isoformat()
    out += [
        "-- " + "=" * 62,
        "-- Production Data Import Script",
        f"-- Generated : {now}",
        "-- Source    : portfolioai_dev",
        "--",
        "-- SAFE TO TEST: run against portfolioai_test, NOT portfolioai_dev",
        "--   PGPASSWORD='<password>' psql -h <host> -U <user> -d portfolioai_test \\",
        "--        -v ON_ERROR_STOP=1 -f import_production_data.sql",
        "--",
        "-- All statements are INSERT … ON CONFLICT … DO UPDATE so the",
        "-- script is fully idempotent (safe to run multiple times).",
        "-- " + "=" * 62,
        "",
        "BEGIN;",
        "",
    ]

    # ── languages ───────────────────────────────────────────────────────────
    out += section("LANGUAGES")
    cols, rows = dump_table(cursor, "languages")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("languages", cols, rows, ["id"], upd)
    out += [seq_reset("languages"), ""]

    # ── skill_types ─────────────────────────────────────────────────────────
    out += section("SKILL TYPES")
    cols, rows = dump_table(cursor, "skill_types", order_by="code")
    out += inserts("skill_types", cols, rows, ["code"], ["name"])
    out.append("")

    # ── skills ──────────────────────────────────────────────────────────────
    out += section("SKILLS")
    cols, rows = dump_table(cursor, "skills")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("skills", cols, rows, ["id"], upd)
    out += [seq_reset("skills"), ""]

    # ── skill_texts ─────────────────────────────────────────────────────────
    out += section("SKILL TEXTS")
    cols, rows = dump_table(cursor, "skill_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("skill_texts", cols, rows, ["id"], upd)
    out += [seq_reset("skill_texts"), ""]

    # ── category_types ──────────────────────────────────────────────────────
    out += section("CATEGORY TYPES")
    cols, rows = dump_table(cursor, "category_types", order_by="code")
    upd = [c for c in cols if c != "code"]
    out += inserts("category_types", cols, rows, ["code"], upd)
    out.append("")

    # ── categories ──────────────────────────────────────────────────────────
    out += section("CATEGORIES")
    cols, rows = dump_table(cursor, "categories")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("categories", cols, rows, ["id"], upd)
    out += [seq_reset("categories"), ""]

    # ── category_texts ──────────────────────────────────────────────────────
    out += section("CATEGORY TEXTS")
    cols, rows = dump_table(cursor, "category_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("category_texts", cols, rows, ["id"], upd)
    out += [seq_reset("category_texts"), ""]

    # ── category_skills  (no unique constraint → delete+insert) ─────────────
    out += section("CATEGORY SKILLS")
    cols, rows = dump_table(cursor, "category_skills", order_by="category_id, skill_id")
    out += delete_then_insert("category_skills", cols, rows)
    out.append("")

    # ── link_category_types ─────────────────────────────────────────────────
    out += section("LINK CATEGORY TYPES")
    cols, rows = dump_table(cursor, "link_category_types", order_by="code")
    out += inserts("link_category_types", cols, rows, ["code"], ["name"])
    out.append("")

    # ── link_categories ─────────────────────────────────────────────────────
    out += section("LINK CATEGORIES")
    cols, rows = dump_table(cursor, "link_categories")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("link_categories", cols, rows, ["id"], upd)
    out += [seq_reset("link_categories"), ""]

    # ── link_category_texts ─────────────────────────────────────────────────
    out += section("LINK CATEGORY TEXTS")
    cols, rows = dump_table(cursor, "link_category_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("link_category_texts", cols, rows, ["id"], upd)
    out += [seq_reset("link_category_texts"), ""]

    # ── experiences ─────────────────────────────────────────────────────────
    out += section("EXPERIENCES")
    cols, rows = dump_table(cursor, "experiences")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("experiences", cols, rows, ["id"], upd)
    out += [seq_reset("experiences"), ""]

    # ── experience_texts ────────────────────────────────────────────────────
    out += section("EXPERIENCE TEXTS")
    cols, rows = dump_table(cursor, "experience_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("experience_texts", cols, rows, ["id"], upd)
    out += [seq_reset("experience_texts"), ""]

    # ── experience_images ───────────────────────────────────────────────────
    out += section("EXPERIENCE IMAGES")
    cols, rows = dump_table(cursor, "experience_images")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("experience_images", cols, rows, ["id"], upd)
    out += [seq_reset("experience_images"), ""]

    # ── sections ────────────────────────────────────────────────────────────
    out += section("SECTIONS")
    cols, rows = dump_table(cursor, "sections")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("sections", cols, rows, ["id"], upd)
    out += [seq_reset("sections"), ""]

    # ── section_texts ───────────────────────────────────────────────────────
    out += section("SECTION TEXTS")
    cols, rows = dump_table(cursor, "section_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("section_texts", cols, rows, ["id"], upd)
    out += [seq_reset("section_texts"), ""]

    # ── section_images ──────────────────────────────────────────────────────
    out += section("SECTION IMAGES")
    cols, rows = dump_table(cursor, "section_images")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("section_images", cols, rows, ["id"], upd)
    out += [seq_reset("section_images"), ""]

    # ── section_attachments ─────────────────────────────────────────────────
    out += section("SECTION ATTACHMENTS")
    cols, rows = dump_table(cursor, "section_attachments")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("section_attachments", cols, rows, ["id"], upd)
    out += [seq_reset("section_attachments"), ""]

    # ── projects ────────────────────────────────────────────────────────────
    out += section("PROJECTS")
    cols, rows = dump_table(cursor, "projects")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("projects", cols, rows, ["id"], upd)
    out += [seq_reset("projects"), ""]

    # ── project_texts ───────────────────────────────────────────────────────
    out += section("PROJECT TEXTS")
    cols, rows = dump_table(cursor, "project_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("project_texts", cols, rows, ["id"], upd)
    out += [seq_reset("project_texts"), ""]

    # ── project_images ──────────────────────────────────────────────────────
    out += section("PROJECT IMAGES")
    cols, rows = dump_table(cursor, "project_images")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("project_images", cols, rows, ["id"], upd)
    out += [seq_reset("project_images"), ""]

    # ── project_categories  (no unique constraint → delete+insert) ───────────
    out += section("PROJECT CATEGORIES")
    cols, rows = dump_table(cursor, "project_categories", order_by="project_id, category_id")
    out += delete_then_insert("project_categories", cols, rows)
    out.append("")

    # ── project_skills  (no unique constraint → delete+insert) ────────────────
    out += section("PROJECT SKILLS")
    cols, rows = dump_table(cursor, "project_skills", order_by="project_id, skill_id")
    out += delete_then_insert("project_skills", cols, rows)
    out.append("")

    # ── project_sections  (no unique constraint → delete+insert) ──────────────
    out += section("PROJECT SECTIONS")
    cols, rows = dump_table(cursor, "project_sections", order_by="project_id, section_id")
    out += delete_then_insert("project_sections", cols, rows)
    out.append("")

    # ── project_attachments ─────────────────────────────────────────────────
    out += section("PROJECT ATTACHMENTS")
    cols, rows = dump_table(cursor, "project_attachments")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("project_attachments", cols, rows, ["id"], upd)
    out += [seq_reset("project_attachments"), ""]

    # ── agent_credentials  (must come BEFORE agents and portfolios) ─────────
    out += section("AGENT CREDENTIALS")
    cols, rows = dump_table(cursor, "agent_credentials")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("agent_credentials", cols, rows, ["id"], upd)
    out += [seq_reset("agent_credentials"), ""]

    # ── agents  (must come BEFORE portfolios) ───────────────────────────────
    out += section("AGENTS")
    cols, rows = dump_table(cursor, "agents")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("agents", cols, rows, ["id"], upd)
    out += [seq_reset("agents"), ""]

    # ── agent_templates ─────────────────────────────────────────────────────
    out += section("AGENT TEMPLATES")
    cols, rows = dump_table(cursor, "agent_templates")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("agent_templates", cols, rows, ["id"], upd)
    out += [seq_reset("agent_templates"), ""]

    # ── portfolios ──────────────────────────────────────────────────────────
    out += section("PORTFOLIOS")
    cols, rows = dump_table(cursor, "portfolios")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("portfolios", cols, rows, ["id"], upd)
    out += [seq_reset("portfolios"), ""]

    # ── portfolio_sections  (no unique constraint → delete+insert) ─────────────
    out += section("PORTFOLIO SECTIONS")
    cols, rows = dump_table(cursor, "portfolio_sections", order_by="portfolio_id, section_id")
    out += delete_then_insert("portfolio_sections", cols, rows)
    out.append("")

    # ── portfolio_categories  (no unique constraint → delete+insert) ───────────
    out += section("PORTFOLIO CATEGORIES")
    cols, rows = dump_table(cursor, "portfolio_categories", order_by="portfolio_id, category_id")
    out += delete_then_insert("portfolio_categories", cols, rows)
    out.append("")

    # ── portfolio_experiences  (no unique constraint → delete+insert) ──────────
    out += section("PORTFOLIO EXPERIENCES")
    cols, rows = dump_table(cursor, "portfolio_experiences", order_by="portfolio_id, experience_id")
    out += delete_then_insert("portfolio_experiences", cols, rows)
    out.append("")

    # ── portfolio_images ────────────────────────────────────────────────────
    out += section("PORTFOLIO IMAGES")
    cols, rows = dump_table(cursor, "portfolio_images")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("portfolio_images", cols, rows, ["id"], upd)
    out += [seq_reset("portfolio_images"), ""]

    # ── portfolio_links ─────────────────────────────────────────────────────
    out += section("PORTFOLIO LINKS")
    cols, rows = dump_table(cursor, "portfolio_links")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("portfolio_links", cols, rows, ["id"], upd)
    out += [seq_reset("portfolio_links"), ""]

    # ── portfolio_link_texts ────────────────────────────────────────────────
    out += section("PORTFOLIO LINK TEXTS")
    cols, rows = dump_table(cursor, "portfolio_link_texts")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("portfolio_link_texts", cols, rows, ["id"], upd)
    out += [seq_reset("portfolio_link_texts"), ""]

    # ── portfolio_projects  (no unique constraint → delete+insert) ─────────────
    out += section("PORTFOLIO PROJECTS")
    cols, rows = dump_table(cursor, "portfolio_projects", order_by="portfolio_id, project_id")
    out += delete_then_insert("portfolio_projects", cols, rows)
    out.append("")

    # ── portfolio_attachments ───────────────────────────────────────────────
    out += section("PORTFOLIO ATTACHMENTS")
    cols, rows = dump_table(cursor, "portfolio_attachments")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("portfolio_attachments", cols, rows, ["id"], upd)
    out += [seq_reset("portfolio_attachments"), ""]

    # ── system_settings ─────────────────────────────────────────────────────
    out += section("SYSTEM SETTINGS")
    cols, rows = dump_table(cursor, "system_settings")
    upd = [c for c in cols if c not in ("id", "created_at", "created_by")]
    out += inserts("system_settings", cols, rows, ["id"], upd)
    out += [seq_reset("system_settings"), ""]

    # ── Footer ──────────────────────────────────────────────────────────────
    out += [
        "COMMIT;",
        "",
        "-- " + "=" * 62,
        "-- Import complete.",
        "-- " + "=" * 62,
    ]

    cursor.close()
    conn.close()

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

    print(f"✅  Written to : {OUTPUT_FILE}")
    print(f"    Lines      : {len(out)}")
    print()
    print("To validate without touching dev data:")
    print("  PGPASSWORD='<password>' psql -h <host> -U <user> -d portfolioai_test \\")
    print("      -v ON_ERROR_STOP=1 -f scripts/database/import_production_data.sql")


if __name__ == "__main__":
    main()
