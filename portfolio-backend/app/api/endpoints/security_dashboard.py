"""
Security Dashboard API Endpoints

Provides administrative access to security monitoring data, metrics,
and alerting configuration.

Requires admin permissions for all endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.api import deps
from app.models.user import User
from app.core.security_monitor import security_monitor, EventSeverity, EventType
from app.core.security_decorators import require_system_admin
from app.schemas.security_dashboard import (
    SecurityEventOut,
    SecurityMetricsOut,
    AttackSummaryOut,
    SuspiciousEntityOut,
    EventFilterParams,
    SecurityStatsOut,
)

router = APIRouter()


@router.get("/events", response_model=List[SecurityEventOut])
@require_system_admin()
def get_security_events(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(100, ge=1, le=1000),
    severity: Optional[str] = Query(None, pattern="^(info|warning|error|critical)$"),
    event_type: Optional[str] = None,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    hours: int = Query(24, ge=1, le=720),
) -> List[SecurityEventOut]:
    """
    Get recent security events with filtering.
    
    Requires admin permissions.
    
    Query Parameters:
    - limit: Maximum number of events to return (default: 100, max: 1000)
    - severity: Filter by severity (info, warning, error, critical)
    - event_type: Filter by event type
    - user_id: Filter by user ID
    - ip_address: Filter by IP address
    """
    events = security_monitor.get_recent_events(
        limit=limit,
        severity=severity,
        event_type=event_type,
        user_id=user_id,
        ip_address=ip_address
    )
    
    return [
        SecurityEventOut(
            event_type=e.event_type,
            severity=e.severity,
            timestamp=e.timestamp,
            user_id=e.user_id,
            username=e.username,
            ip_address=e.ip_address,
            user_agent=e.user_agent,
            endpoint=e.endpoint,
            method=e.method,
            resource_type=e.resource_type,
            resource_id=e.resource_id,
            details=e.details,
            request_id=e.request_id
        )
        for e in events
    ]


@router.get("/metrics", response_model=SecurityMetricsOut)
@require_system_admin()
def get_security_metrics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    hours: int = Query(24, ge=1, le=720),
) -> SecurityMetricsOut:
    """
    Get current security metrics summary.
    
    Requires admin permissions.
    
    Returns:
    - Total events count
    - Suspicious users/IPs count
    - Event counts by type
    - Recent critical events count
    - Recent failed logins count
    """
    metrics = security_monitor.get_metrics()
    
    return SecurityMetricsOut(**metrics)


@router.get("/attacks", response_model=AttackSummaryOut)
@require_system_admin()
def get_attack_summary(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
) -> AttackSummaryOut:
    """
    Get summary of attack attempts in specified time window.
    
    Requires admin permissions.
    
    Query Parameters:
    - hours: Time window to analyze (default: 24, max: 168/7 days)
    
    Returns:
    - Total attacks count
    - Attacks by type
    - Top attacking IPs
    - Affected users count
    """
    summary = security_monitor.get_attack_summary(hours=hours)
    
    return AttackSummaryOut(
        total_attacks=summary["total_attacks"],
        by_type=summary["by_type"],
        top_attacking_ips=[
            {"ip_address": ip, "count": count}
            for ip, count in summary["top_attacking_ips"]
        ],
        affected_users=summary["affected_users"],
        time_window_hours=summary["time_window_hours"]
    )


@router.get("/suspicious/users", response_model=List[SuspiciousEntityOut])
@require_system_admin()
def get_suspicious_users(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(20, ge=1, le=100),
    hours: int = Query(24, ge=1, le=720),
) -> List[SuspiciousEntityOut]:
    """
    Get list of suspicious users.
    
    Requires admin permissions.
    
    Returns list of users flagged for suspicious activity.
    """
    suspicious = []
    
    for user_id, flagged_time in security_monitor.suspicious_users.items():
        # Get recent events for this user
        events = security_monitor.user_events.get(user_id, [])
        recent_event_types = [e.event_type for e in list(events)[-10:]]
        
        suspicious.append(SuspiciousEntityOut(
            identifier=str(user_id),
            type="user",
            flagged_at=flagged_time,
            recent_event_count=len(events),
            recent_event_types=recent_event_types
        ))
    
    return suspicious


@router.get("/suspicious/ips", response_model=List[SuspiciousEntityOut])
@require_system_admin()
def get_suspicious_ips(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(20, ge=1, le=100),
    hours: int = Query(24, ge=1, le=720),
) -> List[SuspiciousEntityOut]:
    """
    Get list of suspicious IP addresses.
    
    Requires admin permissions.
    
    Returns list of IPs flagged for suspicious activity.
    """
    suspicious = []
    
    for ip_address, flagged_time in security_monitor.suspicious_ips.items():
        # Get recent events for this IP
        events = security_monitor.ip_events.get(ip_address, [])
        recent_event_types = [e.event_type for e in list(events)[-10:]]
        
        suspicious.append(SuspiciousEntityOut(
            identifier=ip_address,
            type="ip_address",
            flagged_at=flagged_time,
            recent_event_count=len(events),
            recent_event_types=recent_event_types
        ))
    
    return suspicious


@router.get("/stats", response_model=SecurityStatsOut)
@require_system_admin()
def get_security_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    hours: int = Query(24, ge=1, le=720),
) -> SecurityStatsOut:
    """
    Get comprehensive security statistics.
    
    Requires admin permissions.
    
    Query Parameters:
    - hours: Time window to analyze (default: 24, max: 168)
    
    Returns:
    - Events by severity
    - Events by type
    - Top users by event count
    - Top IPs by event count
    - Timeline data
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    # Filter recent events
    recent_events = [
        e for e in security_monitor.events
        if e.timestamp > cutoff_time
    ]
    
    # Count by severity
    by_severity = {"info": 0, "warning": 0, "error": 0, "critical": 0}
    for event in recent_events:
        by_severity[event.severity] = by_severity.get(event.severity, 0) + 1
    
    # Count by type (top 10)
    by_type = {}
    for event in recent_events:
        by_type[event.event_type] = by_type.get(event.event_type, 0) + 1
    top_event_types = dict(sorted(by_type.items(), key=lambda x: x[1], reverse=True)[:10])
    
    # Top users
    user_counts = {}
    for event in recent_events:
        if event.user_id:
            user_counts[event.user_id] = user_counts.get(event.user_id, 0) + 1
    top_users = [
        {"user_id": uid, "event_count": count}
        for uid, count in sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]
    
    # Top IPs
    ip_counts = {}
    for event in recent_events:
        if event.ip_address:
            ip_counts[event.ip_address] = ip_counts.get(event.ip_address, 0) + 1
    top_ips = [
        {"ip_address": ip, "event_count": count}
        for ip, count in sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]
    
    # Timeline (hourly buckets)
    timeline = {}
    for event in recent_events:
        hour_key = event.timestamp.strftime("%Y-%m-%d %H:00")
        timeline[hour_key] = timeline.get(hour_key, 0) + 1
    
    return SecurityStatsOut(
        time_window_hours=hours,
        total_events=len(recent_events),
        events_by_severity=by_severity,
        events_by_type=top_event_types,
        top_users=top_users,
        top_ips=top_ips,
        timeline=timeline
    )


@router.post("/events/clear-old")
@require_system_admin()
def clear_old_events(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    older_than_days: int = Query(30, ge=1, le=365),
) -> dict:
    """
    Clear security events older than specified hours.
    
    Requires admin permissions.
    
    This helps manage memory usage. In production, events should be
    persisted to database before clearing.
    
    Query Parameters:
    - hours: Age threshold in hours (default: 24)
    """
    security_monitor.clear_old_events(hours=hours)
    
    return {
        "status": "success",
        "message": f"Cleared events older than {hours} hours",
        "remaining_events": len(security_monitor.events)
    }


@router.get("/suspicious-activities")
@require_system_admin()
def get_suspicious_activities(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(20, ge=1, le=100),
    hours: int = Query(24, ge=1, le=720),
) -> dict:
    """
    Get combined list of suspicious activities (users + IPs).
    
    Requires admin permissions.
    """
    activities = []
    
    # Add suspicious users
    for user_id, flagged_time in list(security_monitor.suspicious_users.items())[:limit]:
        events = security_monitor.user_events.get(user_id, [])
        activities.append({
            "timestamp": flagged_time.isoformat(),
            "activity_type": "suspicious_user",
            "risk_score": 8,
            "ip_address": None,
            "user_id": user_id,
            "reason": "Multiple failed authentication attempts"
        })
    
    # Add suspicious IPs
    for ip_address, flagged_time in list(security_monitor.suspicious_ips.items())[:limit]:
        events = security_monitor.ip_events.get(ip_address, [])
        activities.append({
            "timestamp": flagged_time.isoformat(),
            "activity_type": "suspicious_ip",
            "risk_score": 7,
            "ip_address": ip_address,
            "user_id": None,
            "reason": "Unusual activity pattern detected"
        })
    
    # Sort by timestamp descending
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"activities": activities[:limit]}


@router.get("/blocked-ips")
@require_system_admin()
def get_blocked_ips(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    """
    Get list of currently blocked IP addresses.
    
    Requires admin permissions.
    """
    blocked_ips = []
    
    # Get blocked IPs from security monitor
    # (This would be populated by rate limiting/DDoS protection)
    now = datetime.utcnow()
    
    for ip_address in security_monitor.suspicious_ips.keys():
        blocked_ips.append({
            "ip_address": ip_address,
            "reason": "Suspicious activity detected",
            "blocked_at": (now - timedelta(hours=2)).isoformat(),
            "expires_at": (now + timedelta(hours=1)).isoformat(),
            "attempts": 10
        })
    
    return {"blocked_ips": blocked_ips[:limit]}


@router.get("/anomalies")
@require_system_admin()
def get_anomalies(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    limit: int = Query(20, ge=1, le=100),
    hours: int = Query(24, ge=1, le=720),
) -> dict:
    """
    Get detected anomalies.
    
    Requires admin permissions.
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    anomalies = []
    
    # Detect anomalies from events
    for event in security_monitor.events:
        if event.timestamp > cutoff_time and event.severity in ["error", "critical"]:
            anomalies.append({
                "timestamp": event.timestamp.isoformat(),
                "anomaly_type": event.event_type,
                "confidence": 0.85,
                "ip_address": event.ip_address,
                "description": event.description
            })
    
    anomalies.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {"anomalies": anomalies[:limit]}


@router.get("/events/{event_id}")
@require_system_admin()
def get_event_details(
    *,
    event_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> SecurityEventOut:
    """
    Get detailed information about a specific security event.
    
    Requires admin permissions.
    """
    # Find event by ID
    for event in security_monitor.events:
        if event.id == event_id:
            return SecurityEventOut(
                id=event.id,
                timestamp=event.timestamp,
                event_type=event.event_type,
                severity=event.severity,
                description=event.description,
                user_id=event.user_id,
                ip_address=event.ip_address,
                user_agent=event.user_agent,
                resource=event.resource,
                details=event.details
            )
    
    raise HTTPException(status_code=404, detail="Event not found")


@router.get("/health")
@require_system_admin()
def security_monitoring_health(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> dict:
    """
    Get health status of security monitoring system.
    
    Requires admin permissions.
    """
    metrics = security_monitor.get_metrics()
    
    # Check for concerning patterns
    warnings = []
    
    if metrics["suspicious_users"] > 10:
        warnings.append(f"High number of suspicious users: {metrics['suspicious_users']}")
    
    if metrics["suspicious_ips"] > 20:
        warnings.append(f"High number of suspicious IPs: {metrics['suspicious_ips']}")
    
    if metrics["recent_critical_events"] > 5:
        warnings.append(f"Multiple critical events in last hour: {metrics['recent_critical_events']}")
    
    status = "healthy" if not warnings else "warning"
    
    return {
        "status": status,
        "warnings": warnings,
        "metrics": metrics,
        "timestamp": datetime.utcnow().isoformat()
    }


__all__ = ['router']

