"""
Security Events Middleware

Automatically captures security-relevant events from HTTP requests
and tracks them in the security monitoring system.

Features:
- Automatic event capture for authentication failures
- Injection attempt detection and tracking
- Anomaly detection integration
- Request correlation tracking
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import logging
from typing import Callable
import uuid

from app.core.security_monitor import security_monitor, EventType, EventSeverity
from app.core.validators import input_validator

logger = logging.getLogger(__name__)


class SecurityEventsMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically capture and track security events.
    
    Monitors:
    - Failed authentication attempts
    - Unauthorized access attempts
    - Input validation failures (SQL injection, XSS, etc.)
    - Suspicious request patterns
    - Rate limiting violations
    """
    
    def __init__(self, app: ASGIApp, enabled: bool = True):
        """
        Initialize security events middleware.
        
        Args:
            app: FastAPI application
            enabled: Whether middleware is enabled
        """
        super().__init__(app)
        self.enabled = enabled
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and capture security events"""
        if not self.enabled:
            return await call_next(request)
        
        # Generate request ID for correlation
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Get request details
        client_host = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")
        method = request.method
        path = request.url.path
        
        # Track request start time
        start_time = time.time()
        
        try:
            # Check for suspicious patterns in URL
            if self._check_url_injection(path):
                security_monitor.track_event(
                    event_type=self._get_injection_type(path),
                    severity=EventSeverity.ERROR,
                    ip_address=client_host,
                    user_agent=user_agent,
                    endpoint=path,
                    method=method,
                    details={"pattern": "suspicious_url"},
                    request_id=request_id
                )
            
            # Check for suspicious query parameters
            if request.url.query:
                if self._check_query_injection(str(request.url.query)):
                    security_monitor.track_event(
                        event_type=self._get_injection_type(str(request.url.query)),
                        severity=EventSeverity.ERROR,
                        ip_address=client_host,
                        user_agent=user_agent,
                        endpoint=path,
                        method=method,
                        details={"pattern": "suspicious_query"},
                        request_id=request_id
                    )
            
            # Process request
            response = await call_next(request)
            
            # Track response time
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Track security-relevant status codes
            if response.status_code == 401:
                # Unauthorized - failed authentication
                security_monitor.track_event(
                    event_type=EventType.LOGIN_FAILED,
                    severity=EventSeverity.WARNING,
                    ip_address=client_host,
                    user_agent=user_agent,
                    endpoint=path,
                    method=method,
                    details={"status_code": 401, "duration_ms": duration_ms},
                    request_id=request_id
                )
            
            elif response.status_code == 403:
                # Forbidden - authorization failure
                user = getattr(request.state, "user", None)
                security_monitor.track_event(
                    event_type=EventType.PERMISSION_DENIED,
                    severity=EventSeverity.WARNING,
                    user_id=user.id if user else None,
                    username=user.username if user else None,
                    ip_address=client_host,
                    user_agent=user_agent,
                    endpoint=path,
                    method=method,
                    details={"status_code": 403, "duration_ms": duration_ms},
                    request_id=request_id
                )
            
            elif response.status_code == 429:
                # Too Many Requests - rate limit exceeded
                security_monitor.track_event(
                    event_type=EventType.RATE_LIMIT_EXCEEDED,
                    severity=EventSeverity.WARNING,
                    ip_address=client_host,
                    user_agent=user_agent,
                    endpoint=path,
                    method=method,
                    details={"status_code": 429, "duration_ms": duration_ms},
                    request_id=request_id
                )
            
            # Check for anomalies after processing
            if client_host and security_monitor.is_suspicious_ip(client_host):
                logger.warning(f"Request from suspicious IP: {client_host} to {path}")
            
            return response
            
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Security middleware error: {e}", exc_info=True)
            raise
    
    def _check_url_injection(self, url: str) -> bool:
        """Check URL for injection attempts"""
        # SQL injection check
        is_safe, _ = input_validator.validate_sql_safe(url)
        if not is_safe:
            return True
        
        # XSS check
        is_safe, _ = input_validator.validate_xss_safe(url)
        if not is_safe:
            return True
        
        # Path traversal check
        is_safe, _ = input_validator.validate_path_safe(url)
        if not is_safe:
            return True
        
        # Command injection check
        is_safe, _ = input_validator.validate_command_safe(url)
        if not is_safe:
            return True
        
        return False
    
    def _check_query_injection(self, query: str) -> bool:
        """Check query parameters for injection attempts"""
        # SQL injection check
        is_safe, _ = input_validator.validate_sql_safe(query)
        if not is_safe:
            return True
        
        # XSS check
        is_safe, _ = input_validator.validate_xss_safe(query)
        if not is_safe:
            return True
        
        return False
    
    def _get_injection_type(self, value: str) -> str:
        """Determine type of injection attempt"""
        # Check each type
        is_safe, _ = input_validator.validate_sql_safe(value)
        if not is_safe:
            return EventType.SQL_INJECTION_ATTEMPT
        
        is_safe, _ = input_validator.validate_xss_safe(value)
        if not is_safe:
            return EventType.XSS_ATTEMPT
        
        is_safe, _ = input_validator.validate_path_safe(value)
        if not is_safe:
            return EventType.PATH_TRAVERSAL_ATTEMPT
        
        is_safe, _ = input_validator.validate_command_safe(value)
        if not is_safe:
            return EventType.COMMAND_INJECTION_ATTEMPT
        
        return EventType.SUSPICIOUS_LOGIN  # Default


__all__ = ['SecurityEventsMiddleware']

