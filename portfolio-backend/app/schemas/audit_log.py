"""
Audit Log Pydantic Schemas

Request and response models for audit log viewing and querying.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    """Single audit log entry response"""
    id: int
    event_type: str
    event_category: str
    severity: str
    user_id: Optional[int] = None
    username: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    action: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    success: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    record_hash: Optional[str] = None
    
    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1234,
                "event_type": "LOGIN_ATTEMPT",
                "event_category": "authentication",
                "severity": "info",
                "username": "john.doe",
                "action": "login",
                "ip_address": "192.168.1.100",
                "success": "success",
                "created_at": "2025-10-22T14:30:00Z"
            }
        }
    }


class AuditLogListResponse(BaseModel):
    """Paginated list of audit logs"""
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditLogQueryParams(BaseModel):
    """Query parameters for filtering audit logs"""
    event_type: Optional[str] = Field(None, description="Filter by event type")
    event_category: Optional[str] = Field(None, description="Filter by category")
    severity: Optional[str] = Field(None, description="Filter by severity")
    user_id: Optional[int] = Field(None, description="Filter by user ID")
    username: Optional[str] = Field(None, description="Filter by username")
    ip_address: Optional[str] = Field(None, description="Filter by IP address")
    action: Optional[str] = Field(None, description="Filter by action")
    success: Optional[str] = Field(None, description="Filter by success status")
    date_from: Optional[datetime] = Field(None, description="Filter from date")
    date_to: Optional[datetime] = Field(None, description="Filter to date")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=200, description="Items per page")


class AuditLogStatsResponse(BaseModel):
    """Audit log statistics"""
    total_events: int
    by_category: Dict[str, int]
    by_severity: Dict[str, int]
    by_success: Dict[str, int]
    recent_events: List[AuditLogResponse]
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "total_events": 15234,
                "by_category": {
                    "authentication": 8500,
                    "authorization": 3200,
                    "admin": 1500,
                    "security": 2034
                },
                "by_severity": {
                    "info": 10000,
                    "warning": 4000,
                    "error": 1234
                },
                "by_success": {
                    "success": 12000,
                    "failure": 3234
                }
            }
        }
    }


class HashChainVerificationResponse(BaseModel):
    """Response for hash chain verification"""
    is_valid: bool
    total_records: int
    broken_chain_at: Optional[int] = None
    message: str
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "is_valid": True,
                "total_records": 15234,
                "message": "Hash chain is intact"
            }
        }
    }

