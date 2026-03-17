---
name: deploy
description: Use when deploying to the VPS, reviewing deployment readiness, or troubleshooting production issues. Triggers on keywords like deploy, production, VPS, amfapps.com, nginx, systemd.
---

# Deployment Workflow

## Git workflow
```
dev → PR → test → PR → main → git pull on VPS
```
Never deploy directly from dev or test branches.

## Pre-deployment checklist
- [ ] All tests passing: `pytest tests/ -v` and `npm test`
- [ ] No secrets in git: `git log --all --full-history -- "**/.env*"` shows nothing new
- [ ] Migrations ready: `alembic check` exits 0
- [ ] Frontend env vars set as GitHub Secrets (not hardcoded)
- [ ] CLAUDE.md / memory updated if architecture changed

## Backend deployment (VPS)
```bash
# On VPS: /opt/portfolio/portfolio-suite/
git pull origin main
cd portfolio-backend
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart portfolio-api
sudo systemctl status portfolio-api
```

## Frontend deployment (GitHub Actions)
Triggered via GitHub Actions manual dispatch:
- `deploy-frontend-vps.yml` — frontend only
- `deploy-full-stack-vps.yml` — everything

Required GitHub Secrets:
- `REACT_APP_SERVER_HOSTNAME` = `api.amfapps.com`
- `REACT_APP_SERVER_PORT` = `443`
- `REACT_APP_SERVER_PROTOCOL` = `https`
- `REACT_APP_WEBSITE_URL` = `https://amfapps.com`
- `REACT_APP_API_URL` = `https://api.amfapps.com`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`

**ALWAYS apply the same fix to BOTH workflow files:**
- `.github/workflows/deploy-frontend-vps.yml`
- `.github/workflows/deploy-full-stack-vps.yml`

## VPS service management
```bash
sudo systemctl status portfolio-api     # Check backend
sudo systemctl restart portfolio-api    # Restart backend
sudo nginx -t                           # Test nginx config
sudo systemctl reload nginx             # Reload nginx
journalctl -u portfolio-api -f          # Follow backend logs
```

## Production environment specifics
- `ENVIRONMENT=production`
- `ALGORITHM=HS256` (RS256 requires RSA key files configured)
- `DB_SSL_ENABLED=False`, `DB_SSL_MODE=disable` (ProtectHome blocks cert files)
- 4 uvicorn workers (`--workers 4`)
- Node.js build: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`

## Post-deployment verification
```bash
# Check API health
curl https://api.amfapps.com/health

# Check admin UI loads
curl -I https://admin.amfapps.com

# Check website loads
curl -I https://amfapps.com

# Check backend logs for errors
journalctl -u portfolio-api -n 50 --no-pager | grep -i error
```

## Rollback
```bash
# Backend: revert last commit and redeploy
git revert HEAD --no-edit
git push origin main
# Then restart service

# Frontend: re-run GitHub Action on previous commit
# Or manually re-upload previous build from CI artifacts
```
