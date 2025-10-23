# Backend Utility Scripts

Utility scripts for administration, backup, database management, and security operations.

## 📁 Directory Structure

```
scripts/
├── admin/              # User and admin management scripts
├── backup/             # Backup and restore scripts
├── database/           # Database utilities
├── db/                 # Database migration scripts (existing)
├── generate_rsa_keys.py  # RSA key generation for JWT
└── README.md           # This file
```

---

## 👤 Admin Scripts

**Location**: `scripts/admin/`

### User Management

#### create_admin.py
Creates a new admin user with full privileges.

**Usage:**
```bash
cd /path/to/portfolio-backend
source venv/bin/activate
python scripts/admin/create_admin.py
```

**Interactive prompts:**
- Username
- Email
- Password
- Full name

**Grants:**
- Admin role
- All permissions
- Active status

#### create_user_directly.py
Creates a standard user account.

**Usage:**
```bash
python scripts/admin/create_user_directly.py
```

**Interactive prompts:**
- Username
- Email
- Password
- Role assignment

#### setup_systemadmin.py
Sets up the special `systemadmin` superuser account.

**Usage:**
```bash
python scripts/admin/setup_systemadmin.py
```

**⚠️  WARNING**: This creates a superuser with unrestricted access. Use only for initial setup.

**What it does:**
- Creates systemadmin user if not exists
- Sets strong default password
- Grants all roles and permissions
- Ensures MFA is disabled initially

#### reset_systemadmin_password.py
Resets the systemadmin password if locked out.

**Usage:**
```bash
python scripts/admin/reset_systemadmin_password.py
```

**⚠️  SECURITY**: Only use in emergency situations. This bypasses normal security.

---

## 💾 Backup Scripts

**Location**: `scripts/backup/`

### Backup Operations

#### backup.py
Full database backup script.

**Usage:**
```bash
# Manual backup
python scripts/backup/backup.py

# With custom backup directory
python scripts/backup/backup.py --backup-dir /path/to/backups
```

**Features:**
- Full PostgreSQL database dump
- Compressed backup files
- Automatic timestamp naming
- Retention policy support

**Environment variables:**
- `DATABASE_URL` - Database connection string
- `BACKUP_DIR` - Backup storage directory (optional)

#### restore.py
Restore database from backup.

**Usage:**
```bash
# Restore from latest backup
python scripts/backup/restore.py

# Restore specific backup file
python scripts/backup/restore.py --backup-file /path/to/backup.sql.gz
```

**⚠️  WARNING**: This will overwrite current database data!

**Best practices:**
- Test restores in staging environment first
- Verify backup integrity before restore
- Ensure application is stopped during restore

### Automated Backups

#### backup.cron.example
Example cron configuration for automated backups.

**Usage:**
```bash
# Copy to crontab
crontab -e

# Add line (daily backup at 2 AM):
0 2 * * * /path/to/venv/bin/python /path/to/scripts/backup/backup.py
```

#### portfolio-backup.service
Systemd service file for backup operations.

**Installation:**
```bash
sudo cp scripts/backup/portfolio-backup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable portfolio-backup.service
```

#### portfolio-backup.timer
Systemd timer for scheduled backups.

**Installation:**
```bash
sudo cp scripts/backup/portfolio-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable portfolio-backup.timer
sudo systemctl start portfolio-backup.timer

# Check timer status
sudo systemctl list-timers portfolio-backup.timer
```

---

## 🗄️ Database Scripts

**Location**: `scripts/database/`

### Database Utilities

#### backfill_rag.py
Backfills RAG (Retrieval-Augmented Generation) embeddings for existing content.

**Usage:**
```bash
python scripts/database/backfill_rag.py
```

**What it does:**
- Processes all existing projects/content
- Generates embeddings for AI search
- Updates vector database
- Handles large datasets in batches

**Environment variables:**
- `DATABASE_URL` - Database connection
- `EMBED_PROVIDER` - Embedding provider (openai, cohere, etc.)
- `EMBED_MODEL` - Model name

**See also:** Root-level `scripts/database/` for additional DB utilities

---

## 🔐 Security Scripts

**Location**: Root level (`scripts/`)

### RSA Key Generation

#### generate_rsa_keys.py
Generates RSA key pairs for JWT RS256 signing.

**Usage:**
```bash
cd /path/to/portfolio-backend
python scripts/generate_rsa_keys.py

# With custom key size
python scripts/generate_rsa_keys.py --key-size 4096
```

**Generates:**
- `private_key.pem` - RSA private key (keep secret!)
- `public_key.pem` - RSA public key

**⚠️  SECURITY:**
- Move keys to secure location after generation
- Set proper permissions (private key: 600)
- Never commit keys to version control
- Use environment variables to reference key paths

**Example deployment:**
```bash
# Generate keys
python scripts/generate_rsa_keys.py --key-size 4096

# Move to secure location
sudo mkdir -p /etc/portfolio/keys
sudo mv private_key.pem /etc/portfolio/keys/
sudo mv public_key.pem /etc/portfolio/keys/

# Set permissions
sudo chmod 600 /etc/portfolio/keys/private_key.pem
sudo chmod 644 /etc/portfolio/keys/public_key.pem

# Update .env
echo "JWT_PRIVATE_KEY_PATH=/etc/portfolio/keys/private_key.pem" >> .env
echo "JWT_PUBLIC_KEY_PATH=/etc/portfolio/keys/public_key.pem" >> .env
```

---

## 🔧 Common Tasks

### Initial Setup

```bash
# 1. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Setup database
alembic upgrade head

# 3. Create system administrator
python scripts/admin/setup_systemadmin.py

# 4. Generate RSA keys (for RS256 JWT)
python scripts/generate_rsa_keys.py --key-size 4096
# Move keys to secure location (see above)

# 5. Create additional admin users
python scripts/admin/create_admin.py
```

### Regular Maintenance

```bash
# Backup database
python scripts/backup/backup.py

# Check backup integrity
python scripts/backup/restore.py --dry-run --backup-file latest.sql.gz

# Regenerate embeddings (after content updates)
python scripts/database/backfill_rag.py
```

### Emergency Recovery

```bash
# Reset systemadmin password
python scripts/admin/reset_systemadmin_password.py

# Restore from backup
python scripts/backup/restore.py --backup-file /backups/portfolio-2024-12-01.sql.gz
```

---

## ⚙️ Environment Variables

All scripts respect these environment variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `BACKUP_DIR` | Backup storage directory | `./backups` |
| `EMBED_PROVIDER` | Embedding provider (openai, etc.) | `openai` |
| `EMBED_MODEL` | Embedding model name | Provider-specific |
| `JWT_PRIVATE_KEY_PATH` | Path to RSA private key | None (HS256 fallback) |
| `JWT_PUBLIC_KEY_PATH` | Path to RSA public key | None (HS256 fallback) |

**Setting environment variables:**
```bash
# In .env file
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
BACKUP_DIR=/var/backups/portfolio

# Or export in shell
export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
```

---

## 🛡️ Security Best Practices

### Script Permissions

```bash
# Restrict access to admin scripts
chmod 750 scripts/admin/*.py

# Secure backup scripts
chmod 750 scripts/backup/*.py

# Protect key generation
chmod 750 scripts/generate_rsa_keys.py
```

### Credential Management

**DO ✅:**
- Use environment variables for all credentials
- Store .env file securely (not in git)
- Use key vaults for production secrets
- Rotate credentials regularly

**DON'T ❌:**
- Hardcode credentials in scripts
- Commit .env files
- Share credentials via email/chat
- Use same credentials across environments

### Backup Security

**Best practices:**
- Encrypt backups at rest
- Store backups in separate location
- Test restore procedures regularly
- Implement retention policies
- Monitor backup success/failures

---

## 📝 Creating New Scripts

### Template

```python
#!/usr/bin/env python3
"""
Script description

Usage:
    python scripts/category/script_name.py [options]
"""
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.database import get_db
from app.core.config import settings

def main():
    """Main script logic"""
    # Get database connection
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    
    # Your logic here
    print("Script executed successfully")

if __name__ == "__main__":
    main()
```

### Best Practices

1. **Use environment variables** for configuration
2. **Add docstrings** explaining purpose and usage
3. **Handle errors gracefully** with try/except
4. **Provide user feedback** (progress, success, errors)
5. **Include --help** option for complex scripts
6. **Test in development** before using in production
7. **Log important operations** for auditing

---

## 🔗 Related Documentation

- **Admin Setup**: `docs/development/systemadmin_setup_and_testing.md`
- **Backup Guide**: `docs/deployment/BACKUP_RECOVERY.md`
- **Security Guide**: `docs/security/JWT_SECURITY_GUIDE.md`
- **Main README**: `../README.md`

---

**Last Updated**: December 2024  
**Maintained by**: Portfolio Suite Development Team
