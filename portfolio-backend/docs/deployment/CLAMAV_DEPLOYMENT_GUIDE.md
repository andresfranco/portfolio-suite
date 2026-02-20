# ClamAV Deployment Guide

This guide covers deploying and configuring ClamAV antivirus for the portfolio backend's file upload security.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Integration with Portfolio Backend](#integration-with-portfolio-backend)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Troubleshooting](#troubleshooting)

## Overview

ClamAV is used to scan uploaded files for malware before they're stored in the system. The backend integrates with ClamAV through the `clamd` daemon for real-time scanning.

**Architecture:**
- ClamAV daemon (`clamd`) runs as a system service
- Backend connects via Unix socket or TCP
- Files are scanned before being saved to disk
- Infected files are rejected and logged

## Installation

### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install ClamAV daemon and freshclam (signature updater)
sudo apt install -y clamav clamav-daemon clamav-freshclam

# Stop services for initial configuration
sudo systemctl stop clamav-daemon
sudo systemctl stop clamav-freshclam
```

### RHEL/CentOS/Fedora

```bash
# Install EPEL repository (RHEL/CentOS only)
sudo yum install -y epel-release

# Install ClamAV
sudo yum install -y clamav clamav-update clamd

# Stop services
sudo systemctl stop clamd
sudo systemctl stop clamav-freshclam
```

### Docker Deployment

```yaml
# Add to docker-compose.yml
services:
  clamav:
    image: clamav/clamav:latest
    container_name: clamav
    restart: unless-stopped
    ports:
      - "3310:3310"  # TCP port
    volumes:
      - clamav-data:/var/lib/clamav
      - ./clamav-config:/etc/clamav
    environment:
      - CLAMAV_NO_FRESHCLAM=false
    healthcheck:
      test: ["CMD", "clamdscan", "--ping", "3"]
      interval: 60s
      timeout: 10s
      retries: 3

volumes:
  clamav-data:
```

## Configuration

### Update Virus Signatures

```bash
# Manual update
sudo freshclam

# Enable automatic updates
sudo systemctl enable clamav-freshclam
sudo systemctl start clamav-freshclam
```

**Configure freshclam** (`/etc/clamav/freshclam.conf`):

```conf
# Update frequency (default: 24 checks per day)
Checks 24

# Database mirror (use official mirrors)
DatabaseMirror database.clamav.net

# Log file
UpdateLogFile /var/log/clamav/freshclam.log

# Enable logging
LogVerbose yes
LogTime yes
```

### Configure ClamAV Daemon

Edit `/etc/clamav/clamd.conf`:

```conf
# Unix socket (recommended for local deployment)
LocalSocket /var/run/clamav/clamd.ctl
LocalSocketGroup clamav
LocalSocketMode 666

# TCP socket (for Docker/remote deployment)
# TCPSocket 3310
# TCPAddr 0.0.0.0

# Maximum file size to scan (default 25MB)
MaxFileSize 50M
MaxScanSize 100M

# Maximum recursion depth for archives
MaxRecursion 16
MaxFiles 10000

# Scan options
ScanPDF yes
ScanSWF yes
ScanXMLDOCS yes
ScanHWP3 yes
ScanArchive yes

# Logging
LogFile /var/log/clamav/clamav.log
LogTime yes
LogVerbose yes

# Performance tuning
MaxThreads 12
MaxConnectionQueueLength 30

# Timeout for scanning (in milliseconds)
CommandReadTimeout 30000
```

### Set Permissions

```bash
# Create ClamAV user if not exists
sudo useradd -r -s /bin/false clamav || true

# Set permissions
sudo chown -R clamav:clamav /var/lib/clamav
sudo chown -R clamav:clamav /var/log/clamav
sudo chown -R clamav:clamav /var/run/clamav

# Log directory permissions
sudo chmod 755 /var/log/clamav
sudo chmod 644 /var/log/clamav/*.log
```

### Start ClamAV Services

```bash
# Enable services
sudo systemctl enable clamav-daemon
sudo systemctl enable clamav-freshclam

# Start services
sudo systemctl start clamav-daemon
sudo systemctl start clamav-freshclam

# Verify status
sudo systemctl status clamav-daemon
sudo systemctl status clamav-freshclam
```

## Integration with Portfolio Backend

### Backend Configuration

Update `/portfolio-backend/.env`:

```bash
# ClamAV Configuration
CLAMAV_ENABLED=true

# For Unix socket (recommended)
CLAMAV_SOCKET_PATH=/var/run/clamav/clamd.ctl

# For TCP socket (Docker/remote)
# CLAMAV_HOST=localhost
# CLAMAV_PORT=3310
# CLAMAV_TIMEOUT=30
```

### Application Code

The backend uses `app/core/file_security.py` for ClamAV integration:

```python
from app.core.file_security import scan_file_for_malware

# In your file upload endpoint
@router.post("/upload")
async def upload_file(file: UploadFile):
    try:
        # Scan file
        scan_result = await scan_file_for_malware(file.file)
        
        if not scan_result["is_clean"]:
            raise HTTPException(
                status_code=400,
                detail=f"Malware detected: {scan_result['virus_name']}"
            )
        
        # Proceed with file storage
        # ...
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise
```

### Testing Integration

Test ClamAV connection:

```bash
# Activate virtual environment
cd portfolio-backend
source venv/bin/activate

# Test ClamAV connection
python -c "
import pyclamd
cd = pyclamd.ClamdUnixSocket()
print('ClamAV version:', cd.version())
print('Ping:', cd.ping())
"
```

Test malware detection with EICAR test file:

```python
# Create EICAR test file (harmless malware test signature)
# DO NOT run this on production systems
cat > /tmp/eicar.txt << 'EOF'
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
EOF

# Test scan
python -c "
import pyclamd
cd = pyclamd.ClamdUnixSocket()
result = cd.scan_file('/tmp/eicar.txt')
print('Scan result:', result)
"
# Expected: {'/tmp/eicar.txt': ('FOUND', 'Eicar-Test-Signature')}
```

## Monitoring and Maintenance

### Log Monitoring

```bash
# View ClamAV daemon logs
sudo tail -f /var/log/clamav/clamav.log

# View freshclam update logs
sudo tail -f /var/log/clamav/freshclam.log

# Check for scan failures
sudo grep -i "error" /var/log/clamav/clamav.log
```

### Signature Updates

```bash
# Check signature version
sudo clamdscan --version

# Check last update
sudo freshclam --show-progress

# Force update
sudo systemctl restart clamav-freshclam
```

### Performance Monitoring

```bash
# Check ClamAV resource usage
ps aux | grep clam

# Memory usage
sudo pmap -x $(pgrep clamd) | tail -1

# Active connections
sudo lsof -i :3310  # TCP
sudo lsof /var/run/clamav/clamd.ctl  # Unix socket
```

### Automated Monitoring Script

Create `/usr/local/bin/check-clamav.sh`:

```bash
#!/bin/bash

# ClamAV health check script

LOGFILE="/var/log/clamav/healthcheck.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Check if clamd is running
if ! pgrep -x "clamd" > /dev/null; then
    echo "[$DATE] ERROR: clamd is not running" >> $LOGFILE
    systemctl start clamav-daemon
    exit 1
fi

# Check if freshclam is running
if ! pgrep -x "freshclam" > /dev/null; then
    echo "[$DATE] WARNING: freshclam is not running" >> $LOGFILE
fi

# Check signature age (warn if older than 2 days)
DB_AGE=$(find /var/lib/clamav/daily.cvd -mtime +2)
if [ -n "$DB_AGE" ]; then
    echo "[$DATE] WARNING: Virus signatures are outdated" >> $LOGFILE
    freshclam
fi

# Test connection
if ! clamdscan --ping; then
    echo "[$DATE] ERROR: clamd not responding to ping" >> $LOGFILE
    systemctl restart clamav-daemon
    exit 1
fi

echo "[$DATE] OK: ClamAV is healthy" >> $LOGFILE
exit 0
```

Make it executable and add to cron:

```bash
sudo chmod +x /usr/local/bin/check-clamav.sh

# Add to crontab (check every 5 minutes)
echo "*/5 * * * * /usr/local/bin/check-clamav.sh" | sudo crontab -
```

### Logrotate Configuration

Create `/etc/logrotate.d/clamav`:

```conf
/var/log/clamav/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 clamav clamav
    postrotate
        systemctl reload clamav-daemon > /dev/null 2>&1 || true
    endscript
}
```

## Troubleshooting

### ClamAV Won't Start

**Check permissions:**
```bash
sudo chown -R clamav:clamav /var/lib/clamav
sudo chown -R clamav:clamav /var/run/clamav
```

**Check configuration syntax:**
```bash
sudo clamd --config-file=/etc/clamav/clamd.conf --debug
```

**View detailed errors:**
```bash
sudo journalctl -xeu clamav-daemon
```

### Connection Refused

**Unix socket:**
```bash
# Check socket exists
ls -l /var/run/clamav/clamd.ctl

# Check permissions
sudo chmod 666 /var/run/clamav/clamd.ctl
```

**TCP socket:**
```bash
# Check port listening
sudo netstat -tlnp | grep 3310

# Test connection
telnet localhost 3310
```

### Signature Update Failures

```bash
# Check network connectivity
ping database.clamav.net

# Check firewall rules
sudo ufw status

# Manual update with verbose output
sudo freshclam --verbose

# Reset database
sudo rm -rf /var/lib/clamav/*
sudo freshclam
```

### High Memory Usage

ClamAV loads virus signatures into memory:

```bash
# Check current memory usage
free -h

# Reduce memory usage in clamd.conf
MaxThreads 4
MaxFileSize 25M
MaxScanSize 50M

# Restart daemon
sudo systemctl restart clamav-daemon
```

### Slow Scans

```bash
# Increase timeout in .env
CLAMAV_TIMEOUT=60

# Optimize clamd.conf
MaxThreads 8
StreamMaxLength 50M

# Check system resources
top
iostat -x 1
```

### False Positives

```bash
# Report false positive to ClamAV
# Visit: https://www.clamav.net/reports/fp

# Temporarily exclude file (not recommended for production)
# Add to clamd.conf:
# ExcludePath /path/to/file
```

## Production Deployment Checklist

- [ ] ClamAV daemon installed and running
- [ ] Freshclam configured for automatic updates
- [ ] Virus signatures up to date
- [ ] Backend `.env` configured with correct socket/host
- [ ] Connection tested successfully
- [ ] EICAR test file detected
- [ ] Logs configured and rotating
- [ ] Monitoring script in cron
- [ ] Firewall rules configured (if using TCP)
- [ ] Backup of ClamAV configuration
- [ ] Documentation provided to ops team

## Security Considerations

1. **Keep signatures updated**: Outdated signatures = ineffective protection
2. **Monitor logs**: Regular review for suspicious activity
3. **Resource limits**: Prevent DoS via large file uploads
4. **Quarantine infected files**: Don't just delete, log and quarantine
5. **Network isolation**: If using TCP, restrict to localhost or VPN
6. **Fail-safe mode**: Decide behavior when ClamAV is down (reject uploads vs allow)
7. **Regular audits**: Test with known malware samples (in isolated environment)

## Additional Resources

- [ClamAV Official Documentation](https://docs.clamav.net/)
- [ClamAV FAQ](https://docs.clamav.net/faq/faq.html)
- [Virus Signature Database](https://www.clamav.net/documents/clamav-virus-database-faq)
- [pyclamd Documentation](https://pypi.org/project/pyClamd/)
