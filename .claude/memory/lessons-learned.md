# Lessons Learned — Portfolio Suite

This file is appended to by the `/lessons-learned` skill after debugging sessions or complex features.
Format: date, category, title, then problem/root cause/fix/prevention.

---

## 2026-01-xx [deployment]: Frontend env vars not baked into bundle
**Problem**: Admin UI pointed to localhost:8000 in production
**Root cause**: `BackendServerData.js` reads `REACT_APP_SERVER_HOSTNAME/PORT/PROTOCOL`, not `REACT_APP_API_URL`
**Fix**: Set all three GitHub Secrets separately
**Prevention**: Check `BackendServerData.js` when adding new env var patterns

---

## 2026-01-xx [deployment]: Node.js OOM during CI build
**Problem**: `npm run build` killed with OOM in GitHub Actions
**Root cause**: Default Node.js heap too small for React 19 + MUI bundle
**Fix**: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
**Prevention**: Always set NODE_OPTIONS in CI build steps

---

## 2026-01-xx [deployment]: DB SSL blocking on VPS
**Problem**: asyncpg couldn't connect to PostgreSQL
**Root cause**: `ProtectHome` in systemd unit blocks access to home dir cert files
**Fix**: `DB_SSL_ENABLED=False`, `DB_SSL_MODE=disable`
**Prevention**: Use system-level cert paths or disable SSL in non-public network

---

## 2026-01-xx [auth]: JWT algorithm mismatch
**Problem**: All auth requests failing in production
**Root cause**: `app/auth/jwt.py` hardcoded HS256 while `.env` had `ALGORITHM=RS256`
**Fix**: Read algorithm from config, not hardcoded
**Prevention**: Never hardcode crypto algorithms — always read from settings

---

## 2026-01-xx [auth]: Token fingerprint using client IP
**Problem**: Auth failures across multiple workers
**Root cause**: Proxy IP varies per uvicorn worker, fingerprint mismatch
**Fix**: Fingerprint = user-agent only (removed IP)
**Prevention**: Never use IP for fingerprinting behind a reverse proxy

---

## 2026-01-xx [auth]: Admin role case sensitivity
**Problem**: Admin users getting 403 on admin-only endpoints
**Root cause**: RBAC check comparing against `"admin"` but role stored as `"Admin"`
**Fix**: Role name is `"Admin"` (capital A)
**Prevention**: Use constants for role names, never hardcode strings in checks

---

## 2026-01-xx [deployment]: Permission init race condition
**Problem**: App startup fails on fresh DB with duplicate key error
**Root cause**: Multiple workers racing to initialize core roles/permissions
**Fix**: Advisory lock in `initialize_core_roles` + `ON CONFLICT DO NOTHING`
**Prevention**: Always use advisory locks for startup initialization in multi-worker setups
