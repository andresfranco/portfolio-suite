"""
Security Dashboard Schemas

Pydantic schemas for security monitoring and dashboard API responses.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class SecurityEventOut(BaseModel):
    """Schema for security event output"""
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


class SecurityMetricsOut(BaseModel):
    """Schema for security metrics summary"""
    total_events: int
    suspicious_users: int
    suspicious_ips: int
    event_counts: Dict[str, int]
    recent_critical_events: int
    recent_failed_logins: int


class AttackIPInfo(BaseModel):
    """Schema for attacking IP information"""
    ip_address: str
    count: int


class AttackSummaryOut(BaseModel):
    """Schema for attack summary output"""
    total_attacks: int
    by_type: Dict[str, int]
    top_attacking_ips: List[AttackIPInfo]
    affected_users: int
    time_window_hours: int


class SuspiciousEntityOut(BaseModel):
    """Schema for suspicious entity (user or IP)"""
    identifier: str = Field(..., description="User ID or IP address")
    type: str = Field(..., description="Type: 'user' or 'ip_address'")
    flagged_at: datetime
    recent_event_count: int
    recent_event_types: List[str]


class UserEventCount(BaseModel):
    """Schema for user event count"""
    user_id: int
    event_count: int


class IPEventCount(BaseModel):
    """Schema for IP event count"""
    ip_address: str
    event_count: int


class SecurityStatsOut(BaseModel):
    """Schema for comprehensive security statistics"""
    time_window_hours: int
    total_events: int
    events_by_severity: Dict[str, int]
    events_by_type: Dict[str, int]
    top_users: List[UserEventCount]
    top_ips: List[IPEventCount]
    timeline: Dict[str, int] = Field(..., description="Hourly event counts")


class EventFilterParams(BaseModel):
    """Schema for event filtering parameters"""
    severity: Optional[str] = Field(None, pattern="^(info|warning|error|critical)$")
    event_type: Optional[str] = None
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


__all__ = [
    'SecurityEventOut',
    'SecurityMetricsOut',
    'AttackSummaryOut',
    'SuspiciousEntityOut',
    'EventFilterParams',
    'SecurityStatsOut',
    'UserEventCount',
    'IPEventCount',
    'AttackIPInfo',
]

