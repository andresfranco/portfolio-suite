---
name: lessons-learned
description: Use after completing a debugging session, fixing a tricky bug, or finishing a complex feature to capture what was learned. Also use when asked to recall past issues or patterns. Improves future session quality over time.
user-invocable: true
---

# Lessons Learned — Capture & Review

## How to capture a lesson

After resolving an issue or completing a complex task, save to `.claude/memory/lessons-learned.md`:

```markdown
## [Date] [Category]: [Short title]

**Problem**: What was broken or unclear
**Root cause**: Why it happened
**Fix**: What resolved it
**Prevention**: How to avoid it next time
**Affects**: [backend|frontend|deployment|rag|auth|migrations]
```

## Existing lessons (load this file to review past patterns)

$!cat /home/andres/projects/portfolio-suite/.claude/memory/lessons-learned.md 2>/dev/null || echo "No lessons recorded yet."$

## Categories to track
- `auth` — JWT, MFA, RBAC, session issues
- `async` — asyncio, SQLAlchemy async, event loop
- `migrations` — Alembic edge cases
- `frontend` — React, MUI, context, routing
- `rag` — Embeddings, Celery, pgvector
- `deployment` — VPS, nginx, GitHub Actions, systemd
- `performance` — slow queries, bundle size, caching
- `security` — vulnerability patterns caught

## Append a new lesson now

If you have a lesson to record, append it to:
`/home/andres/projects/portfolio-suite/.claude/memory/lessons-learned.md`

Keep entries concise — one lesson per block, max 6 lines.
