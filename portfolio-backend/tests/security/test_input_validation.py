"""
Security Tests for Input Validation

Tests comprehensive input validation to ensure protection against:
- SQL Injection
- XSS (Cross-Site Scripting)
- Path Traversal
- Command Injection
- LDAP Injection
"""

import pytest
from app.core.validators import (
    InputValidator,
    validate_input,
    sanitize_url,
    validate_url,
    escape_sql_like,
    sanitize_for_log,
    input_validator,
)
from app.schemas.validators import (
    validate_no_sql_injection,
    validate_no_xss,
    validate_no_path_traversal,
    validate_safe_string,
    validate_username_field,
    validate_email_field,
    validate_url_field,
    validate_filename_field,
    validate_slug,
)


class TestSQLInjectionPrevention:
    """Test SQL injection detection and prevention."""
    
    def test_detect_select_statement(self):
        """Test detection of SELECT statements."""
        is_safe, msg = input_validator.validate_sql_safe("'; SELECT * FROM users--")
        assert not is_safe
        assert msg is not None
    
    def test_detect_union_injection(self):
        """Test detection of UNION attacks."""
        is_safe, msg = input_validator.validate_sql_safe("1' UNION SELECT password FROM users--")
        assert not is_safe
    
    def test_detect_comment_injection(self):
        """Test detection of SQL comments."""
        is_safe, msg = input_validator.validate_sql_safe("admin'--")
        assert not is_safe
    
    def test_detect_or_injection(self):
        """Test detection of OR-based injection."""
        is_safe, msg = input_validator.validate_sql_safe("' OR '1'='1")
        assert not is_safe
    
    def test_detect_drop_table(self):
        """Test detection of DROP TABLE."""
        is_safe, msg = input_validator.validate_sql_safe("'; DROP TABLE users--")
        assert not is_safe
    
    def test_safe_input(self):
        """Test that safe input passes validation."""
        is_safe, msg = input_validator.validate_sql_safe("john.doe@example.com")
        assert is_safe
        assert msg is None
    
    def test_escape_like_pattern(self):
        """Test escaping SQL LIKE wildcards."""
        escaped = escape_sql_like("test%_value")
        assert escaped == "test\\%\\_value"


class TestXSSPrevention:
    """Test XSS detection and prevention."""
    
    def test_detect_script_tag(self):
        """Test detection of script tags."""
        is_safe, msg = input_validator.validate_xss_safe("<script>alert('xss')</script>")
        assert not is_safe
    
    def test_detect_javascript_protocol(self):
        """Test detection of javascript: protocol."""
        is_safe, msg = input_validator.validate_xss_safe("javascript:alert('xss')")
        assert not is_safe
    
    def test_detect_event_handler(self):
        """Test detection of event handlers."""
        is_safe, msg = input_validator.validate_xss_safe('<img src=x onerror="alert(\'xss\')">')
        assert not is_safe
    
    def test_detect_iframe(self):
        """Test detection of iframe tags."""
        is_safe, msg = input_validator.validate_xss_safe("<iframe src='evil.com'></iframe>")
        assert not is_safe
    
    def test_detect_eval(self):
        """Test detection of eval()."""
        is_safe, msg = input_validator.validate_xss_safe("eval(document.cookie)")
        assert not is_safe
    
    def test_safe_html_text(self):
        """Test that safe text passes validation."""
        is_safe, msg = input_validator.validate_xss_safe("This is <strong>safe</strong> text")
        assert is_safe


class TestPathTraversalPrevention:
    """Test path traversal detection and prevention."""
    
    def test_detect_parent_directory(self):
        """Test detection of parent directory references."""
        is_safe, msg = input_validator.validate_path_safe("../../etc/passwd")
        assert not is_safe
    
    def test_detect_absolute_system_path(self):
        """Test detection of system directory access."""
        is_safe, msg = input_validator.validate_path_safe("/etc/passwd")
        assert not is_safe
    
    def test_detect_file_protocol(self):
        """Test detection of file:// protocol."""
        is_safe, msg = input_validator.validate_path_safe("file:///etc/passwd")
        assert not is_safe
    
    def test_safe_relative_path(self):
        """Test that safe relative paths pass."""
        is_safe, msg = input_validator.validate_path_safe("uploads/documents/file.pdf")
        assert is_safe


class TestCommandInjectionPrevention:
    """Test command injection detection."""
    
    def test_detect_semicolon(self):
        """Test detection of command separator."""
        is_safe, msg = input_validator.validate_command_safe("file.txt; rm -rf /")
        assert not is_safe
    
    def test_detect_pipe(self):
        """Test detection of pipe operator."""
        is_safe, msg = input_validator.validate_command_safe("file.txt | cat /etc/passwd")
        assert not is_safe
    
    def test_detect_backticks(self):
        """Test detection of command substitution."""
        is_safe, msg = input_validator.validate_command_safe("file.txt `cat /etc/passwd`")
        assert not is_safe
    
    def test_safe_filename(self):
        """Test that safe filenames pass."""
        is_safe, msg = input_validator.validate_command_safe("document_2024.pdf")
        assert is_safe


class TestFilenameValidation:
    """Test filename validation."""
    
    def test_reject_path_traversal_in_filename(self):
        """Test rejection of path traversal in filename."""
        is_valid, msg = input_validator.validate_filename("../../etc/passwd")
        assert not is_valid
    
    def test_reject_path_separators(self):
        """Test rejection of path separators."""
        is_valid, msg = input_validator.validate_filename("path/to/file.txt")
        assert not is_valid
    
    def test_reject_dangerous_extension(self):
        """Test rejection of dangerous file extensions."""
        is_valid, msg = input_validator.validate_filename("malware.exe")
        assert not is_valid
    
    def test_reject_control_characters(self):
        """Test rejection of control characters."""
        is_valid, msg = input_validator.validate_filename("file\x00name.txt")
        assert not is_valid
    
    def test_accept_safe_filename(self):
        """Test acceptance of safe filename."""
        is_valid, msg = input_validator.validate_filename("document_2024.pdf")
        assert is_valid


class TestEmailValidation:
    """Test email validation."""
    
    def test_valid_email(self):
        """Test validation of valid email."""
        is_valid, msg = input_validator.validate_email("user@example.com")
        assert is_valid
    
    def test_invalid_format(self):
        """Test rejection of invalid format."""
        is_valid, msg = input_validator.validate_email("invalid-email")
        assert not is_valid
    
    def test_missing_domain(self):
        """Test rejection of missing domain."""
        is_valid, msg = input_validator.validate_email("user@")
        assert not is_valid
    
    def test_too_long(self):
        """Test rejection of too long email."""
        long_email = "a" * 250 + "@example.com"
        is_valid, msg = input_validator.validate_email(long_email)
        assert not is_valid


class TestUsernameValidation:
    """Test username validation."""
    
    def test_valid_username(self):
        """Test validation of valid username."""
        is_valid, msg = input_validator.validate_username("john_doe123")
        assert is_valid
    
    def test_too_short(self):
        """Test rejection of too short username."""
        is_valid, msg = input_validator.validate_username("ab")
        assert not is_valid
    
    def test_invalid_characters(self):
        """Test rejection of invalid characters."""
        is_valid, msg = input_validator.validate_username("user@name")
        assert not is_valid
    
    def test_sql_injection_attempt(self):
        """Test rejection of SQL injection in username."""
        is_valid, msg = input_validator.validate_username("admin'--")
        assert not is_valid


class TestURLValidation:
    """Test URL validation."""
    
    def test_valid_https_url(self):
        """Test validation of HTTPS URL."""
        is_valid, result = validate_url("https://example.com/path")
        assert is_valid
    
    def test_valid_http_url(self):
        """Test validation of HTTP URL."""
        is_valid, result = validate_url("http://example.com")
        assert is_valid
    
    def test_reject_javascript_protocol(self):
        """Test rejection of javascript: protocol."""
        is_valid, msg = validate_url("javascript:alert('xss')")
        assert not is_valid
    
    def test_reject_data_protocol(self):
        """Test rejection of data: protocol."""
        is_valid, msg = validate_url("data:text/html,<script>alert('xss')</script>")
        assert not is_valid
    
    def test_reject_file_protocol(self):
        """Test rejection of file: protocol."""
        is_valid, msg = validate_url("file:///etc/passwd")
        assert not is_valid


class TestStringSanitization:
    """Test string sanitization."""
    
    def test_remove_control_characters(self):
        """Test removal of control characters."""
        sanitized = input_validator.sanitize_string("test\x00\x01\x02value")
        assert "\x00" not in sanitized
    
    def test_trim_whitespace(self):
        """Test trimming whitespace."""
        sanitized = input_validator.sanitize_string("  test  ")
        assert sanitized == "test"
    
    def test_truncate_long_string(self):
        """Test truncation of long strings."""
        long_string = "a" * 200
        sanitized = input_validator.sanitize_string(long_string, max_length=100)
        assert len(sanitized) == 100


class TestComprehensiveValidation:
    """Test comprehensive multi-check validation."""
    
    def test_detect_multiple_threats(self):
        """Test detection when multiple threat types present."""
        is_safe, errors = input_validator.comprehensive_check(
            "'; SELECT * FROM users WHERE name LIKE '%<script>alert(1)</script>%'--"
        )
        assert not is_safe
        assert len(errors) > 0
    
    def test_safe_input_passes_all_checks(self):
        """Test that safe input passes all checks."""
        is_safe, errors = input_validator.comprehensive_check("john.doe@example.com")
        assert is_safe
        assert len(errors) == 0


class TestPydanticValidators:
    """Test Pydantic field validators."""
    
    def test_validate_no_sql_injection_raises(self):
        """Test that SQL injection raises ValueError."""
        with pytest.raises(ValueError):
            validate_no_sql_injection("'; DROP TABLE users--")
    
    def test_validate_no_xss_raises(self):
        """Test that XSS raises ValueError."""
        with pytest.raises(ValueError):
            validate_no_xss("<script>alert('xss')</script>")
    
    def test_validate_username_field(self):
        """Test username field validation."""
        username = validate_username_field("JohnDoe123")
        assert username == "johndoe123"  # Should be normalized to lowercase
    
    def test_validate_email_field(self):
        """Test email field validation."""
        email = validate_email_field("User@Example.COM")
        assert email == "user@example.com"  # Should be normalized
    
    def test_validate_url_field(self):
        """Test URL field validation."""
        url = validate_url_field("https://example.com/path")
        assert url == "https://example.com/path"
    
    def test_validate_slug(self):
        """Test slug validation."""
        slug = validate_slug("my-blog-post-2024")
        assert slug == "my-blog-post-2024"
    
    def test_validate_slug_rejects_uppercase(self):
        """Test that slug rejects uppercase."""
        with pytest.raises(ValueError):
            validate_slug("My-Blog-Post")
    
    def test_validate_filename_field(self):
        """Test filename field validation."""
        filename = validate_filename_field("document.pdf")
        assert filename == "document.pdf"


class TestLogSanitization:
    """Test log sanitization to prevent log injection."""
    
    def test_remove_newlines(self):
        """Test removal of newlines."""
        sanitized = sanitize_for_log("test\nvalue\rwith\r\nnewlines")
        assert "\n" not in sanitized
        assert "\r" not in sanitized
    
    def test_truncate_long_log(self):
        """Test truncation of long log messages."""
        long_msg = "a" * 300
        sanitized = sanitize_for_log(long_msg, max_length=200)
        assert len(sanitized) <= 203  # 200 + "..."


class TestJSONValidation:
    """Test JSON validation."""
    
    def test_valid_json(self):
        """Test validation of valid JSON."""
        is_valid, msg = input_validator.validate_json_safe('{"key": "value"}')
        assert is_valid
    
    def test_invalid_json(self):
        """Test rejection of invalid JSON."""
        is_valid, msg = input_validator.validate_json_safe('{key: "value"}')
        assert not is_valid
    
    def test_deeply_nested_json(self):
        """Test rejection of deeply nested JSON (DoS prevention)."""
        nested = '{"a":' * 15 + '"value"' + '}' * 15
        is_valid, msg = input_validator.validate_json_safe(nested)
        assert not is_valid


# Edge cases and regression tests
class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_empty_string(self):
        """Test handling of empty strings."""
        is_safe, msg = input_validator.validate_sql_safe("")
        assert is_safe
    
    def test_none_value(self):
        """Test handling of None values."""
        is_safe, msg = input_validator.validate_sql_safe(None)
        assert is_safe
    
    def test_unicode_characters(self):
        """Test handling of Unicode characters."""
        is_safe, msg = input_validator.validate_xss_safe("Hello 世界 🌍")
        assert is_safe
    
    def test_mixed_case_injection(self):
        """Test detection of mixed-case injection attempts."""
        is_safe, msg = input_validator.validate_sql_safe("'; SeLeCt * FrOm users--")
        assert not is_safe


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

