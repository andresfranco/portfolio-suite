# Security Incident Response Playbook

This document defines the procedures for detecting, responding to, and recovering from security incidents in the Portfolio Suite application.

## Table of Contents

1. [Overview](#overview)
2. [Incident Classification](#incident-classification)
3. [Response Team](#response-team)
4. [Detection and Analysis](#detection-and-analysis)
5. [Containment Procedures](#containment-procedures)
6. [Eradication](#eradication)
7. [Recovery](#recovery)
8. [Post-Incident Activities](#post-incident-activities)
9. [Incident Scenarios](#incident-scenarios)
10. [Contact Information](#contact-information)

## Overview

### Objectives

- **Minimize impact**: Contain incidents quickly to limit damage
- **Preserve evidence**: Maintain forensic data for investigation
- **Restore operations**: Return to normal operations safely
- **Learn and improve**: Update defenses based on lessons learned

### Scope

This playbook covers security incidents affecting:
- Backend API (FastAPI)
- Frontend application (React)
- Database (PostgreSQL)
- Infrastructure (servers, networks, cloud services)
- User data and authentication systems

### Response Phases

1. **Preparation**: Ready systems and teams
2. **Detection**: Identify security events
3. **Analysis**: Determine scope and severity
4. **Containment**: Limit spread and damage
5. **Eradication**: Remove threat completely
6. **Recovery**: Restore normal operations
7. **Post-Incident**: Review and improve

## Incident Classification

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P0 - Critical** | Active exploitation, data breach, complete service outage | Immediate (15 min) | Database compromised, ransomware, active RCE |
| **P1 - High** | Potential breach, significant vulnerability, partial outage | 1 hour | SQL injection found, authentication bypass, DDoS attack |
| **P2 - Medium** | Suspicious activity, minor vulnerability, degraded service | 4 hours | Brute force attempts, XSS vulnerability, elevated error rates |
| **P3 - Low** | Security concern, informational finding | 24 hours | Outdated dependency, configuration issue, scan findings |

### Incident Types

- **Unauthorized Access**: Compromised accounts, credential theft, privilege escalation
- **Data Breach**: Exposed PII, leaked secrets, stolen data
- **Malware**: Viruses, ransomware, trojans, backdoors
- **Denial of Service**: DDoS, resource exhaustion, API abuse
- **Vulnerabilities**: Zero-days, unpatched systems, misconfigurations
- **Insider Threat**: Malicious employee, accidental exposure
- **Supply Chain**: Compromised dependency, third-party breach

## Response Team

### Roles and Responsibilities

#### Incident Commander (IC)
- **Who**: Senior Engineer or Security Lead
- **Responsibilities**:
  - Coordinate response efforts
  - Make containment decisions
  - Communicate with stakeholders
  - Declare incident closed

#### Technical Lead
- **Who**: Backend/DevOps Engineer
- **Responsibilities**:
  - Implement technical containment
  - Analyze logs and evidence
  - Execute remediation steps
  - Document technical details

#### Communications Lead
- **Who**: Product Manager or CTO
- **Responsibilities**:
  - Internal stakeholder updates
  - Customer communications (if needed)
  - External reporting (regulatory)
  - Media relations

#### Security Analyst
- **Who**: Security Engineer or External Consultant
- **Responsibilities**:
  - Forensic analysis
  - Threat intelligence
  - IOC identification
  - Security recommendations

### Escalation Path

```
P3 (Low) → Technical Lead
    ↓
P2 (Medium) → Technical Lead + Incident Commander
    ↓
P1 (High) → Full Team + Management
    ↓
P0 (Critical) → Full Team + Management + External Support
```

## Detection and Analysis

### Detection Sources

#### Automated Alerts
- **Application logs**: Error spikes, authentication failures
- **Security scans**: SAST, DAST, dependency checks
- **Monitoring**: Prometheus alerts, uptime checks
- **WAF/IDS**: Rate limiting, suspicious patterns
- **File integrity**: Unauthorized file changes

#### Manual Detection
- **User reports**: Suspicious emails, strange behavior
- **Security reviews**: Code audits, pen test findings
- **Threat intelligence**: CVE announcements, breach reports

### Initial Analysis Checklist

- [ ] **Verify incident**: Confirm it's not a false positive
- [ ] **Determine scope**: What systems/data are affected?
- [ ] **Assess severity**: Use classification matrix
- [ ] **Identify IOCs**: IP addresses, file hashes, patterns
- [ ] **Check for persistence**: Backdoors, scheduled tasks
- [ ] **Preserve evidence**: Take snapshots, save logs
- [ ] **Document timeline**: When did it start? When detected?

### Evidence Collection

```bash
# System state
date > incident_$(date +%Y%m%d_%H%M%S).txt
hostname >> incident_*.txt
uptime >> incident_*.txt
who >> incident_*.txt

# Process information
ps auxf > processes.txt
netstat -tulpn > network_connections.txt
lsof > open_files.txt

# Application logs (last 24 hours)
journalctl --since "24 hours ago" > system_logs.txt
docker logs backend > backend_logs.txt
docker logs frontend > frontend_logs.txt

# Database connection logs
docker exec postgres psql -U portfolio -c "SELECT * FROM pg_stat_activity;" > db_connections.txt

# File integrity
find /var/www -type f -mtime -1 > recently_modified_files.txt

# Create evidence archive
tar -czf evidence_$(date +%Y%m%d_%H%M%S).tar.gz *.txt
```

## Containment Procedures

### Immediate Actions (First 15 Minutes)

#### P0 - Critical Incidents

1. **Activate Response Team**
   ```bash
   # Send emergency notification
   ./scripts/alert_team.sh CRITICAL "Active security incident detected"
   ```

2. **Assess Immediate Risk**
   - Is data currently being exfiltrated?
   - Is the attacker still active?
   - Are critical systems compromised?

3. **Short-term Containment** (choose based on situation):
   - **Isolate affected systems**:
     ```bash
     # Block network access
     sudo ufw deny out to any
     sudo systemctl stop docker
     ```
   
   - **Revoke compromised credentials**:
     ```bash
     # Disable user account
     cd portfolio-backend
     source venv/bin/activate
     python scripts/disable_user.py --email compromised@user.com
     
     # Rotate JWT secrets
     export SECRET_KEY=$(openssl rand -hex 32)
     sudo systemctl restart portfolio-backend
     ```
   
   - **Enable enhanced logging**:
     ```bash
     # Increase log verbosity
     export LOG_LEVEL=DEBUG
     export SECURITY_AUDIT=true
     docker-compose restart
     ```

4. **Take Snapshots**
   ```bash
   # VM snapshot (if cloud)
   gcloud compute disks snapshot backend-disk --snapshot-names=incident-$(date +%Y%m%d)
   
   # Database backup
   docker exec postgres pg_dump -U portfolio portfolio > incident_db_backup.sql
   
   # File system backup
   rsync -avz /var/www/ /backup/incident_$(date +%Y%m%d)/
   ```

### Long-term Containment

1. **Patch Vulnerabilities**
   ```bash
   # Update dependencies
   cd portfolio-backend
   pip install --upgrade safety pip-audit
   safety check --apply-fixes
   
   cd ../backend-ui
   npm audit fix --force
   ```

2. **Implement Compensating Controls**
   - Enable WAF rules
   - Add rate limiting
   - Restrict IP ranges
   - Require MFA for all accounts

3. **Monitor for Lateral Movement**
   ```bash
   # Watch authentication logs
   tail -f /var/log/auth.log | grep -i "failed\|invalid"
   
   # Monitor database access
   docker exec postgres psql -U portfolio -c \
     "SELECT pg_stat_reset(); SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

## Eradication

### Remove Threat Artifacts

#### Malware Removal
```bash
# Scan for malware
sudo apt install clamav clamav-daemon
sudo freshclam
sudo clamscan -r --infected --remove /var/www/

# Check for web shells
grep -r "eval(" /var/www/
grep -r "base64_decode" /var/www/
grep -r "shell_exec" /var/www/
```

#### Backdoor Detection
```bash
# Check for unauthorized SSH keys
cat ~/.ssh/authorized_keys
sudo find /home -name "authorized_keys" -exec cat {} \;

# Look for suspicious cron jobs
crontab -l
sudo cat /etc/crontab
sudo ls -la /etc/cron.*

# Check for modified system files
sudo debsums -c
rpm -Va  # For RHEL/CentOS
```

#### Database Cleanup
```sql
-- Remove malicious data
DELETE FROM users WHERE email LIKE '%malicious%';

-- Check for SQL injection artifacts
SELECT * FROM users WHERE username ~ '[;<>]';

-- Audit recent changes
SELECT * FROM audit_log 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Rebuild Compromised Systems

If system integrity cannot be guaranteed:

```bash
# 1. Backup critical data
rsync -avz /var/www/uploads/ /backup/uploads/

# 2. Rebuild from clean images
docker-compose down
docker system prune -af
docker-compose pull
docker-compose up -d

# 3. Restore data from pre-incident backup
docker exec postgres psql -U portfolio -c "DROP DATABASE portfolio;"
docker exec postgres psql -U portfolio -c "CREATE DATABASE portfolio;"
docker exec -i postgres psql -U portfolio portfolio < clean_backup.sql
```

## Recovery

### Restoration Steps

1. **Verify Eradication**
   - [ ] All malware removed
   - [ ] Backdoors eliminated
   - [ ] Vulnerabilities patched
   - [ ] No suspicious activity in logs

2. **Restore Services Gradually**
   ```bash
   # Start in maintenance mode
   export MAINTENANCE_MODE=true
   docker-compose up -d
   
   # Verify functionality
   curl http://localhost:8000/api/v1/health
   
   # Run automated tests
   cd portfolio-backend
   pytest tests/
   
   # Exit maintenance mode
   export MAINTENANCE_MODE=false
   docker-compose restart
   ```

3. **Enhanced Monitoring**
   ```bash
   # Increase monitoring frequency
   # Add to prometheus.yml
   scrape_interval: 15s  # Down from 60s
   
   # Enable detailed access logs
   export ACCESS_LOG_ENABLED=true
   
   # Set up alerts for anomalies
   ./scripts/setup_anomaly_detection.sh
   ```

4. **Credential Reset**
   ```bash
   # Force password reset for all users
   cd portfolio-backend
   python scripts/force_password_reset.py --all
   
   # Rotate API keys
   python scripts/rotate_api_keys.py
   
   # Update JWT secrets
   python scripts/generate_rsa_keys.py --key-size 4096
   export ALGORITHM=RS256
   ```

5. **Communication**
   - Notify users of password reset requirement
   - Update status page
   - Brief stakeholders on resolution

### Validation

- [ ] All services responding normally
- [ ] No error rate spikes
- [ ] Authentication working correctly
- [ ] Database queries performing normally
- [ ] No suspicious log entries for 24 hours
- [ ] Security scans passing
- [ ] Monitoring alerts clear

## Post-Incident Activities

### Incident Report Template

```markdown
# Security Incident Report

**Incident ID**: INC-YYYY-NNNN
**Date Detected**: YYYY-MM-DD HH:MM UTC
**Date Resolved**: YYYY-MM-DD HH:MM UTC
**Severity**: P0/P1/P2/P3
**Type**: Unauthorized Access / Data Breach / etc.

## Executive Summary
[2-3 sentence overview of what happened]

## Timeline
- **YYYY-MM-DD HH:MM** - [Event description]
- **YYYY-MM-DD HH:MM** - [Event description]

## Root Cause
[What vulnerability or misconfiguration led to this incident?]

## Impact Assessment
- **Users Affected**: N users
- **Data Exposed**: PII/credentials/etc.
- **Downtime**: N hours
- **Financial Cost**: $N (estimated)

## Response Actions Taken
1. [Action taken]
2. [Action taken]

## Lessons Learned

### What Went Well
- [Positive observation]

### What Needs Improvement
- [Area for improvement]

### Action Items
- [ ] [Preventive measure] - Assigned to [Name] - Due: YYYY-MM-DD
- [ ] [Detection improvement] - Assigned to [Name] - Due: YYYY-MM-DD
- [ ] [Training need] - Assigned to [Name] - Due: YYYY-MM-DD
```

### Post-Incident Review Meeting

**Agenda** (1-2 hours within 1 week of resolution):
1. Incident timeline walkthrough
2. Root cause analysis
3. Response effectiveness evaluation
4. Improvement opportunities
5. Action item assignment

### Continuous Improvement

Update the following based on lessons learned:
- [ ] Security policies and procedures
- [ ] Detection rules and alerts
- [ ] Access controls and permissions
- [ ] Monitoring coverage
- [ ] Incident response playbook (this document)
- [ ] Training materials
- [ ] Disaster recovery procedures

## Incident Scenarios

### Scenario 1: SQL Injection Attack

**Detection**: WAF alerts on SQL injection patterns

**Immediate Actions**:
```bash
# 1. Block attacker IP
sudo ufw deny from <ATTACKER_IP>

# 2. Enable query logging
docker exec postgres psql -U portfolio -c "ALTER SYSTEM SET log_statement = 'all';"
docker exec postgres psql -U portfolio -c "SELECT pg_reload_conf();"

# 3. Check for data exfiltration
docker exec postgres psql -U portfolio -c \
  "SELECT * FROM pg_stat_activity WHERE query LIKE '%UNION%' OR query LIKE '%OR 1=1%';"
```

**Remediation**:
- Review and fix vulnerable endpoint
- Deploy patch
- Audit database for unauthorized changes
- Reset credentials if sensitive data accessed

---

### Scenario 2: Compromised Admin Account

**Detection**: Admin login from unusual location, multiple privilege escalations

**Immediate Actions**:
```bash
# 1. Disable account
python scripts/disable_user.py --email admin@company.com

# 2. Revoke all active sessions
python scripts/revoke_all_sessions.py --user_id <USER_ID>

# 3. Audit recent actions
docker exec postgres psql -U portfolio -c \
  "SELECT * FROM audit_log WHERE user_id = <USER_ID> AND created_at > NOW() - INTERVAL '7 days';"
```

**Remediation**:
- Force MFA enablement for all admin accounts
- Implement geo-blocking for admin panel
- Require re-authentication for sensitive operations
- Conduct security training for admins

---

### Scenario 3: Ransomware Infection

**Detection**: Files encrypted, ransom note found

**Immediate Actions**:
```bash
# 1. ISOLATE IMMEDIATELY - DO NOT SHUT DOWN
# (Shutting down may trigger additional encryption)
sudo iptables -A OUTPUT -j DROP
sudo iptables -A INPUT -j DROP

# 2. Take memory snapshot (for forensics)
sudo dd if=/dev/mem of=/backup/memory_dump.img

# 3. Identify ransomware variant
strings /backup/memory_dump.img | grep -i "ransom\|bitcoin\|decrypt"
```

**DO NOT**:
- Pay ransom (funds criminals, no guarantee)
- Immediately shut down (may lose volatile data)
- Attempt decryption without expert guidance

**Recovery**:
- Restore from clean backups (verify backup integrity first)
- Consult law enforcement and cybersecurity experts
- Rebuild affected systems from scratch

---

### Scenario 4: Data Breach (PII Exposure)

**Detection**: Unauthorized database access, data dump found online

**Immediate Actions**:
```bash
# 1. Contain breach
python scripts/revoke_all_api_keys.py
python scripts/force_password_reset.py --all

# 2. Determine scope
docker exec postgres psql -U portfolio -c \
  "SELECT email, created_at FROM users WHERE id IN (SELECT user_id FROM <EXPOSED_TABLE>);"

# 3. Preserve evidence
pg_dump -U portfolio --table=<EXPOSED_TABLE> > breach_evidence_$(date +%Y%m%d).sql
```

**Legal/Regulatory Requirements**:
- **GDPR**: Notify supervisory authority within 72 hours
- **CCPA**: Notify affected California residents
- **HIPAA**: Report to HHS within 60 days (if healthcare data)
- Document breach, impact, and remediation

**User Communication Template**:
```
Subject: Important Security Notice

Dear [User],

We are writing to inform you of a security incident that may have affected your account.

On [DATE], we discovered unauthorized access to our systems. Our investigation 
determined that the following information may have been exposed:
- [Data types exposed]

We have taken immediate action to:
- [Remediation steps]

We recommend you:
1. Change your password immediately
2. Enable two-factor authentication
3. Monitor your accounts for suspicious activity

We sincerely apologize for this incident. If you have questions, please contact 
security@company.com.

Sincerely,
[Name]
[Title]
```

---

### Scenario 5: DDoS Attack

**Detection**: Traffic spike, service degradation, high error rates

**Immediate Actions**:
```bash
# 1. Enable rate limiting
# In nginx.conf
limit_req_zone $binary_remote_addr zone=ddos:10m rate=10r/s;
limit_req zone=ddos burst=20 nodelay;
sudo nginx -s reload

# 2. Identify attack source
sudo tail -f /var/log/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -20

# 3. Block top attackers
for ip in $(sudo tail -10000 /var/log/nginx/access.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn | head -10 | awk '{print $2}'); do
  sudo ufw deny from $ip
done
```

**Long-term Mitigation**:
- Enable Cloudflare or AWS Shield
- Implement CAPTCHA for high-traffic endpoints
- Use CDN for static assets
- Set up auto-scaling

## Contact Information

### Internal Contacts

| Role | Name | Email | Phone | Backup |
|------|------|-------|-------|--------|
| Incident Commander | [Name] | [email] | [phone] | [backup] |
| Technical Lead | [Name] | [email] | [phone] | [backup] |
| Security Lead | [Name] | [email] | [phone] | [backup] |
| Management | [Name] | [email] | [phone] | [backup] |

### External Contacts

| Service | Contact | Phone | Notes |
|---------|---------|-------|-------|
| Hosting Provider | [Provider] | [phone] | Account: [ID] |
| Security Consultant | [Company] | [phone] | Contract: [ID] |
| Legal Counsel | [Firm] | [phone] | Matter: [ID] |
| Law Enforcement | [Department] | [phone] | Only for criminal activity |
| Insurance | [Company] | [phone] | Policy: [ID] |

### Regulatory Contacts

| Regulation | Authority | Reporting Email | Phone |
|------------|-----------|----------------|-------|
| GDPR | Supervisory Authority | [email] | [phone] |
| CCPA | California AG | [email] | [phone] |
| State Breach Laws | [State AG] | [email] | [phone] |

### Communication Channels

- **Emergency War Room**: Slack channel `#security-incident`
- **Incident Tracker**: GitHub Issues with label `security-incident`
- **Status Page**: status.company.com
- **External Communication**: security@company.com

## Appendices

### A. Incident Declaration Checklist

- [ ] Incident confirmed (not false positive)
- [ ] Severity level assigned
- [ ] Response team notified
- [ ] Incident ID created (INC-YYYY-NNNN)
- [ ] Initial containment actions taken
- [ ] Evidence preservation started
- [ ] Documentation initiated
- [ ] Stakeholders notified (based on severity)

### B. Evidence Handling

**Chain of Custody**: Maintain log of who accessed evidence and when

| Date/Time | Person | Action | Purpose |
|-----------|--------|--------|---------|
| | | | |

**Storage**: Keep evidence encrypted, access-controlled, backed up

**Retention**: Keep for minimum 1 year or per legal requirements

### C. Tool References

- **Log Analysis**: `jq`, `grep`, `awk`, `Elasticsearch`
- **Network Forensics**: `tcpdump`, `Wireshark`, `Zeek`
- **Malware Analysis**: `ClamAV`, `YARA`, `VirusTotal`
- **Incident Management**: `TheHive`, `MISP`, GitHub Issues

### D. Training and Drills

**Quarterly Tabletop Exercises**:
- Simulate incident scenario
- Walk through response procedures
- Identify gaps and improvements

**Annual Full-Scale Test**:
- Real-world simulation (non-production)
- Test recovery procedures
- Measure response times

**New Team Member Onboarding**:
- Review incident response procedures
- Assign role in response team
- Provide contact information

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: Quarterly  
**Owner**: Security Team
