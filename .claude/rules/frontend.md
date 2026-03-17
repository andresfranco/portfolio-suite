---
description: Frontend architecture, patterns, and common issues for the Admin UI (MUI/React) and Public Website (Tailwind/React). Loaded when working in backend-ui/ or website/.
globs: ["backend-ui/**", "website/**"]
---

# Frontend Architecture

## Admin UI (`backend-ui/`)
```
/src/pages/            — Top-level pages (Dashboard, NotFound)
/src/components/<feat> — Feature components (users, projects, skills, etc.)
/src/contexts/         — React Context: UserContext, LanguageContext, AuthorizationContext
/src/services/         — API clients (authService, systemSettingsApi, etc.)
/src/api/              — Axios base config
/src/hooks/            — Custom hooks (useIdleSession)
/src/config/           — App config
```

**Stack**: React 19 + Material-UI v6 + React Hook Form + Axios + React Router 6
**State**: Context only (no Redux/Zustand)
**i18n**: `LanguageContext` — add keys to ALL language files when adding strings
**RBAC**: `AuthorizationContext` — use `useAuthorization()` hook for permission checks

**Dev commands**:
```bash
cd backend-ui && npm start     # Dev server
npm run build                  # Production build
npm run lint                   # ESLint
npx tsc --noEmit               # Type check
```

**Env vars**: `REACT_APP_SERVER_HOSTNAME`, `REACT_APP_SERVER_PORT`, `REACT_APP_SERVER_PROTOCOL`, `REACT_APP_WEBSITE_URL`

## Public Website (`website/`)
```
/src/pages/       — Page components (HomePage, ProjectDetailsPage, ContactPage)
/src/components/  — Reusable UI components
/src/context/     — Language, Portfolio, EditMode contexts
/src/services/    — portfolioApi.js (with 5-min TTL cache)
/src/hooks/       — Custom hooks
/src/data/        — Static constants
```

**Stack**: React 19 + Tailwind CSS v3 + Tiptap + Monaco editor
**Routing**: URL-based language prefix `/:lang/projects`
**Edit mode**: CMS inline editing controlled by backend auth cookie
**Cache**: `portfolioApi.js` has in-memory 5-min TTL — call `invalidatePortfolioCache()` after mutations
**Lazy loading**: ProjectDetailsPage, ContactPage, ExperienceDetailsPage, ChatModal via `React.lazy()`

**Dev commands**:
```bash
cd website && npm run dev      # Dev server (port 3001)
npm run build                  # Production build
npm test                       # Tests
```

**Env vars**: `REACT_APP_API_URL`

## Shared patterns
- Always add i18n keys to ALL supported language files simultaneously
- API calls go through service layer — never fetch() directly in components
- Error boundaries in place — throw errors up, don't swallow them silently
- Images: WebP output, client-side Canvas compression before upload

## Common issues
- **Proxy errors**: Ensure backend is running first, check `REACT_APP_API_URL` matches
- **Blank edit mode**: Check backend auth cookie is present in dev
- **Build OOM**: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`
- **Language missing**: New string added to only one language file — add to all
