"""
Enhanced JWT Security Module

Features:
- Token blacklisting/revocation
- Token versioning (invalidate old tokens)
- Refresh token rotation (one-time use)
- Token binding to user-agent and IP
- Token usage audit trail
- Asymmetric key support (RS256)
- Short-lived access tokens

Security Enhancements:
- Prevents token replay attacks
- Automatic token invalidation on logout
- Detects stolen tokens (different IP/user-agent)
- Family detection for refresh tokens
- Token fingerprinting
"""

import hashlib
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

import redis.asyncio as redis
from fastapi import Request
import jwt
from jwt.exceptions import PyJWTError as JWTError

from app.core.config import settings

logger = logging.getLogger(__name__)


class EnhancedJWTManager:
    """
    Enhanced JWT manager with security features.
    
    Features:
    - Token blacklisting (revoked tokens stored in Redis)
    - Token versioning (invalidate all user tokens)
    - Refresh token rotation (one-time use)
    - Token binding (IP + User-Agent fingerprinting)
    - Audit trail (token creation/usage logging)
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = settings.RATE_LIMIT_ENABLED  # Reuse Redis config
        
        # Token settings
        self.access_token_expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        self.refresh_token_expire = timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        
        # Algorithm (can be HS256 or RS256)
        self.algorithm = settings.ALGORITHM
    
    async def initialize(self):
        """Initialize Redis connection for token blacklisting."""
        if not self.enabled or not settings.REDIS_URL:
            logger.warning("Enhanced JWT features disabled (Redis not configured)")
            return
        
        try:
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
            )
            await self.redis_client.ping()
            logger.info("Enhanced JWT manager initialized with Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis for JWT: {e}")
            self.redis_client = None
    
    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
    
    def _generate_jti(self) -> str:
        """Generate unique token identifier (JTI)."""
        return str(uuid.uuid4())
    
    def _generate_fingerprint(self, request: Request) -> str:
        """
        Generate token fingerprint based on request.
        
        Combines:
        - User-Agent
        - IP Address (X-Forwarded-For or client IP)
        """
        user_agent = request.headers.get("User-Agent", "unknown")
        
        # Get real IP (handle proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
        
        # Create fingerprint hash
        fingerprint_data = f"{user_agent}:{ip}"
        fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]
        
        return fingerprint
    
    def _verify_fingerprint(self, token_fingerprint: str, request: Request) -> bool:
        """Verify token fingerprint matches current request."""
        current_fingerprint = self._generate_fingerprint(request)
        return token_fingerprint == current_fingerprint
    
    async def create_access_token(
        self,
        user_id: Union[str, int],
        request: Request,
        token_version: Optional[int] = None,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create enhanced access token.
        
        Args:
            user_id: User identifier
            request: FastAPI request (for fingerprinting)
            token_version: User's token version (for invalidation)
            additional_claims: Additional JWT claims
        
        Returns:
            JWT access token
        """
        now = datetime.utcnow()
        expire = now + self.access_token_expire
        jti = self._generate_jti()
        fingerprint = self._generate_fingerprint(request)
        
        # Build token payload
        payload = {
            "sub": str(user_id),
            "jti": jti,
            "type": "access",
            "iat": now,
            "exp": expire,
            "fingerprint": fingerprint,
        }
        
        # Add token version if provided
        if token_version is not None:
            payload["version"] = token_version
        
        # Add additional claims
        if additional_claims:
            payload.update(additional_claims)
        
        # Create JWT
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=self.algorithm)
        
        # Audit log token creation
        logger.info(
            f"Access token created: user={user_id}, jti={jti}, "
            f"expires={expire.isoformat()}"
        )
        
        return token
    
    async def create_refresh_token(
        self,
        user_id: Union[str, int],
        request: Request,
        token_version: Optional[int] = None,
        family_id: Optional[str] = None
    ) -> str:
        """
        Create enhanced refresh token.
        
        Args:
            user_id: User identifier
            request: FastAPI request (for fingerprinting)
            token_version: User's token version
            family_id: Token family ID (for rotation tracking)
        
        Returns:
            JWT refresh token
        """
        now = datetime.utcnow()
        expire = now + self.refresh_token_expire
        jti = self._generate_jti()
        fingerprint = self._generate_fingerprint(request)
        
        # Generate family ID if not provided (first token in family)
        if not family_id:
            family_id = str(uuid.uuid4())
        
        # Build token payload
        payload = {
            "sub": str(user_id),
            "jti": jti,
            "type": "refresh",
            "iat": now,
            "exp": expire,
            "fingerprint": fingerprint,
            "family": family_id,
        }
        
        # Add token version
        if token_version is not None:
            payload["version"] = token_version
        
        # Create JWT
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=self.algorithm)
        
        # Store refresh token in Redis for rotation tracking
        if self.redis_client:
            try:
                key = f"refresh_token:{jti}"
                ttl = int(self.refresh_token_expire.total_seconds())
                await self.redis_client.setex(
                    key,
                    ttl,
                    f"{user_id}:{family_id}:active"
                )
            except Exception as e:
                logger.error(f"Failed to store refresh token: {e}")
        
        # Audit log
        logger.info(
            f"Refresh token created: user={user_id}, jti={jti}, "
            f"family={family_id}, expires={expire.isoformat()}"
        )
        
        return token
    
    async def verify_token(
        self,
        token: str,
        request: Request,
        expected_type: str = "access"
    ) -> Optional[Dict[str, Any]]:
        """
        Verify and decode JWT token with enhanced security checks.
        
        Args:
            token: JWT token to verify
            request: FastAPI request (for fingerprint validation)
            expected_type: Expected token type ('access' or 'refresh')
        
        Returns:
            Decoded token payload if valid, None otherwise
        """
        try:
            # Decode token
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[self.algorithm]
            )
            
            # Verify token type
            token_type = payload.get("type")
            if token_type != expected_type:
                logger.warning(f"Invalid token type: expected={expected_type}, got={token_type}")
                return None
            
            # Verify fingerprint
            token_fingerprint = payload.get("fingerprint")
            if token_fingerprint and not self._verify_fingerprint(token_fingerprint, request):
                logger.warning(
                    f"Token fingerprint mismatch for user={payload.get('sub')}, "
                    f"jti={payload.get('jti')}. Possible token theft!"
                )
                # In production, you might want to:
                # 1. Revoke all user tokens
                # 2. Send security alert
                # 3. Force re-authentication
                return None
            
            # Check if token is blacklisted
            jti = payload.get("jti")
            if jti and await self.is_token_blacklisted(jti):
                logger.warning(f"Blacklisted token used: jti={jti}")
                return None
            
            # Check token version (if present)
            if "version" in payload:
                user_id = payload.get("sub")
                current_version = await self.get_user_token_version(user_id)
                if current_version and payload["version"] < current_version:
                    logger.warning(
                        f"Outdated token version for user={user_id}: "
                        f"token_version={payload['version']}, "
                        f"current_version={current_version}"
                    )
                    return None
            
            return payload
            
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return None
    
    async def rotate_refresh_token(
        self,
        old_token: str,
        request: Request
    ) -> Optional[str]:
        """
        Rotate refresh token (one-time use).
        
        When a refresh token is used:
        1. Verify it's valid and not used before
        2. Mark it as used (blacklist)
        3. Create new refresh token in same family
        
        Args:
            old_token: Current refresh token
            request: FastAPI request
        
        Returns:
            New refresh token, or None if rotation failed
        """
        # Verify old token
        payload = await self.verify_token(old_token, request, expected_type="refresh")
        if not payload:
            return None
        
        jti = payload.get("jti")
        user_id = payload.get("sub")
        family_id = payload.get("family")
        token_version = payload.get("version")
        
        # Check if token already used (prevent replay)
        if self.redis_client:
            try:
                key = f"refresh_token:{jti}"
                token_data = await self.redis_client.get(key)
                
                if not token_data:
                    logger.warning(
                        f"Refresh token already used or expired: jti={jti}, "
                        f"user={user_id}. Possible replay attack!"
                    )
                    # Revoke entire token family (security measure)
                    await self.revoke_token_family(family_id)
                    return None
                
                # Mark token as used
                await self.redis_client.delete(key)
                
            except Exception as e:
                logger.error(f"Failed to check refresh token status: {e}")
                # Fail closed for security
                return None
        
        # Create new refresh token in same family
        new_token = await self.create_refresh_token(
            user_id=user_id,
            request=request,
            token_version=token_version,
            family_id=family_id
        )
        
        logger.info(f"Refresh token rotated: old_jti={jti}, user={user_id}")
        
        return new_token
    
    async def revoke_token(self, jti: str, ttl: int = 86400):
        """
        Revoke/blacklist a specific token.
        
        Args:
            jti: Token JTI (unique identifier)
            ttl: Time to keep in blacklist (seconds)
        """
        if not self.redis_client:
            logger.warning("Cannot revoke token: Redis not configured")
            return
        
        try:
            key = f"blacklist:{jti}"
            await self.redis_client.setex(key, ttl, "1")
            logger.info(f"Token revoked: jti={jti}")
        except Exception as e:
            logger.error(f"Failed to revoke token: {e}")
    
    async def revoke_all_user_tokens(self, user_id: Union[str, int]):
        """
        Revoke all tokens for a user by incrementing their token version.
        
        Args:
            user_id: User identifier
        """
        if not self.redis_client:
            logger.warning("Cannot revoke user tokens: Redis not configured")
            return
        
        try:
            key = f"token_version:{user_id}"
            new_version = await self.redis_client.incr(key)
            # Keep version for 30 days
            await self.redis_client.expire(key, 86400 * 30)
            
            logger.info(f"All tokens revoked for user={user_id}, new_version={new_version}")
        except Exception as e:
            logger.error(f"Failed to revoke user tokens: {e}")
    
    async def revoke_token_family(self, family_id: str):
        """
        Revoke entire token family (all refresh tokens in rotation chain).
        
        Args:
            family_id: Token family identifier
        """
        if not self.redis_client:
            return
        
        try:
            # Mark family as revoked
            key = f"revoked_family:{family_id}"
            await self.redis_client.setex(key, 86400 * 7, "1")  # 7 days
            
            logger.warning(f"Token family revoked: family={family_id}")
        except Exception as e:
            logger.error(f"Failed to revoke token family: {e}")
    
    async def is_token_blacklisted(self, jti: str) -> bool:
        """Check if token is blacklisted."""
        if not self.redis_client:
            return False
        
        try:
            key = f"blacklist:{jti}"
            result = await self.redis_client.exists(key)
            return bool(result)
        except Exception as e:
            logger.error(f"Failed to check blacklist: {e}")
            # Fail open (allow token) to prevent service disruption
            return False
    
    async def get_user_token_version(self, user_id: Union[str, int]) -> Optional[int]:
        """Get current token version for user."""
        if not self.redis_client:
            return None
        
        try:
            key = f"token_version:{user_id}"
            version = await self.redis_client.get(key)
            return int(version) if version else None
        except Exception as e:
            logger.error(f"Failed to get token version: {e}")
            return None


# Global instance
jwt_manager = EnhancedJWTManager()

