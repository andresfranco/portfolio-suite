# CLAUDE.md

Portfolio Suite — full-stack enterprise portfolio management system.

## Applications
- `portfolio-backend/` — FastAPI + PostgreSQL + Redis + Celery
- `backend-ui/` — React 19 admin interface (Material-UI)
- `website/` — React 19 public portfolio site (Tailwind CSS)

## Critical constraints (always enforce)
- **Non-destructive**: Do not rename/move/delete files unless explicitly asked
- **No schema changes without migrations**: Always use Alembic — never apply changes inline
- **No secrets in code**: All config via environment variables
- **Cross-layer changes** (>3 files, crossing API/DB/UI boundary): propose a plan first
- **Backend tests**: ≥85% coverage on changed lines, real DB via Testcontainers (no DB mocks)
- **ALWAYS fix both CI files**: `deploy-frontend-vps.yml` AND `deploy-full-stack-vps.yml`

## Backend request flow
```
Router → PermissionChecker → Service → Repository → Database
       ← Pydantic Schema   ← Logic   ← ORM Model  ←
```

## Auth quick reference
- Login: `POST /api/v1/auth/login` → JWT (HTTP-only cookies)
- MFA: TOTP verify step if enabled
- Refresh: `POST /api/v1/auth/refresh`
- RBAC: `PermissionChecker` dependency; admin role = `"Admin"` (capital A)
- Token fingerprint: user-agent only (not IP)

## RAG system
Embeddings → pgvector → Celery background jobs → citation tracking. Configurable via system settings.

## CMS
Backend serves translated content. Website displays it. Edit mode = backend auth cookie present.

## Skills available (invoke with `/skill-name`)
- `/alembic-migration` — DB schema change workflow
- `/debug-session` — Systematic 4-phase debugging
- `/new-feature` — Feature implementation checklist
- `/rag-debug` — RAG/Celery/embeddings debugging
- `/deploy` — Deployment checklist and VPS commands
- `/code-review` — Pre-commit/PR review checklist
- `/lessons-learned` — Capture and review past learnings

## Detailed rules (auto-loaded by path)
- Backend patterns → `.claude/rules/backend.md`
- Frontend patterns → `.claude/rules/frontend.md`
- Testing requirements → `.claude/rules/testing.md`
- Deployment/CI config → `.claude/rules/deployment.md`

## Token efficiency tips
- Add `use context7` to any prompt about library APIs (SQLAlchemy, FastAPI, MUI, pgvector)
- Use `use sequential thinking` for complex multi-step architectural decisions
- Use `/debug-session` before reading many files — it focuses the investigation
