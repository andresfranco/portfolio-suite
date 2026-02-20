import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.logging import setup_logger
from app.models.user import User

logger = setup_logger("app.core.audit_logger")

class SecurityAuditLogger:
    """
    Enhanced security audit logging with database storage.
    
    Features:
    - Database persistence for compliance
    - Tamper-proof hash chain
    - Flexible event metadata
    - File logging (legacy support)
    """
    
    def __init__(self):
        self.logger = logger
        self._db_session: Optional[Session] = None
    
    def set_db_session(self, db: Session):
        """Set database session for persistent logging."""
        self._db_session = db
    
    def _calculate_hash(self, data: Dict[str, Any]) -> str:
        """Calculate SHA-256 hash of audit log data."""
        # Sort keys for consistent hashing
        sorted_data = json.dumps(data, sort_keys=True)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
    
    def _get_previous_hash(self, db: Session) -> Optional[str]:
        """Get hash of most recent audit log entry."""
        try:
            from app.models.audit_log import AuditLog
            
            last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
            return last_log.record_hash if last_log else None
        except Exception as e:
            self.logger.error(f"Failed to get previous hash: {e}")
            return None
    
    def _store_to_database(
        self,
        db: Session,
        event_type: str,
        event_category: str,
        severity: str,
        user: Optional[User] = None,
        username: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        action: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        success: Optional[str] = None,
        error_message: Optional[str] = None,
        retention_days: int = 365
    ):
        """
        Store audit log entry to database with tamper-proof hash chain.
        """
        try:
            from app.models.audit_log import AuditLog
            
            # Get previous hash for chain
            previous_hash = self._get_previous_hash(db)
            
            # Calculate expiration
            expires_at = datetime.now(timezone.utc) + timedelta(days=retention_days)
            
            # Create audit log entry
            audit_entry = AuditLog(
                event_type=event_type,
                event_category=event_category,
                severity=severity,
                user_id=user.id if user else None,
                username=username or (user.username if user else None),
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
                request_id=request_id,
                details=details,
                success=success,
                error_message=error_message,
                retention_days=retention_days,
                expires_at=expires_at,
                previous_hash=previous_hash
            )
            
            # Calculate hash of this record
            hash_data = {
                'event_type': event_type,
                'user_id': audit_entry.user_id,
                'username': audit_entry.username,
                'resource_type': resource_type,
                'resource_id': resource_id,
                'action': action,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'previous_hash': previous_hash
            }
            audit_entry.record_hash = self._calculate_hash(hash_data)
            
            # Store to database
            db.add(audit_entry)
            db.commit()
            db.refresh(audit_entry)
            
            return audit_entry
            
        except Exception as e:
            self.logger.error(f"Failed to store audit log to database: {e}", exc_info=True)
            try:
                db.rollback()
            except:
                pass
            return None
    
    def log_login_attempt(self, username: str, success: bool, ip_address: str = None, 
                         user_agent: str = None, additional_info: Dict[str, Any] = None, db: Session = None):
        """Log login attempt with details"""
        log_data = {
            "event_type": "LOGIN_ATTEMPT",
            "username": username,
            "success": success,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "additional_info": additional_info or {}
        }
        
        if success:
            self.logger.info(f"Successful login: {username} from {ip_address}")
        else:
            self.logger.warning(f"Failed login attempt: {username} from {ip_address}")
        
        # Log detailed information for audit trail
        self.logger.info(f"LOGIN_AUDIT: {json.dumps(log_data)}")
        
        # Store to database
        if db or self._db_session:
            session = db or self._db_session
            self._store_to_database(
                db=session,
                event_type="LOGIN_ATTEMPT",
                event_category="authentication",
                severity="info" if success else "warning",
                username=username,
                action="login",
                ip_address=ip_address,
                user_agent=user_agent,
                details=additional_info,
                success="success" if success else "failure"
            )
    
    def log_permission_denied(self, user: User, required_permission: str, 
                            endpoint: str = None, ip_address: str = None, db: Session = None):
        """Log permission denied events"""
        log_data = {
            "event_type": "PERMISSION_DENIED",
            "user_id": user.id,
            "username": user.username,
            "required_permission": required_permission,
            "endpoint": endpoint,
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.warning(f"Permission denied: {user.username} attempted {required_permission}")
        self.logger.warning(f"PERMISSION_AUDIT: {json.dumps(log_data)}")
        
        # Store to database
        if db or self._db_session:
            session = db or self._db_session
            self._store_to_database(
                db=session,
                event_type="PERMISSION_DENIED",
                event_category="authorization",
                severity="warning",
                user=user,
                action="access_denied",
                ip_address=ip_address,
                details={"required_permission": required_permission, "endpoint": endpoint},
                success="failure"
            )
    
    def log_admin_action(self, admin_user: User, action: str, target: str = None,
                        details: Dict[str, Any] = None, ip_address: str = None, db: Session = None):
        """Log administrative actions"""
        log_data = {
            "event_type": "ADMIN_ACTION",
            "admin_user_id": admin_user.id,
            "admin_username": admin_user.username,
            "action": action,
            "target": target,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.info(f"Admin action: {admin_user.username} performed {action} on {target}")
        self.logger.info(f"ADMIN_AUDIT: {json.dumps(log_data)}")
        
        # Store to database
        if db or self._db_session:
            session = db or self._db_session
            self._store_to_database(
                db=session,
                event_type="ADMIN_ACTION",
                event_category="admin",
                severity="info",
                user=admin_user,
                action=action,
                resource_id=target,
                ip_address=ip_address,
                details=details,
                success="success"
            )
    
    def log_security_event(self, event_type: str, user: User = None, 
                          details: Dict[str, Any] = None, ip_address: str = None, db: Session = None):
        """Log general security events"""
        log_data = {
            "event_type": event_type,
            "user_id": user.id if user else None,
            "username": user.username if user else None,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        self.logger.warning(f"Security event: {event_type}")
        self.logger.warning(f"SECURITY_AUDIT: {json.dumps(log_data)}")
        
        # Store to database
        if db or self._db_session:
            session = db or self._db_session
            self._store_to_database(
                db=session,
                event_type=event_type,
                event_category="security",
                severity="warning",
                user=user,
                action="security_event",
                ip_address=ip_address,
                details=details,
                success="unknown"
            )

# Global audit logger instance
audit_logger = SecurityAuditLogger() 