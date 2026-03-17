---
description: Deployment architecture, CI/CD workflows, and VPS configuration. Loaded when working in deployment/ or .github/workflows/.
globs: ["deployment/**", ".github/**", "*.yml", "*.yaml"]
---

# Deployment Architecture

## Environment
- Production: `api.amfapps.com`, `admin.amfapps.com`, `amfapps.com`
- VPS path: `/opt/portfolio/portfolio-suite/`
- Backend service: `portfolio-api` (systemd, 4 uvicorn workers)
- Serving: nginx (TLS 1.3, gzip static, 1y cache for hashed assets)

## Git workflow
`dev` → PR → `test` → PR → `main` → `git pull` on VPS

## CI/CD — critical rule
**ALWAYS apply the same fix to BOTH workflow files:**
- `.github/workflows/deploy-frontend-vps.yml`
- `.github/workflows/deploy-full-stack-vps.yml`

## Required GitHub Secrets
| Secret | Value |
|--------|-------|
| `REACT_APP_SERVER_HOSTNAME` | `api.amfapps.com` |
| `REACT_APP_SERVER_PORT` | `443` |
| `REACT_APP_SERVER_PROTOCOL` | `https` |
| `REACT_APP_WEBSITE_URL` | `https://amfapps.com` |
| `REACT_APP_API_URL` | `https://api.amfapps.com` |

## Production .env key settings
- `ENVIRONMENT=production`
- `ALGORITHM=HS256`
- `DB_SSL_ENABLED=False`, `DB_SSL_MODE=disable`

## Build requirements
- `NODE_OPTIONS=--max-old-space-size=4096` for Node.js builds
- Pre-compress assets: `gzip -9 -k build/static/...`
