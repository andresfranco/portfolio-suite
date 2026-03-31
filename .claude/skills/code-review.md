---
name: code-review
description: Use when reviewing a PR, reviewing changed files before committing, or auditing code quality across the stack. Provides a structured checklist for this project's specific patterns.
---

# Code Review Checklist

## Backend (FastAPI / Python)

### Architecture compliance
- [ ] No ORM calls directly in routers (must go through service → repository)
- [ ] Business logic in services, not routers or repositories
- [ ] FastAPI dependencies used for auth/permissions (not inline checks)
- [ ] Async end-to-end: all I/O uses `await`

### Database
- [ ] No raw SQL string interpolation (parameterized only)
- [ ] Schema changes have a corresponding Alembic migration
- [ ] New columns have appropriate indexes if used in filters/ordering
- [ ] `nullable` and `server_default` set correctly on new columns

### Security
- [ ] No secrets in code — all via environment variables
- [ ] New endpoints have `PermissionChecker` dependency if they access protected data
- [ ] File upload endpoints validate MIME type and size
- [ ] Pydantic schemas validate all inputs at API boundary
- [ ] Sensitive data uses field-level encryption (PII)

### Code quality
- [ ] Type hints on all function signatures
- [ ] Docstrings on public functions/methods
- [ ] No unused imports (ruff will catch this)
- [ ] Error responses use consistent envelope: `{code, message, details?}`

## Frontend (React)

### Architecture compliance
- [ ] API calls go through service layer, not directly in components
- [ ] State via Context, not ad-hoc useState scattered across components
- [ ] Protected routes use existing `AuthorizationContext`
- [ ] New strings have i18n translation keys in ALL language files

### Code quality
- [ ] No console.log left in production code
- [ ] Loading and error states handled in UI
- [ ] TypeScript: no `any` types (website strict mode)
- [ ] Accessible: interactive elements have labels/aria attributes

## Quick automated checks
```bash
# Backend
cd portfolio-backend && source venv/bin/activate
ruff check app/ && mypy app/ && bandit -r app/ -ll

# Admin UI
cd backend-ui && npm run lint && npx tsc --noEmit

# Website
cd website && npm run lint
```

## Use sequential-thinking for complex reviews
For large PRs or architectural changes, prefix your review prompt with:
"Use sequential thinking to review this systematically."
