"""
HTML Sanitization Module using Bleach

Provides production-grade HTML sanitization for user-generated content,
rich text editors, and untrusted HTML inputs.

Uses bleach library for robust HTML cleaning that prevents XSS attacks
while preserving safe formatting.

Usage:
    from app.utils.html_sanitizer import sanitize_rich_text, strip_all_html
    
    # Sanitize rich text (preserve safe tags)
    clean_html = sanitize_rich_text(user_html)
    
    # Strip all HTML (plain text only)
    plain_text = strip_all_html(user_html)
    
    # Custom sanitization
    custom_clean = sanitize_html(
        user_html,
        allowed_tags={'p', 'br', 'strong', 'em'},
        allowed_attributes={'a': ['href']}
    )
"""

from typing import Dict, List, Optional, Set
import re
import bleach
from bleach.css_sanitizer import CSSSanitizer
import html


# Default allowed tags for rich text content
DEFAULT_ALLOWED_TAGS = [
    # Text formatting
    'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'mark', 'small', 'del', 'ins', 'sub', 'sup',
    # Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    # Lists
    'ul', 'ol', 'li',
    # Quotes and code
    'blockquote', 'code', 'pre',
    # Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    # Links and images (carefully controlled)
    'a', 'img',
    # Containers
    'div', 'span',
    # Other
    'hr',
]

# Default allowed attributes per tag
DEFAULT_ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'td': ['colspan', 'rowspan', 'headers'],
    'th': ['colspan', 'rowspan', 'scope'],
    'div': ['class'],
    'span': ['class'],
    'code': ['class'],  # For syntax highlighting classes
    'pre': ['class'],
}

# Default allowed styles (CSS properties)
DEFAULT_ALLOWED_STYLES = [
    'color', 'background-color', 'font-size', 'font-weight', 'text-align',
    'text-decoration', 'font-style', 'font-family'
]

# URL schemes allowed in links and images
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto', 'tel']


class HTMLSanitizer:
    """
    Configurable HTML sanitizer using bleach library.
    
    Provides methods for different sanitization levels:
    - Rich text (preserves formatting)
    - Basic text (minimal formatting)
    - Plain text (strips all HTML)
    """
    
    def __init__(
        self,
        allowed_tags: Optional[List[str]] = None,
        allowed_attributes: Optional[Dict[str, List[str]]] = None,
        allowed_styles: Optional[List[str]] = None,
        allowed_protocols: Optional[List[str]] = None,
        strip: bool = True
    ):
        """
        Initialize HTML sanitizer.
        
        Args:
            allowed_tags: List of allowed HTML tags
            allowed_attributes: Dict of allowed attributes per tag
            allowed_styles: List of allowed CSS properties
            allowed_protocols: List of allowed URL protocols
            strip: Whether to strip or escape disallowed tags
        """
        self.allowed_tags = allowed_tags or DEFAULT_ALLOWED_TAGS
        self.allowed_attributes = allowed_attributes or DEFAULT_ALLOWED_ATTRIBUTES
        self.allowed_styles = allowed_styles or DEFAULT_ALLOWED_STYLES
        self.allowed_protocols = allowed_protocols or ALLOWED_PROTOCOLS
        self.strip = strip
        
        # Create CSS sanitizer
        self.css_sanitizer = CSSSanitizer(allowed_css_properties=self.allowed_styles)
    
    def sanitize(self, html_content: str) -> str:
        """
        Sanitize HTML content using configured rules.
        
        Args:
            html_content: HTML string to sanitize
            
        Returns:
            Sanitized HTML string
        """
        if not html_content:
            return ""
        
        # First, remove dangerous tags and their content using regex
        # This ensures script/style content doesn't leak through
        dangerous_patterns = [
            (r'<script[^>]*>.*?</script>', ''),  # Remove script tags and content
            (r'<style[^>]*>.*?</style>', ''),    # Remove style tags and content
            (r'<iframe[^>]*>.*?</iframe>', ''),  # Remove iframe tags and content
            (r'<object[^>]*>.*?</object>', ''),  # Remove object tags and content
            (r'<embed[^>]*>.*?</embed>', ''),    # Remove embed tags and content
            (r'<applet[^>]*>.*?</applet>', ''),  # Remove applet tags and content
        ]
        
        cleaned_content = html_content
        for pattern, replacement in dangerous_patterns:
            cleaned_content = re.sub(pattern, replacement, cleaned_content, flags=re.IGNORECASE | re.DOTALL)
        
        # Now clean with bleach, allowing safe tags
        cleaned = bleach.clean(
            cleaned_content,
            tags=self.allowed_tags,
            attributes=self.allowed_attributes,
            protocols=self.allowed_protocols,
            strip=self.strip,
            css_sanitizer=self.css_sanitizer
        )
        
        return cleaned
    
    def sanitize_and_linkify(self, html_content: str) -> str:
        """
        Sanitize HTML and automatically convert URLs to links.
        
        Args:
            html_content: HTML string to sanitize
            
        Returns:
            Sanitized HTML with linkified URLs
        """
        if not html_content:
            return ""
        
        # Clean first
        cleaned = self.sanitize(html_content)
        
        # Linkify URLs
        linkified = bleach.linkify(
            cleaned,
            callbacks=[self._set_link_attributes]
        )
        
        return linkified
    
    @staticmethod
    def _set_link_attributes(attrs, new=False):
        """Set safe attributes on auto-generated links."""
        # Ensure attrs is a dict we can modify
        if not isinstance(attrs, dict):
            attrs = dict(attrs)
        
        # Open external links in new tab
        href = attrs.get((None, 'href'), '') or attrs.get('href', '')
        if href and (href.startswith('http://') or href.startswith('https://')):
            attrs[(None, 'target')] = '_blank'
            # Security: prevent window.opener access
            attrs[(None, 'rel')] = 'noopener noreferrer'
        return attrs


# Pre-configured sanitizers for different use cases

# Rich text sanitizer (for WYSIWYG editors)
rich_text_sanitizer = HTMLSanitizer(
    allowed_tags=DEFAULT_ALLOWED_TAGS,
    allowed_attributes=DEFAULT_ALLOWED_ATTRIBUTES,
    allowed_styles=DEFAULT_ALLOWED_STYLES,
    strip=True
)

# Basic text sanitizer (minimal formatting only)
basic_text_sanitizer = HTMLSanitizer(
    allowed_tags=['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    allowed_attributes={'a': ['href', 'title']},
    allowed_styles=[],
    strip=True
)

# Comment sanitizer (very restrictive)
comment_sanitizer = HTMLSanitizer(
    allowed_tags=['p', 'br', 'strong', 'em', 'code', 'a'],
    allowed_attributes={'a': ['href']},
    allowed_styles=[],
    strip=True
)


def sanitize_rich_text(html_content: str) -> str:
    """
    Sanitize rich text content preserving safe formatting.
    
    Use this for content from WYSIWYG editors like TinyMCE, CKEditor, etc.
    
    Args:
        html_content: HTML string to sanitize
        
    Returns:
        Sanitized HTML string
    """
    return rich_text_sanitizer.sanitize(html_content)


def sanitize_basic_text(html_content: str) -> str:
    """
    Sanitize content with minimal formatting allowed.
    
    Use this for simple text inputs that may contain basic markup.
    
    Args:
        html_content: HTML string to sanitize
        
    Returns:
        Sanitized HTML string with minimal formatting
    """
    return basic_text_sanitizer.sanitize(html_content)


def sanitize_comment(html_content: str) -> str:
    """
    Sanitize user comment with very restrictive rules.
    
    Use this for user comments, reviews, and similar untrusted content.
    
    Args:
        html_content: HTML string to sanitize
        
    Returns:
        Sanitized HTML string with restricted formatting
    """
    return comment_sanitizer.sanitize(html_content)


def strip_all_html(html_content: str) -> str:
    """
    Strip all HTML tags and return plain text.
    
    Use this when you need plain text only (e.g., meta descriptions, titles).
    
    Args:
        html_content: HTML string to strip
        
    Returns:
        Plain text with all HTML removed
    """
    if not html_content:
        return ""
    
    # Strip all tags
    text = bleach.clean(html_content, tags=[], attributes={}, strip=True)
    
    # Clean up whitespace
    text = ' '.join(text.split())
    
    return text


def sanitize_html(
    html_content: str,
    allowed_tags: Optional[Set[str]] = None,
    allowed_attributes: Optional[Dict[str, Set[str]]] = None,
    strip: bool = True
) -> str:
    """
    Flexible HTML sanitization with custom rules.
    
    Args:
        html_content: HTML string to sanitize
        allowed_tags: Set of allowed tags (None = default)
        allowed_attributes: Dict of allowed attributes per tag (None = default)
        strip: Whether to strip (True) or escape (False) disallowed tags
        
    Returns:
        Sanitized HTML string
    """
    if not html_content:
        return ""
    
    sanitizer = HTMLSanitizer(
        allowed_tags=list(allowed_tags) if allowed_tags else None,
        allowed_attributes={k: list(v) for k, v in allowed_attributes.items()} if allowed_attributes else None,
        strip=strip
    )
    
    return sanitizer.sanitize(html_content)


def linkify_text(text: str, parse_email: bool = True) -> str:
    """
    Convert plain text URLs to clickable links.
    
    Args:
        text: Plain text to linkify
        parse_email: Whether to linkify email addresses
        
    Returns:
        HTML with linkified URLs
    """
    if not text:
        return ""
    
    def set_target_blank(attrs, new=False):
        """Add target=_blank and rel=noopener noreferrer to links."""
        href = attrs.get((None, 'href'), '')
        if href and (href.startswith('http://') or href.startswith('https://')):
            attrs[(None, 'target')] = '_blank'
            attrs[(None, 'rel')] = 'noopener noreferrer'
        return attrs
    
    return bleach.linkify(
        text,
        parse_email=parse_email,
        callbacks=[set_target_blank]
    )


def sanitize_and_truncate(html_content: str, max_length: int = 200) -> str:
    """
    Sanitize HTML and truncate to specified length.
    
    Useful for previews, excerpts, etc.
    
    Args:
        html_content: HTML string to sanitize
        max_length: Maximum length of plain text
        
    Returns:
        Sanitized and truncated HTML
    """
    if not html_content:
        return ""
    
    # Strip HTML to get plain text
    plain_text = strip_all_html(html_content)
    
    # Truncate
    if len(plain_text) > max_length:
        plain_text = plain_text[:max_length].rsplit(' ', 1)[0] + '...'
    
    # Escape for safety
    return html.escape(plain_text)


def escape_html(text: str) -> str:
    """
    Escape HTML special characters.
    
    Use this for displaying user input as plain text in HTML.
    
    Args:
        text: Text to escape
        
    Returns:
        Escaped text safe for HTML display
    """
    return html.escape(text) if text else ""


def unescape_html(text: str) -> str:
    """
    Unescape HTML entities.
    
    Args:
        text: Text with HTML entities
        
    Returns:
        Unescaped text
    """
    return html.unescape(text) if text else ""


__all__ = [
    'HTMLSanitizer',
    'sanitize_rich_text',
    'sanitize_basic_text',
    'sanitize_comment',
    'strip_all_html',
    'sanitize_html',
    'linkify_text',
    'sanitize_and_truncate',
    'escape_html',
    'unescape_html',
    'rich_text_sanitizer',
    'basic_text_sanitizer',
    'comment_sanitizer',
]

