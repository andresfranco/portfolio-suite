# Backend UI Implemented Features

This document captures only behavior that is currently implemented in `backend-ui`.

## Authentication and Request Security

Implemented in `src/services/api.js` and `src/services/authService.js`:
- Cookie-based auth (`withCredentials: true`)
- CSRF token header injection for `POST/PUT/PATCH/DELETE`
- Automatic token refresh retry on `401`
- CSRF refresh flow and request retry on CSRF validation errors
- FormData upload handling in interceptor (removes explicit `Content-Type` so browser sets multipart boundary)

## MFA Management (Admin + Self-Service)

Implemented in:
- `src/components/users/MfaManagement.js`
- `src/components/users/MfaEnrollmentDialog.js`
- `src/components/users/MfaBackupCodesDialog.js`
- `src/services/mfaApi.js`
- `src/components/MySettings.js`

Current capabilities:
- View MFA status
- Enroll/verify MFA
- Disable MFA
- Reset MFA device
- Regenerate backup codes

## Reusable Data Grid Pattern

Implemented in `src/components/common/ReusableDataGrid.js` and used across modules (users, roles, permissions, projects, portfolios, languages, sections, translations, etc.).

Current capabilities:
- Server-side pagination and sorting
- Pluggable filter component integration
- Internal or external data mode
- Standardized grid header rendering and sizing behavior
- Optional custom pagination component

## Website Edit Launch Integration

Implemented in:
- `src/components/portfolios/PortfolioIndex.js`
- `src/components/projects/ProjectIndex.js`
- `src/pages/ProjectDataPage.js`

Current behavior:
- Admin UI requests website edit token from backend (`/api/auth/generate-website-token`)
- Opens website with tokenized edit-mode URL

## Notes

- API contract details should come from backend OpenAPI docs (`/docs`) rather than duplicated static endpoint docs.
- Historical implementation summaries and planning docs were removed to keep this folder implementation-only.
