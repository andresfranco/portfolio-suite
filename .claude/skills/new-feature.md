---
name: new-feature
description: Use when implementing a new feature, endpoint, component, or significant piece of functionality. Enforces proper planning before coding across all three apps.
---

# New Feature Implementation Workflow

## Step 1 — Scope the feature
Answer these before writing code:
1. Which apps are affected? (backend / admin-ui / website / all)
2. Does it require a DB schema change? → If yes, run `/alembic-migration` first
3. Does it cross >3 files or layers? → Write a plan, get approval before proceeding
4. What's the API contract? (endpoint, request/response schema)
5. What are the permission requirements? (which RBAC permission needed)

## Step 2 — Backend implementation order
Always follow this layer order:
```
1. Model (app/models/)          — SQLAlchemy ORM model
2. Schema (app/schemas/)        — Pydantic request/response models
3. Repository (app/crud/)       — Data access, no business logic
4. Service (app/services/)      — Business logic, calls repository
5. Router (app/api/endpoints/)  — HTTP handler, calls service
6. Permission (app/api/deps.py) — Add PermissionChecker if needed
```

Never skip layers. Never put business logic in routers. Never put ORM calls in routers.

## Step 3 — Frontend implementation order (Admin UI)
```
1. Service (src/services/)      — API client function
2. Component (src/components/)  — UI component
3. Page integration             — Wire into existing page or create new page
4. Route (src/App.js)           — Add route if new page
5. i18n                         — Add translation keys to all language files
```

## Step 4 — Frontend implementation order (Website)
```
1. API call (src/services/portfolioApi.js) — Add fetch + cache invalidation
2. Component (src/components/)            — Tailwind-styled component
3. Edit mode support                       — If CMS-editable, add edit handlers
4. Language routing                        — Support /:lang/ prefix
```

## Step 5 — Tests
- Backend: write pytest test in `tests/` before considering the feature done
- Frontend: component test in `*.test.js` alongside the component
- Test coverage gate: ≥85% on changed lines

## Step 6 — Code quality gate
```bash
# Backend
cd portfolio-backend && source venv/bin/activate
ruff check app/ && black app/ --check && mypy app/

# Admin UI
cd backend-ui && npm run lint && npx tsc --noEmit

# Website
cd website && npm run lint && npx tsc --noEmit
```

## Multi-app consistency check
If the feature adds a new content type:
- [ ] Backend model + migration
- [ ] Admin UI CRUD pages
- [ ] Website display component
- [ ] Translation keys in all supported languages
- [ ] Edit mode inline editing (if CMS-managed)
- [ ] API cache invalidation in portfolioApi.js

## Use context7 for library questions
When unsure about SQLAlchemy async API, FastAPI dependency injection, or MUI component props — add `use context7` to the prompt to get targeted, version-correct docs.
