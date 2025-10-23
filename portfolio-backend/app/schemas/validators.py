"""
Pydantic Validators for Enhanced Input Validation

This module provides Pydantic field validators that can be used
in schema definitions to automatically validate and sanitize inputs.

Usage:
    from app.schemas.validators import validate_no_xss, validate_safe_string
    from pydantic import BaseModel, field_validator
    
    class UserInput(BaseModel):
        name: str
        description: str
        
        @field_validator('name')
        @classmethod
        def validate_name(cls, v):
            return validate_safe_string(v, max_length=100)
        
        @field_validator('description')
        @classmethod
        def validate_desc(cls, v):
            return validate_no_xss(v)
"""

from typing import Any, Optional
from pydantic import field_validator, ValidationError as PydanticValidationError
from app.core.validators import (
    input_validator,
    validate_url as core_validate_url,
    sanitize_for_log
)
from app.utils.html_sanitizer import (
    sanitize_rich_text,
    sanitize_basic_text,
    strip_all_html
)


def validate_no_sql_injection(value: str) -> str:
    """
    Validator to check for SQL injection attempts.
    Raises ValidationError if suspicious patterns detected.
    
    Args:
        value: String to validate
        
    Returns:
        Original value if safe
        
    Raises:
        ValueError: If SQL injection pattern detected
    """
    if not value:
        return value
    
    is_safe, msg = input_validator.validate_sql_safe(value)
    if not is_safe:
        raise ValueError(msg)
    
    return value


def validate_no_xss(value: str) -> str:
    """
    Validator to check for XSS attack attempts.
    Raises ValidationError if suspicious patterns detected.
    
    Args:
        value: String to validate
        
    Returns:
        Original value if safe
        
    Raises:
        ValueError: If XSS pattern detected
    """
    if not value:
        return value
    
    is_safe, msg = input_validator.validate_xss_safe(value)
    if not is_safe:
        raise ValueError(msg)
    
    return value


def validate_no_path_traversal(value: str) -> str:
    """
    Validator to check for path traversal attempts.
    Raises ValidationError if suspicious patterns detected.
    
    Args:
        value: String to validate
        
    Returns:
        Original value if safe
        
    Raises:
        ValueError: If path traversal pattern detected
    """
    if not value:
        return value
    
    is_safe, msg = input_validator.validate_path_safe(value)
    if not is_safe:
        raise ValueError(msg)
    
    return value


def validate_safe_string(value: str, max_length: Optional[int] = None,
                         allow_empty: bool = False) -> str:
    """
    Comprehensive string validator that checks for multiple attack vectors.
    
    Args:
        value: String to validate
        max_length: Maximum allowed length
        allow_empty: Whether to allow empty strings
        
    Returns:
        Sanitized value
        
    Raises:
        ValueError: If validation fails
    """
    if not value:
        if allow_empty:
            return value
        raise ValueError("Value cannot be empty")
    
    # Run comprehensive check
    is_safe, errors = input_validator.comprehensive_check(value, checks=['sql', 'xss', 'command'])
    if not is_safe:
        raise ValueError(f"Input validation failed: {'; '.join(errors)}")
    
    # Sanitize
    sanitized = input_validator.sanitize_string(value, max_length=max_length)
    
    return sanitized


def validate_username_field(value: str) -> str:
    """
    Validator for username fields.
    
    Args:
        value: Username to validate
        
    Returns:
        Validated username
        
    Raises:
        ValueError: If username is invalid
    """
    if not value:
        raise ValueError("Username cannot be empty")
    
    is_valid, msg = input_validator.validate_username(value)
    if not is_valid:
        raise ValueError(msg)
    
    return value.lower()  # Normalize to lowercase


def validate_email_field(value: str) -> str:
    """
    Validator for email fields.
    
    Args:
        value: Email to validate
        
    Returns:
        Validated email
        
    Raises:
        ValueError: If email is invalid
    """
    if not value:
        raise ValueError("Email cannot be empty")
    
    is_valid, msg = input_validator.validate_email(value)
    if not is_valid:
        raise ValueError(msg)
    
    return value.lower()  # Normalize to lowercase


def validate_url_field(value: str, allowed_schemes: Optional[list] = None) -> str:
    """
    Validator for URL fields.
    
    Args:
        value: URL to validate
        allowed_schemes: List of allowed schemes (default: ['http', 'https'])
        
    Returns:
        Validated URL
        
    Raises:
        ValueError: If URL is invalid
    """
    if not value:
        raise ValueError("URL cannot be empty")
    
    is_valid, result = core_validate_url(value, allowed_schemes=allowed_schemes)
    if not is_valid:
        raise ValueError(result)
    
    return result


def validate_filename_field(value: str) -> str:
    """
    Validator for filename fields.
    
    Args:
        value: Filename to validate
        
    Returns:
        Validated filename
        
    Raises:
        ValueError: If filename is invalid
    """
    if not value:
        raise ValueError("Filename cannot be empty")
    
    is_valid, msg = input_validator.validate_filename(value)
    if not is_valid:
        raise ValueError(msg)
    
    return value


def validate_rich_text(value: str, max_length: Optional[int] = None,
                       level: str = "rich") -> str:
    """
    Validator for rich text content (HTML).
    Sanitizes HTML to remove dangerous tags and attributes.
    
    Args:
        value: HTML content to validate
        max_length: Maximum allowed length
        level: Sanitization level ('rich', 'basic', 'strip')
        
    Returns:
        Sanitized HTML
        
    Raises:
        ValueError: If content is too long
    """
    if not value:
        return value
    
    if max_length and len(value) > max_length:
        raise ValueError(f"Content too long (max {max_length} characters)")
    
    # Sanitize HTML based on level
    if level == "rich":
        sanitized = sanitize_rich_text(value)
    elif level == "basic":
        sanitized = sanitize_basic_text(value)
    elif level == "strip":
        sanitized = strip_all_html(value)
    else:
        raise ValueError(f"Invalid sanitization level: {level}")
    
    return sanitized


def validate_json_string(value: str) -> str:
    """
    Validator for JSON string fields.
    
    Args:
        value: JSON string to validate
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If JSON is invalid or unsafe
    """
    if not value:
        return value
    
    is_valid, msg = input_validator.validate_json_safe(value)
    if not is_valid:
        raise ValueError(msg)
    
    return value


def sanitize_for_logging(value: Any) -> str:
    """
    Sanitize any value for safe logging.
    
    Args:
        value: Value to sanitize
        
    Returns:
        Sanitized string safe for logging
    """
    if value is None:
        return "None"
    
    str_value = str(value)
    return sanitize_for_log(str_value)


def validate_alphanumeric(value: str, allow_spaces: bool = False,
                          allow_underscore: bool = False,
                          allow_hyphen: bool = False) -> str:
    """
    Validate that string contains only alphanumeric characters.
    
    Args:
        value: String to validate
        allow_spaces: Whether to allow spaces
        allow_underscore: Whether to allow underscores
        allow_hyphen: Whether to allow hyphens
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If contains non-alphanumeric characters
    """
    if not value:
        return value
    
    allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    
    if allow_spaces:
        allowed_chars.add(' ')
    if allow_underscore:
        allowed_chars.add('_')
    if allow_hyphen:
        allowed_chars.add('-')
    
    if not all(char in allowed_chars for char in value):
        raise ValueError("Value contains invalid characters")
    
    return value


def validate_slug(value: str) -> str:
    """
    Validate slug format (lowercase alphanumeric with hyphens).
    
    Args:
        value: String to validate
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If slug format is invalid
    """
    if not value:
        raise ValueError("Slug cannot be empty")
    
    import re
    if not re.match(r'^[a-z0-9-]+$', value):
        raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
    
    if value.startswith('-') or value.endswith('-'):
        raise ValueError("Slug cannot start or end with a hyphen")
    
    if '--' in value:
        raise ValueError("Slug cannot contain consecutive hyphens")
    
    return value


def validate_ip_address(value: str) -> str:
    """
    Validate IP address format (IPv4 or IPv6).
    
    Args:
        value: IP address to validate
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If IP address format is invalid
    """
    if not value:
        raise ValueError("IP address cannot be empty")
    
    import ipaddress
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        raise ValueError("Invalid IP address format")


def validate_port_number(value: int) -> int:
    """
    Validate port number (1-65535).
    
    Args:
        value: Port number to validate
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If port number is invalid
    """
    if not isinstance(value, int):
        raise ValueError("Port must be an integer")
    
    if value < 1 or value > 65535:
        raise ValueError("Port must be between 1 and 65535")
    
    return value


def validate_positive_integer(value: int, max_value: Optional[int] = None) -> int:
    """
    Validate positive integer.
    
    Args:
        value: Integer to validate
        max_value: Maximum allowed value
        
    Returns:
        Original value if valid
        
    Raises:
        ValueError: If value is not positive or exceeds max
    """
    if not isinstance(value, int):
        raise ValueError("Value must be an integer")
    
    if value < 1:
        raise ValueError("Value must be positive")
    
    if max_value and value > max_value:
        raise ValueError(f"Value cannot exceed {max_value}")
    
    return value


def validate_hex_color(value: str) -> str:
    """
    Validate hex color code.
    
    Args:
        value: Hex color to validate (e.g., "#FF0000" or "FF0000")
        
    Returns:
        Normalized hex color with #
        
    Raises:
        ValueError: If color format is invalid
    """
    if not value:
        raise ValueError("Color cannot be empty")
    
    # Remove # if present
    color = value.lstrip('#')
    
    # Check format
    if len(color) not in (3, 6):
        raise ValueError("Hex color must be 3 or 6 characters")
    
    try:
        int(color, 16)
    except ValueError:
        raise ValueError("Invalid hex color format")
    
    return f"#{color.upper()}"


__all__ = [
    'validate_no_sql_injection',
    'validate_no_xss',
    'validate_no_path_traversal',
    'validate_safe_string',
    'validate_username_field',
    'validate_email_field',
    'validate_url_field',
    'validate_filename_field',
    'validate_rich_text',
    'validate_json_string',
    'sanitize_for_logging',
    'validate_alphanumeric',
    'validate_slug',
    'validate_ip_address',
    'validate_port_number',
    'validate_positive_integer',
    'validate_hex_color',
]

