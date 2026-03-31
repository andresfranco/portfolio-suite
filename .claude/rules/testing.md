---
description: Testing requirements, patterns, and commands. Loaded when working in test files or when running tests.
globs: ["**/tests/**", "**/*.test.*", "**/*.spec.*", "**/*.test.js", "**/*.test.ts"]
---

# Testing Requirements

## Backend (pytest)
- Coverage gate: **≥85% on changed lines** — non-negotiable
- Use **Testcontainers** for integration tests (real PostgreSQL, not mocks)
- Mock external services with `respx` (HTTP) — never mock the DB
- Use `pytest-asyncio` for async test functions

```bash
cd portfolio-backend && source venv/bin/activate
pytest tests/ -v --tb=short                  # Full suite
pytest tests/path/to/test.py::test_name -v   # Single test
pytest tests/ --cov=app --cov-report=term-missing  # With coverage
```

## Frontend (React Testing Library)
- Test **behavior**, not implementation details
- API mocking: MSW (Mock Service Worker)
- Accessibility: jest-axe on interactive components
- E2E: Playwright for critical flows (auth, checkout-style flows)

```bash
cd backend-ui && npm test           # Admin UI tests
cd website && npm test              # Website tests
```

## What NOT to do
- Do not mock the database in backend integration tests — real DB only via Testcontainers
- Do not test implementation details (internal state, private methods)
- Do not skip tests to make CI pass — fix the underlying issue

## Test structure (backend)
```
tests/
  unit/          — Pure logic, no I/O (services, utils)
  integration/   — Real DB via Testcontainers (repositories, endpoints)
  security/      — Auth, RBAC, rate limiting
```
