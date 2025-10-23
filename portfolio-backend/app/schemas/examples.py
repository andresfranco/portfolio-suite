"""
Example Schemas Demonstrating Input Validation

These examples show how to use the validation utilities
in your Pydantic schemas to ensure data security.

Usage:
    from app.schemas.examples import SafeUserInput, RichTextPost
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.schemas.validators import (
    validate_safe_string,
    validate_no_xss,
    validate_no_sql_injection,
    validate_username_field,
    validate_email_field,
    validate_url_field,
    validate_filename_field,
    validate_rich_text,
    validate_slug,
)


class SafeUserInput(BaseModel):
    """
    Example schema with comprehensive input validation.
    
    Demonstrates XSS and SQL injection prevention.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=254)
    display_name: str = Field(..., min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    website: Optional[str] = Field(None, max_length=2048)
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """Validate username format."""
        return validate_username_field(v)
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        """Validate email format."""
        return validate_email_field(v)
    
    @field_validator('display_name')
    @classmethod
    def validate_display_name(cls, v):
        """Validate display name is safe."""
        return validate_safe_string(v, max_length=100)
    
    @field_validator('bio')
    @classmethod
    def validate_bio(cls, v):
        """Validate bio text."""
        if v:
            return validate_safe_string(v, max_length=500, allow_empty=True)
        return v
    
    @field_validator('website')
    @classmethod
    def validate_website(cls, v):
        """Validate website URL."""
        if v:
            return validate_url_field(v)
        return v


class RichTextPost(BaseModel):
    """
    Example schema for blog post with rich text content.
    
    Demonstrates HTML sanitization for user-generated content.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    title: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    excerpt: Optional[str] = Field(None, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=10)
    
    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        """Validate title is safe."""
        return validate_safe_string(v, max_length=200)
    
    @field_validator('slug')
    @classmethod
    def validate_slug_format(cls, v):
        """Validate slug format."""
        return validate_slug(v)
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """Sanitize rich text content."""
        return validate_rich_text(v, level="rich")
    
    @field_validator('excerpt')
    @classmethod
    def validate_excerpt(cls, v):
        """Validate excerpt text."""
        if v:
            return validate_safe_string(v, max_length=500, allow_empty=True)
        return v
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        """Validate each tag."""
        if v:
            validated_tags = []
            for tag in v:
                # Validate tag format
                if not tag or len(tag) > 50:
                    raise ValueError(f"Invalid tag length: {tag}")
                validated_tag = validate_safe_string(tag, max_length=50)
                validated_tags.append(validated_tag.lower())
            return validated_tags
        return v


class FileUploadRequest(BaseModel):
    """
    Example schema for file upload with validation.
    
    Demonstrates filename validation and metadata safety.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    filename: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    tags: list[str] = Field(default_factory=list, max_length=20)
    
    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v):
        """Validate filename is safe."""
        return validate_filename_field(v)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        """Validate description text."""
        if v:
            return validate_safe_string(v, max_length=500, allow_empty=True)
        return v
    
    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v):
        """Validate each tag."""
        if v:
            validated_tags = []
            for tag in v[:20]:  # Limit to 20 tags
                if tag and len(tag) <= 30:
                    validated_tag = validate_safe_string(tag, max_length=30)
                    validated_tags.append(validated_tag.lower())
            return validated_tags
        return v


class CommentCreate(BaseModel):
    """
    Example schema for user comment with restrictive validation.
    
    Demonstrates highly restrictive validation for public comments.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    content: str = Field(..., min_length=1, max_length=1000)
    author_name: Optional[str] = Field(None, max_length=100)
    author_email: Optional[str] = Field(None, max_length=254)
    
    @field_validator('content')
    @classmethod
    def validate_content(cls, v):
        """Sanitize comment content (basic HTML only)."""
        return validate_rich_text(v, max_length=1000, level="basic")
    
    @field_validator('author_name')
    @classmethod
    def validate_author_name(cls, v):
        """Validate author name."""
        if v:
            return validate_safe_string(v, max_length=100, allow_empty=True)
        return v
    
    @field_validator('author_email')
    @classmethod
    def validate_author_email(cls, v):
        """Validate author email."""
        if v:
            return validate_email_field(v)
        return v


class SearchQuery(BaseModel):
    """
    Example schema for search with SQL injection prevention.
    
    Demonstrates validation for database search queries.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    query: str = Field(..., min_length=1, max_length=200)
    filters: Optional[dict] = Field(None)
    sort_by: Optional[str] = Field(None, max_length=50)
    order: Optional[str] = Field("asc", pattern="^(asc|desc)$")
    
    @field_validator('query')
    @classmethod
    def validate_query(cls, v):
        """Validate search query is safe."""
        # Check for SQL injection
        validated = validate_no_sql_injection(v)
        # Check for XSS
        validated = validate_no_xss(validated)
        return validated
    
    @field_validator('sort_by')
    @classmethod
    def validate_sort_by(cls, v):
        """Validate sort field name."""
        if v:
            # Only allow alphanumeric and underscore
            if not v.replace('_', '').isalnum():
                raise ValueError("Invalid sort field name")
            return v.lower()
        return v
    
    @field_validator('filters')
    @classmethod
    def validate_filters(cls, v):
        """Validate filter values."""
        if v:
            # Validate each filter value
            for key, value in v.items():
                if isinstance(value, str):
                    # Check for injection attempts
                    validate_no_sql_injection(value)
                    validate_no_xss(value)
        return v


class ConfigUpdate(BaseModel):
    """
    Example schema for configuration update with strict validation.
    
    Demonstrates validation for administrative settings.
    """
    model_config = ConfigDict(str_strip_whitespace=True)
    
    key: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_]+$")
    value: str = Field(..., max_length=1000)
    description: Optional[str] = Field(None, max_length=500)
    
    @field_validator('key')
    @classmethod
    def validate_key(cls, v):
        """Validate config key format."""
        # Only allow alphanumeric and underscore
        if not v.replace('_', '').isalnum():
            raise ValueError("Config key must be alphanumeric with underscores")
        return v.upper()
    
    @field_validator('value')
    @classmethod
    def validate_value(cls, v):
        """Validate config value is safe."""
        return validate_safe_string(v, max_length=1000)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        """Validate description."""
        if v:
            return validate_safe_string(v, max_length=500, allow_empty=True)
        return v


__all__ = [
    'SafeUserInput',
    'RichTextPost',
    'FileUploadRequest',
    'CommentCreate',
    'SearchQuery',
    'ConfigUpdate',
]

