import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.logging import setup_logger
from app.models.user import User

logger = setup_logger("app.core.audit_logger")

class SecurityAuditLogger:
    """Centralized security audit logging"""
    
    def __init__(self):
        self.logger = logger
    
    def log_login_attempt(self, username: str, success: bool, ip_address: str = None, 
                         user_agent: str = None, additional_info: Dict[str, Any] = None):
        """Log login attempt with details"""
        log_data = {
            "event_type": "LOGIN_ATTEMPT",
            "username": username,
            "success": success,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow().isoformat(),
            "additional_info": additional_info or {}
        }
        
        if success:
            self.logger.info(f"Successful login: {username} from {ip_address}")
        else:
            self.logger.warning(f"Failed login attempt: {username} from {ip_address}")
        
        # Log detailed information for audit trail
        self.logger.info(f"LOGIN_AUDIT: {json.dumps(log_data)}")
    
    def log_permission_denied(self, user: User, required_permission: str, 
                            endpoint: str = None, ip_address: str = None):
        """Log permission denied events"""
        log_data = {
            "event_type": "PERMISSION_DENIED",
            "user_id": user.id,
            "username": user.username,
            "required_permission": required_permission,
            "endpoint": endpoint,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.warning(f"Permission denied: {user.username} attempted {required_permission}")
        self.logger.warning(f"PERMISSION_AUDIT: {json.dumps(log_data)}")
    
    def log_admin_action(self, admin_user: User, action: str, target: str = None,
                        details: Dict[str, Any] = None, ip_address: str = None):
        """Log administrative actions"""
        log_data = {
            "event_type": "ADMIN_ACTION",
            "admin_user_id": admin_user.id,
            "admin_username": admin_user.username,
            "action": action,
            "target": target,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.info(f"Admin action: {admin_user.username} performed {action} on {target}")
        self.logger.info(f"ADMIN_AUDIT: {json.dumps(log_data)}")
    
    def log_security_event(self, event_type: str, user: User = None, 
                          details: Dict[str, Any] = None, ip_address: str = None):
        """Log general security events"""
        log_data = {
            "event_type": event_type,
            "user_id": user.id if user else None,
            "username": user.username if user else None,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.warning(f"Security event: {event_type}")
        self.logger.warning(f"SECURITY_AUDIT: {json.dumps(log_data)}")

# Global audit logger instance
audit_logger = SecurityAuditLogger() 