# Production Deployment Guide

This guide provides step-by-step instructions for securely deploying the Portfolio Suite to production.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Web Server Configuration](#web-server-configuration)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Post-Deployment Verification](#post-deployment-verification)

## Pre-Deployment Checklist

### Required

- [ ] Production server provisioned
- [ ] PostgreSQL database set up
- [ ] SSL/TLS certificates obtained
- [ ] Domain name configured
- [ ] SMTP server configured
- [ ] Backup storage configured
- [ ] Monitoring tools set up

### Security

- [ ] Strong SECRET_KEY generated
- [ ] Database credentials secured
- [ ] Firewall rules configured
- [ ] SSH access secured
- [ ] Secrets manager configured (optional but recommended)

## Environment Configuration

### 1. Generate Secrets

```bash
# Generate SECRET_KEY (64 characters recommended)
openssl rand -hex 32

# Generate database password
openssl rand -base64 32

# Generate API keys as needed
openssl rand -hex 16
```

### 2. Create Production .env File

Copy `.env.example` to `.env` and configure:

```bash
# Application Environment
ENVIRONMENT=production
DEBUG=False
LOG_LEVEL=WARNING
LOG_FORMAT=json

# Security
SECRET_KEY=<your-generated-64-char-hex-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_MINUTES=10080

# Hosts & CORS
ALLOWED_HOSTS=api.your-domain.com
FRONTEND_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Database (with SSL)
DATABASE_URL=postgresql://username:password@db-host:5432/portfolio_prod?sslmode=verify-full
DB_SSL_ENABLED=True
DB_SSL_MODE=verify-full
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=0

# SMTP
SMTP_HOST=<SMTP_HOSTNAME>
SMTP_PORT=<SMTP_PORT>
SMTP_USER=your-email@your-domain.com
SMTP_PASSWORD=<app-specific-password>
SMTP_TLS=True
SMTP_FROM_EMAIL=noreply@your-domain.com

# Security Headers
HSTS_ENABLED=True
HSTS_MAX_AGE=31536000
CSP_ENABLED=True

# Rate Limiting (if using Redis)
RATE_LIMIT_ENABLED=True
REDIS_URL=redis://redis-host:6379/0

# File Uploads
MAX_UPLOAD_SIZE=10485760
UPLOADS_DIR=/var/www/portfolio/uploads

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### 3. Set File Permissions

```bash
# Secure the .env file
chmod 600 .env
chown www-data:www-data .env

# Secure the uploads directory
mkdir -p /var/www/portfolio/uploads
chmod 750 /var/www/portfolio/uploads
chown www-data:www-data /var/www/portfolio/uploads
```

## Database Setup

### 1. Create Production Database

```sql
-- Create database
CREATE DATABASE portfolio_prod;

-- Create user with strong password
CREATE USER portfolio_user WITH ENCRYPTED PASSWORD 'your-strong-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE portfolio_prod TO portfolio_user;

-- Enable required extensions
\c portfolio_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- if using vector embeddings
```

### 2. Enable SSL

Edit `postgresql.conf`:

```conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
ssl_ca_file = '/path/to/root.crt'
```

Edit `pg_hba.conf`:

```conf
# Require SSL for all connections
hostssl all all 0.0.0.0/0 md5
```

### 3. Run Migrations

```bash
# Install dependencies
pip install -r requirements.txt

# Run Alembic migrations
alembic upgrade head
```

### 4. Create Initial Admin User

```bash
# Run the initial setup script
python scripts/create_admin.py
```

## Application Deployment

### Option 1: Using Systemd (Recommended)

Create `/etc/systemd/system/portfolio-api.service`:

```ini
[Unit]
Description=Portfolio API
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/var/www/portfolio
Environment="PATH=/var/www/portfolio/venv/bin"
EnvironmentFile=/var/www/portfolio/.env
ExecStart=/var/www/portfolio/venv/bin/gunicorn \
    -k uvicorn.workers.UvicornWorker \
    -w 4 \
    -b 127.0.0.1:8000 \
    --access-logfile /var/log/portfolio/access.log \
    --error-logfile /var/log/portfolio/error.log \
    --log-level warning \
    app.main:app

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable portfolio-api
sudo systemctl start portfolio-api
sudo systemctl status portfolio-api
```

### Option 2: Using Docker

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - ENVIRONMENT=production
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads:rw
      - ./logs:/app/logs:rw
    restart: always
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: portfolio_prod
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./ssl:/var/lib/postgresql/ssl:ro
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: always

volumes:
  postgres_data:
```

Deploy:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Web Server Configuration

### Nginx Configuration

Create `/etc/nginx/sites-available/portfolio`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Upstream
upstream portfolio_api {
    server 127.0.0.1:8000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers (belt-and-suspenders with FastAPI middleware)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/portfolio-access.log;
    error_log /var/log/nginx/portfolio-error.log;

    # Request size limits
    client_max_body_size 10M;
    client_body_timeout 60s;

    # Root location
    location / {
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;

        # Proxy settings
        proxy_pass http://portfolio_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files (uploads)
    location /uploads {
        alias /var/www/portfolio/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://portfolio_api;
        access_log off;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoring & Logging

### 1. Application Logs

Configure log rotation `/etc/logrotate.d/portfolio`:

```
/var/log/portfolio/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload portfolio-api > /dev/null 2>&1 || true
    endscript
}
```

### 2. Monitoring Setup

#### Prometheus Metrics

The application exposes metrics at `/metrics`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'portfolio-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
```

#### Health Checks

Set up automated health checks:

```bash
# Add to crontab
*/5 * * * * curl -f https://api.your-domain.com/health || echo "API down" | mail -s "Alert: API Down" admin@your-domain.com
```

## Backup & Recovery

### 1. Database Backups

Create backup script `/opt/scripts/backup-db.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/portfolio"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="portfolio_prod"
DB_USER="portfolio_user"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Encrypt backup
gpg --encrypt --recipient backup@your-domain.com $BACKUP_DIR/db_backup_$DATE.sql.gz

# Remove unencrypted backup
rm $BACKUP_DIR/db_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "*.gpg" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz.gpg s3://your-backup-bucket/
```

Add to crontab:

```bash
0 2 * * * /opt/scripts/backup-db.sh
```

### 2. Application Backups

```bash
# Backup uploads directory
tar -czf /var/backups/portfolio/uploads_$(date +%Y%m%d).tar.gz /var/www/portfolio/uploads

# Backup configuration
tar -czf /var/backups/portfolio/config_$(date +%Y%m%d).tar.gz /var/www/portfolio/.env /etc/systemd/system/portfolio-api.service
```

## Post-Deployment Verification

### 1. Security Checks

```bash
# Check SSL certificate
openssl s_client -connect api.your-domain.com:443 -servername api.your-domain.com

# Test SSL Labs
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.your-domain.com

# Check security headers
curl -I https://api.your-domain.com
```

### 2. Functionality Tests

```bash
# Health check
curl https://api.your-domain.com/health

# Authentication
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=yourpassword"

# Protected endpoint
curl https://api.your-domain.com/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Performance Tests

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://api.your-domain.com/health

# Or use hey
hey -n 1000 -c 10 https://api.your-domain.com/health
```

## Maintenance

### Regular Tasks

- [ ] Review logs weekly
- [ ] Check for dependency updates monthly
- [ ] Rotate SSL certificates before expiry
- [ ] Test backup restoration quarterly
- [ ] Review and update firewall rules
- [ ] Monitor disk space and database size
- [ ] Review access logs for anomalies

### Emergency Procedures

1. **Application Down**: Check systemd status, review logs, restart service
2. **Database Issues**: Check connections, disk space, restart database
3. **High Load**: Scale workers, check for DDoS, enable rate limiting
4. **Security Incident**: Review logs, rotate secrets, notify users

## Rollback Procedure

```bash
# Stop the service
sudo systemctl stop portfolio-api

# Restore previous version
cd /var/www/portfolio
git checkout <previous-version-tag>

# Restore database (if needed)
gunzip < /var/backups/portfolio/db_backup_<timestamp>.sql.gz | psql -U portfolio_user portfolio_prod

# Restart service
sudo systemctl start portfolio-api
```

## Support

For deployment issues:
- Documentation: `/docs`
- Logs: `/var/log/portfolio/`
- Support: support@your-domain.com

---

Last Updated: 2025-10-22

