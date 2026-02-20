# Security Quick Reference Guide

**Quick reference for developers working with the secured Portfolio Suite**

## TL;DR

### Development Setup
```bash
# 1. Copy environment template
cp portfolio-backend/.env.example portfolio-backend/.env
cp backend-ui/.env.example backend-ui/.env

# 2. Set development mode (in .env)
ENVIRONMENT=development
DEBUG=True
LOG_LEVEL=DEBUG

# 3. Start application
cd portfolio-backend
uvicorn app.main:app --reload
```

### Production Deployment
```bash
# 1. Set production environment
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=$(openssl rand -hex 32)
LOG_LEVEL=WARNING
LOG_FORMAT=json
ALLOWED_HOSTS=api.your-domain.com
FRONTEND_ORIGINS=https://your-domain.com
DB_SSL_ENABLED=True
HSTS_ENABLED=True

# 2. Validate configuration fails on insecure settings
# 3. See DEPLOYMENT.md for full guide
```

## Environment Variables Cheat Sheet

### Required in All Environments
```bash
ENVIRONMENT=development|staging|production
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Security Critical (Production)
```bash
SECRET_KEY=<64-char-hex>              # openssl rand -hex 32
ALLOWED_HOSTS=api.your-domain.com     # No wildcards!
FRONTEND_ORIGINS=https://your-domain.com  # HTTPS only!
DEBUG=False                           # Enforced
```

### Optional but Recommended
```bash
LOG_LEVEL=WARNING                     # DEBUG|INFO|WARNING|ERROR
LOG_FORMAT=json                       # text|json
DB_SSL_ENABLED=True                   # Enable SSL
DB_SSL_MODE=verify-full               # SSL verification level
HSTS_ENABLED=True                     # Force HTTPS
```

## Common Tasks

### Generate Secrets
```bash
# SECRET_KEY (64 characters)
openssl rand -hex 32

# Database password
openssl rand -base64 32

# API key
openssl rand -hex 16
```

### Check Current Environment
```bash
# Python
from app.core.config import settings
print(f"Environment: {settings.ENVIRONMENT}")
print(f"Is Production: {settings.is_production()}")
print(f"Debug Mode: {settings.DEBUG}")

# Or via endpoint
curl http://localhost:8000/health
```

### View Logs

**Development** (detailed text):
```
2025-10-22 14:30:15 - app.main - DEBUG - [main.py:123] - User login successful
```

**Production** (JSON):
```json
{"timestamp":"2025-10-22T14:30:15Z","level":"WARNING","logger":"app.main","message":"Login failed"}
```

### Test Security Headers
```bash
# Development
curl -I http://localhost:8000

# Production
curl -I https://api.your-domain.com

# Look for:
# - Strict-Transport-Security
# - Content-Security-Policy
# - X-Content-Type-Options
# - X-Frame-Options
# - X-Request-ID
```

## Troubleshooting

### "SECRET_KEY must be set to a secure random value"
```bash
# Production requires strong SECRET_KEY
export SECRET_KEY=$(openssl rand -hex 32)
# Or in .env file
```

### "DEBUG must be False in production"
```bash
# In .env file
DEBUG=False
```

### "ALLOWED_HOSTS must be set to specific domains"
```bash
# Don't use wildcards in production
ALLOWED_HOSTS=api.your-domain.com,api2.your-domain.com
```

### CORS Errors in Production
```bash
# Check FRONTEND_ORIGINS includes your domain
FRONTEND_ORIGINS=https://your-domain.com

# Must be HTTPS in production (http://localhost is exception)
```

### Database SSL Connection Failed
```bash
# Check SSL mode
DB_SSL_ENABLED=True
DB_SSL_MODE=require  # Try 'require' before 'verify-full'

# For development, can disable
DB_SSL_ENABLED=False
```

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **DEBUG** | True | False (enforced) |
| **Log Level** | DEBUG | WARNING |
| **Log Format** | Text | JSON |
| **Errors** | Detailed | Generic |
| **CORS** | Permissive | Strict HTTPS |
| **HSTS** | Disabled | Enabled |
| **Secret Validation** | Lenient | Strict |
| **DB Timeout** | 60s | 30s |

## Security Checklist

### Before Committing
- [ ] No secrets in code
- [ ] No hardcoded passwords
- [ ] No `.env` file in git
- [ ] Sensitive data in `.gitignore`

### Before Deploying
- [ ] `ENVIRONMENT=production`
- [ ] Strong `SECRET_KEY` set
- [ ] `DEBUG=False`
- [ ] Specific `ALLOWED_HOSTS`
- [ ] HTTPS `FRONTEND_ORIGINS`
- [ ] `DB_SSL_ENABLED=True`
- [ ] Tested in staging

### After Deploying
- [ ] Check SSL Labs rating (A+ goal)
- [ ] Verify security headers present
- [ ] Test authentication
- [ ] Monitor logs for errors
- [ ] Verify database connection

## Common Patterns

### Reading Configuration
```python
from app.core.config import settings

# Check environment
if settings.is_production():
    # Production-specific logic
    pass
elif settings.is_development():
    # Development-specific logic
    pass

# Use settings
origins = settings.get_allowed_origins()
extensions = settings.get_allowed_extensions()
```

### Logging
```python
from app.core.logging import setup_logger

logger = setup_logger("my_module")

# Development: Shows all levels
logger.debug("Debug info")
logger.info("Info message")

# Production: Only WARNING and above
logger.warning("Warning message")
logger.error("Error message")
```

### Error Handling
```python
from fastapi import HTTPException

# Development: Detailed error
if settings.is_development():
    raise HTTPException(
        status_code=400,
        detail=f"Invalid value: {value}, expected: {expected}"
    )
else:
    # Production: Generic error
    raise HTTPException(
        status_code=400,
        detail="Invalid input"
    )
```

## Cookie-Based Auth (Optional)

### Setting Tokens
```python
from app.core.cookie_auth import set_auth_cookies

# In login endpoint
set_auth_cookies(
    response=response,
    access_token=token,
    refresh_token=refresh,
    access_token_expires=timedelta(minutes=30),
    refresh_token_expires=timedelta(days=7)
)
```

### Getting Tokens
```python
from app.core.cookie_auth import get_token_from_cookie

# In protected endpoint
token = get_token_from_cookie(request)
```

### Clearing Tokens (Logout)
```python
from app.core.cookie_auth import clear_auth_cookies

# In logout endpoint
clear_auth_cookies(response)
```

## Monitoring

### Health Check
```bash
# Basic health
curl https://api.your-domain.com/health

# Readiness (includes worker status)
curl https://api.your-domain.com/readyz

# Metrics (Prometheus format)
curl https://api.your-domain.com/metrics
```

### Log Locations
```bash
# Development
# Console output (stderr)

# Production
/var/log/portfolio/app.log          # Application logs
/var/log/portfolio/access.log       # Access logs
/var/log/portfolio/error.log        # Error logs
```

## File Structure

```
portfolio-backend/
├── .env.example              # Template (committed)
├── .env                      # Your config (gitignored)
├── SECURITY.md              # Security policy
├── DEPLOYMENT.md            # Deployment guide
├── app/
│   ├── core/
│   │   ├── config.py        # Configuration
│   │   ├── logging.py       # Logging setup
│   │   ├── database.py      # Database with SSL
│   │   └── cookie_auth.py   # Cookie auth utilities
│   └── middleware/
│       └── security_headers.py  # Security headers
```

## Resources

- **Security Policy**: `portfolio-backend/SECURITY.md`
- **Deployment Guide**: `portfolio-backend/DEPLOYMENT.md`  
- **Implementation Summary**: `SECURITY_IMPLEMENTATION_SUMMARY.md`
- **Full Security Plan**: `maindocs/security_improvements_plan.md`

## Support

- 🐛 **Issues**: Create GitHub issue
- 📧 **Security**: security@your-domain.com
- 📚 **Docs**: `/docs` endpoint when running

---

**Last Updated**: 2025-10-22  
**Version**: 1.0.0

