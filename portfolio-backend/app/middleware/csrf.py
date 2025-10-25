"""
CSRF Protection Middleware

Implements Cross-Site Request Forgery protection using double-submit cookie pattern.
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.secure_cookies import SecureCookieManager
from app.core.logging import setup_logger
from fastapi.responses import JSONResponse

logger = setup_logger("app.middleware.csrf")


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to protect against CSRF attacks
    
    Implementation:
    - Double-submit cookie pattern
    - Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    - Skips validation for safe methods (GET, HEAD, OPTIONS)
    - Skips validation for specific endpoints (login, public endpoints)
    
    The frontend must:
    1. Read CSRF token from cookie
    2. Include it in X-CSRF-Token header for all state-changing requests
    """
    
    # Endpoints that don't require CSRF protection
    EXEMPT_PATHS = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/password-reset-request",
        "/api/auth/mfa/verify-login",
        "/docs",
        "/openapi.json",
        "/healthz",
        "/readyz",
    ]
    
    # Methods that don't require CSRF protection
    SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]
    
    def __init__(self, app: ASGIApp, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled
        if not enabled:
            logger.info("CSRF protection middleware initialized (DISABLED)")
        else:
            logger.info("CSRF protection middleware initialized (ENABLED)")
    
    async def dispatch(self, request: Request, call_next):
        """Process request with CSRF protection"""
        
        # Skip if disabled
        if not self.enabled:
            return await call_next(request)
        
        # Skip for safe methods
        if request.method in self.SAFE_METHODS:
            return await call_next(request)
        
        # Skip for exempt paths
        request_path = request.url.path
        if any(request_path.startswith(exempt_path) for exempt_path in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Skip CSRF validation if using Bearer token authentication (API clients)
        # Cookie-based auth requires CSRF, but Bearer token auth doesn't need it
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # This is API authentication via Bearer token, skip CSRF
            return await call_next(request)
        
        # Verify CSRF token for cookie-based authentication
        if not SecureCookieManager.verify_csrf_token(request):
            logger.warning(
                f"CSRF validation failed for {request.method} {request_path} "
                f"from {request.client.host if request.client else 'unknown'}"
            )
            
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "CSRF token validation failed",
                    "code": "CSRF_VALIDATION_FAILED"
                }
            )
        
        # Token is valid, process request
        response = await call_next(request)
        return response

