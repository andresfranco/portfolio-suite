# Backend UI (Admin Panel)

React 19 admin application for managing portfolio content, users, roles, permissions, and security settings.

## Stack

- React 19
- Material UI + MUI DataGrid
- React Router
- React Hook Form
- Axios with cookie + CSRF flow

## Run

```bash
cd backend-ui
npm install
npm start
```

## Test and Build

```bash
npm test
npm run build
```

## Implemented Highlights

- Cookie-based auth and CSRF-protected state-changing requests
- MFA management UI for admins and user self-service
- Reusable server-side DataGrid pattern across major modules
- Website edit-mode launch from admin screens

## Docs

- [Docs Index](./docs/README.md)
- [Implemented Features](./docs/IMPLEMENTED_FEATURES.md)
- [Config Guide](./config/README.md)
