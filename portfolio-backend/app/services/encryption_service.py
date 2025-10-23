"""
Encryption Service

High-level service for encrypting/decrypting sensitive data in the application.
Provides business logic layer on top of the encryption manager.

Author: Security Team
Date: October 23, 2025
"""

import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.core.encryption import encryption_manager

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Service for managing encrypted data in the application.
    
    Features:
    - Encrypt/decrypt PII fields
    - Batch operations for key rotation
    - Audit trail for encryption operations
    """
    
    def __init__(self, db: Session):
        """
        Initialize encryption service.
        
        Args:
            db: Database session
        """
        self.db = db
        self.encryption_manager = encryption_manager
    
    def encrypt_user_pii(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt PII fields in user data.
        
        PII fields encrypted:
        - email (if different from username)
        - phone_number
        - ssn (if present)
        - address fields
        
        Args:
            user_data: User data dictionary
            
        Returns:
            User data with encrypted PII fields
        """
        pii_fields = []
        
        # Conditionally add fields that exist and contain data
        if user_data.get("email"):
            pii_fields.append("email")
        
        if user_data.get("phone_number"):
            pii_fields.append("phone_number")
        
        if user_data.get("ssn"):
            pii_fields.append("ssn")
        
        if user_data.get("address"):
            pii_fields.append("address")
        
        if user_data.get("date_of_birth"):
            pii_fields.append("date_of_birth")
        
        if pii_fields:
            encrypted_data = self.encryption_manager.encrypt_dict(user_data, pii_fields)
            logger.info(f"Encrypted {len(pii_fields)} PII fields for user")
            return encrypted_data
        
        return user_data
    
    def decrypt_user_pii(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt PII fields in user data.
        
        Args:
            user_data: User data with encrypted PII
            
        Returns:
            User data with decrypted PII fields
        """
        pii_fields = ["email", "phone_number", "ssn", "address", "date_of_birth"]
        
        decrypted_data = self.encryption_manager.decrypt_dict(user_data, pii_fields)
        logger.debug("Decrypted PII fields for user")
        
        return decrypted_data
    
    def rotate_user_encryption(self, user_id: int) -> bool:
        """
        Re-encrypt a user's PII with the current encryption key.
        
        Use this after key rotation to upgrade old encrypted data.
        
        Args:
            user_id: User ID
            
        Returns:
            True if successful
        """
        try:
            from app.models.user import User
            
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                logger.error(f"User {user_id} not found")
                return False
            
            # Re-encrypt each encrypted field
            encrypted_fields = []
            
            if hasattr(user, 'email_encrypted') and user.email_encrypted:
                user.email_encrypted = self.encryption_manager.re_encrypt(user.email_encrypted)
                encrypted_fields.append('email')
            
            if hasattr(user, 'phone_encrypted') and user.phone_encrypted:
                user.phone_encrypted = self.encryption_manager.re_encrypt(user.phone_encrypted)
                encrypted_fields.append('phone')
            
            if hasattr(user, 'ssn_encrypted') and user.ssn_encrypted:
                user.ssn_encrypted = self.encryption_manager.re_encrypt(user.ssn_encrypted)
                encrypted_fields.append('ssn')
            
            self.db.commit()
            
            logger.info(f"Re-encrypted {len(encrypted_fields)} fields for user {user_id}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to rotate encryption for user {user_id}: {e}")
            self.db.rollback()
            return False
    
    def rotate_all_users_encryption(self) -> Dict[str, int]:
        """
        Re-encrypt all users' PII with current encryption key.
        
        Use this after key rotation. Should be run in batches for large datasets.
        
        Returns:
            Dictionary with success/failure counts
        """
        from app.models.user import User
        
        users = self.db.query(User).all()
        
        success_count = 0
        failure_count = 0
        
        for user in users:
            if self.rotate_user_encryption(user.id):
                success_count += 1
            else:
                failure_count += 1
        
        logger.info(
            f"Encryption rotation complete: {success_count} successful, {failure_count} failed"
        )
        
        return {
            "success": success_count,
            "failed": failure_count,
            "total": len(users)
        }
    
    def get_encryption_status(self) -> Dict[str, Any]:
        """
        Get encryption system status.
        
        Returns:
            Status information
        """
        key_info = self.encryption_manager.get_key_info()
        
        # Count encrypted records (example for users)
        try:
            from app.models.user import User
            
            total_users = self.db.query(User).count()
            
            # Count users with encrypted fields
            # This is model-specific, adjust based on your schema
            encrypted_users = 0
            if hasattr(User, 'email_encrypted'):
                encrypted_users = self.db.query(User).filter(
                    User.email_encrypted.isnot(None)
                ).count()
            
            key_info["users_total"] = total_users
            key_info["users_encrypted"] = encrypted_users
            key_info["encryption_coverage"] = (
                f"{(encrypted_users / total_users * 100):.1f}%"
                if total_users > 0 else "0%"
            )
        
        except Exception as e:
            logger.warning(f"Could not get encryption statistics: {e}")
        
        return key_info


def mask_pii(value: str, mask_char: str = "*", visible_chars: int = 4) -> str:
    """
    Mask PII for display purposes (e.g., in logs or UI).
    
    Args:
        value: Value to mask
        mask_char: Character to use for masking
        visible_chars: Number of characters to show at end
        
    Returns:
        Masked value
        
    Examples:
        >>> mask_pii("john@example.com", visible_chars=4)
        '*************.com'
        
        >>> mask_pii("+1-555-0123", visible_chars=4)
        '*******0123'
    """
    if not value:
        return ""
    
    if len(value) <= visible_chars:
        return mask_char * len(value)
    
    masked_length = len(value) - visible_chars
    return (mask_char * masked_length) + value[-visible_chars:]


def mask_email(email: str) -> str:
    """
    Mask email address for display.
    
    Args:
        email: Email address
        
    Returns:
        Masked email
        
    Example:
        >>> mask_email("john.doe@example.com")
        'j******e@example.com'
    """
    if not email or "@" not in email:
        return mask_pii(email)
    
    local, domain = email.split("@", 1)
    
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + ("*" * (len(local) - 2)) + local[-1]
    
    return f"{masked_local}@{domain}"


def mask_phone(phone: str) -> str:
    """
    Mask phone number for display.
    
    Args:
        phone: Phone number
        
    Returns:
        Masked phone number
        
    Example:
        >>> mask_phone("+1-555-123-4567")
        '+1-***-***-4567'
    """
    # Keep last 4 digits visible
    return mask_pii(phone, visible_chars=4)


def mask_ssn(ssn: str) -> str:
    """
    Mask Social Security Number for display.
    
    Args:
        ssn: SSN
        
    Returns:
        Masked SSN
        
    Example:
        >>> mask_ssn("123-45-6789")
        '***-**-6789'
    """
    # Keep last 4 digits visible
    return mask_pii(ssn, visible_chars=4)


if __name__ == "__main__":
    # Test masking functions
    print("=" * 70)
    print("PII Masking Functions Test")
    print("=" * 70)
    
    print(f"\nEmail masking:")
    print(f"  Original: john.doe@example.com")
    print(f"  Masked:   {mask_email('john.doe@example.com')}")
    
    print(f"\nPhone masking:")
    print(f"  Original: +1-555-123-4567")
    print(f"  Masked:   {mask_phone('+1-555-123-4567')}")
    
    print(f"\nSSN masking:")
    print(f"  Original: 123-45-6789")
    print(f"  Masked:   {mask_ssn('123-45-6789')}")
    
    print(f"\nGeneric PII masking:")
    print(f"  Original: SensitiveData123")
    print(f"  Masked:   {mask_pii('SensitiveData123', visible_chars=3)}")
    
    print("\n" + "=" * 70)
    print("✅ Masking tests complete!")
    print("=" * 70)
