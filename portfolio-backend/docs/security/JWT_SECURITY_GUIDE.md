# Enhanced JWT Security Guide

## Overview

The Portfolio Suite implements enterprise-grade JWT security with multiple layers of protection against common JWT vulnerabilities.

## Security Features

### ✅ Implemented

1. **Token Blacklisting/Revocation**
   - Individual token revocation via JTI
   - Revoke all user tokens (version increment)
   - Revoke token families (refresh token chains)

2. **Refresh Token Rotation**
   - One-time use refresh tokens
   - Automatic rotation on use
   - Family tracking for replay detection

3. **Token Binding**
   - Fingerprint based on User-Agent + IP
   - Detects token theft (different device/location)
   - Prevents token replay attacks

4. **Token Versioning**
   - Invalidate all old tokens instantly
   - Useful for password changes, security incidents
   - Stored in Redis with 30-day TTL

5. **Short-Lived Access Tokens**
   - Default: 30 minutes (configurable)
   - Reduces attack window
   - Requires refresh token for long sessions

6. **Audit Trail**
   - Log all token creation events
   - Track token usage patterns
   - Security event logging

## Usage

### Creating Tokens

```python
from fastapi import Request
from app.core.jwt_enhanced import jwt_manager

# In your login endpoint
async def login(request: Request, credentials: LoginCredentials):
    # ... authenticate user ...
    
    # Get user's current token version
    token_version = await jwt_manager.get_user_token_version(user.id) or 1
    
    # Create access token
    access_token = await jwt_manager.create_access_token(
        user_id=user.id,
        request=request,
        token_version=token_version,
        additional_claims={"role": user.role}
    )
    
    # Create refresh token
    refresh_token = await jwt_manager.create_refresh_token(
        user_id=user.id,
        request=request,
        token_version=token_version
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
```

### Verifying Tokens

```python
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.jwt_enhanced import jwt_manager

security = HTTPBearer()

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Dependency to get current authenticated user."""
    
    # Verify token
    payload = await jwt_manager.verify_token(
        token=credentials.credentials,
        request=request,
        expected_type="access"
    )
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("sub")
    # ... load user from database ...
    
    return user
```

### Refresh Token Rotation

```python
async def refresh_access_token(
    request: Request,
    refresh_token: str
):
    """Rotate refresh token and create new access token."""
    
    # Rotate refresh token (marks old one as used)
    new_refresh_token = await jwt_manager.rotate_refresh_token(
        old_token=refresh_token,
        request=request
    )
    
    if not new_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or already used refresh token"
        )
    
    # Verify new refresh token to get user_id
    payload = await jwt_manager.verify_token(
        token=new_refresh_token,
        request=request,
        expected_type="refresh"
    )
    
    # Create new access token
    access_token = await jwt_manager.create_access_token(
        user_id=payload["sub"],
        request=request,
        token_version=payload.get("version")
    )
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }
```

### Token Revocation

```python
async def logout(request: Request, current_user: User = Depends(get_current_user)):
    """Logout and revoke tokens."""
    
    # Option 1: Revoke current access token
    # (requires extracting JTI from current token)
    credentials = request.headers.get("authorization")
    if credentials:
        token = credentials.replace("Bearer ", "")
        payload = jwt.decode(token, verify=False)
        jti = payload.get("jti")
        if jti:
            await jwt_manager.revoke_token(jti)
    
    # Option 2: Revoke all user tokens (more secure)
    await jwt_manager.revoke_all_user_tokens(current_user.id)
    
    return {"message": "Logged out successfully"}
```

### Password Change (Revoke All Tokens)

```python
async def change_password(
    request: Request,
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user)
):
    """Change password and revoke all existing tokens."""
    
    # ... verify old password and set new password ...
    
    # Revoke all existing tokens (force re-login)
    await jwt_manager.revoke_all_user_tokens(current_user.id)
    
    return {"message": "Password changed. Please log in again."}
```

## Security Best Practices

### 1. Token Storage

**Frontend (Browser)**:
- ✅ Access Token: Memory only (never localStorage)
- ✅ Refresh Token: httpOnly cookie (secure, SameSite=strict)

**Frontend (Mobile)**:
- ✅ Use secure storage (Keychain/KeyStore)
- ✅ Never log tokens
- ✅ Clear on logout

### 2. Token Expiration

**Recommended Settings**:
```bash
# .env
ACCESS_TOKEN_EXPIRE_MINUTES=30    # 30 minutes
REFRESH_TOKEN_EXPIRE_MINUTES=10080  # 7 days
```

**High Security**:
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=15    # 15 minutes
REFRESH_TOKEN_EXPIRE_MINUTES=1440  # 24 hours
```

### 3. Token Binding

**Enable fingerprinting** to detect token theft:
- Compares User-Agent + IP address
- Logs warning if mismatch detected
- Can auto-revoke suspicious tokens

**Trade-off**: May cause issues with:
- Mobile users (changing networks)
- VPN users
- Corporate proxies

**Configuration**:
```python
# Strict mode (reject on mismatch)
if not jwt_manager._verify_fingerprint(fingerprint, request):
    raise HTTPException(401, "Token stolen/invalid")

# Permissive mode (log but allow)
if not jwt_manager._verify_fingerprint(fingerprint, request):
    logger.warning("Fingerprint mismatch")
    # Continue anyway
```

### 4. Refresh Token Families

**Automatic replay detection**:
- Each refresh creates new token in same "family"
- If old refresh token used again → entire family revoked
- Prevents token replay attacks

**Example scenario**:
1. Attacker steals refresh token R1
2. User refreshes → R1 → R2
3. Attacker tries to use R1 → DETECTED!
4. System revokes R1, R2, and all future tokens in family
5. User forced to re-login

## Monitoring

### Security Events to Monitor

```python
# app/core/jwt_enhanced.py logs these events:

# Token creation
logger.info(f"Access token created: user={user_id}, jti={jti}")

# Token verification failures
logger.warning(f"Token fingerprint mismatch for user={user_id}")

# Replay attack detection
logger.warning(f"Refresh token already used: jti={jti}. Possible replay attack!")

# Token revocation
logger.info(f"All tokens revoked for user={user_id}")
logger.warning(f"Token family revoked: family={family_id}")
```

### Prometheus Metrics (Optional)

```python
# Add to app/observability/metrics.py

from prometheus_client import Counter, Histogram

# Token operations
token_created_total = Counter('jwt_tokens_created_total', 'Total tokens created', ['type'])
token_verified_total = Counter('jwt_tokens_verified_total', 'Total token verifications', ['result'])
token_revoked_total = Counter('jwt_tokens_revoked_total', 'Total tokens revoked', ['reason'])

# Security events
security_events_total = Counter('jwt_security_events_total', 'Security events', ['event_type'])
```

## Configuration

### Environment Variables

```bash
# JWT Settings
SECRET_KEY=<64-char-hex>  # openssl rand -hex 32
ALGORITHM=HS256  # or RS256 for asymmetric

# Token Expiration
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=10080

# Redis (for blacklisting)
REDIS_URL=redis://localhost:6379/0
RATE_LIMIT_ENABLED=True  # Reuses same Redis connection
```

### Database Migration (Optional)

For persisting token versions in database instead of Redis:

```sql
-- Add token_version to users table
ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1;
CREATE INDEX idx_users_token_version ON users(id, token_version);
```

## Troubleshooting

### Issue: Tokens not being revoked

**Check:**
- Redis connection working
- `RATE_LIMIT_ENABLED=True`
- `REDIS_URL` configured

**Solution:**
```bash
# Test Redis connection
redis-cli ping

# Check logs
tail -f logs/app.log | grep "Enhanced JWT"
```

### Issue: Token fingerprint mismatches

**Causes:**
- User changed IP (mobile network, VPN)
- Proxy/load balancer configuration
- User-Agent changes (browser updates)

**Solution:**
```python
# Make fingerprinting optional
# In jwt_enhanced.py, _verify_fingerprint():
if not token_fingerprint:
    return True  # Skip check if not present
```

### Issue: Refresh token rotation fails

**Check:**
- Token not already used
- Token family not revoked
- Request fingerprint matches

**Debug:**
```python
# Enable debug logging
import logging
logging.getLogger('app.core.jwt_enhanced').setLevel(logging.DEBUG)
```

## Migration from Basic JWT

### Step 1: Update Token Creation

```python
# Old
from app.core.security import create_access_token
token = create_access_token(user.id)

# New
from app.core.jwt_enhanced import jwt_manager
token = await jwt_manager.create_access_token(user.id, request)
```

### Step 2: Update Token Verification

```python
# Old
from jose import jwt
payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# New
from app.core.jwt_enhanced import jwt_manager
payload = await jwt_manager.verify_token(token, request)
```

### Step 3: Add Logout Handler

```python
# New endpoint
@app.post("/api/auth/logout")
async def logout(request: Request, current_user = Depends(get_current_user)):
    await jwt_manager.revoke_all_user_tokens(current_user.id)
    return {"message": "Logged out successfully"}
```

## Security Testing

### Test Token Revocation

```bash
# 1. Login and get token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}' | jq -r .access_token)

# 2. Use token (should work)
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Logout (revoke token)
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# 4. Try using token again (should fail)
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 401 Unauthorized
```

### Test Refresh Token Rotation

```bash
# 1. Get tokens
RESPONSE=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}')

ACCESS_TOKEN=$(echo $RESPONSE | jq -r .access_token)
REFRESH_TOKEN=$(echo $RESPONSE | jq -r .refresh_token)

# 2. Refresh (should work)
NEW_RESPONSE=$(curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")

# 3. Try using old refresh token again (should fail)
curl -X POST http://localhost:8000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
# Expected: 401 Unauthorized + family revoked
```

---

**Last Updated**: October 22, 2025  
**Version**: 1.0.0

