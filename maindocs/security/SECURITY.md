# Security Policy

## Reporting a Vulnerability

Please do not disclose vulnerabilities in public issues.

Report through one of these channels:
- Email: `security@your-domain.com`
- GitHub Security Advisories: `https://github.com/YOUR-ORG/portfolio-suite/security/advisories/new`

Include:
- Affected component and file paths
- Reproduction steps
- Impact assessment
- Proof of concept (if available)

### Response Targets

- Initial acknowledgment: within 48 hours
- First status update: within 7 days

## Implemented Security Controls (Current)

The following controls are implemented in the active codebase and deployment runbooks:

- JWT-based authentication (`/api/auth/*`)
- MFA endpoints and admin/user MFA management (`/api/mfa/*` and admin UI MFA flows)
- Role/permission-based authorization
- Redis-backed rate limiting
- Security dashboard endpoints (`/api/admin/security/*`)
- Input validation at API boundary (Pydantic schemas)
- Nginx/TLS hardening procedures in VPS deployment guide
- Audit-oriented operational process in incident response playbook

## Secure Deployment Baseline

Use the canonical deployment guide:
- `maindocs/guides/VPS_DEPLOYMENT_GUIDE.md`

Minimum production baseline:
- HTTPS/TLS enabled
- UFW configured to expose only required ports
- SSH hardened (no root login, key auth)
- Fail2Ban enabled
- Strong environment secrets (no secrets in git)
- Regular backups and restore verification

## Security Operations

For incident handling and recovery workflow:
- `maindocs/guides/INCIDENT_RESPONSE_PLAYBOOK.md`

## Scope Notes

- This policy intentionally avoids historical phase-completion claims.
- If a control is not in active code/routes or active runbooks, it is not listed as implemented here.
