"""
Audit Log Database Model

Stores comprehensive audit trail of all security-relevant events:
- User authentication and authorization
- Data access and modifications
- Administrative actions
- Security events

Features:
- Tamper-proof hash chain
- Automatic timestamp tracking
- JSON metadata storage
- Efficient querying with indexes
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class AuditLog(Base):
    """
    Audit log entry for security and compliance tracking.
    
    Design principles:
    - Immutable after creation (no updates, only inserts)
    - Hash chain for tamper detection
    - Comprehensive event capture
    - Searchable and queryable
    """
    
    __tablename__ = "audit_logs"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Event identification
    event_type = Column(String(100), nullable=False, index=True)
    # Event types: LOGIN_ATTEMPT, PERMISSION_DENIED, ADMIN_ACTION, DATA_ACCESS,
    #             DATA_MODIFICATION, SECURITY_EVENT, MFA_EVENT, etc.
    
    event_category = Column(String(50), nullable=False, index=True)
    # Categories: authentication, authorization, data_access, admin, security, system
    
    severity = Column(String(20), nullable=False, index=True, server_default='info')
    # Severity levels: debug, info, warning, error, critical
    
    # Actor information (who)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String(255), nullable=True, index=True)
    
    # Target information (what)
    resource_type = Column(String(100), nullable=True, index=True)
    # Examples: user, role, permission, portfolio, project, file
    
    resource_id = Column(String(255), nullable=True)
    # ID of the affected resource
    
    action = Column(String(100), nullable=True, index=True)
    # Actions: create, read, update, delete, login, logout, grant, revoke, etc.
    
    # Context information
    ip_address = Column(String(45), nullable=True, index=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True, index=True)  # UUID for request tracking
    session_id = Column(String(255), nullable=True)
    
    # Event details (flexible JSON storage)
    details = Column(JSON, nullable=True)
    # Stores additional context: old_value, new_value, reason, etc.
    
    # Status
    success = Column(String(20), nullable=True, index=True)
    # Values: success, failure, partial, unknown
    
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Tamper detection (hash chain)
    record_hash = Column(String(64), nullable=True)
    # SHA-256 hash of this record
    
    previous_hash = Column(String(64), nullable=True)
    # Hash of previous record (creates chain for tamper detection)
    
    # Retention and compliance
    retention_days = Column(Integer, nullable=True)
    # How long to keep this log entry (for compliance)
    
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    # Auto-calculated from retention_days
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    
    # Table-level indexes for common queries
    __table_args__ = (
        Index('ix_audit_logs_user_event', 'user_id', 'event_type'),
        Index('ix_audit_logs_created_event', 'created_at', 'event_type'),
        Index('ix_audit_logs_category_severity', 'event_category', 'severity'),
        Index('ix_audit_logs_resource', 'resource_type', 'resource_id'),
        Index('ix_audit_logs_ip_created', 'ip_address', 'created_at'),
    )
    
    def __repr__(self):
        return (
            f"<AuditLog(id={self.id}, "
            f"event_type={self.event_type}, "
            f"user={self.username}, "
            f"created_at={self.created_at})>"
        )

