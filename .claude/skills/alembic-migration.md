---
name: alembic-migration
description: Use when creating, applying, reviewing, or debugging Alembic database migrations for the portfolio-backend. Triggers on keywords like migration, alembic, schema change, database column, add field.
---

# Alembic Migration Workflow

## Pre-flight checks
1. Verify virtual environment is active: `source portfolio-backend/venv/bin/activate`
2. Confirm DB is running: `psql $DATABASE_URL -c "SELECT 1"`
3. Check current migration head: `cd portfolio-backend && alembic current`
4. Check for pending changes: `alembic check` (exits non-zero if models differ from DB)

## Creating a migration
```bash
cd portfolio-backend
source venv/bin/activate
alembic revision --autogenerate -m "descriptive_snake_case_name"
```

## ALWAYS review the generated file before applying
- Open `alembic/versions/<timestamp>_<name>.py`
- Verify `upgrade()` contains only the expected changes
- Verify `downgrade()` correctly reverses every change
- Check for: missing indexes, wrong nullable settings, missing server_default
- Ensure PostgreSQL-native types are used (UUID, JSONB, CITEXT) not generic ones

## Applying
```bash
alembic upgrade head        # Apply all pending
alembic upgrade +1          # Apply one step
alembic downgrade -1        # Rollback one step
alembic downgrade base      # Rollback everything (DANGEROUS in prod)
```

## Testing both paths
```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

## Common pitfalls in this project
- **asyncpg driver**: DATABASE_URL must use `postgresql+asyncpg://` for the app but plain `postgresql://` for alembic CLI
- **Alembic env.py**: Uses `asyncio` run mode — don't break the async setup in `env.py`
- **Never delete applied migrations** — only add new ones
- **Migration conflicts**: Always `git pull` before creating new migrations
- **CITEXT columns**: Import from `sqlalchemy.dialects.postgresql`
- **UUID primary keys**: Use `server_default=text("gen_random_uuid()")` not Python-side defaults

## After migration: verify schema drift
```bash
alembic check  # Should exit 0 with "No new upgrade operations detected"
```

## Lesson capture
After completing a migration, note any surprises in `.claude/memory/lessons-learned.md`
