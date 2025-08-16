# Portfolio Backend

## Overview
This is the backend API for the Portfolio AI project, built with FastAPI and PostgreSQL.

## Features
- User authentication and authorization
- Project management with images and attachments
- Multilingual content support
- Category and skill management
- File upload and management
- **External Document Preview** - Support for previewing DOCX/XLSX files using temporary tokens

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
