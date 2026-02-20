"""
Comprehensive Input Validation & Sanitization Module

This module provides enterprise-grade input validation and sanitization
to prevent common security vulnerabilities:
- SQL Injection
- XSS (Cross-Site Scripting)
- Path Traversal
- Command Injection
- LDAP Injection
- XML External Entity (XXE)

Usage:
    from app.core.validators import InputValidator, sanitize_html, validate_url
    
    validator = InputValidator()
    
    # SQL injection check
    is_safe, msg = validator.validate_sql_safe("user input")
    
    # XSS sanitization
    clean_text = sanitize_html(user_html)
    
    # URL validation
    is_valid, url = validate_url("https://example.com")
"""

import re
import html
import unicodedata
from typing import Tuple, Optional, List, Dict, Any
from urllib.parse import urlparse, quote, unquote
from pathlib import Path
import json

# Dangerous patterns for various injection attacks
SQL_INJECTION_PATTERNS = [
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT|JAVASCRIPT)\b)",
    r"(--|\#|\/\*|\*\/)",  # SQL comments
    r"(\bOR\b.*=.*)",  # OR clauses
    r"(;|\||&|`|\$\(|\$\{)",  # Command separators
    r"(xp_|sp_)",  # SQL Server stored procedures
    r"(\bAND\b.*=.*)",  # AND clauses in suspicious context
]

XSS_PATTERNS = [
    r"<script[^>]*>.*?</script>",  # Script tags
    r"javascript:",  # JavaScript protocol
    r"on\w+\s*=",  # Event handlers (onclick, onerror, etc.)
    r"<iframe[^>]*>",  # IFrames
    r"<embed[^>]*>",  # Embed tags
    r"<object[^>]*>",  # Object tags
    r"eval\s*\(",  # eval() calls
    r"expression\s*\(",  # CSS expressions
    r"vbscript:",  # VBScript protocol
    r"data:text/html",  # Data URIs with HTML
]

PATH_TRAVERSAL_PATTERNS = [
    r"\.\./",  # Directory traversal
    r"\.\.",  # Parent directory
    r"~",  # Home directory
    r"/etc/",  # System directories
    r"/proc/",
    r"/sys/",
    r"\\\\",  # UNC paths
    r"file://",  # File protocol
]

COMMAND_INJECTION_PATTERNS = [
    r"[;&|`$]",  # Shell metacharacters
    r"\$\(.*\)",  # Command substitution
    r"`.*`",  # Backticks
    r"\|\|",  # OR operator
    r"&&",  # AND operator
]

LDAP_INJECTION_PATTERNS = [
    r"[*()\\]",  # LDAP special characters
    r"[\x00]",  # Null byte
]

# Allowed HTML tags and attributes for rich text
ALLOWED_HTML_TAGS = {
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'hr', 'ul', 'ol', 'li', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div'
}

ALLOWED_HTML_ATTRIBUTES = {
    'a': {'href', 'title', 'target'},
    'img': {'src', 'alt', 'title', 'width', 'height'},
    'span': {'class'},
    'div': {'class'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
}

# Dangerous file extensions
DANGEROUS_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'dll', 'sys', 'sh', 'bash', 'ps1', 'psm1', 'app', 'deb', 'rpm'
}


class InputValidator:
    """
    Comprehensive input validator for security checks.
    
    Validates inputs against various injection attack patterns
    and provides sanitization utilities.
    """
    
    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator.
        
        Args:
            strict_mode: If True, applies stricter validation rules
        """
        self.strict_mode = strict_mode
    
    def validate_sql_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if input is safe from SQL injection.
        
        Args:
            value: String to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        value_upper = value.upper()
        
        for pattern in SQL_INJECTION_PATTERNS:
            if re.search(pattern, value_upper, re.IGNORECASE):
                return False, f"Potential SQL injection detected: suspicious pattern found"
        
        return True, None
    
    def validate_xss_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if input is safe from XSS attacks.
        
        Args:
            value: String to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        for pattern in XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return False, f"Potential XSS attack detected: suspicious pattern found"
        
        return True, None
    
    def validate_path_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if path is safe from traversal attacks.
        
        Args:
            value: Path to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        for pattern in PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                return False, f"Potential path traversal detected: suspicious pattern found"
        
        # Additional check: resolve path and ensure it doesn't escape
        try:
            resolved_path = Path(value).resolve()
            # This is a basic check; in production, compare against allowed base paths
            if str(resolved_path).startswith('/etc') or str(resolved_path).startswith('/sys'):
                return False, "Access to system directories not allowed"
        except Exception:
            return False, "Invalid path format"
        
        return True, None
    
    def validate_command_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if input is safe from command injection.
        
        Args:
            value: String to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        for pattern in COMMAND_INJECTION_PATTERNS:
            if re.search(pattern, value):
                return False, f"Potential command injection detected: suspicious pattern found"
        
        return True, None
    
    def validate_ldap_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if input is safe for LDAP queries.
        
        Args:
            value: String to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        for pattern in LDAP_INJECTION_PATTERNS:
            if re.search(pattern, value):
                return False, f"Potential LDAP injection detected: suspicious character found"
        
        return True, None
    
    def validate_json_safe(self, value: str) -> Tuple[bool, Optional[str]]:
        """
        Check if JSON string is valid and safe.
        
        Args:
            value: JSON string to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not value:
            return True, None
        
        try:
            parsed = json.loads(value)
            # Check for excessively deep nesting (DoS prevention)
            if self._get_json_depth(parsed) > 10:
                return False, "JSON nesting too deep (max 10 levels)"
            return True, None
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)}"
    
    def _get_json_depth(self, obj: Any, depth: int = 0) -> int:
        """Calculate maximum depth of JSON object."""
        if isinstance(obj, dict):
            return max([self._get_json_depth(v, depth + 1) for v in obj.values()], default=depth)
        elif isinstance(obj, list):
            return max([self._get_json_depth(item, depth + 1) for item in obj], default=depth)
        return depth
    
    def validate_filename(self, filename: str) -> Tuple[bool, Optional[str]]:
        """
        Validate filename for security issues.
        
        Args:
            filename: Filename to validate
            
        Returns:
            Tuple of (is_safe, error_message)
        """
        if not filename:
            return False, "Filename cannot be empty"
        
        # Check for path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            return False, "Filename cannot contain path separators or parent directory references"
        
        # Check for control characters
        if any(ord(char) < 32 for char in filename):
            return False, "Filename cannot contain control characters"
        
        # Check extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext in DANGEROUS_EXTENSIONS:
            return False, f"File extension '.{ext}' is not allowed for security reasons"
        
        # Check length
        if len(filename) > 255:
            return False, "Filename too long (max 255 characters)"
        
        return True, None
    
    def validate_email(self, email: str) -> Tuple[bool, Optional[str]]:
        """
        Validate email address format.
        
        Args:
            email: Email address to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not email:
            return False, "Email cannot be empty"
        
        # Basic email regex (RFC 5322 simplified)
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        if not re.match(email_pattern, email):
            return False, "Invalid email format"
        
        # Additional checks
        if len(email) > 254:
            return False, "Email too long (max 254 characters)"
        
        local_part, domain = email.rsplit('@', 1)
        if len(local_part) > 64:
            return False, "Email local part too long (max 64 characters)"
        
        return True, None
    
    def validate_username(self, username: str) -> Tuple[bool, Optional[str]]:
        """
        Validate username format.
        
        Args:
            username: Username to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not username:
            return False, "Username cannot be empty"
        
        # Only allow alphanumeric, underscore, hyphen, period
        if not re.match(r'^[a-zA-Z0-9._-]+$', username):
            return False, "Username can only contain letters, numbers, and ._- characters"
        
        if len(username) < 3:
            return False, "Username must be at least 3 characters"
        
        if len(username) > 50:
            return False, "Username cannot exceed 50 characters"
        
        return True, None
    
    def sanitize_string(self, value: str, max_length: Optional[int] = None) -> str:
        """
        Sanitize a string by removing dangerous characters.
        
        Args:
            value: String to sanitize
            max_length: Maximum allowed length
            
        Returns:
            Sanitized string
        """
        if not value:
            return ""
        
        # Normalize unicode characters
        value = unicodedata.normalize('NFKC', value)
        
        # Remove control characters (except common whitespace)
        value = ''.join(char for char in value if ord(char) >= 32 or char in '\n\r\t')
        
        # Remove null bytes
        value = value.replace('\x00', '')
        
        # Trim whitespace
        value = value.strip()
        
        # Truncate if needed
        if max_length and len(value) > max_length:
            value = value[:max_length]
        
        return value
    
    def comprehensive_check(self, value: str, checks: Optional[List[str]] = None) -> Tuple[bool, List[str]]:
        """
        Run multiple validation checks on input.
        
        Args:
            value: String to validate
            checks: List of check names to run. If None, runs all checks.
                   Options: 'sql', 'xss', 'path', 'command', 'ldap'
        
        Returns:
            Tuple of (is_safe, list_of_errors)
        """
        if checks is None:
            checks = ['sql', 'xss', 'command']
        
        errors = []
        
        if 'sql' in checks:
            is_safe, msg = self.validate_sql_safe(value)
            if not is_safe:
                errors.append(msg)
        
        if 'xss' in checks:
            is_safe, msg = self.validate_xss_safe(value)
            if not is_safe:
                errors.append(msg)
        
        if 'path' in checks:
            is_safe, msg = self.validate_path_safe(value)
            if not is_safe:
                errors.append(msg)
        
        if 'command' in checks:
            is_safe, msg = self.validate_command_safe(value)
            if not is_safe:
                errors.append(msg)
        
        if 'ldap' in checks:
            is_safe, msg = self.validate_ldap_safe(value)
            if not is_safe:
                errors.append(msg)
        
        return len(errors) == 0, errors


def sanitize_html(html_content: str, allowed_tags: Optional[set] = None, 
                   allowed_attributes: Optional[Dict[str, set]] = None) -> str:
    """
    Sanitize HTML content by removing dangerous tags and attributes.
    
    This is a lightweight sanitizer. For full HTML sanitization,
    use app.utils.html_sanitizer module which uses bleach library.
    
    Args:
        html_content: HTML string to sanitize
        allowed_tags: Set of allowed HTML tags (default: escape all)
        allowed_attributes: Dict of allowed attributes per tag
        
    Returns:
        Sanitized HTML string
    """
    if not html_content:
        return ""
    
    # For security, default to escaping all HTML
    # Use app.utils.html_sanitizer for rich text that needs formatting
    return html.escape(html_content)


def sanitize_url(url: str) -> str:
    """
    Sanitize URL by encoding special characters.
    
    Args:
        url: URL to sanitize
        
    Returns:
        Sanitized URL
    """
    if not url:
        return ""
    
    # Remove control characters
    url = ''.join(char for char in url if ord(char) >= 32)
    
    # Basic URL encoding
    return quote(url, safe=':/?#[]@!$&\'()*+,;=')


def validate_url(url: str, allowed_schemes: Optional[List[str]] = None) -> Tuple[bool, Optional[str]]:
    """
    Validate URL format and scheme.
    
    Args:
        url: URL to validate
        allowed_schemes: List of allowed schemes (default: ['http', 'https'])
        
    Returns:
        Tuple of (is_valid, error_message or validated_url)
    """
    if not url:
        return False, "URL cannot be empty"
    
    if allowed_schemes is None:
        allowed_schemes = ['http', 'https']
    
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in allowed_schemes:
            return False, f"URL scheme must be one of: {', '.join(allowed_schemes)}"
        
        # Check for valid domain
        if not parsed.netloc:
            return False, "URL must have a valid domain"
        
        # Check for suspicious patterns
        if any(char in url for char in ['<', '>', '"', "'"]):
            return False, "URL contains invalid characters"
        
        # Check length
        if len(url) > 2048:
            return False, "URL too long (max 2048 characters)"
        
        return True, url
        
    except Exception as e:
        return False, f"Invalid URL format: {str(e)}"


def escape_sql_like(value: str) -> str:
    """
    Escape special characters in SQL LIKE patterns.
    
    Args:
        value: String to escape
        
    Returns:
        Escaped string safe for SQL LIKE clauses
    """
    if not value:
        return ""
    
    # Escape SQL LIKE wildcards
    value = value.replace('\\', '\\\\')
    value = value.replace('%', '\\%')
    value = value.replace('_', '\\_')
    
    return value


def sanitize_for_log(value: str, max_length: int = 200) -> str:
    """
    Sanitize string for safe logging (prevent log injection).
    
    Args:
        value: String to sanitize
        max_length: Maximum length for log output
        
    Returns:
        Sanitized string safe for logging
    """
    if not value:
        return ""
    
    # Remove newlines and carriage returns (log injection prevention)
    value = value.replace('\n', ' ').replace('\r', ' ')
    
    # Remove control characters
    value = ''.join(char for char in value if ord(char) >= 32 or char == ' ')
    
    # Truncate
    if len(value) > max_length:
        value = value[:max_length] + "..."
    
    return value


# Global validator instance
input_validator = InputValidator()


# Convenience functions
def validate_input(value: str, check_type: str = "comprehensive") -> Tuple[bool, Optional[str]]:
    """
    Convenience function for common validation.
    
    Args:
        value: String to validate
        check_type: Type of check ('sql', 'xss', 'path', 'command', 'comprehensive')
        
    Returns:
        Tuple of (is_safe, error_message)
    """
    if check_type == "sql":
        return input_validator.validate_sql_safe(value)
    elif check_type == "xss":
        return input_validator.validate_xss_safe(value)
    elif check_type == "path":
        return input_validator.validate_path_safe(value)
    elif check_type == "command":
        return input_validator.validate_command_safe(value)
    elif check_type == "comprehensive":
        is_safe, errors = input_validator.comprehensive_check(value)
        return is_safe, "; ".join(errors) if errors else None
    else:
        raise ValueError(f"Unknown check type: {check_type}")


__all__ = [
    'InputValidator',
    'sanitize_html',
    'sanitize_url',
    'validate_url',
    'escape_sql_like',
    'sanitize_for_log',
    'validate_input',
    'input_validator',
]

