# SystemAdmin Setup and Testing Guide

## Overview

This document provides comprehensive instructions for setting up the systemadmin user, logging in with enhanced security features, and testing the security implementations. The systemadmin user has unrestricted access to all system resources and bypasses normal permission checks.

## Table of Contents

1. [SystemAdmin Setup](#systemadmin-setup)
2. [Login Procedures](#login-procedures)
3. [Security Features](#security-features)
4. [Testing Security Implementation](#testing-security-implementation)
5. [Troubleshooting](#troubleshooting)
6. [Security Best Practices](#security-best-practices)

## SystemAdmin Setup

### Prerequisites

Before setting up the systemadmin user, ensure:

1. **Database is running** and accessible
2. **Database migrations** have been applied
3. **Core roles and permissions** are initialized
4. **Backend dependencies** are installed

### Step 1: Initialize Database

First, ensure your database is properly initialized:

```bash
# Navigate to the backend directory
cd portfolio-backend

# Run database migrations
alembic upgrade head

# Start the backend server (this will initialize roles and permissions)
python run.py
```

### Step 2: Run SystemAdmin Setup Script

Execute the setup script to create the systemadmin user:

```bash
# Navigate to the backend directory
cd portfolio-backend

# Run the setup script
python setup_systemadmin.py
```

### Expected Output

The script will produce output similar to:

```
SystemAdmin Setup Script
==================================================
✅ Database connection successful: development

==================================================
SYSTEMADMIN USER CREATED
==================================================
Username: systemadmin
Email: systemadmin@portfolio.local
Password: SystemAdmin123!
User ID: 1
==================================================
IMPORTANT: Change the password after first login!
==================================================

============================================================
SYSTEMADMIN VERIFICATION
============================================================
User ID: 1
Username: systemadmin
Email: systemadmin@portfolio.local
Active: True
Roles: ['System Administrator']
Has SYSTEM_ADMIN permission: True
============================================================

✅ SystemAdmin setup completed successfully!

Next steps:
1. Start the backend server: python run.py
2. Test login with systemadmin credentials
3. Change the default password after first login
4. Configure additional users and roles as needed
```

### Step 3: Verify Setup

You can verify the setup by re-running the script:

```bash
python setup_systemadmin.py
```

This will show that the systemadmin user already exists and verify the configuration.

## Login Procedures

### Default Credentials

After setup, use these default credentials:

- **Username**: `systemadmin`
- **Email**: `systemadmin@portfolio.local`
- **Password**: `SystemAdmin123!`

**⚠️ IMPORTANT**: Change the password after first login!

### Login Methods

#### Method 1: Using cURL

```bash
# Basic login request
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=systemadmin&password=SystemAdmin123!"
```

#### Method 2: Using Python Requests

```python
import requests

# Login request
response = requests.post(
    "http://localhost:8000/api/auth/login",
    data={
        "username": "systemadmin",
        "password": "SystemAdmin123!"
    }
)

# Check response
if response.status_code == 200:
    token_data = response.json()
    print(f"Login successful!")
    print(f"Access Token: {token_data['access_token']}")
    print(f"User Info: {token_data['user']}")
else:
    print(f"Login failed: {response.status_code}")
    print(f"Error: {response.json()}")
```

#### Method 3: Using Frontend Application

If you have the frontend running:

1. Navigate to the login page
2. Enter username: `systemadmin`
3. Enter password: `SystemAdmin123!`
4. Click "Login"

### Expected Login Response

Successful login will return:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "systemadmin",
    "email": "systemadmin@portfolio.local",
    "is_active": true,
    "is_systemadmin": true,
    "roles": [
      {
        "id": 1,
        "name": "System Administrator"
      }
    ]
  }
}
```

## Security Features

### 1. Rate Limiting

The enhanced login system implements multiple rate limiting layers:

- **General Rate Limit**: 1000 requests per hour
- **Login Rate Limit**: 10 login attempts per 15 minutes
- **Failed Login Limit**: 5 failed attempts per 15 minutes

### 2. Security Audit Logging

All login attempts are logged with comprehensive details:

- **Successful Logins**: IP address, user agent, timestamp
- **Failed Logins**: Reason for failure, IP address, attempt details
- **Rate Limit Violations**: Client information, limit type
- **SystemAdmin Activity**: Special logging for admin actions

### 3. Enhanced Error Handling

- **Rate Limit Exceeded**: Returns 429 with retry information
- **Invalid Credentials**: Returns 401 with generic error message
- **Account Inactive**: Returns 401 for inactive accounts
- **Database Errors**: Returns 500 with error logging

### 4. SystemAdmin Privileges

The systemadmin user has special privileges:

- **Permission Bypass**: Automatic access to all endpoints
- **Account Status**: Can login even if marked inactive
- **Special Logging**: All systemadmin actions are specially tracked
- **Unrestricted Access**: No operation restrictions

## Testing Security Implementation

### Test 1: Successful Login

```bash
# Test successful login
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=systemadmin&password=SystemAdmin123!"

# Expected: 200 OK with access token
```

### Test 2: Failed Login - Invalid Credentials

```bash
# Test with wrong password
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=systemadmin&password=wrong_password"

# Expected: 401 Unauthorized
```

### Test 3: Rate Limiting - Login Attempts

```bash
# Script to test login rate limiting
for i in {1..12}; do
  echo "Attempt $i:"
  curl -X POST "http://localhost:8000/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=systemadmin&password=SystemAdmin123!"
  echo ""
done

# Expected: First 10 attempts succeed, then 429 Too Many Requests
```

### Test 4: Rate Limiting - Failed Attempts

```bash
# Script to test failed login rate limiting
for i in {1..7}; do
  echo "Failed attempt $i:"
  curl -X POST "http://localhost:8000/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=systemadmin&password=wrong_password"
  echo ""
done

# Expected: First 5 attempts return 401, then 429 Too Many Requests
```

### Test 5: SystemAdmin Bypass

```bash
# Test that systemadmin can access protected endpoints
# First, login to get token
TOKEN=$(curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=systemadmin&password=SystemAdmin123!" \
  | jq -r '.access_token')

# Test accessing protected endpoint
curl -X GET "http://localhost:8000/api/users/" \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 OK with user list (systemadmin bypasses permissions)
```

### Test 6: Security Audit Logging

Check the application logs for security events:

```bash
# View recent logs
tail -f app/logs/app.log | grep -E "(LOGIN_AUDIT|SECURITY_AUDIT)"

# Look for entries like:
# LOGIN_AUDIT: {"event_type": "LOGIN_ATTEMPT", "username": "systemadmin", "success": true, ...}
# SECURITY_AUDIT: {"event_type": "SYSTEMADMIN_LOGIN", ...}
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Error**: `Database connection failed`

**Solution**:
```bash
# Check database status
pg_isready -h localhost -p 5432

# Verify database URL in environment
echo $DATABASE_URL

# Check database exists
psql -h localhost -p 5432 -U postgres -l
```

#### 2. System Administrator Role Not Found

**Error**: `System Administrator role not found`

**Solution**:
```bash
# Initialize database with roles
python -c "
from app.core.database import SessionLocal
from app.crud.role import initialize_core_roles
db = SessionLocal()
initialize_core_roles(db)
db.close()
"
```

#### 3. Permission Denied Errors

**Error**: `Permission denied when accessing endpoints`

**Solution**:
1. Verify systemadmin user has System Administrator role
2. Check that SYSTEM_ADMIN permission exists
3. Ensure the permission is assigned to the role

```bash
# Verify systemadmin setup
python setup_systemadmin.py
```

#### 4. Rate Limiting Too Restrictive

**Error**: `Too many requests` appears too quickly

**Solution**:
Adjust rate limits in `app/core/rate_limiter.py`:

```python
# Increase limits for development
self.LOGIN_RATE_LIMIT = 100      # More login attempts
self.FAILED_LOGIN_LIMIT = 20     # More failed attempts
```

#### 5. Token Validation Errors

**Error**: `Could not validate credentials`

**Solution**:
1. Check that JWT secret key is consistent
2. Verify token hasn't expired
3. Ensure proper Authorization header format

### Debug Mode

Enable debug logging for detailed information:

```python
# In app/core/config.py
DEBUG = True

# Or set environment variable
export DEBUG=True
```

### Log Analysis

Check security audit logs:

```bash
# View all security events
grep "AUDIT" app/logs/app.log

# View login attempts
grep "LOGIN_ATTEMPT" app/logs/app.log

# View rate limit violations
grep "RATE_LIMIT" app/logs/app.log

# View systemadmin activity
grep "SYSTEMADMIN" app/logs/app.log
```

## Security Best Practices

### 1. Change Default Password

**Immediately** after setup, change the default password:

```bash
# Use the user management endpoint to change password
curl -X PUT "http://localhost:8000/api/users/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "NewSecurePassword123!"
  }'
```

### 2. Secure Storage

- Store credentials securely (use environment variables)
- Never commit passwords to version control
- Use strong, unique passwords
- Consider using a password manager

### 3. Access Control

- Limit systemadmin access to necessary personnel
- Use separate accounts for day-to-day operations
- Implement additional authentication factors if possible
- Regular audit of systemadmin activities

### 4. Monitoring

- Monitor systemadmin login attempts
- Set up alerts for unusual activity
- Regular review of security audit logs
- Monitor rate limiting violations

### 5. Environment Security

- Use different passwords for different environments
- Secure production database access
- Implement network security measures
- Regular security updates

## Production Deployment

### Environment Variables

Set these environment variables for production:

```bash
# Strong secret key for JWT
export SECRET_KEY="your-very-secure-secret-key-here"

# Production database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Email for systemadmin (change from default)
export SYSTEMADMIN_EMAIL="admin@yourdomain.com"

# Optional: Custom systemadmin password
export SYSTEMADMIN_PASSWORD="YourSecurePassword123!"
```

### Security Hardening

1. **Rate Limiting**: Adjust limits for production load
2. **HTTPS**: Use HTTPS for all communications
3. **Database Security**: Secure database access
4. **Network Security**: Implement proper firewall rules
5. **Monitoring**: Set up comprehensive monitoring

## Conclusion

The systemadmin user provides unrestricted access to the portfolio management system with enhanced security features. Proper setup, testing, and monitoring ensure secure operation while maintaining the flexibility needed for system administration.

Remember to:
- Change default passwords immediately
- Monitor security logs regularly
- Test security features periodically
- Follow security best practices
- Keep system updated

For additional support or questions, refer to the other security implementation documents or contact the development team. 