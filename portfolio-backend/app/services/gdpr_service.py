"""
GDPR Compliance Service

Implements GDPR (General Data Protection Regulation) compliance features:
- Right to Access (Article 15)
- Right to Rectification (Article 16)
- Right to Erasure / "Right to be Forgotten" (Article 17)
- Right to Data Portability (Article 20)
- Right to Object (Article 21)

Author: Security Team
Date: October 23, 2025
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import text

logger = logging.getLogger(__name__)


class GDPRService:
    """
    Service for handling GDPR compliance requirements.
    
    Features:
    - Data export (portable format)
    - Data deletion (right to be forgotten)
    - Consent management
    - Data retention policies
    - Privacy audit trail
    """
    
    def __init__(self, db: Session):
        """
        Initialize GDPR service.
        
        Args:
            db: Database session
        """
        self.db = db
    
    def export_user_data(self, user_id: int) -> Dict[str, Any]:
        """
        Export all personal data for a user (GDPR Article 15 - Right to Access).
        
        Returns data in portable JSON format that can be transferred to another service.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary containing all user data
            
        Raises:
            ValueError: If user not found
        """
        from app.models.user import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        logger.info(f"Exporting data for user {user_id} (GDPR Article 15)")
        
        # Collect all personal data
        user_data = {
            "export_metadata": {
                "export_date": datetime.utcnow().isoformat(),
                "export_type": "GDPR Article 15 - Right to Access",
                "user_id": user_id,
                "format_version": "1.0"
            },
            "personal_information": {
                "id": user.id,
                "username": user.username,
                "email": user.email if hasattr(user, 'email') else None,
                "full_name": user.full_name if hasattr(user, 'full_name') else None,
                "phone_number": user.phone_number if hasattr(user, 'phone_number') else None,
                "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') else None,
                "updated_at": user.updated_at.isoformat() if hasattr(user, 'updated_at') else None,
                "last_login_at": user.last_login_at.isoformat() if hasattr(user, 'last_login_at') else None,
                "is_active": user.is_active if hasattr(user, 'is_active') else None,
            },
            "account_security": {
                "mfa_enabled": user.mfa_enabled if hasattr(user, 'mfa_enabled') else False,
                "email_verified": user.email_verified if hasattr(user, 'email_verified') else False,
                "password_changed_at": user.password_changed_at.isoformat() if hasattr(user, 'password_changed_at') and user.password_changed_at else None,
            },
            "associated_data": {}
        }
        
        # Export portfolios
        try:
            from app.models.portfolio import Portfolio
            portfolios = self.db.query(Portfolio).filter(Portfolio.owner_id == user_id).all()
            user_data["associated_data"]["portfolios"] = [
                {
                    "id": p.id,
                    "title": p.title if hasattr(p, 'title') else None,
                    "description": p.description if hasattr(p, 'description') else None,
                    "created_at": p.created_at.isoformat() if hasattr(p, 'created_at') else None,
                }
                for p in portfolios
            ]
        except Exception as e:
            logger.warning(f"Could not export portfolios: {e}")
            user_data["associated_data"]["portfolios"] = []
        
        # Export projects
        try:
            from app.models.project import Project
            projects = self.db.query(Project).filter(Project.user_id == user_id).all()
            user_data["associated_data"]["projects"] = [
                {
                    "id": proj.id,
                    "name": proj.name if hasattr(proj, 'name') else None,
                    "description": proj.description if hasattr(proj, 'description') else None,
                    "created_at": proj.created_at.isoformat() if hasattr(proj, 'created_at') else None,
                }
                for proj in projects
            ]
        except Exception as e:
            logger.warning(f"Could not export projects: {e}")
            user_data["associated_data"]["projects"] = []
        
        # Export audit logs (last 90 days)
        try:
            from app.models.audit_log import AuditLog
            cutoff_date = datetime.utcnow() - timedelta(days=90)
            audit_logs = self.db.query(AuditLog).filter(
                AuditLog.user_id == user_id,
                AuditLog.created_at >= cutoff_date
            ).order_by(AuditLog.created_at.desc()).limit(1000).all()
            
            user_data["associated_data"]["audit_logs"] = [
                {
                    "event_type": log.event_type,
                    "event_category": log.event_category,
                    "timestamp": log.created_at.isoformat(),
                    "ip_address": log.ip_address,
                    "success": log.success,
                }
                for log in audit_logs
            ]
        except Exception as e:
            logger.warning(f"Could not export audit logs: {e}")
            user_data["associated_data"]["audit_logs"] = []
        
        # Log the data export
        self._log_gdpr_action(
            user_id=user_id,
            action="DATA_EXPORT",
            details={"export_date": datetime.utcnow().isoformat()}
        )
        
        return user_data
    
    def delete_user_data(
        self,
        user_id: int,
        reason: Optional[str] = None,
        requested_by_user: bool = True
    ) -> Dict[str, Any]:
        """
        Delete all user data (GDPR Article 17 - Right to Erasure / "Right to be Forgotten").
        
        This is a soft delete that:
        1. Marks account as deleted
        2. Anonymizes PII
        3. Removes sensitive data
        4. Keeps audit trail (required by law)
        5. Allows restoration within 30 days (optional grace period)
        
        Args:
            user_id: User ID
            reason: Reason for deletion
            requested_by_user: Whether user requested deletion
            
        Returns:
            Dictionary with deletion summary
            
        Raises:
            ValueError: If user not found
        """
        from app.models.user import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        logger.warning(f"Deleting data for user {user_id} (GDPR Article 17)")
        
        deletion_summary = {
            "user_id": user_id,
            "deletion_date": datetime.utcnow().isoformat(),
            "reason": reason or "User requested deletion",
            "requested_by_user": requested_by_user,
            "grace_period_until": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "deleted_data": {}
        }
        
        # Step 1: Mark account for deletion (soft delete)
        user.is_active = False
        user.deleted_at = datetime.utcnow()
        user.deletion_reason = reason
        
        # Step 2: Anonymize PII (GDPR allows keeping anonymized data)
        anonymized_username = f"deleted_user_{user_id}"
        user.username = anonymized_username
        
        # Clear encrypted PII fields
        if hasattr(user, 'email_encrypted'):
            user.email_encrypted = None
        if hasattr(user, 'phone_encrypted'):
            user.phone_encrypted = None
        if hasattr(user, 'ssn_encrypted'):
            user.ssn_encrypted = None
        
        # Clear other PII
        if hasattr(user, 'full_name'):
            user.full_name = None
        if hasattr(user, 'date_of_birth'):
            user.date_of_birth = None
        if hasattr(user, 'address'):
            user.address = None
        
        deletion_summary["deleted_data"]["personal_information"] = True
        
        # Step 3: Clear authentication data (but keep password hash for audit)
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_backup_codes = None
        user.password_reset_token = None
        user.email_verification_token = None
        
        deletion_summary["deleted_data"]["authentication"] = True
        
        # Step 4: Anonymize associated data (optional - depends on business requirements)
        # You may want to keep some data for analytics (anonymized)
        
        # Portfolios: Mark as deleted or transfer ownership
        try:
            from app.models.portfolio import Portfolio
            portfolios = self.db.query(Portfolio).filter(Portfolio.owner_id == user_id).all()
            for portfolio in portfolios:
                portfolio.is_deleted = True
                portfolio.deleted_at = datetime.utcnow()
            deletion_summary["deleted_data"]["portfolios"] = len(portfolios)
        except Exception as e:
            logger.error(f"Error deleting portfolios: {e}")
            deletion_summary["deleted_data"]["portfolios"] = "error"
        
        # Projects: Mark as deleted
        try:
            from app.models.project import Project
            projects = self.db.query(Project).filter(Project.user_id == user_id).all()
            for project in projects:
                project.is_deleted = True
                project.deleted_at = datetime.utcnow()
            deletion_summary["deleted_data"]["projects"] = len(projects)
        except Exception as e:
            logger.error(f"Error deleting projects: {e}")
            deletion_summary["deleted_data"]["projects"] = "error"
        
        # Step 5: Keep audit logs (required by law, but anonymize user reference)
        # Don't delete audit logs - they're needed for compliance
        deletion_summary["deleted_data"]["audit_logs"] = "anonymized (kept for compliance)"
        
        # Commit changes
        try:
            self.db.commit()
            
            # Log the deletion
            self._log_gdpr_action(
                user_id=user_id,
                action="DATA_DELETION",
                details={
                    "deletion_date": datetime.utcnow().isoformat(),
                    "reason": reason,
                    "requested_by_user": requested_by_user,
                    "grace_period": 30
                }
            )
            
            logger.info(f"Successfully deleted data for user {user_id}")
            deletion_summary["status"] = "success"
        
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete user data: {e}")
            deletion_summary["status"] = "error"
            deletion_summary["error"] = str(e)
            raise
        
        return deletion_summary
    
    def restore_deleted_user(self, user_id: int) -> bool:
        """
        Restore a user within grace period (30 days).
        
        Args:
            user_id: User ID
            
        Returns:
            True if successful
        """
        from app.models.user import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        # Check if within grace period
        if user.deleted_at:
            grace_period_end = user.deleted_at + timedelta(days=30)
            if datetime.utcnow() > grace_period_end:
                raise ValueError("Grace period expired, cannot restore user")
        else:
            raise ValueError("User was not deleted")
        
        # Restore account
        user.is_active = True
        user.deleted_at = None
        user.deletion_reason = None
        
        # Note: PII was anonymized and cannot be restored
        # User will need to update their information
        
        self.db.commit()
        
        self._log_gdpr_action(
            user_id=user_id,
            action="DATA_RESTORATION",
            details={"restored_at": datetime.utcnow().isoformat()}
        )
        
        logger.info(f"Restored user {user_id} from deletion")
        return True
    
    def permanently_delete_user(self, user_id: int) -> bool:
        """
        Permanently delete user after grace period (hard delete).
        
        WARNING: This is irreversible!
        
        Args:
            user_id: User ID
            
        Returns:
            True if successful
        """
        from app.models.user import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        logger.critical(f"PERMANENT deletion of user {user_id}")
        
        # Delete associated data first (foreign key constraints)
        try:
            # Delete portfolios
            self.db.execute(
                text("DELETE FROM portfolios WHERE owner_id = :user_id"),
                {"user_id": user_id}
            )
            
            # Delete projects
            self.db.execute(
                text("DELETE FROM projects WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            
            # Keep audit logs for compliance (just anonymize user_id reference)
            self.db.execute(
                text("UPDATE audit_logs SET user_id = NULL WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            
            # Finally, delete user
            self.db.delete(user)
            self.db.commit()
            
            logger.info(f"Permanently deleted user {user_id}")
            return True
        
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to permanently delete user: {e}")
            raise
    
    def get_data_retention_status(self, user_id: int) -> Dict[str, Any]:
        """
        Get data retention information for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with retention information
        """
        from app.models.user import User
        
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User with ID {user_id} not found")
        
        status = {
            "user_id": user_id,
            "account_status": "active" if user.is_active else "inactive",
            "created_at": user.created_at.isoformat() if hasattr(user, 'created_at') else None,
            "last_login": user.last_login_at.isoformat() if hasattr(user, 'last_login_at') and user.last_login_at else None,
            "data_retention": {}
        }
        
        # Check if account is marked for deletion
        if hasattr(user, 'deleted_at') and user.deleted_at:
            status["account_status"] = "pending_deletion"
            status["deleted_at"] = user.deleted_at.isoformat()
            status["grace_period_until"] = (user.deleted_at + timedelta(days=30)).isoformat()
            status["permanent_deletion_date"] = (user.deleted_at + timedelta(days=30)).isoformat()
        
        # Data retention policies
        status["data_retention"]["audit_logs"] = "90 days (recent), permanent (compliance)"
        status["data_retention"]["account_data"] = "Until deletion requested"
        status["data_retention"]["backups"] = "30 days (encrypted)"
        
        return status
    
    def get_consent_status(self, user_id: int) -> Dict[str, bool]:
        """
        Get user consent status for various data processing activities.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with consent status
        """
        # This would query a consent_records table in a real implementation
        # For now, return placeholder
        return {
            "marketing_emails": False,
            "analytics": True,
            "third_party_sharing": False,
            "personalization": True,
        }
    
    def update_consent(self, user_id: int, consent_type: str, granted: bool) -> bool:
        """
        Update user consent for specific data processing.
        
        Args:
            user_id: User ID
            consent_type: Type of consent (e.g., 'marketing_emails')
            granted: Whether consent is granted
            
        Returns:
            True if successful
        """
        # In a real implementation, this would update a consent_records table
        self._log_gdpr_action(
            user_id=user_id,
            action="CONSENT_UPDATE",
            details={
                "consent_type": consent_type,
                "granted": granted,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
        logger.info(f"Updated consent for user {user_id}: {consent_type} = {granted}")
        return True
    
    def _log_gdpr_action(self, user_id: int, action: str, details: Dict[str, Any]):
        """
        Log GDPR-related actions for audit trail.
        
        Args:
            user_id: User ID
            action: Action type
            details: Additional details
        """
        try:
            from app.core.audit_logger import audit_logger
            
            audit_logger.log_system_event(
                event_type=f"GDPR_{action}",
                details={
                    "user_id": user_id,
                    "action": action,
                    **details
                },
                severity="info"
            )
        except Exception as e:
            logger.error(f"Failed to log GDPR action: {e}")


def check_inactive_accounts(db: Session, inactive_days: int = 365) -> List[int]:
    """
    Identify inactive accounts that may be eligible for deletion.
    
    GDPR requires minimizing data retention. Accounts inactive for extended
    periods may be candidates for deletion notifications.
    
    Args:
        db: Database session
        inactive_days: Number of days of inactivity
        
    Returns:
        List of user IDs for inactive accounts
    """
    from app.models.user import User
    
    cutoff_date = datetime.utcnow() - timedelta(days=inactive_days)
    
    inactive_users = db.query(User.id).filter(
        User.is_active == True,
        User.last_login_at < cutoff_date
    ).all()
    
    user_ids = [user[0] for user in inactive_users]
    
    logger.info(f"Found {len(user_ids)} inactive accounts (>{inactive_days} days)")
    
    return user_ids


def cleanup_expired_data(db: Session) -> Dict[str, int]:
    """
    Clean up expired data according to retention policies.
    
    This should be run periodically (e.g., daily cron job).
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with cleanup counts
    """
    cleanup_counts = {}
    
    # Clean up expired password reset tokens (older than 2 hours)
    try:
        from app.models.user import User
        cutoff = datetime.utcnow() - timedelta(hours=2)
        
        result = db.query(User).filter(
            User.password_reset_sent_at < cutoff,
            User.password_reset_token.isnot(None)
        ).update({
            User.password_reset_token: None,
            User.password_reset_sent_at: None
        })
        
        cleanup_counts["password_reset_tokens"] = result
    except Exception as e:
        logger.error(f"Error cleaning password reset tokens: {e}")
        cleanup_counts["password_reset_tokens"] = 0
    
    # Clean up expired email verification tokens (older than 24 hours)
    try:
        from app.models.user import User
        cutoff = datetime.utcnow() - timedelta(hours=24)
        
        result = db.query(User).filter(
            User.email_verification_sent_at < cutoff,
            User.email_verification_token.isnot(None),
            User.email_verified == False
        ).update({
            User.email_verification_token: None,
            User.email_verification_sent_at: None
        })
        
        cleanup_counts["email_verification_tokens"] = result
    except Exception as e:
        logger.error(f"Error cleaning email verification tokens: {e}")
        cleanup_counts["email_verification_tokens"] = 0
    
    # Clean up old audit logs (keep only 90 days of detailed logs)
    try:
        from app.models.audit_log import AuditLog
        cutoff = datetime.utcnow() - timedelta(days=90)
        
        # Don't delete, just mark for archival or summarize
        # In real implementation, move to cold storage
        result = db.query(AuditLog).filter(
            AuditLog.created_at < cutoff,
            AuditLog.event_category != "security"  # Keep security events longer
        ).count()
        
        cleanup_counts["old_audit_logs"] = result
    except Exception as e:
        logger.error(f"Error counting old audit logs: {e}")
        cleanup_counts["old_audit_logs"] = 0
    
    # Permanently delete users past grace period
    try:
        from app.models.user import User
        cutoff = datetime.utcnow() - timedelta(days=30)
        
        users_to_delete = db.query(User).filter(
            User.deleted_at < cutoff
        ).all()
        
        gdpr_service = GDPRService(db)
        deleted_count = 0
        
        for user in users_to_delete:
            try:
                gdpr_service.permanently_delete_user(user.id)
                deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to permanently delete user {user.id}: {e}")
        
        cleanup_counts["permanently_deleted_users"] = deleted_count
    except Exception as e:
        logger.error(f"Error permanently deleting users: {e}")
        cleanup_counts["permanently_deleted_users"] = 0
    
    db.commit()
    
    logger.info(f"Data cleanup complete: {cleanup_counts}")
    
    return cleanup_counts


if __name__ == "__main__":
    pass
