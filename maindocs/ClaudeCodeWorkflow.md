# Claude Code Workflow — Portfolio Suite

This document describes the full Claude Code productivity setup installed in this project: what was configured, why, and how to use it effectively.

---

## What Was Installed

### MCP Servers (`.mcp.json`)

| Server | Purpose | Invocation |
|--------|---------|------------|
| `postgres-portfolio` | Query production DB | Available as tool automatically |
| `postgres-portfolio-dev` | Query dev DB | Available as tool automatically |
| `context7` | Fetch targeted library docs (saves ~65% tokens on doc lookups) | Add `use context7` to any prompt |
| `fetch` | Make HTTP requests to live APIs | Available as tool automatically |
| `sequential-thinking` | Structured reasoning for complex problems | Add `use sequential thinking` to prompt |
| `memory` | Persistent graph-based memory across sessions | Available as tool automatically |
| `redis` | Inspect Redis keys, queues, cache state | Available as tool automatically |
| `github` | Read issues, PRs, CI workflow logs | Requires `GITHUB_TOKEN` env var (see below) |

**To activate GitHub MCP**: export your GitHub Personal Access Token before starting Claude Code:
```bash
export GITHUB_TOKEN=ghp_your_token_here
claude  # then start session
```
Or add to `~/.zshrc` / `~/.bashrc` for persistence.

**After any `.mcp.json` change**: restart Claude Code for new servers to load.

---

### Hooks (`.claude/settings.json` + `.claude/hooks/`)

Hooks run automatically — no action needed.

| Hook | Event | What it does |
|------|-------|-------------|
| `block-env-commit.sh` | PreToolUse (Bash) | Blocks `git add/commit` on `.env` files — prevents secret leaks |
| `filter-test-output.sh` | PreToolUse (Bash) | Wraps `pytest` and `npm test` to return failures only (~90% token reduction on test output) |
| `ruff-autofix.sh` | PostToolUse (Edit/Write) | Runs `ruff --fix` + `ruff format` after editing any `.py` file in `portfolio-backend/` |
| `precompact.sh` | PreCompact | Saves a git status snapshot to `.claude/session-snapshots/` before context compression |

**Session snapshots** are saved to `.claude/session-snapshots/YYYYMMDD-HHMMSS.md` and excluded from git. Review them if a long session was compressed mid-task.

---

### Skills (`.claude/skills/`)

Skills are on-demand instruction sets — they load only when invoked, keeping the base context lean.

**Invoke in chat**: `/skill-name` or just mention the task and Claude will auto-select the relevant skill.

| Skill | Invoke | Use when |
|-------|--------|---------|
| `alembic-migration` | `/alembic-migration` | Creating or debugging DB schema changes |
| `debug-session` | `/debug-session` | Systematic 4-phase root cause investigation |
| `new-feature` | `/new-feature` | Starting implementation of a new feature |
| `rag-debug` | `/rag-debug` | Debugging RAG pipeline, embeddings, Celery |
| `deploy` | `/deploy` | Pre-deploy checklist or VPS troubleshooting |
| `code-review` | `/code-review` | Reviewing code before committing or merging |
| `lessons-learned` | `/lessons-learned` | Recording or reviewing past lessons |

**Best practices**:
- Start every debugging session with `/debug-session` before reading files
- Start every DB change with `/alembic-migration`
- After fixing a tricky bug, run `/lessons-learned` to record what you learned

---

### Path-Scoped Rules (`.claude/rules/`)

Rules load automatically based on which files you're working with. No action needed.

| Rule file | Loads when | Contains |
|-----------|-----------|---------|
| `backend.md` | Editing `portfolio-backend/**` | Layer structure, async patterns, security features, dev commands |
| `frontend.md` | Editing `backend-ui/**` or `website/**` | Component patterns, i18n requirements, env vars, common issues |
| `testing.md` | Working with test files | Coverage requirements, Testcontainers pattern, no-mock-DB rule |
| `deployment.md` | Editing `deployment/**` or `.github/**` | VPS config, CI secrets, dual-workflow rule |

---

### Memory System (`.claude/memory/`)

Two layers of memory work together:

**1. Auto-memory** (`~/.claude/projects/.../memory/`)
Claude Code automatically saves user preferences, project context, and feedback across sessions. The first 200 lines of `MEMORY.md` load at every session start. Detailed notes live in topic files.

**2. Lessons learned** (`.claude/memory/lessons-learned.md`)
Project-specific lessons captured after debugging sessions. Loaded on demand via `/lessons-learned`. Review this when hitting a recurring issue.

**3. MCP graph memory** (`.claude/memory/graph.jsonl`)
Entity-relationship graph persisted by the `memory` MCP server. Claude can store and retrieve architectural decisions, known patterns, and relationships across sessions.

To record a lesson after a bug fix:
```
/lessons-learned
```
Then describe what happened — Claude will append a structured entry.

---

## Token Efficiency Reference

| Technique | How to use | Savings |
|-----------|-----------|---------|
| Context7 | Add `use context7` to prompt | ~65% on doc lookups |
| Sequential thinking | Add `use sequential thinking` | Fewer reasoning cycles |
| Test filter hook | Automatic on pytest/npm test | ~90% on test output |
| Path-scoped rules | Automatic | Backend rules don't load during frontend work |
| Skills vs CLAUDE.md | Skills only load when invoked | 100% when not needed |
| Specific prompts | Name the exact file + function | 30–50% less file scanning |
| `/debug-session` skill | Start debugging structured | Avoids reading wrong files |

---

## CLAUDE.md Structure

The main `CLAUDE.md` is now intentionally lean (~60 lines). It contains:
- Project overview and app list
- Critical constraints (the non-negotiables)
- Backend request flow diagram
- Auth quick reference
- Skill and rule index

Everything else loads on-demand via rules or skills.

---

## Adding New Skills

To add a project skill:

1. Create `.claude/skills/my-skill.md` with frontmatter:
```markdown
---
name: my-skill
description: When to auto-invoke this skill (Claude reads this to decide)
---

# My Skill Title
...instructions...
```

2. Reference it in the `## Skills available` section of `CLAUDE.md`

Skills committed to `.claude/skills/` are shared across the team via git.

---

## Adding New Rules

To add a path-scoped rule:

```markdown
---
description: One-line description of what this rule covers
globs: ["path/to/files/**"]
---

# Rule content
...
```

Save to `.claude/rules/my-rule.md`. It will auto-load when Claude works with matching files.

---

## Plugins to Install (Manual Step)

These require running in an active Claude Code session:

```bash
# Superpowers — TDD enforcement, systematic debugging methodology
/plugin install superpowers@claude-plugins-official

# Python code intelligence — LSP-based type resolution (replaces reading files for type info)
/plugin install python@claude-plugins-official

# TypeScript code intelligence — same for React/TS
/plugin install typescript@claude-plugins-official
```

Run these commands in the Claude Code chat after restarting.

---

## File Structure Reference

```
portfolio-suite/
├── CLAUDE.md                          # Lean core instructions (~60 lines)
├── .mcp.json                          # MCP server config (gitignored — no secrets)
├── .gitignore                         # .mcp.json, session-snapshots, graph.jsonl excluded
└── .claude/
    ├── settings.json                  # Hooks configuration (committed)
    ├── settings.local.json            # Local permissions (gitignored)
    ├── hooks/
    │   ├── block-env-commit.sh        # Security: block .env commits
    │   ├── filter-test-output.sh      # Token: filter test failures only
    │   ├── ruff-autofix.sh            # Quality: auto-fix Python on save
    │   └── precompact.sh              # Memory: snapshot before compression
    ├── skills/
    │   ├── alembic-migration.md       # DB migration workflow
    │   ├── debug-session.md           # Systematic debugging
    │   ├── new-feature.md             # Feature implementation
    │   ├── rag-debug.md               # RAG/Celery debugging
    │   ├── deploy.md                  # Deployment workflow
    │   ├── code-review.md             # Code review checklist
    │   └── lessons-learned.md        # Lesson capture & review
    ├── rules/
    │   ├── backend.md                 # Auto-loads for portfolio-backend/**
    │   ├── frontend.md                # Auto-loads for backend-ui/**, website/**
    │   ├── testing.md                 # Auto-loads for test files
    │   └── deployment.md              # Auto-loads for deployment/**, .github/**
    ├── memory/
    │   ├── lessons-learned.md         # Accumulated bug/feature lessons
    │   └── graph.jsonl                # MCP memory graph (gitignored)
    └── session-snapshots/             # PreCompact saves (gitignored)
```

---

## Maintenance

- **After a tricky bug**: run `/lessons-learned`, describe the issue, Claude records it
- **After architecture changes**: update the relevant `.claude/rules/*.md` file
- **After adding a new tech/service**: add it to `backend.md` or `frontend.md` rules
- **Periodically**: review `.claude/memory/lessons-learned.md` for patterns
- **Token budget getting tight**: use `/compact` to compress context, snapshot is auto-saved first
