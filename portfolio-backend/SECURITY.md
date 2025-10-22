# Security Policy

## Overview

This document outlines the security measures implemented in the Portfolio Suite application and provides guidelines for secure deployment and operation.

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please report it by emailing security@your-domain.com. Do not create public GitHub issues for security vulnerabilities.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Features

### 1. Environment-Based Configuration

The application supports three environments with different security profiles:

#### Development
- DEBUG mode enabled
- Detailed error messages
- Permissive CORS
- Verbose logging
- Generated SECRET_KEY if not provided

#### Staging
- DEBUG mode disabled
- Limited error details
- Restricted CORS
- Standard logging
- Required SECRET_KEY validation

#### Production
- DEBUG mode MUST be disabled
- Generic error messages only
- Strict CORS with HTTPS enforcement
- Minimal logging (WARNING level)
- Strong SECRET_KEY validation (min 32 chars)
- Security headers enforced

### 2. Authentication & Authorization

#### JWT Token Security
- **Algorithm**: HS256 (symmetric) - Consider RS256 for multi-service architecture
- **Access Token**: 30 minutes (configurable)
- **Refresh Token**: 7 days (configurable)
- **Token Storage**: 
  - Current: localStorage (development)
  - Recommended: httpOnly cookies (production)

#### Password Security
- Passwords hashed using bcrypt/argon2
- Minimum password requirements enforced
- Password history tracking (prevents reuse)
- Account lockout after failed attempts

### 3. HTTP Security Headers

All responses include the following security headers:

- **Strict-Transport-Security (HSTS)**: Forces HTTPS (production only)
  ```
  max-age=31536000; includeSubDomains; preload
  ```

- **Content-Security-Policy (CSP)**: Prevents XSS and code injection
  - Production: Strict policy, no unsafe-inline/eval
  - Development: Permissive for hot-reload

- **X-Content-Type-Options**: Prevents MIME sniffing
  ```
  nosniff
  ```

- **X-Frame-Options**: Prevents clickjacking
  ```
  DENY (production) | SAMEORIGIN (development)
  ```

- **X-XSS-Protection**: Browser XSS protection
  ```
  1; mode=block
  ```

- **Referrer-Policy**: Controls referrer information
  ```
  strict-origin-when-cross-origin
  ```

- **Permissions-Policy**: Restricts browser features
  ```
  geolocation=(), microphone=(), camera=(), payment=()
  ```

### 4. CORS (Cross-Origin Resource Sharing)

#### Production
- Explicit origin whitelist (HTTPS only)
- Specific methods: GET, POST, PUT, DELETE, PATCH
- Specific headers: Content-Type, Authorization, X-Request-ID
- Credentials allowed
- 1-hour preflight cache

#### Development
- Localhost origins allowed (HTTP)
- All methods allowed
- All headers allowed

### 5. Database Security

- **Connection Pooling**: Configured limits to prevent exhaustion
  - Pool size: 20 connections
  - Max overflow: 0 (no unlimited connections)
  - Pool timeout: 30 seconds
  - Connection recycling: 1 hour

- **SSL/TLS Encryption**: 
  - Configurable per environment
  - Modes: disable, allow, prefer, require, verify-ca, verify-full
  - Production: verify-ca or verify-full recommended

- **Query Security**:
  - Parameterized queries only (SQLAlchemy ORM)
  - Statement timeout: 30s (prod) / 60s (dev)
  - UTC timezone enforced

### 6. Logging & Monitoring

#### Development
- Log level: DEBUG
- Format: Detailed text with file/line numbers
- SQL logging: Optional
- All details included

#### Production
- Log level: WARNING
- Format: Structured JSON
- SQL logging: Disabled (errors only)
- Sensitive data sanitized
- Request IDs for correlation

### 7. Error Handling

#### Development
- Detailed error messages
- Stack traces included
- Exception types exposed
- Validation error details

#### Production
- Generic error messages
- No stack traces
- No internal details leaked
- Request ID for support
- Error codes for client handling

## Configuration Checklist

### Pre-Production Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=False`
- [ ] Generate strong `SECRET_KEY` (min 32 chars): `openssl rand -hex 32`
- [ ] Configure specific `ALLOWED_HOSTS` (no wildcards)
- [ ] Set `FRONTEND_ORIGINS` to HTTPS URLs only
- [ ] Enable `HSTS_ENABLED=True`
- [ ] Enable `DB_SSL_ENABLED=True` with `DB_SSL_MODE=verify-ca` or `verify-full`
- [ ] Configure SSL certificates
- [ ] Set `LOG_LEVEL=WARNING`
- [ ] Set `LOG_FORMAT=json`
- [ ] Configure SMTP for notifications
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting
- [ ] Review and update `.env.example`

### Production Deployment

1. **Environment Variables**
   ```bash
   ENVIRONMENT=production
   DEBUG=False
   SECRET_KEY=<generated-64-char-hex>
   ALLOWED_HOSTS=api.your-domain.com
   FRONTEND_ORIGINS=https://your-domain.com
   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=verify-full
   DB_SSL_ENABLED=True
   DB_SSL_MODE=verify-full
   HSTS_ENABLED=True
   LOG_LEVEL=WARNING
   LOG_FORMAT=json
   ```

2. **Database Setup**
   - Enable SSL/TLS
   - Configure connection limits
   - Set up automated backups
   - Enable audit logging
   - Configure row-level security if needed

3. **Web Server**
   - Use Gunicorn/uvicorn with multiple workers
   - Configure reverse proxy (nginx/Apache)
   - Enable HTTPS with valid certificates
   - Configure rate limiting
   - Set up WAF if available

4. **Monitoring**
   - Configure application monitoring
   - Set up error tracking (Sentry)
   - Enable security event logging
   - Configure alerting for anomalies

## Security Best Practices

### For Developers

1. **Never commit secrets**
   - Use `.env` files (gitignored)
   - Use `.env.example` for templates
   - Use secrets management tools in production

2. **Input Validation**
   - Validate all inputs using Pydantic schemas
   - Sanitize HTML/rich text
   - Validate file uploads
   - Use parameterized queries

3. **Authentication**
   - Never store passwords in plain text
   - Use httpOnly cookies for tokens
   - Implement token refresh rotation
   - Add CSRF protection for cookies

4. **Error Handling**
   - Never expose internal errors to clients
   - Log all errors server-side
   - Use generic messages in production
   - Include request IDs for debugging

5. **Dependencies**
   - Keep dependencies updated
   - Run security scanners (Snyk, Dependabot)
   - Review dependency licenses
   - Pin dependency versions

### For Operators

1. **Network Security**
   - Use HTTPS everywhere
   - Configure firewalls
   - Limit database access
   - Use VPCs/private networks

2. **Access Control**
   - Use least privilege principle
   - Rotate credentials regularly
   - Enable MFA for admin access
   - Review access logs

3. **Backup & Recovery**
   - Automated encrypted backups
   - Test recovery procedures
   - Maintain offline backups
   - Document RTO/RPO

4. **Monitoring**
   - Monitor failed login attempts
   - Track API usage patterns
   - Alert on anomalies
   - Regular security audits

## Compliance

This security implementation addresses requirements for:

- **GDPR**: Data protection, privacy rights, breach notification
- **SOC 2**: Access controls, audit logging, encryption
- **HIPAA** (if applicable): Encryption, audit controls, access logging
- **PCI DSS** (if applicable): Network security, encryption, monitoring

## Security Roadmap

### Phase 1 (Current)
- ✅ Environment-based configuration
- ✅ HTTP security headers
- ✅ Enhanced logging
- ✅ Database SSL support
- ✅ CORS hardening

### Phase 2 (Planned)
- [ ] Multi-factor authentication (MFA)
- [ ] Token blacklisting/revocation
- [ ] Account lockout policies
- [ ] Password complexity requirements
- [ ] Session management

### Phase 3 (Future)
- [ ] Rate limiting with Redis
- [ ] Web Application Firewall (WAF)
- [ ] Intrusion detection
- [ ] Automated security scanning
- [ ] Penetration testing

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)

## Contact

For security concerns or questions:
- Email: security@your-domain.com
- Security Team: [Your Team]

---

Last Updated: 2025-10-22
Version: 1.0.0

