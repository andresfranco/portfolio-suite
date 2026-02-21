"""
Security Monitoring & Event Detection System

Provides real-time security monitoring, event detection, and alerting
for suspicious activities and security incidents.

Features:
- Security event classification and tracking
- Anomaly detection (failed logins, rate limit violations, etc.)
- Real-time alerting for critical security events
- Security metrics collection
- Attack pattern detection

Usage:
    from app.core.security_monitor import security_monitor
    
    # Track security event
    security_monitor.track_event(
        event_type="failed_login",
        severity="warning",
        user_id=user.id,
        ip_address=request.client.host,
        details={"reason": "invalid_password"}
    )
    
    # Check for anomalies
    is_suspicious = security_monitor.detect_anomaly(
        user_id=user.id,
        event_type="failed_login"
    )
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import asyncio
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


class EventSeverity(str, Enum):
    """Security event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class EventType(str, Enum):
    """Security event types"""
    # Authentication events
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    MFA_FAILED = "mfa_failed"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    
    # Authorization events
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PERMISSION_DENIED = "permission_denied"
    ROLE_CHANGED = "role_changed"
    
    # Account security events
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    SUSPICIOUS_LOGIN = "suspicious_login"
    NEW_DEVICE_LOGIN = "new_device_login"
    
    # Input validation events
    SQL_INJECTION_ATTEMPT = "sql_injection_attempt"
    XSS_ATTEMPT = "xss_attempt"
    PATH_TRAVERSAL_ATTEMPT = "path_traversal_attempt"
    COMMAND_INJECTION_ATTEMPT = "command_injection_attempt"
    
    # Rate limiting events
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    IP_BLOCKED = "ip_blocked"
    IP_UNBLOCKED = "ip_unblocked"
    
    # File upload events
    MALWARE_DETECTED = "malware_detected"
    SUSPICIOUS_FILE_UPLOAD = "suspicious_file_upload"
    
    # Data access events
    SENSITIVE_DATA_ACCESS = "sensitive_data_access"
    BULK_DATA_EXPORT = "bulk_data_export"
    DATA_DELETION = "data_deletion"
    
    # System events
    CONFIG_CHANGED = "config_changed"
    ADMIN_ACTION = "admin_action"
    SECURITY_SCAN = "security_scan"
    VULNERABILITY_DETECTED = "vulnerability_detected"


@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_type: str
    severity: str
    timestamp: datetime
    user_id: Optional[int] = None
    username: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


@dataclass
class AnomalyThreshold:
    """Anomaly detection thresholds"""
    event_type: str
    max_events: int
    time_window_minutes: int
    severity: str


class SecurityMonitor:
    """
    Central security monitoring and alerting system.
    
    Tracks security events, detects anomalies, and triggers alerts
    for suspicious activities.
    """
    
    def __init__(self):
        """Initialize security monitor"""
        # Event storage (in-memory, should be replaced with Redis/DB in production)
        self.events: deque = deque(maxlen=10000)  # Keep last 10k events
        
        # Per-user event tracking for anomaly detection
        self.user_events: Dict[int, deque] = defaultdict(lambda: deque(maxlen=100))
        
        # Per-IP event tracking
        self.ip_events: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        
        # Alert callbacks
        self.alert_callbacks: List = []
        
        # Anomaly thresholds
        self.anomaly_thresholds = self._init_thresholds()
        
        # Metrics
        self.metrics = defaultdict(int)
        
        # Suspicious IPs (temporary storage)
        self.suspicious_ips: Dict[str, datetime] = {}
        
        # Suspicious users (temporary storage)
        self.suspicious_users: Dict[int, datetime] = {}
        
        logger.info("Security monitor initialized")
    
    def _init_thresholds(self) -> Dict[str, AnomalyThreshold]:
        """Initialize anomaly detection thresholds"""
        return {
            "failed_login": AnomalyThreshold(
                event_type="login_failed",
                max_events=5,
                time_window_minutes=15,
                severity="warning"
            ),
            "unauthorized_access": AnomalyThreshold(
                event_type="unauthorized_access",
                max_events=3,
                time_window_minutes=10,
                severity="error"
            ),
            "sql_injection": AnomalyThreshold(
                event_type="sql_injection_attempt",
                max_events=1,
                time_window_minutes=5,
                severity="critical"
            ),
            "xss_attempt": AnomalyThreshold(
                event_type="xss_attempt",
                max_events=1,
                time_window_minutes=5,
                severity="critical"
            ),
            "rate_limit": AnomalyThreshold(
                event_type="rate_limit_exceeded",
                max_events=10,
                time_window_minutes=5,
                severity="warning"
            ),
        }
    
    def track_event(
        self,
        event_type: str,
        severity: str = "info",
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        method: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ) -> SecurityEvent:
        """
        Track a security event.
        
        Args:
            event_type: Type of security event
            severity: Event severity (info, warning, error, critical)
            user_id: User ID if applicable
            username: Username if applicable
            ip_address: IP address of request
            user_agent: User agent string
            endpoint: API endpoint
            method: HTTP method
            resource_type: Type of resource accessed
            resource_id: ID of resource accessed
            details: Additional event details
            request_id: Request correlation ID
            
        Returns:
            SecurityEvent instance
        """
        event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            timestamp=datetime.utcnow(),
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            method=method,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            request_id=request_id
        )
        
        # Store event
        self.events.append(event)
        
        # Track per-user
        if user_id:
            self.user_events[user_id].append(event)
        
        # Track per-IP
        if ip_address:
            self.ip_events[ip_address].append(event)
        
        # Update metrics
        self.metrics[f"event_{event_type}"] += 1
        self.metrics[f"severity_{severity}"] += 1
        
        # Log event
        log_level = self._get_log_level(severity)
        logger.log(
            log_level,
            f"Security event: {event_type} | Severity: {severity} | "
            f"User: {username or user_id} | IP: {ip_address} | "
            f"Details: {details}"
        )
        
        # Check for anomalies
        if severity in ["error", "critical"]:
            self._check_anomalies(event)
        
        # Trigger alerts for critical events
        if severity == "critical":
            asyncio.create_task(self._trigger_alert(event))
        
        return event
    
    def _get_log_level(self, severity: str) -> int:
        """Get logging level from severity"""
        return {
            "info": logging.INFO,
            "warning": logging.WARNING,
            "error": logging.ERROR,
            "critical": logging.CRITICAL
        }.get(severity, logging.INFO)
    
    def _check_anomalies(self, event: SecurityEvent):
        """Check for anomalous patterns"""
        # Check user-based anomalies
        if event.user_id and self.detect_anomaly(
            user_id=event.user_id,
            event_type=event.event_type
        ):
            self.suspicious_users[event.user_id] = datetime.utcnow()
            logger.warning(
                f"Anomaly detected for user {event.user_id}: "
                f"Multiple {event.event_type} events"
            )
        
        # Check IP-based anomalies
        if event.ip_address and self.detect_anomaly(
            ip_address=event.ip_address,
            event_type=event.event_type
        ):
            self.suspicious_ips[event.ip_address] = datetime.utcnow()
            logger.warning(
                f"Anomaly detected for IP {event.ip_address}: "
                f"Multiple {event.event_type} events"
            )
    
    async def _trigger_alert(self, event: SecurityEvent):
        """Trigger alert for critical event"""
        logger.critical(
            f"SECURITY ALERT: {event.event_type} | "
            f"User: {event.username or event.user_id} | "
            f"IP: {event.ip_address} | "
            f"Details: {event.details}"
        )
        
        # Call registered alert callbacks
        for callback in self.alert_callbacks:
            try:
                await callback(event)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")
    
    def detect_anomaly(
        self,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        event_type: Optional[str] = None
    ) -> bool:
        """
        Detect anomalous behavior based on event patterns.
        
        Args:
            user_id: User ID to check
            ip_address: IP address to check
            event_type: Specific event type to check
            
        Returns:
            True if anomaly detected, False otherwise
        """
        # Get applicable thresholds
        thresholds = []
        if event_type:
            # Check specific event type
            for key, threshold in self.anomaly_thresholds.items():
                if threshold.event_type == event_type:
                    thresholds.append(threshold)
        else:
            # Check all thresholds
            thresholds = list(self.anomaly_thresholds.values())
        
        # Check user-based anomalies
        if user_id:
            events = self.user_events.get(user_id, [])
            for threshold in thresholds:
                if self._check_threshold(events, threshold):
                    return True
        
        # Check IP-based anomalies
        if ip_address:
            events = self.ip_events.get(ip_address, [])
            for threshold in thresholds:
                if self._check_threshold(events, threshold):
                    return True
        
        return False
    
    def _check_threshold(
        self,
        events: deque,
        threshold: AnomalyThreshold
    ) -> bool:
        """Check if events exceed threshold"""
        if not events:
            return False
        
        # Filter events by type and time window
        cutoff_time = datetime.utcnow() - timedelta(minutes=threshold.time_window_minutes)
        recent_events = [
            e for e in events
            if e.event_type == threshold.event_type and e.timestamp > cutoff_time
        ]
        
        return len(recent_events) >= threshold.max_events
    
    def is_suspicious_user(self, user_id: int) -> bool:
        """Check if user is flagged as suspicious"""
        if user_id in self.suspicious_users:
            # Check if flag is still valid (last 1 hour)
            flagged_time = self.suspicious_users[user_id]
            if datetime.utcnow() - flagged_time < timedelta(hours=1):
                return True
            else:
                # Remove expired flag
                del self.suspicious_users[user_id]
        return False
    
    def is_suspicious_ip(self, ip_address: str) -> bool:
        """Check if IP is flagged as suspicious"""
        if ip_address in self.suspicious_ips:
            # Check if flag is still valid (last 1 hour)
            flagged_time = self.suspicious_ips[ip_address]
            if datetime.utcnow() - flagged_time < timedelta(hours=1):
                return True
            else:
                # Remove expired flag
                del self.suspicious_ips[ip_address]
        return False
    
    def get_recent_events(
        self,
        limit: int = 100,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None
    ) -> List[SecurityEvent]:
        """
        Get recent security events with filtering.
        
        Args:
            limit: Maximum number of events to return
            severity: Filter by severity
            event_type: Filter by event type
            user_id: Filter by user ID
            ip_address: Filter by IP address
            
        Returns:
            List of SecurityEvent instances
        """
        filtered_events = []
        
        for event in reversed(self.events):
            # Apply filters
            if severity and event.severity != severity:
                continue
            if event_type and event.event_type != event_type:
                continue
            if user_id and event.user_id != user_id:
                continue
            if ip_address and event.ip_address != ip_address:
                continue
            
            filtered_events.append(event)
            
            if len(filtered_events) >= limit:
                break
        
        return filtered_events
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get security metrics summary.
        
        Returns:
            Dictionary of metrics
        """
        return {
            "total_events": len(self.events),
            "suspicious_users": len(self.suspicious_users),
            "suspicious_ips": len(self.suspicious_ips),
            "event_counts": dict(self.metrics),
            "recent_critical_events": len([
                e for e in self.events
                if e.severity == "critical" and
                datetime.utcnow() - e.timestamp < timedelta(hours=1)
            ]),
            "recent_failed_logins": len([
                e for e in self.events
                if e.event_type == "login_failed" and
                datetime.utcnow() - e.timestamp < timedelta(hours=1)
            ]),
        }
    
    def get_attack_summary(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get summary of attack attempts in the specified time window.
        
        Args:
            hours: Number of hours to look back
            
        Returns:
            Dictionary with attack summary
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        attack_types = [
            "sql_injection_attempt",
            "xss_attempt",
            "path_traversal_attempt",
            "command_injection_attempt",
            "malware_detected"
        ]
        
        attack_events = [
            e for e in self.events
            if e.event_type in attack_types and e.timestamp > cutoff_time
        ]
        
        # Group by type
        by_type = defaultdict(int)
        by_ip = defaultdict(int)
        by_user = defaultdict(int)
        
        for event in attack_events:
            by_type[event.event_type] += 1
            if event.ip_address:
                by_ip[event.ip_address] += 1
            if event.user_id:
                by_user[event.user_id] += 1
        
        return {
            "total_attacks": len(attack_events),
            "by_type": dict(by_type),
            "top_attacking_ips": sorted(by_ip.items(), key=lambda x: x[1], reverse=True)[:10],
            "affected_users": len(by_user),
            "time_window_hours": hours
        }
    
    def register_alert_callback(self, callback):
        """
        Register a callback for critical alerts.
        
        Args:
            callback: Async function to call on critical events
        """
        self.alert_callbacks.append(callback)
        logger.info(f"Registered alert callback: {callback.__name__}")
    
    def clear_old_events(self, hours: int = 24):
        """
        Clear events older than specified hours.
        
        This should be called periodically to prevent memory issues.
        In production, events should be persisted to database.
        
        Args:
            hours: Age threshold in hours
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Events deque is already size-limited, but clear user/IP tracking
        for user_id in list(self.user_events.keys()):
            events = self.user_events[user_id]
            recent = deque([e for e in events if e.timestamp > cutoff_time], maxlen=100)
            if recent:
                self.user_events[user_id] = recent
            else:
                del self.user_events[user_id]
        
        for ip in list(self.ip_events.keys()):
            events = self.ip_events[ip]
            recent = deque([e for e in events if e.timestamp > cutoff_time], maxlen=100)
            if recent:
                self.ip_events[ip] = recent
            else:
                del self.ip_events[ip]
        
        logger.info(f"Cleared events older than {hours} hours")


# Global security monitor instance
security_monitor = SecurityMonitor()


__all__ = [
    'SecurityMonitor',
    'SecurityEvent',
    'EventSeverity',
    'EventType',
    'AnomalyThreshold',
    'security_monitor',
]

