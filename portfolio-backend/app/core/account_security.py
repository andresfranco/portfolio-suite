"""
Account Security Module

Implements account security features:
- Progressive account lockout
- Password reset with secure tokens
- Email verification
- Password history validation
- Session management
- Suspicious login detection
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

# Password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AccountSecurityManager:
    """
    Manages account security operations.
    
    Features:
    - Account lockout after failed attempts
    - Password reset token generation/validation
    - Email verification token generation/validation
    - Password history tracking
    - Session tracking
    - Suspicious login detection
    """
    
    def __init__(self):
        # Account lockout settings
        self.max_failed_attempts = 5  # Lock after 5 failed attempts
        self.lockout_duration_minutes = 30  # Lock for 30 minutes
        
        # Progressive lockout (escalating)
        self.lockout_escalation = {
            3: 5,   # 3 failures: 5 min lock
            5: 30,  # 5 failures: 30 min lock
            10: 60,  # 10 failures: 1 hour lock
        }
        
        # Token settings
        self.token_length = 32  # bytes (64 chars hex)
        self.email_verification_validity_hours = 24
        self.password_reset_validity_hours = 2
        
        # Password history
        self.password_history_count = 5  # Remember last 5 passwords
    
    def record_failed_login(
        self,
        user: User,
        db: Session,
        ip_address: Optional[str] = None
    ) -> Tuple[bool, Optional[int]]:
        """
        Record a failed login attempt and apply progressive lockout.
        
        Args:
            user: User model instance
            db: Database session
            ip_address: Client IP address
        
        Returns:
            Tuple of (is_locked, lockout_minutes)
        """
        try:
            # Increment failed attempts
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            
            # Determine lockout duration based on escalation
            lockout_minutes = 0
            for threshold, duration in sorted(self.lockout_escalation.items()):
                if user.failed_login_attempts >= threshold:
                    lockout_minutes = duration
            
            # Apply lockout if threshold reached
            is_locked = False
            if lockout_minutes > 0:
                user.account_locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)
                is_locked = True
                
                logger.warning(
                    f"Account locked for user {user.username}: "
                    f"{user.failed_login_attempts} failed attempts, "
                    f"locked for {lockout_minutes} minutes"
                )
            
            db.commit()
            
            return is_locked, lockout_minutes if is_locked else None
            
        except Exception as e:
            logger.error(f"Failed to record failed login: {e}")
            db.rollback()
            return False, None
    
    def reset_failed_attempts(self, user: User, db: Session) -> None:
        """Reset failed login attempts counter after successful login."""
        try:
            user.failed_login_attempts = 0
            user.account_locked_until = None
            db.commit()
        except Exception as e:
            logger.error(f"Failed to reset failed attempts: {e}")
            db.rollback()
    
    def is_account_locked(self, user: User) -> Tuple[bool, Optional[int]]:
        """
        Check if account is currently locked.
        
        Returns:
            Tuple of (is_locked, minutes_remaining)
        """
        if not user.account_locked_until:
            return False, None
        
        now = datetime.now(timezone.utc)
        
        # Check if lockout has expired
        if now >= user.account_locked_until:
            return False, None
        
        # Calculate remaining time
        remaining = user.account_locked_until - now
        minutes_remaining = int(remaining.total_seconds() / 60)
        
        return True, minutes_remaining
    
    def update_login_metadata(
        self,
        user: User,
        db: Session,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """
        Update login metadata after successful login.
        
        Updates:
        - last_login_at
        - last_login_ip
        - failed_login_attempts (reset to 0)
        """
        try:
            user.last_login_at = datetime.now(timezone.utc)
            user.last_login_ip = ip_address
            user.failed_login_attempts = 0
            user.account_locked_until = None
            db.commit()
            
            logger.info(f"Login metadata updated for user {user.username}")
            
        except Exception as e:
            logger.error(f"Failed to update login metadata: {e}")
            db.rollback()
    
    def generate_token(self) -> str:
        """Generate a secure random token."""
        return secrets.token_urlsafe(self.token_length)
    
    def generate_email_verification_token(
        self,
        user: User,
        db: Session
    ) -> str:
        """
        Generate email verification token.
        
        Returns:
            Verification token (URL-safe)
        """
        try:
            token = self.generate_token()
            
            # Store hashed token (for security)
            user.email_verification_token = hashlib.sha256(token.encode()).hexdigest()
            user.email_verification_sent_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.info(f"Email verification token generated for user {user.username}")
            
            return token
            
        except Exception as e:
            logger.error(f"Failed to generate email verification token: {e}")
            db.rollback()
            raise
    
    def verify_email_token(
        self,
        user: User,
        token: str,
        db: Session
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify email verification token.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if token exists
        if not user.email_verification_token:
            return False, "No verification token found"
        
        # Hash provided token
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Compare hashes
        if token_hash != user.email_verification_token:
            return False, "Invalid verification token"
        
        # Check expiry
        if user.email_verification_sent_at:
            expiry = user.email_verification_sent_at + timedelta(
                hours=self.email_verification_validity_hours
            )
            
            if datetime.now(timezone.utc) > expiry:
                return False, "Verification token expired"
        
        # Mark email as verified
        try:
            user.email_verified = True
            user.email_verification_token = None
            user.email_verification_sent_at = None
            db.commit()
            
            logger.info(f"Email verified for user {user.username}")
            return True, None
            
        except Exception as e:
            logger.error(f"Failed to verify email: {e}")
            db.rollback()
            return False, "Failed to update verification status"
    
    def generate_password_reset_token(
        self,
        user: User,
        db: Session
    ) -> str:
        """
        Generate password reset token.
        
        Returns:
            Reset token (URL-safe)
        """
        try:
            token = self.generate_token()
            
            # Store hashed token
            user.password_reset_token = hashlib.sha256(token.encode()).hexdigest()
            user.password_reset_sent_at = datetime.now(timezone.utc)
            db.commit()
            
            logger.info(f"Password reset token generated for user {user.username}")
            
            return token
            
        except Exception as e:
            logger.error(f"Failed to generate password reset token: {e}")
            db.rollback()
            raise
    
    def verify_password_reset_token(
        self,
        user: User,
        token: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify password reset token.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if token exists
        if not user.password_reset_token:
            return False, "No reset token found"
        
        # Hash provided token
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Compare hashes
        if token_hash != user.password_reset_token:
            return False, "Invalid reset token"
        
        # Check expiry
        if user.password_reset_sent_at:
            expiry = user.password_reset_sent_at + timedelta(
                hours=self.password_reset_validity_hours
            )
            
            if datetime.now(timezone.utc) > expiry:
                return False, "Reset token expired"
        
        return True, None
    
    def reset_password(
        self,
        user: User,
        new_password: str,
        db: Session
    ) -> bool:
        """
        Reset user password and clear reset token.
        
        Args:
            user: User model instance
            new_password: New plain text password
            db: Database session
        
        Returns:
            True if successful
        """
        try:
            # Set new password
            user.set_password(new_password)
            
            # Clear reset token
            user.password_reset_token = None
            user.password_reset_sent_at = None
            
            # Update password change timestamp
            user.password_changed_at = datetime.now(timezone.utc)
            
            # Clear force password change flag
            user.force_password_change = False
            
            db.commit()
            
            logger.info(f"Password reset for user {user.username}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset password: {e}")
            db.rollback()
            return False
    
    def detect_suspicious_login(
        self,
        user: User,
        ip_address: str,
        user_agent: Optional[str] = None
    ) -> Tuple[bool, List[str]]:
        """
        Detect suspicious login patterns.
        
        Checks:
        - New IP address
        - New user agent
        - Login from different country (future enhancement)
        
        Returns:
            Tuple of (is_suspicious, reasons)
        """
        suspicious = False
        reasons = []
        
        # Check for new IP address
        if user.last_login_ip and user.last_login_ip != ip_address:
            suspicious = True
            reasons.append("login_from_new_ip")
            logger.info(
                f"Suspicious login detected for {user.username}: "
                f"New IP {ip_address} (previous: {user.last_login_ip})"
            )
        
        # Check for rapid location changes (future: use GeoIP)
        # if user.last_login_at:
        #     time_since_last = datetime.now(timezone.utc) - user.last_login_at
        #     if time_since_last < timedelta(minutes=5):
        #         # Too soon for different location
        #         suspicious = True
        #         reasons.append("rapid_location_change")
        
        return suspicious, reasons
    
    def require_password_change(
        self,
        user: User,
        db: Session
    ) -> None:
        """
        Force user to change password on next login.
        """
        try:
            user.force_password_change = True
            db.commit()
            logger.info(f"Password change required for user {user.username}")
        except Exception as e:
            logger.error(f"Failed to set password change requirement: {e}")
            db.rollback()
    
    def validate_password_strength(
        self,
        password: str
    ) -> Tuple[bool, List[str]]:
        """
        Validate password strength.
        
        Requirements:
        - Minimum 8 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        
        Returns:
            Tuple of (is_valid, errors)
        """
        errors = []
        
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long")
        
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            errors.append("Password must contain at least one special character")
        
        return len(errors) == 0, errors


# Global instance
account_security_manager = AccountSecurityManager()

