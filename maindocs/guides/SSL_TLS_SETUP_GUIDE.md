# SSL/TLS Setup Guide for Production Deployment

## Overview

This guide provides step-by-step instructions for setting up HTTPS/TLS for the Portfolio Suite in production with:
- TLS 1.3 with strong cipher suites
- Let's Encrypt SSL certificates
- HSTS preloading
- A+ SSL Labs rating

## Prerequisites

- Ubuntu/Debian server with sudo access
- Domain name pointed to your server IP
- Nginx installed
- Ports 80 and 443 open in firewall

## Step 1: Install Certbot (Let's Encrypt Client)

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

## Step 2: Obtain SSL Certificate

### For Single Domain:
```bash
sudo certbot certonly --nginx \
  -d your-domain.com \
  -d www.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

### For API Subdomain:
```bash
sudo certbot certonly --nginx \
  -d api.your-domain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

### Certificates will be stored at:
```
/etc/letsencrypt/live/your-domain.com/fullchain.pem
/etc/letsencrypt/live/your-domain.com/privkey.pem
/etc/letsencrypt/live/your-domain.com/chain.pem
```

## Step 3: Configure Nginx

```bash
# Copy the nginx.conf to Nginx sites directory
sudo cp nginx.conf /etc/nginx/sites-available/portfolio

# Update domain names in the config
sudo nano /etc/nginx/sites-available/portfolio
# Replace:
# - your-domain.com with your actual domain
# - api.your-domain.com with your API subdomain

# Enable the site
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

## Step 4: Configure Automatic Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Test renewal process (dry run)
sudo certbot renew --dry-run

# Certbot automatically creates a systemd timer for renewal
# Verify it's active:
sudo systemctl status certbot.timer

# Manual renewal (if needed)
sudo certbot renew

# Add post-renewal hook to reload Nginx
echo '#!/bin/bash
systemctl reload nginx
' | sudo tee /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
```

## Step 5: Test SSL Configuration

### A. Use SSL Labs Test

Visit: https://www.ssllabs.com/ssltest/

Enter your domain and run the test. You should get an **A+ rating** with:
- TLS 1.3 support
- Strong cipher suites
- HSTS enabled
- Certificate chain valid

### B. Use Command Line Tools

```bash
# Test TLS 1.3
openssl s_client -connect your-domain.com:443 -tls1_3

# Check certificate expiration
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Verify HSTS header
curl -I https://your-domain.com | grep -i strict-transport-security

# Check all security headers
curl -I https://your-domain.com
```

### C. Expected Security Headers

Your response should include:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: ...
Permissions-Policy: ...
```

## Step 6: Enable HSTS Preloading (Optional but Recommended)

### 1. Ensure HSTS header is set (already in nginx.conf)
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### 2. Submit to HSTS Preload List

Visit: https://hstspreload.org/

Enter your domain and submit for inclusion in browsers' HSTS preload lists.

**Requirements:**
- Serve valid certificate
- Redirect HTTP to HTTPS (port 80 → 443)
- Serve HSTS header on all requests
- `max-age` at least 31536000 seconds (1 year)
- Include `includeSubDomains` directive
- Include `preload` directive

**Warning:** This is semi-permanent. Removal can take months. Only enable if you're committed to HTTPS forever.

## Step 7: Configure Application for HTTPS

### Backend (.env)
```bash
# Update backend environment
ENVIRONMENT=production
DEBUG=False
ALLOWED_HOSTS=api.your-domain.com
HSTS_ENABLED=True
HSTS_MAX_AGE=31536000

# Update CORS origins
FRONTEND_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Frontend (.env)
```bash
# Update frontend environment
REACT_APP_SERVER_HOSTNAME=api.your-domain.com
REACT_APP_API_URL=https://api.your-domain.com
```

## Step 8: Firewall Configuration

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Allow HTTP (for cert renewal and redirect)
sudo ufw allow 80/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 9: Monitoring and Maintenance

### Certificate Expiration Monitoring

Create a monitoring script:

```bash
#!/bin/bash
# /usr/local/bin/check-ssl-expiry.sh

DOMAIN="your-domain.com"
THRESHOLD=30  # Alert if expires in less than 30 days

EXPIRY_DATE=$(echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | \
  openssl x509 -noout -enddate | cut -d= -f2)

EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt $THRESHOLD ]; then
    echo "WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days!"
    # Send alert (email, Slack, etc.)
else
    echo "SSL certificate for $DOMAIN is valid for $DAYS_LEFT more days"
fi
```

Add to crontab for daily checks:
```bash
sudo crontab -e
# Add:
0 2 * * * /usr/local/bin/check-ssl-expiry.sh
```

### Log Rotation

```bash
# Nginx logs can grow large
sudo nano /etc/logrotate.d/nginx

# Ensure it contains:
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

## Troubleshooting

### Issue: Certificate Not Found

```bash
# Check if certificate exists
sudo ls -l /etc/letsencrypt/live/your-domain.com/

# If missing, re-run certbot
sudo certbot certonly --nginx -d your-domain.com
```

### Issue: Nginx Configuration Test Fails

```bash
# Check syntax
sudo nginx -t

# Check error log
sudo tail -f /var/log/nginx/error.log

# Common issues:
# - Incorrect domain names
# - Certificate paths wrong
# - Syntax errors (missing semicolons)
```

### Issue: Mixed Content Warnings

If browser shows mixed content warnings:
- Ensure all API calls use HTTPS
- Check that images/assets use HTTPS URLs
- Verify CSP headers allow correct sources

### Issue: Certificate Renewal Fails

```bash
# Check renewal timer
sudo systemctl status certbot.timer

# Check renewal logs
sudo journalctl -u certbot.renew

# Test renewal manually
sudo certbot renew --dry-run

# Check if port 80 is blocked
sudo netstat -tulpn | grep :80
```

## Security Checklist

Before going to production:

- [ ] SSL certificates installed and valid
- [ ] Nginx configuration tested (`sudo nginx -t`)
- [ ] SSL Labs test shows A+ rating
- [ ] HSTS header present in all responses
- [ ] All HTTP traffic redirects to HTTPS
- [ ] CORS configured for HTTPS origins only
- [ ] Application environment variables updated
- [ ] Firewall allows ports 80 and 443
- [ ] Certificate auto-renewal working
- [ ] Monitoring alerts configured
- [ ] Backup of certificate and private key created
- [ ] Documentation updated with domain names

## Advanced: Certificate Pinning (Optional)

For extra security, implement HTTP Public Key Pinning (HPKP) or use Certificate Transparency monitoring.

### Get Certificate Pin:
```bash
openssl x509 -in /etc/letsencrypt/live/your-domain.com/cert.pem -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | base64
```

**Warning:** HPKP is deprecated and can lock users out if misconfigured. Use with extreme caution.

## Performance Optimization

### Enable HTTP/2 Push
```nginx
location / {
    http2_push /static/css/main.css;
    http2_push /static/js/main.js;
    proxy_pass http://backend_api;
}
```

### Enable Brotli Compression
```bash
# Install Brotli module
sudo apt install libnginx-mod-http-brotli

# Add to nginx.conf
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

## Resources

- **SSL Labs Test:** https://www.ssllabs.com/ssltest/
- **HSTS Preload:** https://hstspreload.org/
- **Let's Encrypt Docs:** https://letsencrypt.org/docs/
- **Mozilla SSL Config Generator:** https://ssl-config.mozilla.org/
- **Certbot Documentation:** https://certbot.eff.org/docs/

## Support

If you encounter issues:
1. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
2. Check Certbot logs: `sudo journalctl -u certbot`
3. Test certificate: `openssl s_client -connect your-domain.com:443`
4. Verify DNS: `dig your-domain.com`

---

**Last Updated:** October 23, 2025  
**Maintained by:** DevOps Team
