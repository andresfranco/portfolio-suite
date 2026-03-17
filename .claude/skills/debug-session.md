---
name: debug-session
description: Use when debugging errors, tracing bugs, or investigating unexpected behavior in any part of the stack. Provides a systematic 4-phase approach to root cause analysis.
---

# Systematic Debugging Workflow

## Phase 1 — Understand before touching code
- State the exact error message and stack trace
- Identify which layer failed: Router → Service → Repository → DB
- Reproduce the issue in the smallest possible way
- Do NOT change code yet

## Phase 2 — Gather evidence
```bash
# Backend: check logs
journalctl -u portfolio-api -n 100 --no-pager

# Backend: run with verbose SQL logging
LOG_SQL=True python run.py

# Frontend: check browser console for the exact error
# Check network tab for failed API requests and response bodies

# DB: verify data state
psql $DATABASE_URL -c "SELECT ..."

# Redis: check cache/queue state
redis-cli keys "portfolio:*"
redis-cli llen celery
```

## Phase 3 — Hypothesize and test
- Form ONE hypothesis at a time
- Test it with the minimum change possible
- Confirm or reject before moving on
- Use `use context7` for library API questions rather than guessing

## Phase 4 — Fix and verify
- Implement the fix
- Run the specific test that covers the broken path: `pytest tests/path/to/test.py::test_name -v`
- Run the broader test suite: `pytest tests/ -v --tb=short`
- Verify the original reproduction case no longer fails

## Common failure patterns in this project

### Async/await issues
- Missing `await` on coroutines — SQLAlchemy 2.x async requires `await session.execute()`
- `AsyncSession` not passed correctly through dependency injection
- Event loop conflicts in tests — use `pytest-asyncio` with `@pytest.mark.asyncio`

### JWT / Auth failures
- Token fingerprint mismatch: only user-agent is checked (not IP — proxy varies)
- Algorithm mismatch: check `.env` ALGORITHM vs `app/auth/jwt.py`
- Admin role is `"Admin"` (capital A) — case-sensitive RBAC check

### Database issues
- Connection pool exhausted — check `DB_POOL_SIZE` and connection leaks
- `asyncpg` driver needs `postgresql+asyncpg://` URL not plain `postgresql://`
- SSL disabled on dev/VPS: `DB_SSL_ENABLED=False`, `DB_SSL_MODE=disable`

### Frontend API errors
- CORS: check `FRONTEND_ORIGINS` in `.env` includes the dev port
- Wrong env var: website uses `REACT_APP_API_URL`, admin-ui uses `REACT_APP_SERVER_HOSTNAME` etc.
- Edit mode: controlled by backend auth cookie — check it's present in dev

## After debugging: capture the lesson
Run `/lessons-learned` to record what was found and how it was fixed.
