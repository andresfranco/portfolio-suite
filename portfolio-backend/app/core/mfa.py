"""
Multi-Factor Authentication (MFA) Module

Implements TOTP-based (Time-based One-Time Password) MFA:
- TOTP secret generation and verification
- QR code generation for authenticator apps
- Backup codes generation and validation
- MFA enrollment and verification flows

Compatible with:
- Google Authenticator
- Microsoft Authenticator
- Authy
- Any RFC 6238 TOTP app
"""

import base64
import hashlib
import io
import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

import pyotp
import qrcode
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# Password context for backup code hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class MFAManager:
    """
    Manages Multi-Factor Authentication operations.
    
    Features:
    - TOTP secret generation
    - QR code generation for enrollment
    - TOTP code verification with time drift tolerance
    - Backup code generation and validation
    - Code reuse prevention
    """
    
    def __init__(self):
        self.app_name = settings.PROJECT_NAME
        self.totp_valid_window = 1  # Allow 1 step before/after (30s each)
        self.backup_code_length = 8
        self.backup_code_count = 10
    
    def generate_secret(self) -> str:
        """
        Generate a random TOTP secret.
        
        Returns:
            Base32-encoded secret string (compatible with authenticator apps)
        """
        secret = pyotp.random_base32()
        logger.info("Generated new TOTP secret")
        return secret
    
    def generate_qr_code(self, secret: str, username: str) -> bytes:
        """
        Generate QR code for TOTP enrollment.
        
        Args:
            secret: TOTP secret (base32)
            username: User's username or email
        
        Returns:
            PNG image bytes of QR code
        """
        try:
            # Create TOTP URI
            totp = pyotp.TOTP(secret)
            provisioning_uri = totp.provisioning_uri(
                name=username,
                issuer_name=self.app_name
            )
            
            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(provisioning_uri)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to bytes
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            
            logger.info(f"Generated QR code for user: {username}")
            return img_bytes.read()
            
        except Exception as e:
            logger.error(f"Failed to generate QR code: {e}")
            raise
    
    def generate_backup_codes(self, count: Optional[int] = None) -> List[Tuple[str, str]]:
        """
        Generate backup codes for account recovery.
        
        Args:
            count: Number of backup codes to generate (default: 10)
        
        Returns:
            List of tuples (plain_code, hashed_code)
        """
        if count is None:
            count = self.backup_code_count
        
        codes = []
        for _ in range(count):
            # Generate random alphanumeric code
            plain_code = ''.join(
                secrets.choice(string.ascii_uppercase + string.digits)
                for _ in range(self.backup_code_length)
            )
            
            # Format with dashes for readability (XXXX-XXXX)
            formatted_code = f"{plain_code[:4]}-{plain_code[4:]}"
            
            # Hash code for storage
            hashed_code = pwd_context.hash(plain_code)
            
            codes.append((formatted_code, hashed_code))
        
        logger.info(f"Generated {count} backup codes")
        return codes
    
    def verify_totp_code(
        self,
        secret: str,
        code: str,
        used_codes_window: Optional[List[int]] = None
    ) -> bool:
        """
        Verify TOTP code with time drift tolerance.
        
        Args:
            secret: User's TOTP secret
            code: 6-digit code from authenticator app
            used_codes_window: List of recently used time windows (prevents reuse)
        
        Returns:
            True if code is valid and not recently used
        """
        if not code or not code.isdigit() or len(code) != 6:
            logger.warning(f"Invalid TOTP code format: {code}")
            return False
        
        try:
            totp = pyotp.TOTP(secret)
            
            # Check code with time drift tolerance
            # valid_window=1 allows codes from 30s before and after
            is_valid = totp.verify(code, valid_window=self.totp_valid_window)
            
            if not is_valid:
                logger.warning("TOTP code verification failed: invalid code")
                return False
            
            # Prevent code reuse within the time window
            if used_codes_window is not None:
                current_time_window = self._get_current_time_window(totp)
                if current_time_window in used_codes_window:
                    logger.warning("TOTP code already used in this time window")
                    return False
            
            logger.info("TOTP code verified successfully")
            return True
            
        except Exception as e:
            logger.error(f"TOTP verification error: {e}")
            return False
    
    def verify_backup_code(
        self,
        plain_code: str,
        hashed_codes: List[str]
    ) -> Tuple[bool, Optional[List[str]]]:
        """
        Verify backup code against stored hashed codes.
        
        Args:
            plain_code: Plain backup code entered by user
            hashed_codes: List of hashed backup codes
        
        Returns:
            Tuple of (is_valid, remaining_codes)
            - is_valid: True if code matches
            - remaining_codes: List of hashes with the used one removed (None if invalid)
        """
        # Remove dashes and convert to uppercase
        plain_code = plain_code.replace("-", "").replace(" ", "").upper()
        
        if not plain_code or len(plain_code) != self.backup_code_length:
            logger.warning("Invalid backup code format")
            return False, None
        
        # Check against all stored hashes
        for hashed_code in hashed_codes:
            try:
                if pwd_context.verify(plain_code, hashed_code):
                    logger.info("Backup code verified successfully")
                    # Return remaining codes (all except the matched one)
                    remaining = [h for h in hashed_codes if h != hashed_code]
                    logger.info(f"Backup code used. Remaining codes: {len(remaining)}")
                    return True, remaining
            except Exception as e:
                logger.error(f"Error verifying backup code: {e}")
                continue
        
        logger.warning("Backup code verification failed: no match")
        return False, None
    
    def _get_current_time_window(self, totp: pyotp.TOTP) -> int:
        """Get current TOTP time window (for reuse prevention)."""
        return int(datetime.now().timestamp() / totp.interval)
    
    def get_current_code(self, secret: str) -> str:
        """
        Get current TOTP code (for testing/verification).
        
        Args:
            secret: TOTP secret
        
        Returns:
            Current 6-digit code
        """
        totp = pyotp.TOTP(secret)
        return totp.now()
    
    def time_remaining(self, secret: str) -> int:
        """
        Get seconds remaining before current code expires.
        
        Args:
            secret: TOTP secret
        
        Returns:
            Seconds remaining (0-30)
        """
        totp = pyotp.TOTP(secret)
        current_time = datetime.now().timestamp()
        time_remaining = totp.interval - (int(current_time) % totp.interval)
        return time_remaining


# Global MFA manager instance
mfa_manager = MFAManager()

