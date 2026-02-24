"""
Secure Cookie Management for Authentication

Implements httpOnly, secure cookies for JWT tokens with CSRF protection.
This replaces the insecure localStorage approach vulnerable to XSS attacks.
"""

from fastapi import Response, Request, HTTPException, status
from datetime import timedelta, datetime, timezone
import secrets
import hashlib
from typing import Optional, Dict
from app.core.config import settings
from app.core.logging import setup_logger

logger = setup_logger("app.core.secure_cookies")


class SecureCookieManager:
    """
    Manages secure httpOnly cookies for authentication tokens
    
    Features:
    - httpOnly cookies (not accessible via JavaScript)
    - Secure flag (HTTPS only in production)
    - SameSite=Strict/Lax for CSRF protection
    - CSRF token generation and validation
    - Token fingerprinting for additional security
    """
    
    # Cookie names
    ACCESS_TOKEN_COOKIE = "access_token"
    REFRESH_TOKEN_COOKIE = "refresh_token"
    CSRF_TOKEN_COOKIE = "csrf_token"
    TOKEN_FINGERPRINT_COOKIE = "token_fp"
    
    # In-memory store for CSRF tokens (in production, use Redis)
    _csrf_tokens: Dict[str, datetime] = {}
    
    @classmethod
    def set_auth_cookies(
        cls,
        response: Response,
        access_token: str,
        refresh_token: str,
        access_token_expires: timedelta,
        refresh_token_expires: timedelta,
        request: Optional[Request] = None
    ) -> str:
        """
        Set authentication cookies on response
        
        Args:
            response: FastAPI Response object
            access_token: JWT access token
            refresh_token: JWT refresh token
            access_token_expires: Access token expiration time
            refresh_token_expires: Refresh token expiration time
            request: FastAPI Request object (for fingerprinting)
            
        Returns:
            CSRF token to be sent in response body
        """
        is_production = settings.is_production()
        is_secure = is_production  # Only use secure flag in production (requires HTTPS)
        
        # Set access token cookie (httpOnly, secure, short-lived)
        response.set_cookie(
            key=cls.ACCESS_TOKEN_COOKIE,
            value=access_token,
            max_age=int(access_token_expires.total_seconds()),
            httponly=True,  # Not accessible via JavaScript (XSS protection)
            secure=is_secure,  # HTTPS only in production
            samesite="lax",  # CSRF protection (allows top-level navigation)
            path="/",
            domain=None  # Use default domain
        )
        
        # Set refresh token cookie (httpOnly, secure, long-lived)
        response.set_cookie(
            key=cls.REFRESH_TOKEN_COOKIE,
            value=refresh_token,
            max_age=int(refresh_token_expires.total_seconds()),
            httponly=True,
            secure=is_secure,
            samesite="strict",  # Strict CSRF protection for refresh token
            path="/api/auth/refresh-token",  # Only sent to refresh endpoint
            domain=None
        )
        
        # Generate CSRF token
        csrf_token = cls.generate_csrf_token()
        
        # Set CSRF token cookie (NOT httpOnly - needs to be readable by JS)
        response.set_cookie(
            key=cls.CSRF_TOKEN_COOKIE,
            value=csrf_token,
            max_age=int(access_token_expires.total_seconds()),
            httponly=False,  # Must be readable by JavaScript
            secure=is_secure,
            samesite="lax",
            path="/",
            domain=None
        )
        
        # Generate and set token fingerprint for additional security
        if request:
            fingerprint = cls.generate_token_fingerprint(request)
            fingerprint_hash = cls.hash_fingerprint(fingerprint)
            
            response.set_cookie(
                key=cls.TOKEN_FINGERPRINT_COOKIE,
                value=fingerprint_hash,
                max_age=int(access_token_expires.total_seconds()),
                httponly=True,
                secure=is_secure,
                samesite="lax",
                path="/",
                domain=None
            )
        
        logger.info("Authentication cookies set successfully")
        return csrf_token
    
    @classmethod
    def clear_auth_cookies(cls, response: Response):
        """
        Clear all authentication cookies (logout)
        
        Args:
            response: FastAPI Response object
        """
        # Clear all authentication cookies
        for cookie_name in [
            cls.ACCESS_TOKEN_COOKIE,
            cls.REFRESH_TOKEN_COOKIE,
            cls.CSRF_TOKEN_COOKIE,
            cls.TOKEN_FINGERPRINT_COOKIE
        ]:
            response.delete_cookie(
                key=cookie_name,
                path="/" if cookie_name != cls.REFRESH_TOKEN_COOKIE else "/api/auth/refresh-token",
                domain=None
            )
        
        logger.info("Authentication cookies cleared")
    
    @classmethod
    def get_access_token(cls, request: Request) -> Optional[str]:
        """
        Get access token from cookie
        
        Args:
            request: FastAPI Request object
            
        Returns:
            Access token string or None
        """
        return request.cookies.get(cls.ACCESS_TOKEN_COOKIE)
    
    @classmethod
    def get_refresh_token(cls, request: Request) -> Optional[str]:
        """
        Get refresh token from cookie
        
        Args:
            request: FastAPI Request object
            
        Returns:
            Refresh token string or None
        """
        return request.cookies.get(cls.REFRESH_TOKEN_COOKIE)
    
    @classmethod
    def generate_csrf_token(cls) -> str:
        """
        Generate a cryptographically secure CSRF token
        
        Returns:
            64-character hex CSRF token
        """
        token = secrets.token_hex(32)
        
        # Store token with expiration (1 hour)
        expiry = datetime.now(timezone.utc) + timedelta(hours=1)
        cls._csrf_tokens[token] = expiry
        
        # Clean up expired tokens (simple cleanup)
        cls._cleanup_expired_tokens()
        
        return token
    
    @classmethod
    def validate_csrf_token(cls, token: str) -> bool:
        """
        Validate CSRF token
        
        Args:
            token: CSRF token to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not token or token not in cls._csrf_tokens:
            return False
        
        # Check if token is expired
        expiry = cls._csrf_tokens[token]
        if datetime.now(timezone.utc) > expiry:
            del cls._csrf_tokens[token]
            return False
        
        return True
    
    @classmethod
    def _cleanup_expired_tokens(cls):
        """Clean up expired CSRF tokens from memory"""
        now = datetime.now(timezone.utc)
        expired = [token for token, expiry in cls._csrf_tokens.items() if now > expiry]
        for token in expired:
            del cls._csrf_tokens[token]
    
    @classmethod
    def verify_csrf_token(cls, request: Request) -> bool:
        """
        Verify CSRF token from request
        
        Checks both cookie and header for double-submit cookie pattern
        
        Args:
            request: FastAPI Request object
            
        Returns:
            True if valid, False otherwise
        """
        # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return True
        
        # Get CSRF token from cookie
        cookie_token = request.cookies.get(cls.CSRF_TOKEN_COOKIE)
        
        # Get CSRF token from header (X-CSRF-Token)
        header_token = request.headers.get("X-CSRF-Token")
        
        # Both must be present and match
        if not cookie_token or not header_token:
            logger.warning(f"CSRF token missing: cookie={bool(cookie_token)}, header={bool(header_token)}")
            return False
        
        if cookie_token != header_token:
            logger.warning("CSRF token mismatch")
            return False
        
        # Validate token (check if it exists and not expired)
        if not cls.validate_csrf_token(cookie_token):
            logger.warning("CSRF token invalid or expired")
            return False
        
        return True
    
    @classmethod
    def generate_token_fingerprint(cls, request: Request) -> str:
        """
        Generate a fingerprint of the request for token binding
        
        Binds token to user-agent and IP for additional security
        
        Args:
            request: FastAPI Request object
            
        Returns:
            Fingerprint string
        """
        user_agent = request.headers.get("user-agent", "unknown")

        # Use only user-agent for fingerprint — not client IP.
        # Behind a reverse proxy the IP seen by uvicorn is the proxy's address
        # and can vary between workers or requests, causing false-positive mismatches.
        fingerprint = user_agent
        return fingerprint
    
    @classmethod
    def hash_fingerprint(cls, fingerprint: str) -> str:
        """
        Hash the fingerprint for secure storage
        
        Args:
            fingerprint: Raw fingerprint string
            
        Returns:
            SHA256 hash of fingerprint
        """
        return hashlib.sha256(fingerprint.encode()).hexdigest()
    
    @classmethod
    def verify_token_fingerprint(cls, request: Request) -> bool:
        """
        Verify token fingerprint matches current request
        
        Args:
            request: FastAPI Request object
            
        Returns:
            True if valid, False otherwise
        """
        # Get stored fingerprint hash from cookie
        stored_hash = request.cookies.get(cls.TOKEN_FINGERPRINT_COOKIE)
        
        if not stored_hash:
            # If no fingerprint stored, consider it valid (for backward compatibility)
            return True
        
        # Generate current fingerprint
        current_fingerprint = cls.generate_token_fingerprint(request)
        current_hash = cls.hash_fingerprint(current_fingerprint)
        
        # Compare hashes
        if stored_hash != current_hash:
            logger.warning("Token fingerprint mismatch - possible session hijacking attempt")
            return False
        
        return True


# Dependency for CSRF protection
def require_csrf_token(request: Request):
    """
    FastAPI dependency to require CSRF token validation
    
    Usage:
        @router.post("/endpoint", dependencies=[Depends(require_csrf_token)])
    
    Args:
        request: FastAPI Request object
        
    Raises:
        HTTPException: If CSRF token is invalid
    """
    if not SecureCookieManager.verify_csrf_token(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token validation failed"
        )


# Dependency for token fingerprint verification
def require_valid_fingerprint(request: Request):
    """
    FastAPI dependency to require token fingerprint validation
    
    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_valid_fingerprint)])
    
    Args:
        request: FastAPI Request object
        
    Raises:
        HTTPException: If token fingerprint is invalid
    """
    if not SecureCookieManager.verify_token_fingerprint(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token fingerprint validation failed - possible session hijacking"
        )


# Global instance
secure_cookie_manager = SecureCookieManager()

