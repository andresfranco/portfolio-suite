# Utility Scripts

This directory contains utility scripts for database management, testing, and maintenance.

## ⚠️  Security Notice

**Always use environment variables for database credentials. Never hardcode passwords in scripts.**

---

## 📁 Directory Structure

```
scripts/
├── database/              # Database management scripts
│   ├── check_columns.py   # Check database schema
│   ├── create_project_categories.sql  # Sample data
│   └── fix_admindb_permissions.sql    # Permission fixes
├── tests/                 # Test scripts
│   ├── test_security.sh   # Security feature tests
│   ├── test_login_security.py  # Login security tests
│   └── run_tests.sh       # Test runner
└── README.md              # This file
```

---

## 🗄️ Database Scripts

### check_columns.py

Check if specific columns exist in database tables.

**Usage:**
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Check specific column
python scripts/database/check_columns.py users is_active

# Check with default (users table, is_active column)
python scripts/database/check_columns.py
```

**Example:**
```bash
DATABASE_URL="postgresql://admindb:password@localhost:5432/portfolioai_dev" \
python scripts/database/check_columns.py users email
```

### create_project_categories.sql

Inserts sample project categories for development/testing.

**Usage:**
```bash
# Connect to database and run
psql $DATABASE_URL -f scripts/database/create_project_categories.sql

# Or pipe it
psql -U admindb -d portfolioai_dev < scripts/database/create_project_categories.sql
```

**Categories Created:**
- WEB_APP - Web applications
- MOBILE_APP - Mobile applications  
- DESKTOP_APP - Desktop applications
- API_SERVICE - API services
- WEBSITE - Static websites
- LIBRARY - Code libraries
- FRAMEWORK - Development frameworks
- TOOL - Development tools

### fix_admindb_permissions.sql

Fixes database permissions for the admindb user.

**⚠️  WARNING: This grants SUPERUSER privileges. Use carefully!**

**Usage:**
```bash
# Run as postgres superuser
sudo -u postgres psql < scripts/database/fix_admindb_permissions.sql
```

**What it does:**
- Grants schema usage
- Makes admindb a superuser
- Grants all privileges on tables/sequences/functions
- Sets default privileges for future objects

---

## 🧪 Test Scripts

### run_tests.sh

Runs all pytest tests without warnings.

**Usage:**
```bash
cd portfolio-backend
./scripts/tests/run_tests.sh

# Pass pytest arguments
./scripts/tests/run_tests.sh -v -k "test_auth"
```

### test_security.sh

Tests security features via HTTP API calls.

**Prerequisites:**
- Backend server running on localhost:8000
- Valid test user credentials

**Usage:**
```bash
# Ensure backend is running
cd portfolio-backend
source venv/bin/activate
python run.py &

# Run security tests
cd ../scripts/tests
./test_security.sh
```

**Tests:**
- Login functionality
- Account status endpoint
- MFA status endpoint
- MFA enrollment
- Audit logging

### test_login_security.py

Comprehensive Python script for testing login security features.

**Features Tested:**
- Rate limiting
- Security audit logging
- SystemAdmin privileges
- Error handling
- Failed login attempts
- Account lockout

**Usage:**
```bash
cd scripts/tests

# Edit credentials if needed
nano test_login_security.py

# Run tests
python test_login_security.py
```

**Configuration:**
Set the admin password via environment variable before running:
```bash
SYSTEMADMIN_PASSWORD=<your_password> python test_login_security.py
```

---

## 🔧 Common Tasks

### Initialize Database with Sample Data

```bash
# Set database URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"

# Run migrations first
cd portfolio-backend
alembic upgrade head

# Add sample categories
psql $DATABASE_URL -f ../scripts/database/create_project_categories.sql
```

### Check Database Schema

```bash
# Check if migration was applied
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname" \
python scripts/database/check_columns.py users mfa_secret

# Check multiple columns
for col in email username is_active mfa_enabled; do
  python scripts/database/check_columns.py users $col
done
```

### Run Full Test Suite

```bash
cd portfolio-backend

# Unit tests
../scripts/tests/run_tests.sh

# Integration tests (requires running server)
python run.py &
sleep 5
../scripts/tests/test_security.sh
pkill -f "python run.py"
```

---

## 🔒 Security Best Practices

### Database Credentials

**DO ✅:**
```bash
# Use environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
python scripts/database/check_columns.py

# Use .env file
echo "DATABASE_URL=postgresql://..." >> .env
source .env
```

**DON'T ❌:**
```python
# Never hardcode credentials in scripts
DB_URL = "postgresql://admindb:password123@localhost:5432/db"  # BAD!
```

### Script Permissions

```bash
# Make scripts executable
chmod +x scripts/tests/*.sh

# Restrict access to scripts with sensitive operations
chmod 700 scripts/database/fix_admindb_permissions.sql
```

### Testing in Production

**⚠️  NEVER run test scripts against production databases!**

Always:
1. Use separate test/staging databases
2. Backup before running SQL scripts
3. Test in development first
4. Review script contents before execution

---

## 🐛 Troubleshooting

### "psycopg2 could not be resolved"

The check_columns.py script requires psycopg2. Install it:

```bash
cd portfolio-backend
source venv/bin/activate
pip install psycopg2-binary
```

### "Permission denied" on shell scripts

Make scripts executable:

```bash
chmod +x scripts/tests/*.sh
```

### "Connection refused" in tests

Ensure backend server is running:

```bash
cd portfolio-backend
source venv/bin/activate
python run.py &
sleep 3
curl http://localhost:8000/healthz
```

### SQL script fails with permission errors

You may need superuser privileges:

```bash
# Run as postgres user
sudo -u postgres psql < scripts/database/fix_admindb_permissions.sql

# Or connect as superuser
psql -U postgres -d portfolioai_dev < scripts/database/script.sql
```

---

## 📝 Creating New Scripts

### Database Script Template

```python
#!/usr/bin/env python
"""
Script description
"""
import os
import sys

# Get credentials from environment
db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not set")
    sys.exit(1)

# Your script logic here
```

### Test Script Template

```bash
#!/bin/bash
set -e  # Exit on error

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"

# Your test logic here
echo "Running tests..."

# Report results
echo "✅ All tests passed"
```

---

## 📚 Related Documentation

- [Backend README](../../portfolio-backend/README.md)
- [Testing Quick Reference](../../maindocs/guides/TESTING_QUICK_REFERENCE.md)
- [Security Features Test Report](../../maindocs/tests/SECURITY_FEATURES_TEST_REPORT.md)

---

**Last Updated**: December 2024  
**Maintained by**: Portfolio Suite Team
