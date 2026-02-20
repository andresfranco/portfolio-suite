# Portfolio Suite

A full-stack web application suite with enterprise-grade security, AI-powered features, and comprehensive admin capabilities.

[![Security: 100%](https://img.shields.io/badge/Security-100%25-brightgreen)](./maindocs/security/SECURITY_COMPLETE.md)
[![Tests: Passing](https://img.shields.io/badge/Tests-Passing-brightgreen)](./maindocs/tests/SECURITY_FEATURES_TEST_REPORT.md)
[![GDPR: Compliant](https://img.shields.io/badge/GDPR-Compliant-blue)](./maindocs/security/GDPR_IMPLEMENTATION_SUMMARY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🏗️ Architecture

### Technology Stack

**Backend** (`portfolio-backend/`):
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15+ with asyncpg
- **ORM**: SQLAlchemy 2.x (async)
- **Migrations**: Alembic
- **Authentication**: JWT (HS256/RS256) with MFA support
- **Security**: ClamAV, rate limiting, input validation
- **Testing**: pytest, httpx, Testcontainers

**Frontend - Admin UI** (`backend-ui/`):
- **Framework**: React 19
- **Language**: JavaScript/TypeScript
- **State**: TanStack Query, Context API
- **Routing**: React Router 6+
- **Forms**: React Hook Form + Zod
- **Styling**: Tailwind CSS / Material-UI
- **Testing**: Vitest + React Testing Library

**Frontend - Public Website** (`website/`):
- **Framework**: React/Next.js
- **Purpose**: Public-facing portfolio website

**Infrastructure**:
- **Web Server**: Nginx (TLS 1.3, HTTP/2)
- **CI/CD**: GitHub Actions
- **Security Scanning**: OWASP ZAP, Bandit, Safety, CodeQL
- **Containerization**: Docker (optional)

---

## 🔐 Security Features

### 🎯 100% Security Implementation Complete

The Portfolio Suite implements enterprise-grade security controls across all layers:

#### Authentication & Authorization
- ✅ JWT-based authentication (HS256/RS256 asymmetric signing)
- ✅ Multi-factor authentication (TOTP-based 2FA)
- ✅ Role-based access control (RBAC)
- ✅ Secure password hashing (bcrypt)
- ✅ HTTP-only secure cookies
- ✅ Account lockout after failed attempts
- ✅ Password strength requirements

#### Data Protection
- ✅ TLS 1.3 encryption
- ✅ Input validation and sanitization
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ File upload scanning (ClamAV)
- ✅ GDPR compliance (data export, erasure, consent)

#### Infrastructure Security
- ✅ Security headers (HSTS, CSP, X-Frame-Options, etc.)
- ✅ Rate limiting (per-endpoint configuration)
- ✅ CORS protection
- ✅ OCSP stapling
- ✅ CI/CD security gates
- ✅ Automated vulnerability scanning (SAST/DAST)

#### Monitoring & Response
- ✅ Comprehensive audit logging
- ✅ Security metrics dashboard
- ✅ Failed login tracking
- ✅ Real-time security monitoring
- ✅ Incident response procedures

**📖 Full Security Documentation**: [`maindocs/security/SECURITY_COMPLETE.md`](./maindocs/security/SECURITY_COMPLETE.md)

---

## 🚀 Quick Start

### Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18.x or higher
- **PostgreSQL**: 15 or higher
- **Git**: Latest version

### 1. Clone the Repository

```bash
git clone https://github.com/andresfranco/portfolio-suite.git
cd portfolio-suite
```

### 2. Backend Setup

```bash
cd portfolio-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration (database URL, secret key, etc.)

# Run database migrations
alembic upgrade head

# Create admin user
python create_admin.py

# Start the development server
python run.py
```

Backend will be available at `http://localhost:8000`

**API Documentation**: `http://localhost:8000/docs` (Swagger UI)

### 3. Frontend (Admin UI) Setup

```bash
cd backend-ui

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with backend API URL

# Start development server
npm start
```

Admin UI will be available at `http://localhost:3000`

### 4. (Optional) Public Website Setup

```bash
cd website

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📁 Project Structure

```
portfolio-suite/
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── deployment-gate.yml # Pre-deployment security checks
│       ├── security-scan.yml   # Continuous security scanning
│       └── dast.yml            # OWASP ZAP dynamic testing
├── backend-ui/                 # React admin frontend
│   ├── src/
│   │   ├── api/                # API client
│   │   ├── features/           # Feature modules
│   │   │   ├── auth/           # Authentication
│   │   │   ├── mfa/            # Multi-factor auth
│   │   │   ├── security-dashboard/ # Security metrics
│   │   │   └── gdpr/           # GDPR compliance
│   │   ├── components/         # Shared components
│   │   └── lib/                # Utilities
│   └── package.json
├── portfolio-backend/          # FastAPI backend
│   ├── alembic/                # Database migrations
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/      # API routes
│   │   │   │   ├── auth.py     # Authentication
│   │   │   │   ├── mfa.py      # MFA endpoints
│   │   │   │   ├── gdpr.py     # GDPR endpoints
│   │   │   │   └── security_audit.py # Security logs
│   │   │   └── deps.py         # Dependencies
│   │   ├── core/               # Core functionality
│   │   │   ├── config.py       # Configuration
│   │   │   ├── security.py     # Security utilities
│   │   │   ├── validation.py   # Input validation
│   │   │   └── file_security.py # File scanning
│   │   ├── db/
│   │   │   ├── models/         # SQLAlchemy models
│   │   │   ├── database.py     # DB connection
│   │   │   └── repositories/   # Data access layer
│   │   └── schemas/            # Pydantic schemas
│   ├── scripts/                # Utility scripts
│   │   └── generate_rsa_keys.py # RSA key generation
│   ├── tests/                  # Test suite
│   ├── requirements.txt
│   └── run.py
├── website/                    # Public-facing website
├── deployment/                 # Infrastructure & deployment configs
│   ├── nginx/                  # Nginx configuration
│   │   ├── nginx.conf.example  # Template (commit this)
│   │   └── nginx.conf          # Actual config (gitignored)
│   ├── docker/                 # Docker configuration
│   │   ├── docker-compose.yml.example
│   │   ├── docker-compose.yml  # Actual config (gitignored)
│   │   └── Makefile
│   └── README.md               # Deployment guide
├── scripts/                    # Utility scripts
│   ├── database/               # Database management
│   │   ├── check_columns.py
│   │   ├── create_project_categories.sql
│   │   └── fix_admindb_permissions.sql
│   ├── tests/                  # Test scripts
│   │   ├── test_security.sh
│   │   ├── test_login_security.py
│   │   └── run_tests.sh
│   └── README.md               # Scripts documentation
├── maindocs/                   # Documentation
│   ├── security/               # Security documentation
│   │   ├── SECURITY_COMPLETE.md # Consolidated security docs
│   │   ├── SECURITY_QUICK_REFERENCE.md
│   │   ├── SECURITY_IMPLEMENTATION_AUDIT.md
│   │   ├── INPUT_VALIDATION_SUMMARY.md
│   │   └── GDPR_IMPLEMENTATION_SUMMARY.md
│   ├── guides/                 # Implementation guides
│   │   ├── SSL_TLS_SETUP_GUIDE.md
│   │   ├── INCIDENT_RESPONSE_PLAYBOOK.md
│   │   ├── MFA_QUICK_START.md
│   │   ├── TESTING_QUICK_REFERENCE.md
│   │   └── SECRETS_MANAGEMENT.md
│   ├── tests/                  # Test documentation
│   │   ├── SECURITY_FEATURES_TEST_REPORT.md
│   │   ├── test_nginx_config.py
│   │   └── test_workflows.py
│   ├── architecture/           # Architecture docs
│   └── archived/               # Historical documents
├── .gitignore                  # Git ignore rules (protects sensitive files)
└── README.md                   # This file
```

---

## 🛠️ Development

### Running Tests

**Backend Tests**:
```bash
cd portfolio-backend
source venv/bin/activate
pytest tests/ -v
```

**Frontend Tests**:
```bash
cd backend-ui
npm test
```

**Security Tests**:
```bash
# RS256 JWT implementation
cd portfolio-backend
source venv/bin/activate
python scripts/generate_rsa_keys.py

# Nginx configuration validation
cd maindocs/tests
python test_nginx_config.py

# CI/CD workflow validation
python test_workflows.py
```

### Code Quality

**Backend**:
```bash
# Linting
ruff check app/
black app/ --check
isort app/ --check-only

# Type checking
mypy app/

# Security scanning
bandit -r app/ -ll
safety check
```

**Frontend**:
```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit
```

### Database Migrations

```bash
cd portfolio-backend

# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

---

## 🔒 Security Setup

### 1. Generate RS256 Keys (Recommended for Production)

```bash
cd portfolio-backend
python scripts/generate_rsa_keys.py --key-size 4096

# Move keys to secure location
sudo mkdir -p /etc/portfolio/keys
sudo mv private_key.pem /etc/portfolio/keys/
sudo mv public_key.pem /etc/portfolio/keys/
sudo chmod 600 /etc/portfolio/keys/private_key.pem
sudo chmod 644 /etc/portfolio/keys/public_key.pem
```

Update `.env`:
```bash
ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/etc/portfolio/keys/private_key.pem
JWT_PUBLIC_KEY_PATH=/etc/portfolio/keys/public_key.pem
```

### 2. Configure HTTPS

Follow the [SSL/TLS Setup Guide](./maindocs/guides/SSL_TLS_SETUP_GUIDE.md):

1. Install Certbot (Let's Encrypt)
2. Obtain SSL certificates
3. Copy and customize nginx configuration:
   ```bash
   cp deployment/nginx/nginx.conf.example deployment/nginx/nginx.conf
   # Edit nginx.conf with your domains and paths
   ```
4. Deploy nginx configuration
5. Test with SSL Labs (target: A+ rating)
6. Enable HSTS preloading

**See**: [Deployment Guide](./deployment/README.md) for detailed instructions

### 3. Setup MFA

See [MFA Quick Start Guide](./maindocs/guides/MFA_QUICK_START.md):

1. Login to the application
2. Navigate to Settings > Security
3. Enable Two-Factor Authentication
4. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
5. Save backup codes securely
6. Verify with 6-digit code

### 4. Configure File Scanning

ClamAV setup is documented in `portfolio-backend/CLAMAV_DEPLOYMENT_GUIDE.md`

---

## 📊 Monitoring & Observability

### Security Dashboard

Access at: `/admin/security` (requires admin role)

**Metrics Available**:
- Failed login attempts (last 24h)
- Active MFA users
- Recent security events
- System health indicators

### Audit Logging

All security events are logged to the `security_logs` table:
- Login attempts (success/failure)
- MFA verification attempts
- Password changes
- Role changes
- Data access (GDPR requests)

Query logs:
```sql
SELECT * FROM security_logs 
WHERE event_type = 'login_failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Health Checks

- **Backend**: `GET /api/v1/health`
- **Database**: `GET /api/v1/health/db`

---

## 🚢 Deployment

### Production Checklist

- [ ] Generate fresh RS256 keys (4096-bit)
- [ ] Set strong `SECRET_KEY` (32+ random characters)
- [ ] Configure PostgreSQL with SSL
- [ ] Obtain SSL certificates (Let's Encrypt)
- [ ] Configure nginx with TLS 1.3
- [ ] Enable HSTS preloading
- [ ] Setup ClamAV for file scanning
- [ ] Configure rate limiting
- [ ] Enable security audit logging
- [ ] Setup backup procedures
- [ ] Configure monitoring/alerting
- [ ] Review incident response playbook
- [ ] Run security tests
- [ ] Perform penetration testing
- [ ] Enable CI/CD security gates

### Environment Variables

**Backend (`.env`)**:
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname

# Security
SECRET_KEY=<generate-strong-random-key>
ALGORITHM=RS256  # or HS256
JWT_PRIVATE_KEY_PATH=/path/to/private_key.pem  # if RS256
JWT_PUBLIC_KEY_PATH=/path/to/public_key.pem    # if RS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# CORS
FRONTEND_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# File Security (ClamAV)
CLAMAV_ENABLED=true
CLAMAV_SOCKET_PATH=/var/run/clamav/clamd.ctl

# Environment
ENVIRONMENT=production
DEBUG=false
```

**Frontend (`.env`)**:
```bash
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENABLE_MFA=true
```

---

## 📚 Documentation

### For Developers
- [Security Complete Guide](./maindocs/security/SECURITY_COMPLETE.md) - Comprehensive security documentation
- [Testing Quick Reference](./maindocs/guides/TESTING_QUICK_REFERENCE.md) - How to run tests
- [Backend README](./portfolio-backend/README.md) - Backend-specific docs
- [Frontend README](./backend-ui/README.md) - Frontend-specific docs

### For System Administrators
- [SSL/TLS Setup Guide](./maindocs/guides/SSL_TLS_SETUP_GUIDE.md) - HTTPS deployment
- [Incident Response Playbook](./maindocs/guides/INCIDENT_RESPONSE_PLAYBOOK.md) - Security incident procedures
- [Secrets Management](./maindocs/guides/SECRETS_MANAGEMENT.md) - Handling sensitive data

### For Security Teams
- [Security Implementation Audit](./maindocs/security/SECURITY_IMPLEMENTATION_AUDIT.md) - Implementation review
- [Security Quick Reference](./maindocs/security/SECURITY_QUICK_REFERENCE.md) - Quick commands
- [Test Report](./maindocs/tests/SECURITY_FEATURES_TEST_REPORT.md) - Security testing results

---

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **Python**: Follow PEP 8, use type hints, document with docstrings
- **JavaScript/TypeScript**: Follow ESLint rules, use TypeScript strict mode
- **Commits**: Use conventional commits format
- **Tests**: Maintain >85% code coverage

### Security Contributions

For security-related contributions:
1. Review [Security Complete Guide](./maindocs/security/SECURITY_COMPLETE.md)
2. Run security tests before submitting
3. Document security implications
4. Consider OWASP Top 10 and GDPR compliance

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

### Getting Help

- **Documentation**: Check `maindocs/` directory
- **Issues**: Open a GitHub issue
- **Security**: Email security@yourdomain.com (do not open public issues for security vulnerabilities)

### Reporting Security Vulnerabilities

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead:
1. Email security@yourdomain.com with details
2. Include steps to reproduce
3. Allow 48 hours for initial response
4. Follow responsible disclosure guidelines

---

## 🎯 Roadmap

### Planned Features

- [ ] OAuth2 integration (Google, GitHub, etc.)
- [ ] WebAuthn/FIDO2 support
- [ ] GraphQL API
- [ ] Real-time notifications (WebSocket)
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant support
- [ ] API rate limiting per user
- [ ] Automated security scanning in CI/CD
- [ ] Container orchestration (Kubernetes)
- [ ] Distributed tracing (OpenTelemetry)

### Recently Completed ✅

- ✅ RS256 asymmetric JWT signing
- ✅ CI/CD deployment security gates
- ✅ DAST scanning with OWASP ZAP
- ✅ Cookie-based authentication
- ✅ Comprehensive security testing
- ✅ Incident response playbook
- ✅ Documentation reorganization

---

## 📊 Project Stats

- **Backend**: ~15,000 lines of Python code
- **Frontend**: ~20,000 lines of JavaScript/React code
- **Documentation**: 25+ comprehensive guides
- **Security Features**: 40+ implemented controls
- **Test Coverage**: >85% (backend), >80% (frontend)
- **Security Tests**: 20/20 passing
- **Compliance**: OWASP Top 10, GDPR, NIST CSF

---

## 🙏 Acknowledgments

- FastAPI team for the excellent framework
- React team for React 19
- OWASP for security guidelines
- Let's Encrypt for free SSL certificates
- The open-source community

---

**Built with ❤️ by the Portfolio Suite Team**

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Status**: Production Ready ✅