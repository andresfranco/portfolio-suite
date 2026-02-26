# Portfolio Suite Main Documentation

This directory now keeps only active, implementation-backed documentation.

## Canonical Guides

- [VPS Deployment Guide](./guides/VPS_DEPLOYMENT_GUIDE.md)
  - Primary source for Ubuntu VPS setup, security hardening, SSL/TLS, services, backups, and production verification.
- [Website CMS Edit Mode Guide](./guides/WEBSITE_CMS_EDIT_MODE_GUIDE.md)
  - Operational guide for website edit mode, inline editing, and project image/content updates.
- [Incident Response Playbook](./guides/INCIDENT_RESPONSE_PLAYBOOK.md)
  - Procedures for triage, containment, and recovery during security incidents.
- [Security Policy](./security/SECURITY.md)
  - Vulnerability reporting and security policy baseline.

## Validation Scripts

- `tests/test_nginx_config.py`
- `tests/test_workflows.py`

## Cleanup Policy Applied

The following categories were removed from `maindocs/`:
- Phase-by-phase completion reports
- Historical implementation summaries
- Superseded quick references now covered by the VPS deployment guide
- Planning/proposal docs that are not operational runbooks

## Notes

- Deployment and operations should start from `guides/VPS_DEPLOYMENT_GUIDE.md`.
- Feature-level backend/frontend details remain in each app’s local README/docs.
