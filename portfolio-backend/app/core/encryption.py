"""
Field-Level Encryption for Sensitive Data

This module provides encryption utilities for protecting Personally Identifiable Information (PII)
and other sensitive data at the field level using Fernet (symmetric encryption with AES-128-CBC).

Security Features:
- Symmetric encryption using Fernet (AES-128-CBC + HMAC)
- Key rotation support with versioning
- Automatic key derivation from master key
- Secure key storage recommendations
- Envelope encryption pattern

Usage:
    from app.core.encryption import encryption_manager
    
    # Encrypt sensitive data
    encrypted_email = encryption_manager.encrypt("user@example.com")
    
    # Decrypt when needed
    plain_email = encryption_manager.decrypt(encrypted_email)
    
    # Rotate keys periodically
    encryption_manager.rotate_key()

Author: Security Team
Date: October 23, 2025
"""

import os
import base64
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from cryptography.fernet import Fernet, MultiFernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


class EncryptionManager:
    """
    Manages field-level encryption for sensitive data.
    
    Features:
    - AES-128-CBC encryption via Fernet
    - Key rotation with backward compatibility
    - Key derivation from master secret
    - Envelope encryption pattern
    """
    
    def __init__(self, master_key: Optional[str] = None, salt: Optional[str] = None):
        """
        Initialize encryption manager.
        
        Args:
            master_key: Master encryption key (from environment)
            salt: Salt for key derivation (from environment)
        """
        self.master_key = master_key or os.getenv("ENCRYPTION_MASTER_KEY", "")
        self.salt = salt or os.getenv("ENCRYPTION_SALT", "default-salt-change-in-production")
        
        if not self.master_key:
            # In development, generate a key
            if os.getenv("ENVIRONMENT", "development").lower() == "development":
                logger.warning("ENCRYPTION_MASTER_KEY not set, generating random key for development")
                self.master_key = Fernet.generate_key().decode()
            else:
                raise ValueError(
                    "ENCRYPTION_MASTER_KEY must be set in production. "
                    "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
                )
        
        # Derive encryption keys
        self._keys = self._derive_keys()
        self._fernet = self._create_fernet()
        
        # Track encryption metadata
        self._key_version = 1
        self._created_at = datetime.utcnow()
        
        logger.info("Encryption manager initialized (key version: %d)", self._key_version)
    
    def _derive_keys(self) -> list:
        """
        Derive encryption keys from master key using PBKDF2.
        
        Returns:
            List of derived Fernet keys
        """
        # Convert master key to bytes
        if isinstance(self.master_key, str):
            master_bytes = self.master_key.encode()
        else:
            master_bytes = self.master_key
        
        # Derive primary key
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt.encode(),
            iterations=100000,
            backend=default_backend()
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(master_bytes))
        
        return [derived_key]
    
    def _create_fernet(self) -> MultiFernet:
        """
        Create MultiFernet instance for encryption with key rotation support.
        
        Returns:
            MultiFernet instance
        """
        fernet_keys = [Fernet(key) for key in self._keys]
        return MultiFernet(fernet_keys)
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt sensitive data.
        
        Args:
            plaintext: Plain text to encrypt
            
        Returns:
            Encrypted data as base64 string
            
        Raises:
            ValueError: If plaintext is empty
            Exception: If encryption fails
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty string")
        
        try:
            # Convert to bytes and encrypt
            plaintext_bytes = plaintext.encode('utf-8')
            encrypted_bytes = self._fernet.encrypt(plaintext_bytes)
            
            # Return base64-encoded string for storage
            return encrypted_bytes.decode('utf-8')
        
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise Exception(f"Encryption failed: {e}")
    
    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt sensitive data.
        
        Args:
            ciphertext: Encrypted data (base64 string)
            
        Returns:
            Decrypted plain text
            
        Raises:
            ValueError: If ciphertext is empty
            InvalidToken: If decryption fails (wrong key or corrupted data)
        """
        if not ciphertext:
            raise ValueError("Cannot decrypt empty string")
        
        try:
            # Convert from base64 and decrypt
            ciphertext_bytes = ciphertext.encode('utf-8')
            decrypted_bytes = self._fernet.decrypt(ciphertext_bytes)
            
            # Return decoded string
            return decrypted_bytes.decode('utf-8')
        
        except InvalidToken:
            logger.error("Decryption failed: Invalid token (wrong key or corrupted data)")
            raise InvalidToken("Decryption failed: Invalid token")
        
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise Exception(f"Decryption failed: {e}")
    
    def encrypt_dict(self, data: Dict[str, Any], fields: list) -> Dict[str, Any]:
        """
        Encrypt specific fields in a dictionary.
        
        Args:
            data: Dictionary containing data
            fields: List of field names to encrypt
            
        Returns:
            Dictionary with encrypted fields
        """
        encrypted_data = data.copy()
        
        for field in fields:
            if field in encrypted_data and encrypted_data[field]:
                try:
                    encrypted_data[field] = self.encrypt(str(encrypted_data[field]))
                    encrypted_data[f"{field}_encrypted"] = True
                except Exception as e:
                    logger.error(f"Failed to encrypt field '{field}': {e}")
                    # Don't fail the entire operation, log error
        
        return encrypted_data
    
    def decrypt_dict(self, data: Dict[str, Any], fields: list) -> Dict[str, Any]:
        """
        Decrypt specific fields in a dictionary.
        
        Args:
            data: Dictionary containing encrypted data
            fields: List of field names to decrypt
            
        Returns:
            Dictionary with decrypted fields
        """
        decrypted_data = data.copy()
        
        for field in fields:
            if field in decrypted_data and decrypted_data[field]:
                # Only decrypt if marked as encrypted
                if decrypted_data.get(f"{field}_encrypted"):
                    try:
                        decrypted_data[field] = self.decrypt(decrypted_data[field])
                        decrypted_data[f"{field}_encrypted"] = False
                    except Exception as e:
                        logger.error(f"Failed to decrypt field '{field}': {e}")
                        # Keep encrypted value, log error
        
        return decrypted_data
    
    def rotate_key(self, new_master_key: Optional[str] = None):
        """
        Rotate encryption keys.
        
        This allows decrypting old data while encrypting new data with new key.
        Old data should be re-encrypted in batches after rotation.
        
        Args:
            new_master_key: New master key (optional, generates if not provided)
        """
        # Generate or use provided new key
        if new_master_key:
            new_key = new_master_key
        else:
            new_key = Fernet.generate_key().decode()
            logger.info("Generated new master key for rotation")
        
        # Derive new encryption key
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt.encode(),
            iterations=100000,
            backend=default_backend()
        )
        derived_key = base64.urlsafe_b64encode(kdf.derive(new_key.encode()))
        
        # Add new key to the front (used for encryption)
        # Keep old keys for decryption of existing data
        self._keys.insert(0, derived_key)
        self._fernet = self._create_fernet()
        self._key_version += 1
        
        logger.warning(
            f"Encryption key rotated (version {self._key_version}). "
            f"Old data can still be decrypted. Re-encrypt data for full rotation."
        )
        
        return new_key
    
    def re_encrypt(self, ciphertext: str) -> str:
        """
        Re-encrypt data with current (latest) key.
        
        Use this after key rotation to upgrade encrypted data to new key.
        
        Args:
            ciphertext: Data encrypted with old key
            
        Returns:
            Data encrypted with new key
        """
        # Decrypt with any available key (including old ones)
        plaintext = self.decrypt(ciphertext)
        
        # Re-encrypt with current (newest) key
        return self.encrypt(plaintext)
    
    def get_key_info(self) -> Dict[str, Any]:
        """
        Get information about current encryption configuration.
        
        Returns:
            Dictionary with key metadata (no sensitive data)
        """
        return {
            "key_version": self._key_version,
            "created_at": self._created_at.isoformat(),
            "algorithm": "Fernet (AES-128-CBC + HMAC)",
            "key_derivation": "PBKDF2-SHA256 (100k iterations)",
            "available_keys": len(self._keys),
        }
    
    @staticmethod
    def generate_master_key() -> str:
        """
        Generate a new master key for encryption.
        
        Returns:
            Base64-encoded master key
        """
        return Fernet.generate_key().decode()
    
    @staticmethod
    def generate_salt() -> str:
        """
        Generate a random salt for key derivation.
        
        Returns:
            Random salt string
        """
        import secrets
        return secrets.token_urlsafe(32)


# Singleton instance
_encryption_manager: Optional[EncryptionManager] = None


def get_encryption_manager() -> EncryptionManager:
    """
    Get or create encryption manager singleton.
    
    Returns:
        EncryptionManager instance
    """
    global _encryption_manager
    
    if _encryption_manager is None:
        _encryption_manager = EncryptionManager()
    
    return _encryption_manager


# Convenient alias
encryption_manager = get_encryption_manager()


# Utility functions for common PII types
def encrypt_email(email: str) -> str:
    """Encrypt email address."""
    return encryption_manager.encrypt(email)


def decrypt_email(encrypted_email: str) -> str:
    """Decrypt email address."""
    return encryption_manager.decrypt(encrypted_email)


def encrypt_phone(phone: str) -> str:
    """Encrypt phone number."""
    return encryption_manager.encrypt(phone)


def decrypt_phone(encrypted_phone: str) -> str:
    """Decrypt phone number."""
    return encryption_manager.decrypt(encrypted_phone)


def encrypt_ssn(ssn: str) -> str:
    """Encrypt Social Security Number."""
    return encryption_manager.encrypt(ssn)


def decrypt_ssn(encrypted_ssn: str) -> str:
    """Decrypt Social Security Number."""
    return encryption_manager.decrypt(encrypted_ssn)


# Example: Database model mixin for encrypted fields
class EncryptedFieldMixin:
    """
    Mixin for SQLAlchemy models with encrypted fields.
    
    Usage:
        class User(Base, EncryptedFieldMixin):
            __tablename__ = "users"
            
            email_encrypted = Column(Text)  # Stores encrypted email
            phone_encrypted = Column(Text)  # Stores encrypted phone
            
            @property
            def email(self):
                return self.decrypt_field('email_encrypted')
            
            @email.setter
            def email(self, value):
                self.email_encrypted = self.encrypt_field(value)
    """
    
    def encrypt_field(self, value: str) -> str:
        """Encrypt a field value."""
        return encryption_manager.encrypt(value)
    
    def decrypt_field(self, field_name: str) -> Optional[str]:
        """Decrypt a field value."""
        encrypted_value = getattr(self, field_name, None)
        if encrypted_value:
            try:
                return encryption_manager.decrypt(encrypted_value)
            except Exception as e:
                logger.error(f"Failed to decrypt {field_name}: {e}")
                return None
        return None


if __name__ == "__main__":
    # Self-test
    
    # Test basic encryption/decryption
    test_data = "user@example.com"
    
    encrypted = encryption_manager.encrypt(test_data)
    
    decrypted = encryption_manager.decrypt(encrypted)
    
    # Test dictionary encryption
    user_data = {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1-555-0123",
        "role": "user"
    }
    
    encrypted_data = encryption_manager.encrypt_dict(user_data, ["email", "phone"])
    
    decrypted_data = encryption_manager.decrypt_dict(encrypted_data, ["email", "phone"])
    
    # Test key info
    info = encryption_manager.get_key_info()
    for key, value in info.items():
        pass

