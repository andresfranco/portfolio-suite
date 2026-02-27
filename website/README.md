# Website (Public Portfolio)

Public-facing React application with multilingual routing, CMS edit mode integration, and portfolio chat.

## Run

```bash
cd website
npm install
npm start
```

## Test and Build

```bash
npm test
npm run build
```

## Implemented Architecture

- `src/context/LanguageContext.js`
  - Loads enabled languages from backend with safe defaults (`en`, `es`)
- `src/context/PortfolioContext.js`
  - Loads default or selected portfolio from backend and exposes helper getters
- `src/context/EditModeContext.js`
  - Handles tokenized CMS edit sessions, token verification, and edit-mode state
- `src/services/portfolioApi.js`
  - Public website fetches (`/api/website/*`), CMS content updates (`/api/cms/content/*`), and chat requests

## Implemented UX Features

- Public routes and language-prefixed routes for projects/contact/experience
- CMS edit mode indicator and editable wrappers
- Inline content editing and project image selection/upload in edit mode
- AI chat modal bound to current portfolio context

## Notes

- Project documentation is intentionally limited to implementation-backed behavior.
- `website/src/assets/docs` is not used as project documentation and has been removed from docs scope.
