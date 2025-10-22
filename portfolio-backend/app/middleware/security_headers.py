"""
Security Headers Middleware

Implements comprehensive HTTP security headers to protect against common web vulnerabilities.
Headers are configured based on environment (development vs production).
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all HTTP responses
    
    Headers added:
    - Strict-Transport-Security (HSTS): Forces HTTPS connections
    - X-Content-Type-Options: Prevents MIME type sniffing
    - X-Frame-Options: Prevents clickjacking
    - X-XSS-Protection: Enables browser XSS protection
    - Content-Security-Policy (CSP): Restricts resource loading
    - Referrer-Policy: Controls referrer information
    - Permissions-Policy: Controls browser features
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.is_production = settings.is_production()
        self.hsts_enabled = getattr(settings, 'HSTS_ENABLED', False)
        self.csp_enabled = getattr(settings, 'CSP_ENABLED', True)
        
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        self._add_security_headers(response)
        
        return response
    
    def _add_security_headers(self, response: Response):
        """Add comprehensive security headers to response"""
        
        # X-Content-Type-Options: Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-Frame-Options: Prevent clickjacking
        # DENY: Don't allow any framing
        # For development, we might be more lenient
        if self.is_production:
            response.headers["X-Frame-Options"] = "DENY"
        else:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
        
        # X-XSS-Protection: Enable browser XSS protection
        # Note: This header is deprecated in modern browsers that support CSP,
        # but we include it for older browser support
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer-Policy: Control referrer information
        # strict-origin-when-cross-origin: Send full URL for same-origin,
        # only origin for cross-origin
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions-Policy: Control browser features
        # Disable potentially dangerous features
        permissions_policy = [
            "geolocation=()",
            "microphone=()",
            "camera=()",
            "payment=()",
            "usb=()",
            "magnetometer=()",
            "gyroscope=()",
            "accelerometer=()",
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions_policy)
        
        # Content-Security-Policy: Restrict resource loading
        if self.csp_enabled:
            csp = self._get_csp_header()
            response.headers["Content-Security-Policy"] = csp
        
        # Strict-Transport-Security (HSTS): Force HTTPS
        # Only enable in production and when HTTPS is available
        if self.is_production and self.hsts_enabled:
            max_age = getattr(settings, 'HSTS_MAX_AGE', 31536000)  # 1 year default
            response.headers["Strict-Transport-Security"] = (
                f"max-age={max_age}; includeSubDomains; preload"
            )
        
        # Remove server header to avoid information disclosure
        if "Server" in response.headers:
            del response.headers["Server"]
        
        # Add custom security header to indicate security middleware is active
        # (only in development for debugging)
        if not self.is_production:
            response.headers["X-Security-Middleware"] = "active"
    
    def _get_csp_header(self) -> str:
        """
        Generate Content Security Policy header
        
        Development: More permissive for local development
        Production: Strict policy to prevent XSS and data injection
        """
        
        if self.is_production:
            # Strict production CSP
            csp_directives = [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",  # unsafe-inline needed for some frameworks
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'",
                "upgrade-insecure-requests",
            ]
        else:
            # Permissive development CSP
            csp_directives = [
                "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: http: https:",
                "font-src 'self' data:",
                "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
                "frame-ancestors 'self'",
                "base-uri 'self'",
                "form-action 'self'",
            ]
        
        return "; ".join(csp_directives)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add unique request ID to each request
    Useful for tracking requests in logs and debugging
    """
    
    async def dispatch(self, request: Request, call_next):
        import uuid
        
        # Generate or use existing request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Store in request state for access in endpoints
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response

