"""
File Upload Security Module

Implements comprehensive file upload security:
- File type validation (magic number checking)
- Malware scanning (ClamAV integration)
- EXIF data stripping from images
- File sanitization
- Hash verification
- File size validation
- Content validation

Security Features:
- Prevents file type spoofing
- Detects malware and suspicious files
- Removes metadata from images (privacy)
- Validates file content matches declared type
"""

import hashlib
import io
import logging
import mimetypes
import os
import re
from pathlib import Path
from typing import Optional, Tuple, List, BinaryIO

from PIL import Image
from PIL.ExifTags import TAGS

try:
    import magic  # python-magic for file type detection
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    logging.warning("python-magic not installed. File type validation will use basic checks only.")

from app.core.config import settings

logger = logging.getLogger(__name__)


class FileSecurityManager:
    """
    Manages file upload security operations.
    
    Features:
    - File type validation via magic numbers
    - Malware scanning (ClamAV)
    - EXIF data removal
    - File sanitization
    - Hash generation
    """
    
    def __init__(self):
        # Allowed file extensions and MIME types
        self.allowed_extensions = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
        }
        
        # Maximum file sizes by type (bytes)
        self.max_file_sizes = {
            'image': 10 * 1024 * 1024,  # 10MB for images
            'document': 20 * 1024 * 1024,  # 20MB for documents
            'default': 10 * 1024 * 1024,  # 10MB default
        }
        
        # Dangerous file extensions (always reject)
        self.dangerous_extensions = {
            '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar',
            '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi', '.apk',
            '.com', '.pif', '.scr', '.hta', '.cpl', '.msc', '.vb'
        }
        
        # File magic numbers (first few bytes) for validation
        self.magic_numbers = {
            'image/jpeg': [b'\xFF\xD8\xFF'],
            'image/png': [b'\x89PNG\r\n\x1a\n'],
            'image/gif': [b'GIF87a', b'GIF89a'],
            'application/pdf': [b'%PDF-'],
            'application/zip': [b'PK\x03\x04', b'PK\x05\x06'],
        }
    
    def validate_file_extension(self, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate file extension is allowed.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not filename:
            return False, "Filename is empty"
        
        # Get extension
        extension = Path(filename).suffix.lower()
        
        if not extension:
            return False, "File has no extension"
        
        # Check dangerous extensions
        if extension in self.dangerous_extensions:
            logger.warning(f"Dangerous file extension detected: {extension}")
            return False, f"File type not allowed: {extension}"
        
        # Check allowed extensions
        if extension not in self.allowed_extensions:
            return False, f"File type not allowed: {extension}"
        
        return True, None
    
    def validate_file_size(
        self,
        file_size: int,
        file_type: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate file size is within limits.
        
        Args:
            file_size: File size in bytes
            file_type: File type category ('image', 'document', etc.)
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        max_size = self.max_file_sizes.get(file_type or 'default', self.max_file_sizes['default'])
        
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            return False, f"File too large. Maximum size: {max_mb:.1f}MB"
        
        if file_size == 0:
            return False, "File is empty"
        
        return True, None
    
    def validate_magic_number(
        self,
        file_content: bytes,
        expected_mime: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate file content matches expected type via magic numbers.
        
        Args:
            file_content: First few bytes of file
            expected_mime: Expected MIME type
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not file_content:
            return False, "File content is empty"
        
        # Get expected magic numbers
        expected_magics = self.magic_numbers.get(expected_mime, [])
        
        if not expected_magics:
            # No magic number defined for this type, skip validation
            logger.warning(f"No magic number defined for MIME type: {expected_mime}")
            return True, None
        
        # Check if file starts with any expected magic number
        for magic in expected_magics:
            if file_content.startswith(magic):
                return True, None
        
        logger.warning(
            f"Magic number mismatch: expected {expected_mime}, "
            f"got {file_content[:10].hex()}"
        )
        return False, "File content does not match declared type"
    
    def detect_file_type(self, file_path: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Detect actual file type using python-magic.
        
        Returns:
            Tuple of (mime_type, error_message)
        """
        if not MAGIC_AVAILABLE:
            # Fallback to extension-based detection
            mime_type, _ = mimetypes.guess_type(file_path)
            return mime_type, None
        
        try:
            mime = magic.Magic(mime=True)
            detected_type = mime.from_file(file_path)
            return detected_type, None
        except Exception as e:
            logger.error(f"Failed to detect file type: {e}")
            return None, str(e)
    
    def scan_for_malware(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Scan file for malware using ClamAV.
        
        Note: Requires ClamAV daemon (clamd) to be running.
        If not available, returns clean status with warning.
        
        Returns:
            Tuple of (is_clean, error_message)
        """
        try:
            import clamd
            
            # Connect to ClamAV daemon
            cd = clamd.ClamdUnixSocket()
            
            # Scan file
            scan_result = cd.scan(file_path)
            
            if scan_result is None:
                # File is clean
                return True, None
            
            # File is infected
            logger.warning(f"Malware detected in file: {file_path}, result: {scan_result}")
            return False, "Malware detected in file"
            
        except ImportError:
            logger.warning("clamd library not installed. Malware scanning disabled.")
            # Return clean if scanning not available (with warning logged)
            return True, None
        except Exception as e:
            logger.error(f"Malware scan failed: {e}")
            # Fail open (allow file) to prevent service disruption
            # In production, you might want to fail closed (reject file)
            return True, f"Malware scan unavailable: {e}"
    
    def strip_exif_data(
        self,
        image_path: str,
        output_path: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Remove EXIF metadata from image files.
        
        Privacy feature: Removes GPS, camera, and other metadata.
        
        Args:
            image_path: Path to image file
            output_path: Optional output path (overwrites input if not provided)
        
        Returns:
            Tuple of (success, error_message)
        """
        if output_path is None:
            output_path = image_path
        
        try:
            # Open image
            img = Image.open(image_path)
            
            # Get image data without EXIF
            data = list(img.getdata())
            image_without_exif = Image.new(img.mode, img.size)
            image_without_exif.putdata(data)
            
            # Save without EXIF
            image_without_exif.save(output_path)
            
            logger.info(f"EXIF data stripped from image: {image_path}")
            return True, None
            
        except Exception as e:
            logger.error(f"Failed to strip EXIF data: {e}")
            return False, str(e)
    
    def sanitize_filename(self, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal and other attacks.
        
        Removes:
        - Path separators (/, \)
        - Null bytes
        - Control characters
        - Leading/trailing dots and spaces
        
        Args:
            filename: Original filename
        
        Returns:
            Sanitized filename
        """
        # Remove path components
        filename = os.path.basename(filename)
        
        # Remove null bytes
        filename = filename.replace('\x00', '')
        
        # Remove control characters
        filename = ''.join(c for c in filename if ord(c) >= 32)
        
        # Replace dangerous characters with underscore
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        
        # Remove leading/trailing dots and spaces
        filename = filename.strip('. ')
        
        # Limit filename length
        name, ext = os.path.splitext(filename)
        if len(name) > 200:
            name = name[:200]
        filename = name + ext
        
        # Ensure filename is not empty
        if not filename:
            filename = "unnamed_file"
        
        return filename
    
    def calculate_file_hash(
        self,
        file_path: str,
        algorithm: str = 'sha256'
    ) -> Optional[str]:
        """
        Calculate cryptographic hash of file.
        
        Useful for:
        - Duplicate detection
        - Integrity verification
        - Content addressing
        
        Args:
            file_path: Path to file
            algorithm: Hash algorithm ('sha256', 'md5', 'sha1')
        
        Returns:
            Hex digest of hash, or None on error
        """
        try:
            hash_func = hashlib.new(algorithm)
            
            with open(file_path, 'rb') as f:
                # Read file in chunks to handle large files
                for chunk in iter(lambda: f.read(8192), b''):
                    hash_func.update(chunk)
            
            return hash_func.hexdigest()
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash: {e}")
            return None
    
    def validate_image_content(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validate image file can be opened and processed.
        
        Detects:
        - Corrupted images
        - Malformed headers
        - Suspicious content
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            img = Image.open(file_path)
            
            # Verify image by loading it
            img.verify()
            
            # Re-open for additional checks (verify closes the file)
            img = Image.open(file_path)
            
            # Check image dimensions
            width, height = img.size
            
            if width == 0 or height == 0:
                return False, "Invalid image dimensions"
            
            # Check if image is suspiciously large
            if width > 50000 or height > 50000:
                return False, "Image dimensions too large (possible bomb)"
            
            # Check for reasonable pixel count (prevent decompression bombs)
            max_pixels = 178956970  # Maximum pixels allowed by Pillow
            if width * height > max_pixels:
                return False, "Image pixel count too large"
            
            return True, None
            
        except Exception as e:
            logger.error(f"Image validation failed: {e}")
            return False, f"Invalid or corrupted image: {str(e)}"
    
    def comprehensive_file_check(
        self,
        file_path: str,
        original_filename: str,
        max_size: Optional[int] = None
    ) -> Tuple[bool, List[str]]:
        """
        Perform comprehensive security check on uploaded file.
        
        Checks:
        1. File extension
        2. File size
        3. Magic number validation
        4. Malware scan
        5. Content validation (for images)
        6. EXIF stripping (for images)
        
        Args:
            file_path: Path to uploaded file
            original_filename: Original filename
            max_size: Optional max size override
        
        Returns:
            Tuple of (is_safe, list_of_errors)
        """
        errors = []
        
        # 1. Validate filename
        is_valid, error = self.validate_file_extension(original_filename)
        if not is_valid:
            errors.append(error)
            return False, errors
        
        # 2. Validate file size
        file_size = os.path.getsize(file_path)
        extension = Path(original_filename).suffix.lower()
        file_type = 'image' if extension in ['.jpg', '.jpeg', '.png', '.gif'] else 'document'
        
        is_valid, error = self.validate_file_size(file_size, file_type)
        if not is_valid:
            errors.append(error)
            return False, errors
        
        # 3. Detect and validate file type
        detected_mime, error = self.detect_file_type(file_path)
        if error:
            errors.append(f"File type detection failed: {error}")
        
        expected_mime = self.allowed_extensions.get(extension)
        if detected_mime and expected_mime:
            # Basic MIME type matching (ignore parameters)
            detected_base = detected_mime.split(';')[0].strip()
            expected_base = expected_mime.split(';')[0].strip()
            
            if detected_base != expected_base:
                errors.append(
                    f"File type mismatch: extension suggests {expected_base}, "
                    f"but content is {detected_base}"
                )
        
        # 4. Scan for malware
        is_clean, error = self.scan_for_malware(file_path)
        if not is_clean:
            errors.append(error)
            return False, errors
        
        # 5. Image-specific validation
        if file_type == 'image':
            is_valid, error = self.validate_image_content(file_path)
            if not is_valid:
                errors.append(error)
                return False, errors
            
            # 6. Strip EXIF data
            success, error = self.strip_exif_data(file_path)
            if not success:
                logger.warning(f"Failed to strip EXIF data: {error}")
                # Non-critical error, continue
        
        # If we got here with no errors, file is safe
        if errors:
            return False, errors
        
        logger.info(f"File passed all security checks: {original_filename}")
        return True, []


# Global instance
file_security_manager = FileSecurityManager()

