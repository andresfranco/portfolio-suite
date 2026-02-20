---
# Global: apply to the whole repo
applyTo: "**"
---

# Full-stack guardrails (PostgreSQL + FastAPI + React 19)

**Goals:** scalability, maintainability, testability. Prefer small, composable modules; clear layering (domain vs infrastructure); async I/O end-to-end.

**Safety rails (non-destructive):**
- Do not rename/move/delete files or change public APIs/DB schema unless explicitly asked.
- For changes touching >3 files or crossing layers, propose a short plan first (goal, files, migration impact, rollout).
- DB changes must be Alembic migrations shown as a separate diff.
- Adjust/add tests for changed behavior; don’t rewrite tests to hide regressions.

**Conventions:**
- UTC/ISO-8601; structured JSON logs; descriptive names (`is_active`, `has_permission`).
- RORO (receive object, return object) at service boundaries.
- Env-driven config; never hardcode secrets. Provide `.env.example`.

---

## Backend rules (FastAPI + SQLAlchemy + Alembic)
---
applyTo: "portfolio-backend/**"
---

- **Structure:** `/app/api` (routers, /api/v1), `/app/core` (config, security, logging, lifespan), `/app/db` (models, database.py, repositories, uow.py, migrations/), `/app/domain` (entities/services), `/app/schemas` (Pydantic I/O).
- **Patterns:** Repository + Service (use-case) + Unit of Work. Routers call services; no ORM in routers.
- **DB:** SQLAlchemy 2.x async engine + async session per request; Postgres-native types (UUID/JSONB/CITEXT); indexes for frequent filters; avoid N+1 (`selectinload/joinedload`).
- **Validation:** Pydantic v2 at API edges; typed responses; predictable pagination (`limit/offset` or keyset for large lists).
- **Security:** OAuth2 Bearer (access/refresh), argon2/bcrypt hashes, strict CORS allowlist, secure headers, parameterized queries only.
- **Observability:** `/healthz`, `/readyz`, correlation/request IDs; avoid logging secrets.
- **Performance:** Background tasks (FastAPI BackgroundTasks/Celery/RQ) for long work; cache with Redis where justified.

**Testing (backend):** pytest + httpx AsyncClient (+ lifespan), Testcontainers (Postgres) for integration; mock externals with `respx`. Coverage gate ≥85% on changed lines.

**CI gates (backend):** ruff + black + isort; mypy; run tests; fail on schema drift (ensure migrations updated).

---

## Frontend rules (React 19 + TypeScript)
---
applyTo: "backend-ui/**"
---

- **Structure:** `/src/app` (routes/layouts/boundaries), `/src/features/<name>` (components, hooks, `api.ts`, `types.ts`), `/src/components` (shared UI), `/src/lib` (utils/http/zod).
- **Data:** TanStack Query; keep fetching inside feature `api.ts` (not in components); React Router; ErrorBoundary + Suspense.
- **Forms:** React Hook Form + Zod (schema-first).
- **State:** Prefer server cache (Query) over global state; use Zustand/Context sparingly.
- **Types:** `strict: true`; no `any`. **Generate types from OpenAPI** (`openapi-typescript`) and use them in clients.
- **A11y/UX:** semantic HTML, ARIA where needed; keyboard navigable; skeletons for loading; friendly error messages.
- **Styling:** consistent system (Tailwind or DS); avoid complex inline styles.

**Testing (frontend):** Vitest + RTL; MSW for API; Playwright for critical flows. Test behavior, not implementation details.

**CI gates (frontend):** eslint + prettier; `tsc --noEmit`; run unit/UI tests.

---

## API design
---
applyTo: ["portfolio-backend/**", "backend-ui/**"]
---

- RESTful, plural nouns, stable contracts; version at `/api/v1`.
- Error envelope: `{ code, message, details? }`, consistent across BE/FE.
- Backward-compatible changes; document deprecations.

---
applyTo: "**"
---
## Backend python and Unit tests
- Before running python commands in the terminal activate the virtual environment located in the backend folder /porfolio-backend  

