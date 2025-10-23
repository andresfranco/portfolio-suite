# Backup & Disaster Recovery Guide

## Overview

This guide covers database backup and recovery procedures for the Portfolio Suite application.

## Features

✅ **Automated Backups**
- Scheduled daily backups
- Encrypted backups (GPG/AES256)
- Compressed backups (gzip)
- Integrity verification (SHA256 checksums)
- S3/Cloud upload support
- Automatic retention management

✅ **Point-in-Time Recovery**
- Restore from any backup
- Pre-restore safety backups
- Verification before restore
- Dry-run mode for testing

## Prerequisites

### Required Tools

```bash
# PostgreSQL client tools
sudo apt-get install postgresql-client

# GPG for encryption
sudo apt-get install gnupg

# Python dependencies
pip install python-dotenv boto3  # boto3 for S3 upload
```

### Environment Configuration

Add to your `.env` file:

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Backup Configuration
BACKUP_DIR=./backups  # Local backup directory
BACKUP_ENCRYPTION_KEY=<strong-passphrase>  # GPG encryption key
BACKUP_RETENTION_DAYS=30  # Keep backups for 30 days

# Optional: S3 Upload
AWS_S3_BUCKET=my-backup-bucket
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_DEFAULT_REGION=us-east-1

# Optional: Email Notifications
BACKUP_NOTIFY_EMAIL=admin@your-domain.com
```

## Manual Backup

### Create Backup

```bash
# Basic backup
python scripts/backup.py

# Backup with S3 upload
python scripts/backup.py --upload-s3

# List existing backups
python scripts/backup.py --list

# Verify specific backup
python scripts/backup.py --verify backups/backup_portfolioai_20231022_143000.sql.gz.gpg

# Cleanup old backups
python scripts/backup.py --cleanup
```

### Backup Output

Backups are saved with the format:
```
backup_<database>_<timestamp>.sql.gz.gpg
backup_<database>_<timestamp>.json  (metadata)
```

Example:
```
backups/
├── backup_portfolioai_20231022_143000.sql.gz.gpg
├── backup_portfolioai_20231022_143000.json
├── backup_portfolioai_20231023_020000.sql.gz.gpg
└── backup_portfolioai_20231023_020000.json
```

## Automated Backups

### Option 1: Cron (Traditional)

```bash
# Copy example cron configuration
sudo cp scripts/backup.cron.example /etc/cron.d/portfolio-backup

# Edit the file to set correct paths
sudo nano /etc/cron.d/portfolio-backup

# Verify cron job
sudo crontab -l
```

### Option 2: Systemd Timer (Recommended)

```bash
# Copy service and timer units
sudo cp scripts/portfolio-backup.service /etc/systemd/system/
sudo cp scripts/portfolio-backup.timer /etc/systemd/system/

# Edit service file to set correct paths
sudo nano /etc/systemd/system/portfolio-backup.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start timer
sudo systemctl enable --now portfolio-backup.timer

# Check timer status
sudo systemctl status portfolio-backup.timer

# View timer schedule
sudo systemctl list-timers

# View backup logs
sudo journalctl -u portfolio-backup.service -f
```

## Disaster Recovery

### Restore from Backup

⚠️ **WARNING**: Restoring will replace the current database. Always create a pre-restore backup!

```bash
# Dry run (test without making changes)
python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg --dry-run

# Interactive restore (prompts for confirmation)
python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg

# Force restore (no confirmation)
python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg --force
```

### Restore Process

The restore script automatically:
1. ✅ Verifies backup integrity (checksum)
2. ✅ Decrypts backup (if encrypted)
3. ✅ Decompresses backup (if compressed)
4. ✅ Creates pre-restore backup of current database
5. ✅ Restores database from backup
6. ✅ Cleans up temporary files

### Restore from S3

```bash
# Download backup from S3
aws s3 cp s3://my-backup-bucket/backups/backup_portfolioai_20231022_143000.sql.gz.gpg ./

# Restore
python scripts/restore.py backup_portfolioai_20231022_143000.sql.gz.gpg
```

## Backup Verification

### Manual Verification

```bash
# Verify backup integrity
python scripts/backup.py --verify backups/backup_portfolioai_20231022_143000.sql.gz.gpg

# List all backups with metadata
python scripts/backup.py --list
```

### Automated Verification

Add to cron or systemd timer:
```bash
# Verify latest backup daily at 3 AM
0 3 * * * python scripts/backup.py --verify $(ls -t backups/*.gpg | head -1)
```

## Recovery Scenarios

### Scenario 1: Database Corruption

```bash
# 1. Restore from latest backup
python scripts/restore.py $(ls -t backups/*.gpg | head -1)

# 2. Verify application connectivity
curl http://localhost:8000/health

# 3. Check database
psql -h localhost -U postgres -d portfolioai -c "\dt"
```

### Scenario 2: Accidental Data Deletion

```bash
# 1. Find backup from before deletion
python scripts/backup.py --list

# 2. Restore from specific backup
python scripts/restore.py backups/backup_portfolioai_20231022_143000.sql.gz.gpg

# 3. Verify data
# Check that deleted data is restored
```

### Scenario 3: Complete Server Failure

```bash
# 1. Set up new server
# 2. Install PostgreSQL and dependencies
# 3. Copy or download backups
aws s3 sync s3://my-backup-bucket/backups/ ./backups/

# 4. Restore latest backup
python scripts/restore.py $(ls -t backups/*.gpg | head -1)

# 5. Deploy application
# 6. Verify functionality
```

## Best Practices

### Backup Strategy

✅ **3-2-1 Rule**
- **3** copies of data
- **2** different storage media
- **1** offsite backup

✅ **Retention Policy**
- Daily backups: Keep for 7 days
- Weekly backups: Keep for 4 weeks
- Monthly backups: Keep for 12 months

✅ **Testing**
- Test restore procedure monthly
- Verify backup integrity daily
- Document recovery procedures

### Security

✅ **Encryption**
- Always encrypt backups
- Use strong passphrases (32+ characters)
- Rotate encryption keys annually

✅ **Access Control**
- Limit backup access to authorized personnel
- Use separate credentials for backups
- Audit backup access logs

✅ **Storage**
- Store backups in separate location
- Use immutable/versioned storage (S3)
- Enable encryption at rest

## Monitoring

### Backup Success/Failure

```bash
# Check backup logs
tail -f /var/log/portfolio/backup.log

# Systemd journals
sudo journalctl -u portfolio-backup.service --since today

# Set up alerts for backup failures
# (integrate with monitoring system)
```

### Backup Size Monitoring

```bash
# Check backup sizes
du -sh backups/*

# Monitor backup growth
python scripts/backup.py --list | grep Size
```

## Troubleshooting

### Issue: Backup Fails

**Check:**
- Database connectivity
- Disk space available
- PostgreSQL user permissions
- Backup directory permissions

**Solution:**
```bash
# Check disk space
df -h

# Check PostgreSQL connection
psql -h localhost -U postgres -d portfolioai -c "SELECT 1"

# Check logs
tail -f /var/log/portfolio/backup.log
```

### Issue: Restore Fails

**Check:**
- Backup file integrity
- Encryption key correctness
- Target database exists
- Sufficient disk space

**Solution:**
```bash
# Verify backup
python scripts/backup.py --verify backup_file.sql.gz.gpg

# Test with dry-run
python scripts/restore.py backup_file.sql.gz.gpg --dry-run

# Check restore logs
tail -f restore.log
```

### Issue: Backup Too Large

**Solution:**
```bash
# Check database size
psql -h localhost -U postgres -d portfolioai -c "\l+"

# Optimize database
psql -h localhost -U postgres -d portfolioai -c "VACUUM FULL ANALYZE"

# Archive old data before backup
```

## Performance Considerations

### Backup Impact

- **CPU**: ~5-10% during compression/encryption
- **I/O**: Moderate disk I/O
- **Duration**: Typically 1-5 minutes for small DBs
- **Network**: Depends on S3 upload speed

### Optimization

```bash
# Run backups during low-traffic periods
# Default: 2 AM (configured in cron/timer)

# Use compression level 6 instead of 9 for faster backups
# (modify backup.py if needed)

# Exclude large tables if needed
# (add --exclude-table option to pg_dump)
```

## Emergency Contacts

- **Database Admin**: dba@your-domain.com
- **Operations Team**: ops@your-domain.com
- **On-Call**: +1-XXX-XXX-XXXX

## Recovery Time Objectives (RTO/RPO)

- **Recovery Point Objective (RPO)**: 24 hours
  - Maximum acceptable data loss: 1 day
  - Daily backups ensure RPO ≤ 24 hours

- **Recovery Time Objective (RTO)**: 2 hours
  - Maximum acceptable downtime: 2 hours
  - Restore typically completes in < 1 hour

---

**Last Updated**: October 22, 2025  
**Version**: 1.0.0

