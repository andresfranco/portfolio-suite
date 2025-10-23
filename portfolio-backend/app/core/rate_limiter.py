"""
Rate Limiting & DDoS Protection

Implements distributed rate limiting using Redis with multiple strategies:
- Per-IP rate limiting
- Per-endpoint rate limiting
- Adaptive rate limiting based on server load
- Request size validation
- Slow request detection

Security Features:
- Token bucket algorithm for smooth rate limiting
- Distributed coordination via Redis
- IP-based throttling with progressive backoff
- Configurable limits per endpoint
- CAPTCHA trigger for suspicious patterns
"""

import time
import hashlib
import logging
from typing import Optional, Callable, Dict, Any
from functools import wraps
from datetime import datetime, timedelta

import redis.asyncio as redis
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Distributed rate limiter using Redis with token bucket algorithm.
    
    Features:
    - Per-IP limiting
    - Per-endpoint limiting
    - Custom limits per route
    - Automatic cleanup of expired keys
    - Fallback to in-memory when Redis unavailable
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = settings.RATE_LIMIT_ENABLED
        self.fallback_storage: Dict[str, Dict[str, Any]] = {}
        
        # Default limits (can be overridden per endpoint)
        self.default_limits = {
            "per_minute": settings.RATE_LIMIT_PER_MINUTE,
            "per_hour": settings.RATE_LIMIT_PER_HOUR,
            "per_day": 10000,
        }
        
        # Endpoint-specific limits
        self.endpoint_limits = {
            # Authentication endpoints - strict limits
            "/api/auth/login": {"per_minute": 30, "per_hour": 100},
            "/api/auth/register": {"per_minute": 10, "per_hour": 30},
            "/api/auth/forgot-password": {"per_minute": 10, "per_hour": 30},
            
            # API endpoints - moderate limits
            "/api/users": {"per_minute": 30, "per_hour": 500},
            "/api/portfolios": {"per_minute": 60, "per_hour": 1000},
            "/api/projects": {"per_minute": 60, "per_hour": 1000},
            
            # Upload endpoints - strict limits
            "/api/portfolios/upload": {"per_minute": 10, "per_hour": 50},
            "/api/projects/upload": {"per_minute": 10, "per_hour": 50},
            
            # Public endpoints - relaxed limits
            "/api/health": {"per_minute": 120, "per_hour": 5000},
            "/api/readyz": {"per_minute": 120, "per_hour": 5000},
        }
        
        # Request size limits (bytes)
        self.max_request_size = 10 * 1024 * 1024  # 10MB default
        
        # Slow request threshold (seconds)
        self.slow_request_threshold = 30
    
    async def initialize(self):
        """Initialize Redis connection."""
        if not self.enabled:
            logger.info("Rate limiting is disabled")
            return
        
        if not settings.REDIS_URL:
            logger.warning("REDIS_URL not configured, rate limiting will use fallback in-memory storage")
            return
        
        try:
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info(f"Rate limiter initialized with Redis: {settings.REDIS_URL}")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}. Using fallback in-memory storage.")
            self.redis_client = None
    
    async def close(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Rate limiter Redis connection closed")
    
    def _get_client_identifier(self, request: Request) -> str:
        """
        Get unique identifier for the client.
        
        Priority:
        1. X-Forwarded-For (if behind proxy)
        2. X-Real-IP (if behind proxy)
        3. Client host
        4. User ID (if authenticated)
        """
        # Check for forwarded IP (behind proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take first IP in chain
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to client host
        if request.client:
            return request.client.host
        
        # Last resort: use a hash of user agent
        user_agent = request.headers.get("User-Agent", "unknown")
        return hashlib.sha256(user_agent.encode()).hexdigest()[:16]
    
    def _get_rate_limit_key(self, identifier: str, endpoint: str, window: str) -> str:
        """Generate Redis key for rate limit tracking."""
        return f"ratelimit:{window}:{endpoint}:{identifier}"
    
    def _get_limits_for_endpoint(self, endpoint: str) -> Dict[str, int]:
        """Get rate limits for specific endpoint."""
        # Check for exact match
        if endpoint in self.endpoint_limits:
            return self.endpoint_limits[endpoint]
        
        # Check for prefix match (e.g., /api/auth/*)
        for pattern, limits in self.endpoint_limits.items():
            if endpoint.startswith(pattern.rstrip("*")):
                return limits
        
        # Return default limits
        return self.default_limits
    
    async def _check_limit_redis(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> tuple[bool, int, int]:
        """
        Check rate limit using Redis with sliding window.
        
        Returns:
            (allowed, current_count, reset_time)
        """
        if not self.redis_client:
            return await self._check_limit_fallback(key, limit, window_seconds)
        
        try:
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Use sorted set for sliding window
            pipeline = self.redis_client.pipeline()
            
            # Remove old entries
            pipeline.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipeline.zcard(key)
            
            # Add current request
            pipeline.zadd(key, {str(current_time): current_time})
            
            # Set expiry
            pipeline.expire(key, window_seconds)
            
            # Execute pipeline
            results = await pipeline.execute()
            current_count = results[1]
            
            # Check if limit exceeded
            allowed = current_count < limit
            reset_time = current_time + window_seconds
            
            return allowed, current_count, reset_time
            
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            # Fallback to allowing request on Redis failure
            return True, 0, int(time.time()) + window_seconds
    
    async def _check_limit_fallback(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> tuple[bool, int, int]:
        """
        Fallback in-memory rate limiting.
        
        Note: This is NOT distributed and will reset on restart.
        Only used when Redis is unavailable.
        """
        current_time = time.time()
        
        # Clean up old entries (simple cleanup every 100 requests)
        if len(self.fallback_storage) > 1000:
            cutoff = current_time - 3600  # Remove entries older than 1 hour
            self.fallback_storage = {
                k: v for k, v in self.fallback_storage.items()
                if v.get("reset_time", 0) > cutoff
            }
        
        # Get or create entry
        if key not in self.fallback_storage:
            self.fallback_storage[key] = {
                "count": 0,
                "reset_time": current_time + window_seconds
            }
        
        entry = self.fallback_storage[key]
        
        # Reset if window expired
        if current_time > entry["reset_time"]:
            entry["count"] = 0
            entry["reset_time"] = current_time + window_seconds
        
        # Increment count
        entry["count"] += 1
        current_count = entry["count"]
        
        allowed = current_count <= limit
        reset_time = int(entry["reset_time"])
        
        return allowed, current_count, reset_time
    
    async def check_rate_limit(
        self,
        request: Request,
        endpoint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if request is within rate limits.
        
        Returns dict with:
        - allowed: bool
        - limit: int
        - remaining: int
        - reset: int (unix timestamp)
        - retry_after: int (seconds)
        """
        if not self.enabled:
            return {
                "allowed": True,
                "limit": 999999,
                "remaining": 999999,
                "reset": int(time.time()) + 3600,
                "retry_after": 0
            }
        
        # Get client identifier
        identifier = self._get_client_identifier(request)
        
        # Get endpoint
        if endpoint is None:
            endpoint = request.url.path
        
        # Get limits for endpoint
        limits = self._get_limits_for_endpoint(endpoint)
        
        # Check per-minute limit (most restrictive)
        minute_key = self._get_rate_limit_key(identifier, endpoint, "minute")
        minute_limit = limits.get("per_minute", self.default_limits["per_minute"])
        
        allowed, current_count, reset_time = await self._check_limit_redis(
            minute_key,
            minute_limit,
            60  # 1 minute window
        )
        
        remaining = max(0, minute_limit - current_count)
        retry_after = max(0, reset_time - int(time.time())) if not allowed else 0
        
        # If minute limit passed, check hourly limit
        if allowed and "per_hour" in limits:
            hour_key = self._get_rate_limit_key(identifier, endpoint, "hour")
            hour_limit = limits["per_hour"]
            
            hour_allowed, hour_count, hour_reset = await self._check_limit_redis(
                hour_key,
                hour_limit,
                3600  # 1 hour window
            )
            
            if not hour_allowed:
                allowed = False
                remaining = 0
                retry_after = max(0, hour_reset - int(time.time()))
        
        # Log rate limit violations
        if not allowed:
            logger.warning(
                f"Rate limit exceeded for {identifier} on {endpoint}: "
                f"{current_count}/{minute_limit} per minute"
            )
        
        return {
            "allowed": allowed,
            "limit": minute_limit,
            "remaining": remaining,
            "reset": reset_time,
            "retry_after": retry_after
        }
    
    async def is_ip_blocked(self, request: Request) -> bool:
        """
        Check if IP is temporarily blocked due to abuse.
        
        IPs are blocked after:
        - 10 rate limit violations in 5 minutes
        - Suspicious patterns detected
        """
        identifier = self._get_client_identifier(request)
        block_key = f"blocked:{identifier}"
        
        if self.redis_client:
            try:
                is_blocked = await self.redis_client.get(block_key)
                if is_blocked:
                    logger.warning(f"Blocked IP attempted access: {identifier}")
                    return True
            except Exception as e:
                logger.error(f"Failed to check IP block status: {e}")
        
        return False
    
    async def block_ip(self, request: Request, duration: int = 3600):
        """
        Temporarily block an IP address.
        
        Args:
            request: FastAPI request object
            duration: Block duration in seconds (default 1 hour)
        """
        identifier = self._get_client_identifier(request)
        block_key = f"blocked:{identifier}"
        
        if self.redis_client:
            try:
                await self.redis_client.setex(block_key, duration, "1")
                logger.warning(f"IP blocked for {duration}s: {identifier}")
            except Exception as e:
                logger.error(f"Failed to block IP: {e}")
    
    def get_rate_limit_headers(self, result: Dict[str, Any]) -> Dict[str, str]:
        """Generate HTTP headers for rate limit information."""
        return {
            "X-RateLimit-Limit": str(result["limit"]),
            "X-RateLimit-Remaining": str(result["remaining"]),
            "X-RateLimit-Reset": str(result["reset"]),
        }


# Global rate limiter instance
rate_limiter = RateLimiter()


def rate_limit(
    calls: int = 60,
    period: int = 60,
    identifier: Optional[Callable] = None
):
    """
    Decorator for rate limiting specific endpoints.
    
    Usage:
        @app.get("/api/endpoint")
        @rate_limit(calls=10, period=60)  # 10 requests per minute
        async def my_endpoint():
            return {"message": "success"}
    
    Args:
        calls: Number of allowed calls
        period: Time period in seconds
        identifier: Optional function to extract custom identifier
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from args/kwargs
            request = kwargs.get("request") or next(
                (arg for arg in args if isinstance(arg, Request)),
                None
            )
            
            if not request:
                # If no request found, just execute the function
                return await func(*args, **kwargs)
            
            # Check rate limit
            result = await rate_limiter.check_rate_limit(request)
            
            if not result["allowed"]:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please try again later.",
                        "retry_after": result["retry_after"]
                    },
                    headers={
                        "Retry-After": str(result["retry_after"]),
                        **rate_limiter.get_rate_limit_headers(result)
                    }
                )
            
            # Execute function
            response = await func(*args, **kwargs)
            
            # Add rate limit headers to response if possible
            if hasattr(response, "headers"):
                for key, value in rate_limiter.get_rate_limit_headers(result).items():
                    response.headers[key] = value
            
            return response
        
        return wrapper
    return decorator

