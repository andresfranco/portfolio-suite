# Portfolio Backend

FastAPI-based REST API with PostgreSQL, featuring enterprise-grade security, RAG/AI capabilities, and comprehensive documentation.

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scripts & Utilities](#scripts--utilities)

---

## ✨ Features
- User authentication and authorization (JWT with RS256/HS256)
- Multi-factor authentication (TOTP-based 2FA)
- Role-based access control (RBAC)
- Project management with images and attachments
- Multilingual content support (English/Spanish)
- Category and skill management
- File upload with ClamAV scanning
- GDPR compliance (data export, erasure, consent)
- Security audit logging
- RAG/AI search capabilities
- **External Document Preview** - Support for previewing DOCX/XLSX files using temporary tokens

---

## 📁 Project Structure

```
portfolio-backend/
├── app/                    # Application code
│   ├── api/               # API routes and endpoints
│   ├── core/              # Core functionality (config, security)
│   ├── db/                # Database models and repositories
│   └── schemas/           # Pydantic schemas
├── docs/                   # 📚 Documentation (organized by topic)
│   ├── security/          # Security implementation guides
│   ├── deployment/        # Deployment and infrastructure
│   ├── development/       # Development guides
│   ├── api/               # API documentation
│   └── README.md          # Documentation index
├── scripts/                # 🛠️ Utility scripts (organized by purpose)
│   ├── admin/             # User/admin management
│   ├── backup/            # Backup and restore
│   ├── database/          # Database utilities
│   ├── generate_rsa_keys.py  # RSA key generation
│   └── README.md          # Scripts documentation
├── tests/                  # Test suite
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── alembic/               # Database migrations
├── static/                # Static files
├── uploads/               # User uploads (gitignored)
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── requirements.txt       # Python dependencies
├── run.py                 # Development server
└── README.md              # This file
```

---

## 🚀 Quick Start

## Document Preview System

### Overview
The system supports previewing documents (PDF, DOCX, XLSX, TXT) with special handling for external viewers:

### Supported Preview Types
- **PDF**: Direct browser rendering
- **Text files**: Inline content display
- **Word/Excel documents**: External viewer integration with temporary access tokens

### External Viewer Integration
For DOCX and XLSX files, the system uses:
1. **Google Docs Viewer**: `https://docs.google.com/gview`
2. **Microsoft Office Viewer**: `https://view.officeapps.live.com`

### Temporary Token System
To allow external viewers to access protected files:

1. **Token Generation**: POST `/api/projects/{project_id}/attachments/{attachment_id}/preview-token`
   - Generates a secure, time-limited token (1 hour expiry)
   - Returns a public URL accessible to external services

2. **Public File Access**: GET `/api/projects/{project_id}/attachments/{attachment_id}/public?token={token}`
   - Serves files without authentication when valid token is provided
   - Includes CORS headers for external viewer compatibility

### Security Features
- **HMAC-based tokens** with SHA256 signatures
- **Time-based expiration** (configurable, default 1 hour)
- **Resource-specific binding** (tokens only work for specific attachments)
- **URL-safe encoding** for compatibility with external services

### Limitations in Development
- External viewers (Google/Microsoft) cannot access `localhost` URLs
- Files behind authentication may not be accessible to external services
- CORS restrictions may apply depending on deployment

### Production Requirements
For external preview to work in production:
- Server must be publicly accessible
- Files must be served with appropriate CORS headers
- HTTPS recommended for secure token transmission

## Setup

### Environment Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Modify the values according to your environment
   ```bash
   cp .env.example .env
   ```

### Database Environment Management

The application exclusively uses PostgreSQL for all environments with automatic configuration:

#### Environment Configuration

Set the `ENVIRONMENT` variable to specify which environment to use:
- `development` - For local development (default)
- `testing` - For running tests
- `staging` - For pre-production testing
- `production` - For production deployment

```
ENVIRONMENT=development
```

#### Database URLs

You can configure different database URLs for each environment:

```
# Main database URL (used as base URL and for production)
DATABASE_URL=postgresql://username:password@localhost:5432/portfolioai

# Environment-specific database URLs (optional)
DATABASE_URL_DEVELOPMENT=postgresql://username:password@localhost:5432/portfolioai_dev
DATABASE_URL_TESTING=postgresql://username:password@localhost:5432/portfolioai_test
DATABASE_URL_STAGING=postgresql://username:password@localhost:5432/portfolioai_staging

# Admin database user credentials (used by initialization scripts)
ADMINDB_USERNAME=admindb
ADMINDB_PASSWORD=admindb_secure_password
```

If environment-specific URLs are not provided, the system will automatically adjust the main `DATABASE_URL` based on the current environment.

#### PostgreSQL Setup

1. Install PostgreSQL:
   - Install from [the official PostgreSQL website](https://www.postgresql.org/download/)
   - Start the PostgreSQL service
   - Create a user and password

2. Initialize the databases:
   The project provides several scripts to help with database setup and management:

   #### db_init.py - Database Creation and Setup

   This script creates and configures PostgreSQL databases for all environments:

   ```bash
   # Initialize all environments
   python scripts/db/db_init.py

   # Initialize only development environment
   python scripts/db/db_init.py --env development

   # Initialize with custom admin credentials
   python scripts/db/db_init.py --username systemadmin --password SecurePass123 --email admin@example.com
   ```

   #### init_postgres_db.py - Database Content Initialization

   This script initializes a database with standard permissions, roles, and creates an admin user:

   ```bash
   # Initialize development environment with default admin (admin/generated-password)
   python scripts/db/init_postgres_db.py

   # Initialize specific environment with custom admin
   python scripts/db/init_postgres_db.py --environment production --username admin --password AdminSecurePass123 --email admin@yourdomain.com
   ```

   #### reset_postgres_db.py - Database Reset

   This script removes all data while preserving database structure (use with caution):

   ```bash
   # Reset development database (requires confirmation)
   python scripts/db/reset_postgres_db.py --environment development --confirm YES
   ```

   ⚠️ **WARNING**: The reset script will delete ALL data in the specified database environment. Make sure you have backups before using it, especially in production.

### Running the Application

1. Start the development server:
   ```bash
   source venv/bin/activate && ENVIRONMENT=development uvicorn app.main:app --reload --log-level debug
   ```

2. Access the API documentation at:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Testing

The project includes both unit and integration tests. Tests are organized as follows:

- `tests/unit/`: Contains unit tests that focus on testing individual components in isolation.
- `tests/integration/`: Contains integration tests that test interactions between components or API endpoints.
- `tests/utils.py`: Contains helper utilities for creating and cleaning up test data.

### Running Tests

To run all tests:

```bash
python -m pytest
```

To run only unit tests:

```bash
python -m pytest tests/unit/
```

To run only integration tests:

```bash
python -m pytest tests/integration/
```

To run a specific test file:

```bash
python -m pytest tests/unit/test_permission_model.py
```

To run a specific test:

```bash
python -m pytest tests/unit/test_permission_model.py::TestPermissionModel::test_create_permission
```

---

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

### By Topic

- **Security**: `docs/security/` - MFA, JWT, input validation, encryption
- **Deployment**: `docs/deployment/` - Production deployment, ClamAV, backups
- **Development**: `docs/development/` - Permissions, roles, user management
- **API**: `docs/api/` - Endpoints guide, filtering, pagination

### Quick Links

| Topic | Document | Description |
|-------|----------|-------------|
| **Getting Started** | `README.md` (this file) | Quick start and overview |
| **API Reference** | `docs/api/endpoints_guide.txt` | Complete API endpoints |
| **Security Guide** | `docs/security/SECURITY.md` | Security policy and practices |
| **MFA Setup** | `docs/security/MFA_IMPLEMENTATION_GUIDE.md` | Two-factor authentication |
| **Deployment** | `docs/deployment/DEPLOYMENT.md` | Production deployment guide |
| **Backup** | `docs/deployment/BACKUP_RECOVERY.md` | Backup and recovery procedures |

**See**: `docs/README.md` for complete documentation index

### API Documentation

- **Swagger UI**: http://localhost:8000/docs (when running)
- **ReDoc**: http://localhost:8000/redoc (when running)
- **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## 🛠️ Scripts & Utilities

Utility scripts are organized in the `scripts/` directory:

### Admin Scripts (`scripts/admin/`)

- **create_admin.py** - Create admin users
- **create_user_directly.py** - Create standard users
- **setup_systemadmin.py** - Setup system administrator
- **reset_systemadmin_password.py** - Emergency password reset

**Example:**
```bash
source venv/bin/activate
python scripts/admin/create_admin.py
```

### Backup Scripts (`scripts/backup/`)

- **backup.py** - Database backup
- **restore.py** - Database restore
- **backup.cron.example** - Cron configuration
- **portfolio-backup.service** - Systemd service
- **portfolio-backup.timer** - Systemd timer

**Example:**
```bash
python scripts/backup/backup.py
```

### Database Scripts (`scripts/database/`)

- **backfill_rag.py** - Generate RAG embeddings for existing content

**Example:**
```bash
python scripts/database/backfill_rag.py --table categories --limit 100
```

### Security Scripts

- **generate_rsa_keys.py** - Generate RSA keys for JWT RS256

**Example:**
```bash
python scripts/generate_rsa_keys.py --key-size 4096
```

**See**: `scripts/README.md` for complete scripts documentation

---

## 🚀 Deployment

### Production Checklist

- [ ] Generate RSA keys for JWT (`scripts/generate_rsa_keys.py`)
- [ ] Configure environment variables (`.env`)
- [ ] Setup PostgreSQL with SSL
- [ ] Configure ClamAV for file scanning
- [ ] Setup HTTPS with TLS 1.3
- [ ] Configure Nginx reverse proxy
- [ ] Setup automated backups
- [ ] Enable security audit logging
- [ ] Configure monitoring and alerts
- [ ] Review security documentation

### Deployment Guides

- **Complete Guide**: `docs/deployment/DEPLOYMENT.md`
- **ClamAV Setup**: `docs/deployment/CLAMAV_DEPLOYMENT_GUIDE.md`
- **Backup Guide**: `docs/deployment/BACKUP_RECOVERY.md`
- **Nginx Config**: `/deployment/README.md` (repository root)

---

## 🔒 Security

### Features Implemented

- ✅ JWT authentication (HS256/RS256)
- ✅ Multi-factor authentication (2FA/TOTP)
- ✅ Role-based access control
- ✅ Input validation and sanitization
- ✅ File upload scanning (ClamAV)
- ✅ GDPR compliance
- ✅ Security audit logging
- ✅ Rate limiting
- ✅ HTTPS/TLS 1.3

### Security Documentation

- **Security Policy**: `docs/security/SECURITY.md`
- **MFA Guide**: `docs/security/MFA_IMPLEMENTATION_GUIDE.md`
- **JWT Guide**: `docs/security/JWT_SECURITY_GUIDE.md`
- **Input Validation**: `docs/security/INPUT_VALIDATION_GUIDE.md`
- **Data Encryption**: `docs/security/DATA_ENCRYPTION_GUIDE.md`

---

## 📊 Document Preview System

### Running Tests Without Warnings

To run tests without seeing deprecation warnings:

```bash
# Use our convenience script
./run_tests.sh

# Or run with specific arguments
./run_tests.sh app/tests/api/test_roles.py -v
```

This script activates the virtual environment and runs the tests with the `-p no:warnings` flag to suppress warning messages.

Alternatively, you can run pytest directly with warning filters:

```bash
python -m pytest -p no:warnings
```

### Test Data Management

Tests create test data with unique identifiers to avoid conflicts. The `TestDataManager` class in `tests/utils.py` 
helps manage test data creation and cleanup. All test data is automatically cleaned up after tests run, preventing 
test data from accumulating in the database.

For unit tests, all test data is prefixed with `TEST_` to make it easy to identify and clean up. Integration tests 
using the API typically prefix test data with `TEST_API_`.

## RAG Indexing Quickstart

1) Apply migrations and run API

```bash
cd portfolio-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

2) Backfill existing rows

```bash
source venv/bin/activate
python scripts/backfill_rag.py --table categories --limit 100
```

3) Test retrieval endpoints

```bash
curl 'http://127.0.0.1:8000/api/search/embedding?limit=5' -H 'Authorization: Bearer <token>'
curl 'http://127.0.0.1:8000/api/search/vector?q=hello&limit=5' -H 'Authorization: Bearer <token>'
curl 'http://127.0.0.1:8000/api/search/hybrid?q=hello&limit=5' -H 'Authorization: Bearer <token>'
```

4) Optional: run async worker

```bash
cd portfolio-backend
docker compose up -d redis
source venv/bin/activate
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/1
celery -A app.queue.celery_app:get_celery worker --loglevel=INFO
```

5) Metrics & readiness

- Readiness: `GET /readyz`
- Prometheus metrics: `GET /metrics`

Multiprocess metrics (API + worker):

```bash
# In both API and worker shells
export PROMETHEUS_MULTIPROC_DIR=/tmp/prom_multiproc
rm -rf "$PROMETHEUS_MULTIPROC_DIR"; mkdir -p "$PROMETHEUS_MULTIPROC_DIR"
```

6) Tuning

- Chunk sizes: `CHUNK_CHARS` (default 4000), `CHUNK_OVERLAP` (default 500)
- Embeddings: `EMBED_PROVIDER` (e.g., openai), `EMBED_MODEL`
- Default ACL: `DEFAULT_TENANT_ID` (default `default`), `DEFAULT_VISIBILITY` (default `public`)
