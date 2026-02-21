"""
Cookie-Based Authentication Utilities

Provides secure httpOnly cookie-based token storage as an alternative to localStorage.
This is more secure as it prevents XSS attacks from accessing tokens.

Usage:
    In auth endpoints, use set_auth_cookies() to set tokens in httpOnly cookies
    instead of returning them in the response body.
"""

from fastapi import Response, Request, HTTPException, status
from datetime import timedelta
from app.core.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    access_token_expires: timedelta,
    refresh_token_expires: timedelta
) -> None:
    """
    Set authentication tokens as httpOnly secure cookies
    
    Args:
        response: FastAPI Response object
        access_token: JWT access token
        refresh_token: JWT refresh token
        access_token_expires: Expiration time for access token
        refresh_token_expires: Expiration time for refresh token
    
    Security features:
    - httponly=True: Prevents JavaScript access (XSS protection)
    - secure=True: Only sent over HTTPS (in production)
    - samesite='lax': CSRF protection (allows some cross-site usage)
    """
    
    # Determine if we should use secure cookies (HTTPS only)
    # Always use secure=True in production
    secure = settings.is_production()
    
    # Access token cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        max_age=int(access_token_expires.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    
    # Refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=int(refresh_token_expires.total_seconds()),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/api/auth/refresh",  # Only send to refresh endpoint
    )
    
    # Set a non-httpOnly cookie to indicate authentication status
    # Frontend can read this to know if user is authenticated
    response.set_cookie(
        key="authenticated",
        value="true",
        max_age=int(access_token_expires.total_seconds()),
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
    )
    
    if settings.is_development():
        logger.debug("Auth cookies set successfully")


def clear_auth_cookies(response: Response) -> None:
    """
    Clear all authentication cookies (for logout)
    
    Args:
        response: FastAPI Response object
    """
    cookies_to_clear = ["access_token", "refresh_token", "authenticated"]
    
    for cookie in cookies_to_clear:
        response.delete_cookie(
            key=cookie,
            path="/" if cookie != "refresh_token" else "/api/auth/refresh",
            httponly=cookie != "authenticated",
            samesite="lax",
        )
    
    if settings.is_development():
        logger.debug("Auth cookies cleared")


def get_token_from_cookie(request: Request) -> Optional[str]:
    """
    Extract JWT token from httpOnly cookie
    
    Args:
        request: FastAPI Request object
    
    Returns:
        The JWT token string, or None if not found
    
    Raises:
        HTTPException: If cookie exists but is malformed
    """
    access_token = request.cookies.get("access_token")
    
    if not access_token:
        return None
    
    # Remove "Bearer " prefix if present
    if access_token.startswith("Bearer "):
        return access_token[7:]
    
    return access_token


def get_refresh_token_from_cookie(request: Request) -> Optional[str]:
    """
    Extract refresh token from httpOnly cookie
    
    Args:
        request: FastAPI Request object
    
    Returns:
        The refresh token string, or None if not found
    """
    return request.cookies.get("refresh_token")


# CSRF Protection utilities
def generate_csrf_token() -> str:
    """
    Generate a CSRF token for cookie-based auth
    
    Returns:
        A secure random CSRF token
    """
    import secrets
    return secrets.token_urlsafe(32)


def set_csrf_token(response: Response, token: str) -> None:
    """
    Set CSRF token as a cookie
    
    The CSRF token is set as a non-httpOnly cookie so JavaScript can read it
    and include it in request headers.
    
    Args:
        response: FastAPI Response object
        token: CSRF token to set
    """
    response.set_cookie(
        key="csrf_token",
        value=token,
        max_age=3600,  # 1 hour
        httponly=False,  # Frontend needs to read this
        secure=settings.is_production(),
        samesite="lax",
        path="/",
    )


def validate_csrf_token(request: Request, expected_token: str) -> bool:
    """
    Validate CSRF token from request header against cookie
    
    Args:
        request: FastAPI Request object
        expected_token: Expected CSRF token from cookie
    
    Returns:
        True if tokens match, False otherwise
    """
    header_token = request.headers.get("X-CSRF-Token")
    
    if not header_token:
        return False
    
    return header_token == expected_token


def require_csrf_token(request: Request) -> None:
    """
    Middleware-style CSRF validation
    
    Args:
        request: FastAPI Request object
    
    Raises:
        HTTPException: If CSRF validation fails
    """
    # Only validate CSRF for state-changing methods
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        cookie_token = request.cookies.get("csrf_token")
        
        if not cookie_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )
        
        if not validate_csrf_token(request, cookie_token):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed"
            )


# Cookie-based authentication dependency
async def get_current_user_from_cookie(request: Request):
    """
    Dependency to get current user from cookie-based auth
    
    This can be used as an alternative to the header-based auth
    when implementing cookie-based authentication.
    
    Usage:
        @app.get("/protected")
        async def protected_route(
            user = Depends(get_current_user_from_cookie)
        ):
            return {"user": user}
    
    Args:
        request: FastAPI Request object
    
    Returns:
        The current authenticated user
    
    Raises:
        HTTPException: If authentication fails
    """
    from app.auth.jwt import decode_access_token
    from app.models.user import User
    from app.core.database import SessionLocal
    
    token = get_token_from_cookie(request)
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = decode_access_token(token)
        username: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user
    finally:
        db.close()


# Hybrid authentication dependency (supports both cookies and headers)
async def get_current_user_hybrid(request: Request):
    """
    Dependency that supports both cookie and header-based authentication
    
    Tries cookie first, falls back to Authorization header
    
    Args:
        request: FastAPI Request object
    
    Returns:
        The current authenticated user
    
    Raises:
        HTTPException: If authentication fails
    """
    # Try cookie-based auth first
    try:
        token = get_token_from_cookie(request)
        if token:
            # Use existing decode logic
            from app.auth.jwt import decode_access_token
            from app.models.user import User
            from app.core.database import SessionLocal
            
            payload = decode_access_token(token)
            username: str = payload.get("sub")
            
            if username:
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.username == username).first()
                    if user:
                        return user
                finally:
                    db.close()
    except Exception:
        pass
    
    # Fall back to header-based auth
    from app.api.deps import get_current_active_user
    return await get_current_active_user(request)

