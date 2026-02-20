# GEMINI.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio Suite is a full-stack enterprise portfolio management system with three main applications:
- **Backend API** (`portfolio-backend/`): FastAPI + PostgreSQL with enterprise security
- **Admin UI** (`backend-ui/`): React 19 admin interface for content management
- **Public Website** (`website/`): React public-facing portfolio site with CMS integration

## Development Commands

### Backend (FastAPI)

```bash
cd portfolio-backend

# Activate virtual environment (ALWAYS DO THIS FIRST)
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
python run.py

# Run tests
pytest tests/ -v

# Database migrations
alembic revision --autogenerate -m "Description"  # Create migration
alembic upgrade head                              # Apply migrations
alembic downgrade -1                              # Rollback one

# Code quality
ruff check app/              # Linting
black app/ --check           # Formatting check
isort app/ --check-only      # Import sorting check
mypy app/                    # Type checking
bandit -r app/ -ll           # Security scanning
```

### Admin UI (React)

```bash
cd backend-ui

# Install dependencies
npm install

# Run development server (port from .env)
npm start

# Build production
npm run build

# Run tests
npm test

# Linting
npm run lint
npx tsc --noEmit  # Type checking
```

### Public Website (React)

```bash
cd website

# Install dependencies
npm install

# Run development server
npm run dev

# Build production
npm run build

# Run tests
npm test
```

## Architecture

### Backend Architecture

**Layered Structure:**
- `/app/api/endpoints/` - Route handlers by feature (auth, users, projects, etc.)
- `/app/core/` - Config, security, logging, lifespan, database setup
- `/app/services/` - Business logic (GDPR, RAG, chat, encryption, caching)
- `/app/crud/` - Data access layer (repositories)
- `/app/schemas/` - Pydantic request/response models
- `/app/models/` - SQLAlchemy ORM models
- `/app/middleware/` - Request/response middleware
- `/app/rag/` - RAG (Retrieval-Augmented Generation) system
- `/app/queue/` - Celery background tasks
- `/app/observability/` - Metrics and monitoring

**Key Patterns:**
- **Repository Pattern**: CRUD operations in `/app/crud/`, never ORM calls directly in routers
- **Service Layer**: Business logic in `/app/services/`, called by routers
- **Dependency Injection**: FastAPI dependencies in `/app/api/deps.py`
- **Lifespan Management**: Startup/shutdown in `@asynccontextmanager` in `main.py`
- **Async End-to-End**: All I/O operations use async/await

**Database:**
- SQLAlchemy 2.x with async engine (`asyncpg` driver)
- Alembic for migrations (never bypass migrations)
- Connection pooling configured per environment
- PostgreSQL-native types (UUID, JSONB, CITEXT)
- Indexes on frequently filtered columns

**Security Features:**
- JWT authentication (RS256 asymmetric or HS256)
- Multi-factor authentication (TOTP/2FA)
- Role-based access control (RBAC)
- Rate limiting (Redis-backed)
- Input validation and sanitization
- File upload scanning (ClamAV integration)
- GDPR compliance (data export, erasure, consent)
- Security audit logging

**API Design:**
- RESTful endpoints under `/api/v1/`
- Consistent error envelope: `{code, message, details?}`
- Pagination: `?limit=50&offset=0` (max 200)
- UTC timestamps in ISO-8601 format

### Frontend Architecture (Admin UI)

**Structure:**
- `/src/pages/` - Top-level pages (Dashboard, NotFound)
- `/src/components/<feature>/` - Feature-specific components (users, projects, skills, etc.)
- `/src/contexts/` - React Context providers (User, Language, Authorization)
- `/src/services/` - API client layer (authService, systemSettingsApi, etc.)
- `/src/api/` - Base API configuration
- `/src/hooks/` - Custom React hooks (useIdleSession, etc.)
- `/src/config/` - Configuration files

**Key Patterns:**
- **Context + Providers**: State management via React Context (not Redux/Zustand)
- **Service Layer**: API calls abstracted in `/src/services/`
- **Material-UI**: Component library with custom theme
- **React Router 6+**: Client-side routing with protected routes
- **React Hook Form + Zod**: Form validation

**Features:**
- Multi-language support (i18n via LanguageContext)
- Role-based UI rendering (AuthorizationContext)
- Session timeout handling (useIdleSession hook)
- Security dashboard with metrics
- MFA enrollment/management
- GDPR data management

### Frontend Architecture (Public Website)

**Structure:**
- `/src/pages/` - Page components (HomePage, ProjectDetailsPage, ContactPage)
- `/src/components/` - Reusable UI components
- `/src/context/` - React Context (Language, Portfolio, EditMode)
- `/src/services/` - API clients
- `/src/hooks/` - Custom hooks
- `/src/data/` - Static data/constants

**Key Features:**
- **Edit Mode**: CMS integration allowing backend-controlled inline editing
- **Multi-language**: URL-based language routing (`/:lang/projects`)
- **Tailwind CSS**: Utility-first styling
- **Error Boundaries**: Graceful error handling

**Integration:**
- Fetches content from backend API
- Edit mode controlled by backend authentication
- Language-specific content routing

## Important Development Guidelines

### Non-Destructive Changes
- **Do not rename/move/delete files** unless explicitly requested
- **Do not change public APIs** or database schema without proposing a migration plan first
- For changes affecting >3 files or crossing layers (API, DB, UI), propose a plan first with:
  1. Goal and affected files
  2. Data model/migration impact
  3. Rollout and rollback strategy

### Database Changes
- **Always use Alembic migrations** - never apply schema changes inline
- Show migration diff separately from application code changes
- Test both upgrade and downgrade paths
- Verify no schema drift in CI

### Testing Requirements
- **Backend**: pytest with >85% coverage on changed lines
- Use Testcontainers for integration tests (real PostgreSQL)
- Mock external services with `respx`
- **Frontend**: Vitest + React Testing Library
- Test behavior, not implementation details

### Security Constraints
- Never commit secrets or API keys
- Use parameterized queries only (no string interpolation)
- Validate all inputs at API boundaries (Pydantic schemas)
- Maintain CORS allowlist
- Hash passwords with bcrypt/argon2
- Apply principle of least privilege

### Code Style
- **Backend**: Follow PEP 8, use type hints, docstrings for public functions
- **Frontend**: ESLint rules, TypeScript strict mode
- Descriptive names (`is_active`, `has_permission`)
- Early returns for guard clauses, minimize nesting
- Small, composable functions/modules

### Pre-commit Hooks
The repository uses pre-commit hooks for automated checks:
- Secret scanning (detect-secrets)
- Python: bandit, black, isort, ruff, mypy
- JavaScript: prettier, eslint
- General: trailing whitespace, file size, merge conflicts

Install with:
```bash
pip install pre-commit
pre-commit install
```

## Critical Patterns

### Backend Request Flow
```
Router → Dependencies (auth/permissions) → Service Layer → Repository → Database
       ← Pydantic Schema ← Domain Logic ← ORM Models ←
```

### Authentication Flow
1. Login: POST `/api/v1/auth/login` → JWT tokens (HTTP-only cookies)
2. MFA (if enabled): Verify TOTP code
3. Refresh: POST `/api/v1/auth/refresh` with refresh token
4. Protected routes: Verify JWT in `get_current_user` dependency

### RBAC Pattern
- Users have Roles (many-to-many)
- Roles have Permissions (many-to-many)
- Endpoints check permissions via `PermissionChecker` dependency
- Core permissions initialized on startup (`initialize_core_permissions`)

### RAG System
- Automatic embedding generation on content updates
- Background job processing via Celery
- Vector similarity search for content retrieval
- Citation tracking and source attribution
- Configurable via system settings

### CMS Integration
- Backend API serves content with translations
- Public website fetches and displays content
- Edit mode enabled via backend authentication
- Inline editing updates sent to backend API

## Environment Configuration

### Backend `.env`
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname

# Security
SECRET_KEY=<strong-random-key>
ALGORITHM=RS256  # or HS256
JWT_PRIVATE_KEY_PATH=/path/to/private_key.pem
JWT_PUBLIC_KEY_PATH=/path/to/public_key.pem

# CORS
FRONTEND_ORIGINS=http://localhost:3000,http://localhost:3001

# Features
CLAMAV_ENABLED=false  # Enable in production
ENVIRONMENT=development
```

### Frontend `.env` (Admin UI)
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENABLE_MFA=true
FRONTEND_PORT=3000
```

### Frontend `.env` (Website)
```bash
REACT_APP_API_URL=http://localhost:8000
PORT=3001
```

## Common Issues

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify virtual environment is activated
- Run migrations: `alembic upgrade head`

### Backend Import Errors
- Always activate virtual environment first: `source venv/bin/activate`
- Reinstall dependencies: `pip install -r requirements.txt`

### Frontend Proxy Errors
- Ensure backend is running first
- Check `REACT_APP_API_URL` matches backend port
- Clear browser cache and restart dev server

### Migration Conflicts
- Pull latest migrations before creating new ones
- Resolve conflicts manually in migration files
- Never delete migrations that have been applied

## Testing Strategy

### Backend Tests
- Unit tests for services and utilities
- Integration tests with Testcontainers (real DB)
- Security tests for authentication/authorization
- Coverage gate: ≥85% on changed lines

### Frontend Tests
- Component tests with React Testing Library
- API mocking with MSW (Mock Service Worker)
- Accessibility testing with jest-axe
- E2E tests with Playwright for critical flows

## Deployment

See detailed guides:
- `deployment/README.md` - Infrastructure setup
- `maindocs/guides/SSL_TLS_SETUP_GUIDE.md` - HTTPS configuration
- `maindocs/security/SECURITY_COMPLETE.md` - Security checklist

Production requirements:
- PostgreSQL 15+ with SSL
- Redis for caching/rate limiting
- Nginx with TLS 1.3
- ClamAV for file scanning
- RS256 JWT keys (4096-bit)
- Environment-specific secrets
