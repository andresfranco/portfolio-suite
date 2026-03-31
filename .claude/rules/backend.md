---
description: Backend architecture, patterns, and common issues for the FastAPI + PostgreSQL stack. Loaded when working in portfolio-backend/.
globs: ["portfolio-backend/**"]
---

# Backend Architecture

## Layer structure
```
/app/api/endpoints/  — Route handlers (call services only)
/app/services/       — Business logic (GDPR, RAG, chat, encryption, caching)
/app/crud/           — Repository layer (data access, no business logic)
/app/schemas/        — Pydantic request/response models
/app/models/         — SQLAlchemy ORM models
/app/core/           — Config, security, logging, lifespan, DB setup
/app/middleware/     — Request/response middleware
/app/rag/            — RAG (embeddings, vector search, chunking)
/app/queue/          — Celery background tasks
/app/observability/  — Prometheus metrics
```

## Key patterns
- **Repository Pattern**: All ORM calls in `/app/crud/` — never in routers
- **Service Layer**: All business logic in `/app/services/` — routers call services
- **Dependency Injection**: Auth/permissions in `/app/api/deps.py` via `PermissionChecker`
- **Lifespan**: Startup/shutdown in `@asynccontextmanager` in `main.py`
- **Async end-to-end**: Every I/O operation uses `async/await`

## Database
- SQLAlchemy 2.x async engine (`asyncpg` driver)
- URL in app: `postgresql+asyncpg://...` | URL for alembic CLI: `postgresql://...`
- Connection pooling: `DB_POOL_SIZE=20`, `DB_MAX_OVERFLOW=0`
- PostgreSQL-native types: UUID, JSONB, CITEXT
- Always index filtered/ordered columns

## Security features
- JWT: RS256 (production) or HS256 (dev/VPS) — check `ALGORITHM` in `.env`
- Token fingerprint: user-agent only (not IP — proxy IP varies across workers)
- Admin role name: `"Admin"` (capital A) — RBAC check is case-sensitive
- RBAC: `PermissionChecker` dependency on protected endpoints
- PII: field-level Fernet encryption via `ENCRYPTION_MASTER_KEY`

## API design
- RESTful under `/api/v1/`
- Error envelope: `{"code": "...", "message": "...", "details": [...]}`
- Pagination: `?limit=50&offset=0` (max 200)
- Timestamps: UTC ISO-8601

## Development commands
```bash
cd portfolio-backend && source venv/bin/activate
python run.py                              # Dev server
pytest tests/ -v --tb=short               # Tests
ruff check app/ && black app/ --check     # Lint/format
mypy app/                                 # Type checking
bandit -r app/ -ll                        # Security scan
```

## Common issues
- **Import errors**: Always activate venv first — `source venv/bin/activate`
- **DB connection**: Check `DATABASE_URL` in `.env`, ensure PostgreSQL running
- **Migration conflicts**: `git pull` before creating new migrations
- **asyncpg SSL**: `DB_SSL_ENABLED=False`, `DB_SSL_MODE=disable` on VPS (ProtectHome)
