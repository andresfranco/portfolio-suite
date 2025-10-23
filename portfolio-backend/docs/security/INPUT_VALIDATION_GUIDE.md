## Input Validation & Sanitization - Implementation Guide

**Date**: October 23, 2025  
**Phase**: 4.3 - Input Validation & Sanitization  
**Status**: ✅ Complete

---

## Executive Summary

This guide documents the comprehensive input validation and sanitization system implemented to protect the Portfolio Suite application against common injection attacks and security vulnerabilities.

### Security Threats Addressed

✅ **SQL Injection** - Prevention of database manipulation attacks  
✅ **Cross-Site Scripting (XSS)** - HTML/JavaScript injection prevention  
✅ **Path Traversal** - File system access control  
✅ **Command Injection** - Operating system command prevention  
✅ **LDAP Injection** - Directory service query protection  
✅ **Log Injection** - Audit log tampering prevention  
✅ **HTML Injection** - Rich text sanitization  

---

## Architecture Overview

The validation system consists of three layers:

1. **Core Validators** (`app/core/validators.py`) - Low-level validation logic
2. **Pydantic Validators** (`app/schemas/validators.py`) - Schema integration
3. **HTML Sanitizer** (`app/utils/html_sanitizer.py`) - Rich text cleaning
4. **Frontend Validators** (`backend-ui/src/utils/validators.ts`) - Client-side validation

```
┌─────────────────────────────────────────────────────────────┐
│                     User Input (API/Form)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────▼──────────┐
         │  Frontend Validation │  (Optional, UX improvement)
         │    TypeScript        │
         └───────────┬──────────┘
                     │
         ┌───────────▼──────────┐
         │  Pydantic Schemas    │  (API boundary)
         │  Field Validators    │
         └───────────┬──────────┘
                     │
         ┌───────────▼──────────┐
         │  Core Validators     │  (Security checks)
         │  Pattern Matching    │
         └───────────┬──────────┘
                     │
         ┌───────────▼──────────┐
         │  HTML Sanitizer      │  (Rich text only)
         │  Bleach Library      │
         └───────────┬──────────┘
                     │
         ┌───────────▼──────────┐
         │   Database/Storage   │
         └──────────────────────┘
```

---

## Quick Start

### Backend (Python/FastAPI)

#### Basic String Validation

```python
from app.schemas.validators import validate_safe_string
from pydantic import BaseModel, field_validator

class UserInput(BaseModel):
    name: str
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        return validate_safe_string(v, max_length=100)
```

#### Rich Text Validation

```python
from app.schemas.validators import validate_rich_text

class BlogPost(BaseModel):
    content: str
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        # Sanitizes HTML, preserves safe formatting
        return validate_rich_text(v, level="rich")
```

#### Direct Validation

```python
from app.core.validators import input_validator

# Check for SQL injection
is_safe, msg = input_validator.validate_sql_safe(user_input)
if not is_safe:
    raise HTTPException(400, detail=msg)

# Comprehensive check (SQL, XSS, command injection)
is_safe, errors = input_validator.comprehensive_check(user_input)
if not is_safe:
    raise HTTPException(400, detail="; ".join(errors))
```

### Frontend (TypeScript/React)

```typescript
import { validateEmail, validateUsername, sanitizeString } from '@/utils/validators';

// Validate email
const emailResult = validateEmail(email);
if (!emailResult.isValid) {
  setError(emailResult.error);
  return;
}

// Sanitize user input before display
const safeText = sanitizeString(userInput, 200);

// Comprehensive validation
const inputResult = validateInput(userInput, ['xss', 'sql']);
if (!inputResult.isValid) {
  setError('Input contains potentially unsafe content');
}
```

---

## Core Validation Functions

### SQL Injection Prevention

Detects common SQL injection patterns:

```python
from app.core.validators import input_validator

# Check input
is_safe, msg = input_validator.validate_sql_safe("user input")

# Examples that will be caught:
# "' OR '1'='1"
# "'; DROP TABLE users--"
# "1' UNION SELECT password FROM users--"
# "admin'--"
```

**Patterns Detected**:
- SQL keywords (SELECT, INSERT, UPDATE, DELETE, DROP, etc.)
- SQL comments (`, #, /*, */`)
- OR/AND clauses in suspicious contexts
- Statement separators (`;`, `|`, `&`)
- Stored procedures (xp_, sp_)

### XSS Prevention

Detects cross-site scripting attempts:

```python
is_safe, msg = input_validator.validate_xss_safe(user_html)

# Examples that will be caught:
# "<script>alert('xss')</script>"
# "javascript:alert('xss')"
# "<img src=x onerror='alert(1)'>"
# "<iframe src='evil.com'></iframe>"
```

**Patterns Detected**:
- Script tags
- JavaScript protocols
- Event handlers (onclick, onerror, etc.)
- iframe/embed/object tags
- eval() calls
- VBScript protocols

### Path Traversal Prevention

Prevents unauthorized file system access:

```python
is_safe, msg = input_validator.validate_path_safe(file_path)

# Examples that will be caught:
# "../../etc/passwd"
# "/etc/passwd"
# "file:///etc/passwd"
# "~/../../etc/passwd"
```

### Command Injection Prevention

Prevents OS command execution:

```python
is_safe, msg = input_validator.validate_command_safe(user_input)

# Examples that will be caught:
# "file.txt; rm -rf /"
# "file.txt | cat /etc/passwd"
# "file.txt `cat /etc/passwd`"
# "file.txt && malicious_command"
```

---

## HTML Sanitization

### Rich Text Sanitization

Use `sanitize_rich_text()` for WYSIWYG editor content:

```python
from app.utils.html_sanitizer import sanitize_rich_text

# Input (potentially dangerous)
html = '''
<p>Safe content</p>
<script>alert('xss')</script>
<a href="javascript:alert('xss')">Click</a>
<img src="image.jpg" onerror="alert('xss')">
'''

# Output (safe)
safe_html = sanitize_rich_text(html)
# Result: <p>Safe content</p><img src="image.jpg">
```

**Allowed Elements**:
- Text: `p`, `br`, `strong`, `em`, `u`, `b`, `i`, `s`, `mark`, `small`, `del`, `ins`, `sub`, `sup`
- Headings: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- Lists: `ul`, `ol`, `li`
- Quotes: `blockquote`, `code`, `pre`
- Tables: `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`
- Links: `a` (with safe protocols only)
- Images: `img` (with safe protocols only)
- Containers: `div`, `span`
- Other: `hr`

**Allowed Attributes**:
- Links: `href`, `title`, `target`, `rel`
- Images: `src`, `alt`, `title`, `width`, `height`
- Tables: `colspan`, `rowspan`, `headers`, `scope`
- Containers: `class` (limited)

### Basic Text Sanitization

Use `sanitize_basic_text()` for simple formatting:

```python
from app.utils.html_sanitizer import sanitize_basic_text

# Only allows: p, br, strong, em, u, a, ul, ol, li
safe_html = sanitize_basic_text(user_html)
```

### Comment Sanitization

Use `sanitize_comment()` for user comments (most restrictive):

```python
from app.utils.html_sanitizer import sanitize_comment

# Only allows: p, br, strong, em, code, a
safe_comment = sanitize_comment(user_comment)
```

### Strip All HTML

Use `strip_all_html()` to remove all HTML tags:

```python
from app.utils.html_sanitizer import strip_all_html

# Returns plain text only
plain_text = strip_all_html("<p><strong>Bold</strong> text</p>")
# Result: "Bold text"
```

---

## Pydantic Schema Integration

### Field Validators

Add validators to Pydantic schemas for automatic validation:

```python
from pydantic import BaseModel, Field, field_validator
from app.schemas.validators import (
    validate_username_field,
    validate_email_field,
    validate_url_field,
    validate_safe_string,
    validate_rich_text,
)

class UserProfile(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    website: Optional[str]
    bio: Optional[str]
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        return validate_username_field(v)  # Checks format, normalizes
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        return validate_email_field(v)  # Checks format, normalizes
    
    @field_validator('website')
    @classmethod
    def validate_website(cls, v):
        if v:
            return validate_url_field(v)  # Checks protocol, format
        return v
    
    @field_validator('bio')
    @classmethod
    def validate_bio(cls, v):
        if v:
            return validate_safe_string(v, max_length=500)  # XSS/SQL check
        return v
```

### Available Pydantic Validators

| Validator | Purpose | Example |
|-----------|---------|---------|
| `validate_safe_string` | General-purpose safe string | Names, descriptions |
| `validate_username_field` | Username format | User login names |
| `validate_email_field` | Email format | Email addresses |
| `validate_url_field` | URL format & protocol | Website URLs |
| `validate_filename_field` | Safe filename | File uploads |
| `validate_rich_text` | HTML sanitization | Blog posts, comments |
| `validate_slug` | URL-safe slug | Post slugs, identifiers |
| `validate_no_sql_injection` | SQL injection check | Search queries |
| `validate_no_xss` | XSS check | User-generated content |
| `validate_no_path_traversal` | Path traversal check | File paths |

---

## Frontend Validation (TypeScript)

### Email Validation

```typescript
import { validateEmail } from '@/utils/validators';

const result = validateEmail(email);
if (!result.isValid) {
  console.error(result.error);
}
```

### Password Strength

```typescript
import { validatePassword } from '@/utils/validators';

const result = validatePassword(password);
// Checks: length, uppercase, lowercase, numbers, special chars
```

### URL Validation

```typescript
import { validateUrl } from '@/utils/validators';

const result = validateUrl(url, ['http', 'https']);
if (!result.isValid) {
  console.error(result.error);
}
```

### XSS Detection

```typescript
import { isXSSSafe } from '@/utils/validators';

const result = isXSSSafe(userInput);
if (!result.isValid) {
  alert('Input contains potentially dangerous content');
}
```

### Input Sanitization

```typescript
import { sanitizeString, sanitizeHTML } from '@/utils/validators';

// Remove control characters, trim, truncate
const safe = sanitizeString(userInput, 200);

// Escape HTML for display
const escaped = sanitizeHTML(userHTML);
```

---

## Security Best Practices

### 1. Defense in Depth

✅ **DO**: Validate on both client and server  
✅ **DO**: Use multiple validation layers  
❌ **DON'T**: Rely solely on client-side validation

```python
# Good: Multiple layers
@router.post("/posts")
async def create_post(post: BlogPost):  # Pydantic validation
    # Additional business logic validation
    if len(post.title) < 10:
        raise HTTPException(400, "Title too short")
    
    # Sanitize again before storage (defense in depth)
    safe_content = sanitize_rich_text(post.content)
    return await db.create_post(safe_content)
```

### 2. Whitelist Over Blacklist

✅ **DO**: Define what's allowed  
❌ **DON'T**: Try to block everything bad

```python
# Good: Whitelist approach
def validate_sort_field(field: str):
    ALLOWED_FIELDS = ['created_at', 'updated_at', 'title']
    if field not in ALLOWED_FIELDS:
        raise ValueError("Invalid sort field")
    return field

# Bad: Blacklist approach
def validate_sort_field(field: str):
    if 'DROP' in field or 'DELETE' in field:  # Incomplete!
        raise ValueError("Invalid sort field")
    return field
```

### 3. Context-Appropriate Validation

Use the right validation level for the context:

| Context | Validation Level | Function |
|---------|-----------------|----------|
| Blog posts | Rich text | `sanitize_rich_text()` |
| Comments | Basic text | `sanitize_basic_text()` |
| Titles/Names | Plain text | `validate_safe_string()` |
| Metadata | Strip all HTML | `strip_all_html()` |

### 4. Sanitize Before Storage

✅ **DO**: Clean data before saving  
✅ **DO**: Clean data before display (defense in depth)  
❌ **DON'T**: Store unsanitized user input

```python
# Good
@router.post("/comments")
async def create_comment(comment: CommentCreate):
    # Sanitize before saving
    safe_content = sanitize_comment(comment.content)
    return await db.create_comment(safe_content)
```

### 5. Validate File Uploads

Always validate uploaded files:

```python
from app.utils.file_security import file_security_manager
from app.schemas.validators import validate_filename_field

@router.post("/upload")
async def upload_file(file: UploadFile):
    # Validate filename
    safe_filename = validate_filename_field(file.filename)
    
    # Save temporarily
    temp_path = f"/tmp/{safe_filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    
    # Comprehensive security check
    is_safe, errors = file_security_manager.comprehensive_file_check(
        temp_path, file.filename
    )
    
    if not is_safe:
        os.remove(temp_path)
        raise HTTPException(400, detail="; ".join(errors))
    
    # Process file...
```

### 6. Log Sanitization

Always sanitize data before logging:

```python
from app.core.validators import sanitize_for_log

logger.info(f"User input: {sanitize_for_log(user_input)}")
```

### 7. Error Messages

❌ **DON'T**: Expose validation details to users  
✅ **DO**: Use generic error messages  
✅ **DO**: Log detailed errors server-side

```python
# Good
try:
    validate_no_sql_injection(user_input)
except ValueError as e:
    logger.warning(f"SQL injection attempt: {e}")
    raise HTTPException(400, "Invalid input format")

# Bad
try:
    validate_no_sql_injection(user_input)
except ValueError as e:
    raise HTTPException(400, str(e))  # Exposes validation logic!
```

---

## Testing

### Running Security Tests

```bash
# Run all security tests
pytest tests/security/ -v

# Run specific test file
pytest tests/security/test_input_validation.py -v
pytest tests/security/test_html_sanitization.py -v

# Run with coverage
pytest tests/security/ --cov=app.core.validators --cov=app.utils.html_sanitizer
```

### Writing Custom Tests

```python
import pytest
from app.core.validators import input_validator

def test_custom_injection_pattern():
    """Test detection of custom injection pattern."""
    malicious_input = "'; EXEC sp_executesql--"
    is_safe, msg = input_validator.validate_sql_safe(malicious_input)
    assert not is_safe
    assert msg is not None
```

---

## Common Patterns & Examples

### Search Functionality

```python
from app.schemas.validators import validate_no_sql_injection, validate_no_xss

class SearchQuery(BaseModel):
    query: str = Field(..., max_length=200)
    
    @field_validator('query')
    @classmethod
    def validate_query(cls, v):
        # Prevent SQL injection in search
        v = validate_no_sql_injection(v)
        # Prevent XSS in results
        v = validate_no_xss(v)
        return v
```

### User-Generated Content

```python
from app.utils.html_sanitizer import sanitize_comment

@router.post("/comments")
async def create_comment(content: str):
    # Restrictive sanitization for public comments
    safe_content = sanitize_comment(content)
    return await db.create_comment(safe_content)
```

### Admin Configuration

```python
from app.schemas.validators import validate_safe_string

class ConfigUpdate(BaseModel):
    key: str = Field(..., pattern="^[A-Z_]+$")
    value: str
    
    @field_validator('value')
    @classmethod
    def validate_value(cls, v):
        # Even admin input needs validation
        return validate_safe_string(v, max_length=1000)
```

### File Metadata

```python
from app.schemas.validators import validate_filename_field, validate_safe_string

class FileMetadata(BaseModel):
    filename: str
    description: Optional[str]
    
    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v):
        return validate_filename_field(v)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if v:
            return validate_safe_string(v, max_length=500)
        return v
```

---

## Troubleshooting

### Issue: Legitimate Input Being Blocked

**Problem**: Valid user input is being rejected as unsafe.

**Solution**: Review patterns and adjust validation:

```python
# If email with '+' is being rejected
is_valid, msg = input_validator.validate_email("user+tag@example.com")
# Check if email validator supports '+' character
```

### Issue: HTML Formatting Being Stripped

**Problem**: Necessary HTML formatting is removed.

**Solution**: Use appropriate sanitization level:

```python
# Change from strip (removes all) to rich (preserves safe)
safe_html = validate_rich_text(content, level="rich")  # Not "strip"
```

### Issue: Performance with Large Inputs

**Problem**: Validation is slow for large content.

**Solution**: Add length limits before validation:

```python
class BlogPost(BaseModel):
    content: str = Field(..., max_length=50000)  # Limit size first
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        return validate_rich_text(v)  # Then validate
```

---

## Maintenance & Updates

### Adding New Patterns

To add new attack patterns:

1. Update pattern lists in `app/core/validators.py`:

```python
SQL_INJECTION_PATTERNS = [
    # ... existing patterns ...
    r"new_pattern_here",  # Add your pattern
]
```

2. Add tests in `tests/security/test_input_validation.py`:

```python
def test_new_pattern():
    """Test detection of new attack pattern."""
    is_safe, msg = input_validator.validate_sql_safe("malicious input")
    assert not is_safe
```

3. Run tests to ensure no regressions:

```bash
pytest tests/security/test_input_validation.py -v
```

### Updating HTML Allowed Tags

To modify allowed HTML tags for rich text:

1. Update `app/utils/html_sanitizer.py`:

```python
DEFAULT_ALLOWED_TAGS = [
    # ... existing tags ...
    'video',  # Add new safe tag
]
```

2. Update allowed attributes if needed:

```python
DEFAULT_ALLOWED_ATTRIBUTES = {
    # ... existing attributes ...
    'video': ['src', 'controls', 'width', 'height'],
}
```

3. Test thoroughly:

```python
# Add test
def test_allow_video_tag():
    html = '<video src="video.mp4" controls></video>'
    result = sanitize_rich_text(html)
    assert '<video' in result
```

---

## Security Checklist

Before deploying new features with user input:

- [ ] Input validated at API boundary (Pydantic schemas)
- [ ] Appropriate validators used for data type
- [ ] HTML sanitization applied to rich text
- [ ] File uploads validated (name, type, content)
- [ ] Search queries protected against SQL injection
- [ ] Error messages don't expose validation logic
- [ ] Logging sanitizes user input
- [ ] Tests added for new validators
- [ ] Frontend validation matches backend rules
- [ ] Defense-in-depth: multiple validation layers

---

## Dependencies

### Backend
```bash
pip install bleach>=6.1.0
pip install html5lib>=1.1
```

### Frontend
No additional dependencies (vanilla TypeScript)

---

## References

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **OWASP XSS Prevention**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **OWASP SQL Injection**: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- **Bleach Documentation**: https://bleach.readthedocs.io/
- **Pydantic Validators**: https://docs.pydantic.dev/latest/concepts/validators/

---

## Support

For questions or issues with input validation:

1. Check this guide for examples
2. Review test files for usage patterns
3. Refer to inline documentation in code
4. Open an issue with security team

---

**Last Updated**: October 23, 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready

