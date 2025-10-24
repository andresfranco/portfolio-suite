# Deployment Configuration

This directory contains infrastructure and deployment configuration files for the Portfolio Suite.

## ⚠️  Important Security Notice

**DO NOT commit actual configuration files with real credentials, domains, or sensitive information to version control.**

All files in this directory with sensitive information should be:
1. Listed in `.gitignore`
2. Created from `.example` templates
3. Stored securely on deployment servers only

---

## 📁 Directory Structure

```
deployment/
├── nginx/                  # Nginx web server configuration
│   ├── nginx.conf.example  # Template configuration
│   └── nginx.conf          # Actual config (gitignored)
├── docker/                 # Docker and container configuration
│   ├── docker-compose.yml.example
│   ├── docker-compose.yml  # Actual config (gitignored)
│   └── Makefile            # Build automation
└── README.md               # This file
```

---

## 🚀 Quick Setup

### 1. Nginx Configuration

```bash
cd deployment/nginx

# Copy example and customize
cp nginx.conf.example nginx.conf

# Edit nginx.conf and replace ALL placeholders:
# - example.com → your actual domain
# - api.example.com → your API subdomain
# - SSL certificate paths
# - Backend/frontend server addresses
nano nginx.conf

# Test configuration
sudo nginx -t -c $(pwd)/nginx.conf

# Deploy (requires sudo)
sudo cp nginx.conf /etc/nginx/sites-available/portfolio-suite
sudo ln -s /etc/nginx/sites-available/portfolio-suite /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Docker Configuration

```bash
cd deployment/docker

# Copy example
cp docker-compose.yml.example docker-compose.yml

# Set environment variables in .env file (in backend directory)
# Never put credentials in docker-compose.yml directly!

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 📋 Configuration Checklist

### Nginx Setup

Before deploying nginx.conf, ensure you've replaced:

- [ ] `example.com` → Your actual domain
- [ ] `api.example.com` → Your API subdomain
- [ ] SSL certificate paths (`/etc/letsencrypt/live/...`)
- [ ] Backend upstream server address (default: `127.0.0.1:8000`)
- [ ] Frontend upstream server address (default: `127.0.0.1:3000`)
- [ ] Static file paths (`/var/www/portfolio/uploads/`)
- [ ] Log file paths (`/var/log/nginx/...`)

### Docker Setup

Before deploying docker-compose.yml, ensure:

- [ ] `DATABASE_URL` is set in `.env` (never in compose file)
- [ ] Volume paths point to correct directories
- [ ] Redis configuration matches your needs
- [ ] Resource limits are appropriate for your server
- [ ] All secrets are in `.env`, not in compose file

---

## 🔒 Security Best Practices

### DO ✅

- Use `.example` templates as starting points
- Store actual configs only on deployment servers
- Use environment variables for all secrets
- Review configs before deployment
- Test configurations before going live
- Keep backups of working configs (encrypted)
- Use strong SSL/TLS settings (TLS 1.3 only)
- Enable HSTS and security headers
- Set up rate limiting
- Review logs regularly

### DON'T ❌

- Commit actual `nginx.conf` to git
- Commit actual `docker-compose.yml` to git
- Put credentials in configuration files
- Disable security headers
- Use weak SSL/TLS settings
- Expose unnecessary ports
- Run services as root
- Ignore security warnings

---

## 📚 Related Documentation

- [SSL/TLS Setup Guide](../../maindocs/guides/SSL_TLS_SETUP_GUIDE.md)
- [Security Quick Reference](../../maindocs/security/SECURITY_QUICK_REFERENCE.md)
- [Incident Response Playbook](../../maindocs/guides/INCIDENT_RESPONSE_PLAYBOOK.md)
- [Backend Deployment Guide](../../portfolio-backend/DEPLOYMENT.md)

---

## 🛠️ Nginx Configuration Features

The provided `nginx.conf.example` includes:

### Security
- ✅ TLS 1.3 (with TLS 1.2 fallback option)
- ✅ Strong cipher suites
- ✅ HSTS with preloading
- ✅ OCSP stapling
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Server token hiding

### Performance
- ✅ HTTP/2 support
- ✅ Keepalive connections
- ✅ Static file caching
- ✅ Gzip compression ready

### Protection
- ✅ Rate limiting (general, API, auth endpoints)
- ✅ Connection limits
- ✅ Request timeouts
- ✅ Client body size limits
- ✅ DDoS mitigation

---

## 🐳 Docker Services

### Redis
- **Purpose**: Cache and message broker for Celery
- **Port**: 6379
- **Image**: redis:7-alpine
- **Usage**: Background task queue

### Celery Worker
- **Purpose**: Asynchronous task processing
- **Image**: python:3.12-slim
- **Dependencies**: Redis
- **Tasks**: Email sending, file processing, AI operations

---

## 🔧 Troubleshooting

### Nginx Issues

**Config test fails:**
```bash
sudo nginx -t
# Check error message and fix syntax errors
```

**Certificate errors:**
```bash
# Verify certificate files exist
sudo ls -la /etc/letsencrypt/live/your-domain.com/

# Renew Let's Encrypt certificates
sudo certbot renew
```

**502 Bad Gateway:**
```bash
# Check backend is running
curl http://localhost:8000/healthz

# Check nginx error logs
sudo tail -f /var/log/nginx/api_error.log
```

### Docker Issues

**Services won't start:**
```bash
# Check logs
docker-compose logs

# Check .env file exists
ls -la ../../portfolio-backend/.env

# Verify DATABASE_URL is set
docker-compose config
```

**Redis connection errors:**
```bash
# Test Redis
docker-compose exec redis redis-cli ping
# Should return "PONG"
```

---

## 📊 Monitoring

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/api_access.log
sudo tail -f /var/log/nginx/frontend_access.log

# Error logs
sudo tail -f /var/log/nginx/api_error.log
sudo tail -f /var/log/nginx/frontend_error.log

# Monitor rate limiting
sudo grep "limiting requests" /var/log/nginx/error.log
```

### Docker Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f celery_worker
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] SSL certificates obtained and installed
- [ ] DNS records configured
- [ ] Firewall rules configured (80, 443)
- [ ] All `.example` files copied and customized
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Static files deployed
- [ ] Nginx configuration tested
- [ ] Docker services tested
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Incident response plan reviewed

### Deployment Steps

1. **Setup SSL certificates:**
   ```bash
   sudo certbot certonly --nginx -d example.com -d www.example.com
   sudo certbot certonly --nginx -d api.example.com
   ```

2. **Deploy Nginx:**
   ```bash
   sudo cp deployment/nginx/nginx.conf /etc/nginx/sites-available/portfolio-suite
   sudo ln -s /etc/nginx/sites-available/portfolio-suite /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. **Start Docker services:**
   ```bash
   cd deployment/docker
   docker-compose up -d
   docker-compose ps  # Verify all services running
   ```

4. **Start application:**
   ```bash
   cd ../../portfolio-backend
   source venv/bin/activate
   python run.py  # Or use systemd/supervisor
   ```

5. **Verify deployment:**
   ```bash
   curl https://api.example.com/healthz
   curl https://example.com
   ```

---

## 🔄 Updates and Maintenance

### Nginx Updates

```bash
# Edit configuration
nano deployment/nginx/nginx.conf

# Test changes
sudo nginx -t -c deployment/nginx/nginx.conf

# Deploy
sudo cp deployment/nginx/nginx.conf /etc/nginx/sites-available/portfolio-suite
sudo nginx -t && sudo systemctl reload nginx
```

### Docker Updates

```bash
cd deployment/docker

# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d

# Verify
docker-compose ps
```

---

## 📝 Notes

- All paths in example files are placeholders - customize for your environment
- Test all configurations in staging before production
- Keep backups of working configurations
- Document any customizations
- Review security settings regularly
- Monitor logs for unusual activity

---

**Last Updated**: December 2024  
**Maintained by**: Portfolio Suite Team
