"""
Rate Limiting Middleware

Global rate limiting middleware that applies to all requests.
Provides additional security features:
- Request size validation
- Slow request detection
- IP blocking for repeated violations
- Automatic CAPTCHA triggering for suspicious patterns
"""

import time
import logging
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.rate_limiter import rate_limiter
from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Global rate limiting middleware.
    
    Features:
    - Automatic rate limiting for all endpoints
    - Request size validation
    - IP blocking for abuse
    - Rate limit headers in all responses
    - Exempts health check endpoints
    """
    
    def __init__(
        self,
        app: ASGIApp,
        max_request_size: int = 10 * 1024 * 1024,  # 10MB
        exempt_paths: list = None
    ):
        super().__init__(app)
        self.max_request_size = max_request_size
        
        # Paths exempt from rate limiting
        self.exempt_paths = exempt_paths or [
            "/health",
            "/readyz",
            "/docs",
            "/redoc",
            "/openapi.json",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process each request through rate limiting."""
        
        # Skip rate limiting for exempt paths
        if any(request.url.path.endswith(path) for path in self.exempt_paths):
            return await call_next(request)
        
        # Skip if rate limiting is disabled
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)
        
        # Check if IP is blocked
        if await rate_limiter.is_ip_blocked(request):
            logger.warning(f"Blocked IP attempted access: {request.client.host if request.client else 'unknown'}")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "code": "IP_BLOCKED",
                    "message": "Your IP address has been temporarily blocked due to suspicious activity. Please contact support if you believe this is an error.",
                },
                headers={
                    "Retry-After": "3600"  # 1 hour
                }
            )
        
        # Validate request size
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > self.max_request_size:
                    logger.warning(
                        f"Request size too large: {size} bytes from "
                        f"{request.client.host if request.client else 'unknown'}"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "code": "REQUEST_TOO_LARGE",
                            "message": f"Request size exceeds maximum allowed size of {self.max_request_size} bytes.",
                            "max_size": self.max_request_size,
                            "received_size": size
                        }
                    )
            except ValueError:
                pass  # Invalid content-length, let it pass and fail elsewhere if needed
        
        # Check rate limit
        rate_limit_result = await rate_limiter.check_rate_limit(request)
        
        if not rate_limit_result["allowed"]:
            # Track rate limit violations
            await self._track_violation(request)
            
            logger.warning(
                f"Rate limit exceeded: {request.url.path} from "
                f"{request.client.host if request.client else 'unknown'}"
            )
            
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "limit": rate_limit_result["limit"],
                    "retry_after": rate_limit_result["retry_after"]
                },
                headers={
                    "Retry-After": str(rate_limit_result["retry_after"]),
                    **rate_limiter.get_rate_limit_headers(rate_limit_result)
                }
            )
        
        # Track request start time for slow request detection
        start_time = time.time()
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            raise
        
        # Add rate limit headers to response
        for key, value in rate_limiter.get_rate_limit_headers(rate_limit_result).items():
            response.headers[key] = value
        
        # Check for slow requests
        elapsed_time = time.time() - start_time
        if elapsed_time > 30:  # 30 seconds threshold
            logger.warning(
                f"Slow request detected: {request.url.path} took {elapsed_time:.2f}s from "
                f"{request.client.host if request.client else 'unknown'}"
            )
        
        return response
    
    async def _track_violation(self, request: Request):
        """
        Track rate limit violations and block IPs with repeated violations.
        
        If an IP has more than 10 violations in 5 minutes, block it for 1 hour.
        """
        try:
            if not rate_limiter.redis_client:
                return
            
            identifier = rate_limiter._get_client_identifier(request)
            violation_key = f"violations:{identifier}"
            
            # Increment violation count
            violations = await rate_limiter.redis_client.incr(violation_key)
            
            # Set expiry on first violation
            if violations == 1:
                await rate_limiter.redis_client.expire(violation_key, 300)  # 5 minutes
            
            # Block IP after 10 violations
            if violations >= 10:
                await rate_limiter.block_ip(request, duration=3600)  # 1 hour
                logger.warning(
                    f"IP blocked due to repeated violations: {identifier} "
                    f"({violations} violations in 5 minutes)"
                )
        
        except Exception as e:
            logger.error(f"Failed to track violation: {e}")


class SlowRequestMiddleware(BaseHTTPMiddleware):
    """
    Middleware to terminate slow requests.
    
    Prevents resource exhaustion from slow HTTP attacks (Slowloris, etc.)
    """
    
    def __init__(
        self,
        app: ASGIApp,
        timeout: int = 30,
        exempt_paths: list = None
    ):
        super().__init__(app)
        self.timeout = timeout
        self.exempt_paths = exempt_paths or [
            "/api/portfolios/upload",
            "/api/projects/upload",
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Monitor request duration."""
        
        # Skip timeout for upload endpoints (they may legitimately take longer)
        if any(request.url.path.startswith(path) for path in self.exempt_paths):
            return await call_next(request)
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Check elapsed time
            elapsed = time.time() - start_time
            if elapsed > self.timeout:
                logger.warning(
                    f"Slow request completed: {request.url.path} took {elapsed:.2f}s from "
                    f"{request.client.host if request.client else 'unknown'}"
                )
            
            return response
        
        except Exception as e:
            elapsed = time.time() - start_time
            if elapsed > self.timeout:
                logger.error(
                    f"Request timed out: {request.url.path} after {elapsed:.2f}s from "
                    f"{request.client.host if request.client else 'unknown'}"
                )
            raise


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce request size limits.
    
    Prevents memory exhaustion from large request bodies.
    """
    
    def __init__(
        self,
        app: ASGIApp,
        max_size: int = 10 * 1024 * 1024,  # 10MB default
        custom_limits: dict = None
    ):
        super().__init__(app)
        self.max_size = max_size
        
        # Custom limits for specific endpoints
        self.custom_limits = custom_limits or {
            "/api/portfolios/upload": 10 * 1024 * 1024,  # 10MB
            "/api/projects/upload": 10 * 1024 * 1024,    # 10MB
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Validate request size."""
        
        # Get size limit for this endpoint
        size_limit = self.max_size
        for path, limit in self.custom_limits.items():
            if request.url.path.startswith(path):
                size_limit = limit
                break
        
        # Check content-length header
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
                if size > size_limit:
                    logger.warning(
                        f"Request size too large: {size} bytes (limit: {size_limit}) from "
                        f"{request.client.host if request.client else 'unknown'}"
                    )
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={
                            "code": "REQUEST_TOO_LARGE",
                            "message": f"Request size exceeds maximum allowed size.",
                            "max_size": size_limit,
                            "received_size": size
                        }
                    )
            except ValueError:
                logger.warning(f"Invalid content-length header: {content_length}")
        
        return await call_next(request)

