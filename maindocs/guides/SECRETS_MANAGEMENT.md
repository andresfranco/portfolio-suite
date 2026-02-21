# Secrets Management Guide

**Date**: October 23, 2025  
**Phase**: 1.1 - Secrets Management & Configuration Security  
**Status**: ✅ COMPLETE  
**Priority**: CRITICAL

---

## Executive Summary

This document provides comprehensive guidance on managing secrets and sensitive configuration for the Portfolio Suite application. Proper secrets management is critical for security and must be followed in all environments.

### Security Principles

1. **Never commit secrets** to version control
2. **Use environment variables** for all sensitive configuration
3. **Rotate secrets regularly** (every 90 days minimum)
4. **Use secrets management services** in production
5. **Limit access** to secrets on a need-to-know basis
6. **Audit secret access** and changes
7. **Encrypt secrets at rest** when stored

---

## Quick Start

### Backend Setup

```bash
cd portfolio-backend

# 1. Copy the example file
cp .env.example .env

# 2. Generate a secure SECRET_KEY
openssl rand -hex 32

# 3. Edit .env and add your values
nano .env

# 4. Verify configuration
python -c "from app.core.config import settings; print('✅ Configuration valid!')"
```

### Frontend Setup

```bash
cd backend-ui

# 1. Copy the example file
cp .env.example .env.local

# 2. Edit .env.local and add your values
nano .env.local

# 3. Restart development server
npm start
```

---

## Environment Files

### Backend Environment Files

| File | Purpose | Committed? | Location |
|------|---------|------------|----------|
| `.env.example` | Template with all variables | ✅ Yes | `portfolio-backend/` |
| `.env` | Local development values | ❌ No | `portfolio-backend/` |
| `.env.development` | Development-specific (optional) | ❌ No | `portfolio-backend/` |
| `.env.staging` | Staging environment (optional) | ❌ No | Deployment server |
| `.env.production` | Production environment | ❌ No | Deployment server |

### Frontend Environment Files

| File | Purpose | Committed? | Location |
|------|---------|------------|----------|
| `.env.example` | Template with all variables | ✅ Yes | `backend-ui/` |
| `.env.local` | Local development values | ❌ No | `backend-ui/` |
| `.env.development` | Development build | ❌ No | `backend-ui/` |
| `.env.production` | Production build | ❌ No | `backend-ui/` |

---

## Critical Secrets

### 1. SECRET_KEY (Backend)

**Purpose**: JWT token signing and session encryption

**Requirements**:
- Minimum 32 characters
- Cryptographically random
- Unique per environment
- Never reuse across environments

**Generation**:
```bash
# Generate a secure secret key
openssl rand -hex 32

# Output example: a1b2c3d4e5f6...
```

**Validation**:
```python
# Automatic validation in config.py
@field_validator("SECRET_KEY")
def validate_secret_key(cls, v: str, info) -> str:
    env = info.data.get("ENVIRONMENT", "development").lower()
    
    if env in ["production", "staging"]:
        if not v or len(v) < 32:
            raise ValueError(
                f"SECRET_KEY must be set to a secure random value (min 32 chars)"
            )
    return v
```

**Rotation Schedule**: Every 90 days (quarterly)

---

### 2. DATABASE_URL

**Purpose**: Database connection credentials

**Format**:
```
postgresql://username:password@host:port/database
```

**Security Considerations**:
- Use strong passwords (20+ characters, mixed case, numbers, symbols)
- Different credentials per environment
- Restrict database user permissions (principle of least privilege)
- Enable SSL/TLS for connections (`sslmode=require`)
- Rotate passwords every 90 days

**Example (with SSL)**:
```bash
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:5432/<DB_NAME>?sslmode=require
```

**Never Use**:
```bash
❌ DATABASE_URL=postgresql://<DEFAULT_USER>:<DEFAULT_PASSWORD>@localhost/<DB_NAME>  # Default credentials pattern
❌ DATABASE_URL=postgresql://<ADMIN_USER>:<WEAK_PASSWORD>@prod-db/<DB_NAME>         # Weak password pattern
```

---

### 3. SMTP Credentials

**Purpose**: Email sending for notifications, password resets

**Variables**:
```bash
SMTP_HOST
SMTP_PORT
SMTP_USERNAME
SMTP_PASSWORD
```

Use your environment manager to set these values; do not place sample credentials in docs.

**Best Practices**:
- Use app-specific passwords (not account password)
- Gmail: Generate in "Security > App Passwords"
- SendGrid/Mailgun: Use API keys with limited permissions
- Rotate every 6 months

---

### 4. Cloud Storage Credentials (AWS S3)

**Purpose**: Backup storage, file uploads

**Variables**:
```bash
AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY>
AWS_S3_BUCKET=<AWS_S3_BUCKET_NAME>
AWS_REGION=<AWS_REGION>
```

**Best Practices**:
- Use IAM roles when running on AWS (no keys needed)
- Create dedicated IAM user with minimal permissions
- Enable MFA for IAM user
- Rotate keys every 90 days
- Use bucket policies to restrict access

---

### 5. Encryption Keys

**Backup Encryption**:
```bash
BACKUP_ENCRYPTION_KEY=your_backup_encryption_passphrase_here
```

**Agent/AI Credentials Encryption**:
```bash
AGENT_KMS_KEY=your_kms_encryption_key_here
```

**Best Practices**:
- Store encryption keys separately from data
- Use key management service (KMS) in production
- Never store keys in application code
- Implement key rotation procedures

---

## Environment-Specific Configuration

### Development Environment

```bash
# .env (local development)
ENVIRONMENT=development
DEBUG=True
SECRET_KEY=<DEV_SECRET_KEY_MIN_32_CHARS>
DATABASE_URL=postgresql://<DEV_DB_USER>:<DEV_DB_PASSWORD>@localhost:5432/<DEV_DB_NAME>
ALLOWED_HOSTS=*
RATE_LIMIT_ENABLED=False
LOG_LEVEL=DEBUG
```

**Characteristics**:
- ✅ Can use weaker secrets (but still 32+ chars for SECRET_KEY)
- ✅ DEBUG=True allowed
- ✅ Permissive CORS
- ✅ Detailed logging
- ❌ Never use production secrets

---

### Staging Environment

```bash
# .env (staging server)
ENVIRONMENT=staging
DEBUG=False
SECRET_KEY=<STAGING_SECRET_KEY_64_CHARS>
DATABASE_URL=postgresql://<STAGING_DB_USER>:<STAGING_DB_PASSWORD>@<STAGING_DB_HOST>:5432/<STAGING_DB_NAME>?sslmode=require
ALLOWED_HOSTS=staging.example.com
RATE_LIMIT_ENABLED=True
HSTS_ENABLED=False  # Optional for staging
LOG_LEVEL=INFO
SECURITY_EMAIL_ALERTS_ENABLED=True
```

**Characteristics**:
- ✅ Production-like configuration
- ✅ Strong secrets (but different from production)
- ✅ Security features enabled
- ✅ Monitoring and alerting enabled
- ❌ DEBUG=False
- ❌ Not publicly accessible

---

### Production Environment

```bash
# .env (production server)
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=<PROD_SECRET_KEY_FROM_SECRETS_MANAGER>
DATABASE_URL=postgresql://<PROD_DB_USER>:<PROD_DB_PASSWORD>@<PROD_DB_HOST>:5432/<PROD_DB_NAME>?sslmode=require
ALLOWED_HOSTS=app.example.com,api.example.com
RATE_LIMIT_ENABLED=True
HSTS_ENABLED=True
HSTS_MAX_AGE=31536000
LOG_LEVEL=WARNING
LOG_FORMAT=json
SECURITY_EMAIL_ALERTS_ENABLED=True
SECURITY_ALERT_RECIPIENTS=security@example.com,ops@example.com

# Production-specific
SENTRY_DSN=<SENTRY_DSN>
AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_ID_FROM_SECRETS_MANAGER>
AWS_SECRET_ACCESS_KEY=<AWS_SECRET_ACCESS_KEY_FROM_SECRETS_MANAGER>
```

**Requirements**:
- ✅ All secrets from secrets management service
- ✅ DEBUG=False (enforced by validator)
- ✅ ALLOWED_HOSTS set to specific domains
- ✅ HSTS enabled
- ✅ Rate limiting enabled
- ✅ Security monitoring enabled
- ✅ Structured JSON logging
- ✅ Error tracking (Sentry)
- ❌ No development shortcuts

---

## Secrets Management Services

### For Production Deployments

#### Option 1: AWS Secrets Manager

**Advantages**:
- Automatic rotation
- Encryption at rest
- Fine-grained access control
- Audit logging
- Integration with AWS services

**Setup**:
```bash
# Store secret
aws secretsmanager create-secret \
    --name portfolio-suite/production/secret-key \
    --secret-string "<SECRET_KEY_VALUE>"

# Retrieve in application startup
import boto3
client = boto3.client('secretsmanager')
response = client.get_secret_value(SecretId='portfolio-suite/production/secret-key')
secret = response['SecretString']
```

**Cost**: ~$0.40/month per secret

---

#### Option 2: HashiCorp Vault

**Advantages**:
- Open source
- Dynamic secrets
- Secret versioning
- Multi-cloud support
- Detailed audit logs

**Setup**:
```bash
# Write secret
vault kv put secret/portfolio-suite/production SECRET_KEY="<SECRET_KEY_VALUE>"

# Read in application
import hvac
client = hvac.Client(url='http://vault:8200', token=os.getenv('VAULT_TOKEN'))
secret = client.secrets.kv.v2.read_secret_version(path='portfolio-suite/production')
```

**Cost**: Free (self-hosted) or $0.03/hour (HCP Vault)

---

#### Option 3: Azure Key Vault

**Advantages**:
- Azure integration
- Hardware Security Module (HSM) backed
- Certificate management
- Key rotation

**Setup**:
```python
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://my-vault.vault.azure.net", credential=credential)
secret = client.get_secret("secret-key")
```

**Cost**: ~$0.03/10,000 operations

---

## Secret Rotation

### Rotation Schedule

| Secret Type | Frequency | Automated? |
|-------------|-----------|------------|
| SECRET_KEY | 90 days | Manual |
| Database passwords | 90 days | Semi-automated |
| API keys (3rd party) | 180 days | Manual |
| SMTP passwords | 180 days | Manual |
| AWS credentials | 90 days | Automated (IAM) |
| Encryption keys | 365 days | Manual |

### Rotation Procedure

#### 1. SECRET_KEY Rotation

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Add to secrets manager
aws secretsmanager update-secret \
    --secret-id portfolio-suite/production/secret-key \
    --secret-string "$NEW_SECRET"

# 3. Deploy application with new secret
# (Rolling deployment to avoid downtime)

# 4. Invalidate old tokens (users will need to re-login)
# This happens automatically as old tokens fail validation

# 5. Monitor for issues
# Check error logs for increased auth failures

# 6. Complete rotation
# Update documentation with rotation date
```

#### 2. Database Password Rotation

```bash
# 1. Create new password
NEW_PASSWORD=$(openssl rand -base64 24)

# 2. Create new database user (or alter existing)
psql -c "CREATE USER app_user_new WITH PASSWORD '$NEW_PASSWORD';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE portfolioai TO app_user_new;"

# 3. Update DATABASE_URL in secrets manager

# 4. Rolling restart of application

# 5. Verify application working

# 6. Remove old user
psql -c "DROP USER app_user_old;"
```

---

## Access Control

### Who Needs Access?

| Role | Secrets Needed | Access Level |
|------|----------------|--------------|
| **Developers** | Development secrets only | Read |
| **DevOps/SRE** | All secrets (via secrets manager) | Read/Write |
| **Security Team** | Audit logs, rotation access | Read/Admin |
| **Application** | Runtime secrets (via IAM/service account) | Read |

### Access Audit

```bash
# Review who has accessed secrets
aws secretsmanager list-secrets
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=ResourceName,AttributeValue=portfolio-suite/*

# Regular audit schedule: Monthly
```

---

## Security Checklist

### Pre-Deployment

- [ ] All `.env.example` files are committed
- [ ] No `.env` files in version control
- [ ] `.gitignore` includes `.env*` (with !.env.example)
- [ ] SECRET_KEY is 32+ characters
- [ ] Database password is 20+ characters
- [ ] All production secrets stored in secrets manager
- [ ] Secrets are different across environments
- [ ] DEBUG=False in production config
- [ ] ALLOWED_HOSTS set to specific domains
- [ ] HSTS enabled in production
- [ ] Rate limiting enabled in production

### Post-Deployment

- [ ] Verify application starts without errors
- [ ] Check logs for configuration warnings
- [ ] Test authentication flow
- [ ] Test database connectivity
- [ ] Verify email sending (if configured)
- [ ] Check security headers (HSTS, CSP)
- [ ] Monitor for failed authentication attempts
- [ ] Set up secret rotation reminders (90 days)

---

## Incident Response

### If Secrets Are Compromised

1. **Immediate Actions** (within 1 hour):
   ```bash
   # 1. Rotate compromised secret immediately
   # 2. Invalidate all active sessions
   # 3. Enable additional monitoring
   # 4. Block suspicious IP addresses
   ```

2. **Investigation** (within 24 hours):
   - Review access logs
   - Identify how secret was compromised
   - Assess extent of breach
   - Document timeline

3. **Remediation** (within 48 hours):
   - Rotate all related secrets
   - Update access controls
   - Patch vulnerability
   - Update security procedures

4. **Communication**:
   - Notify security team immediately
   - Notify affected users if needed
   - Document incident in security log
   - Update response procedures

---

## Best Practices

### DO

✅ Use environment variables for all secrets  
✅ Use `.env.example` as a template (committed)  
✅ Generate strong, random secrets  
✅ Use different secrets for each environment  
✅ Rotate secrets regularly (90 days)  
✅ Use secrets management service in production  
✅ Encrypt secrets at rest  
✅ Audit secret access  
✅ Test secret rotation procedures  
✅ Document rotation schedule  

### DON'T

❌ Commit `.env` files to version control  
❌ Share secrets via email or Slack  
❌ Reuse secrets across environments  
❌ Use default or weak passwords  
❌ Store secrets in application code  
❌ Log secrets (even in debug mode)  
❌ Store secrets in frontend code  
❌ Use the same SECRET_KEY across deployments  
❌ Skip secret rotation  
❌ Give broad access to production secrets  

---

## Troubleshooting

### Issue: "SECRET_KEY validation error"

**Error**:
```
ValueError: SECRET_KEY must be set to a secure random value (min 32 chars)
```

**Solution**:
```bash
# Generate a proper secret key
openssl rand -hex 32

# Add to .env file
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
```

---

### Issue: "Database connection failed"

**Possible Causes**:
1. Wrong DATABASE_URL format
2. Database not running
3. Network connectivity issues
4. Invalid credentials

**Solution**:
```bash
# Test database connection
psql "$DATABASE_URL"

# Check format
echo "$DATABASE_URL"
# Should be: postgresql://user:pass@host:port/db
```

---

### Issue: ".env file not loaded"

**Solution**:
```bash
# Verify file location
ls -la portfolio-backend/.env

# Check file permissions
chmod 600 portfolio-backend/.env

# Verify python-dotenv is installed
pip list | grep python-dotenv

# Test loading
python -c "from app.core.config import settings; print(settings.SECRET_KEY)"
```

---

## Compliance

This secrets management implementation addresses:

- **SOC 2**: Access control, encryption, audit logging
- **ISO 27001**: Information security management
- **GDPR**: Data protection, access control
- **HIPAA**: Administrative safeguards, technical safeguards
- **PCI DSS**: Key management, access control

---

## Conclusion

✅ **Phase 1.1 Complete**: Secrets Management & Configuration Security

The Portfolio Suite now has:

- 🔐 Comprehensive `.env.example` files for both backend and frontend
- 🛡️ No hardcoded secrets in codebase
- ✅ Environment variable validation on startup
- 📝 Complete documentation for secrets management
- 🔒 Proper `.gitignore` configuration
- 🔄 Secret rotation procedures
- 📊 Access control guidelines

**Security Score**: Production-ready secrets management

---

**Implementation Date**: October 23, 2025  
**Status**: ✅ COMPLETE  
**Next Phase**: Phase 1.3 - Frontend Token Storage Security

