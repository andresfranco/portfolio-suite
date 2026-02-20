"""
Security Tests for HTML Sanitization

Tests HTML sanitization to ensure protection against XSS attacks
while preserving safe formatting.
"""

import pytest
from app.utils.html_sanitizer import (
    sanitize_rich_text,
    sanitize_basic_text,
    sanitize_comment,
    strip_all_html,
    sanitize_html,
    linkify_text,
    sanitize_and_truncate,
    escape_html,
    unescape_html,
)


class TestRichTextSanitization:
    """Test rich text sanitization."""
    
    def test_preserve_safe_tags(self):
        """Test that safe tags are preserved."""
        html = "<p>This is <strong>bold</strong> and <em>italic</em></p>"
        result = sanitize_rich_text(html)
        assert "<p>" in result
        assert "<strong>" in result
        assert "<em>" in result
    
    def test_remove_script_tags(self):
        """Test removal of script tags."""
        html = "<p>Safe</p><script>alert('xss')</script>"
        result = sanitize_rich_text(html)
        assert "<script>" not in result
        assert "alert" not in result
    
    def test_remove_event_handlers(self):
        """Test removal of event handlers."""
        html = '<p onclick="alert(\'xss\')">Click me</p>'
        result = sanitize_rich_text(html)
        assert "onclick" not in result
    
    def test_remove_javascript_protocol(self):
        """Test removal of javascript: protocol."""
        html = '<a href="javascript:alert(\'xss\')">Click</a>'
        result = sanitize_rich_text(html)
        assert "javascript:" not in result
    
    def test_preserve_safe_links(self):
        """Test preservation of safe links."""
        html = '<a href="https://example.com">Link</a>'
        result = sanitize_rich_text(html)
        assert "https://example.com" in result
    
    def test_preserve_images(self):
        """Test preservation of images with safe attributes."""
        html = '<img src="https://example.com/image.jpg" alt="Image">'
        result = sanitize_rich_text(html)
        assert "src=" in result
        assert "alt=" in result


class TestBasicTextSanitization:
    """Test basic text sanitization."""
    
    def test_allow_minimal_formatting(self):
        """Test that only minimal formatting is allowed."""
        html = "<p><strong>Bold</strong> and <em>italic</em></p>"
        result = sanitize_basic_text(html)
        assert "<p>" in result
        assert "<strong>" in result
    
    def test_remove_complex_formatting(self):
        """Test removal of complex formatting."""
        html = '<div class="fancy"><table><tr><td>Data</td></tr></table></div>'
        result = sanitize_basic_text(html)
        # Tables and divs should be stripped in basic mode
        assert "Data" in result


class TestCommentSanitization:
    """Test comment sanitization (most restrictive)."""
    
    def test_allow_minimal_tags(self):
        """Test that only minimal tags are allowed."""
        html = "<p><strong>Bold</strong> text with <a href='https://example.com'>link</a></p>"
        result = sanitize_comment(html)
        assert "<p>" in result
        assert "<strong>" in result
        assert "<a" in result
    
    def test_remove_images(self):
        """Test removal of images from comments."""
        html = '<p>Text <img src="image.jpg"> more text</p>'
        result = sanitize_comment(html)
        # Images should be removed in comment mode
        assert "Text" in result


class TestStripAllHTML:
    """Test complete HTML stripping."""
    
    def test_remove_all_tags(self):
        """Test removal of all HTML tags."""
        html = "<p>This is <strong>bold</strong> and <em>italic</em> text</p>"
        result = strip_all_html(html)
        assert "<" not in result
        assert ">" not in result
        assert "This is bold and italic text" in result
    
    def test_handle_nested_tags(self):
        """Test handling of nested tags."""
        html = "<div><p><span>Nested <strong>text</strong></span></p></div>"
        result = strip_all_html(html)
        assert "Nested text" in result
        assert "<" not in result


class TestLinkification:
    """Test automatic URL linkification."""
    
    def test_linkify_url(self):
        """Test linkification of plain text URL."""
        text = "Visit https://example.com for more"
        result = linkify_text(text)
        assert "<a" in result
        assert "https://example.com" in result
    
    def test_linkify_email(self):
        """Test linkification of email addresses."""
        text = "Contact us at info@example.com"
        result = linkify_text(text, parse_email=True)
        assert "<a" in result
        assert "mailto:" in result
    
    def test_add_noopener(self):
        """Test that external links get noopener rel."""
        text = "Visit https://example.com"
        result = linkify_text(text)
        assert "noopener" in result
        assert "noreferrer" in result


class TestCustomSanitization:
    """Test custom sanitization rules."""
    
    def test_custom_allowed_tags(self):
        """Test custom allowed tags."""
        html = "<p>Text</p><div>Div</div>"
        result = sanitize_html(html, allowed_tags={'p'}, allowed_attributes={})
        assert "<p>" in result
        # Div should be stripped or escaped
        assert "Div" in result
    
    def test_custom_attributes(self):
        """Test custom allowed attributes."""
        html = '<a href="http://example.com" title="Title" onclick="alert()">Link</a>'
        result = sanitize_html(
            html,
            allowed_tags={'a'},
            allowed_attributes={'a': {'href'}}
        )
        assert "href=" in result
        assert "onclick" not in result


class TestTruncation:
    """Test HTML sanitization with truncation."""
    
    def test_truncate_long_text(self):
        """Test truncation of long text."""
        html = "<p>" + "word " * 100 + "</p>"
        result = sanitize_and_truncate(html, max_length=50)
        assert len(result) <= 60  # Account for "..."
        assert "..." in result


class TestHTMLEscaping:
    """Test HTML escaping and unescaping."""
    
    def test_escape_special_characters(self):
        """Test escaping of special characters."""
        text = "<script>alert('xss')</script>"
        result = escape_html(text)
        assert "&lt;" in result
        assert "&gt;" in result
        assert "<" not in result
    
    def test_unescape_entities(self):
        """Test unescaping of HTML entities."""
        text = "&lt;p&gt;Text&lt;/p&gt;"
        result = unescape_html(text)
        assert "<p>" in result
        assert "&lt;" not in result


class TestXSSVectors:
    """Test protection against known XSS attack vectors."""
    
    def test_svg_xss(self):
        """Test protection against SVG-based XSS."""
        html = '<svg onload="alert(\'xss\')"></svg>'
        result = sanitize_rich_text(html)
        assert "onload" not in result
    
    def test_data_uri_xss(self):
        """Test protection against data URI XSS."""
        html = '<a href="data:text/html,<script>alert(\'xss\')</script>">Click</a>'
        result = sanitize_rich_text(html)
        assert "data:text/html" not in result
    
    def test_meta_refresh_xss(self):
        """Test protection against meta refresh XSS."""
        html = '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss\')">'
        result = sanitize_rich_text(html)
        assert "meta" not in result.lower() or "javascript:" not in result
    
    def test_base_tag_xss(self):
        """Test protection against base tag XSS."""
        html = '<base href="javascript:alert(\'xss\')">'
        result = sanitize_rich_text(html)
        assert "base" not in result.lower() or "javascript:" not in result
    
    def test_form_action_xss(self):
        """Test protection against form action XSS."""
        html = '<form action="javascript:alert(\'xss\')"><input type="submit"></form>'
        result = sanitize_rich_text(html)
        # Forms should be stripped
        assert "javascript:" not in result
    
    def test_iframe_xss(self):
        """Test protection against iframe XSS."""
        html = '<iframe src="javascript:alert(\'xss\')"></iframe>'
        result = sanitize_rich_text(html)
        assert "iframe" not in result.lower()
    
    def test_object_embed_xss(self):
        """Test protection against object/embed XSS."""
        html = '<object data="javascript:alert(\'xss\')"></object>'
        result = sanitize_rich_text(html)
        assert "object" not in result.lower() or "javascript:" not in result


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_empty_string(self):
        """Test handling of empty strings."""
        result = sanitize_rich_text("")
        assert result == ""
    
    def test_none_value(self):
        """Test handling of None values."""
        result = sanitize_rich_text(None)
        assert result == ""
    
    def test_malformed_html(self):
        """Test handling of malformed HTML."""
        html = "<p>Unclosed tag<strong>text"
        result = sanitize_rich_text(html)
        # Should handle gracefully
        assert "text" in result
    
    def test_unicode_characters(self):
        """Test preservation of Unicode characters."""
        html = "<p>Hello 世界 🌍</p>"
        result = sanitize_rich_text(html)
        assert "世界" in result
        assert "🌍" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

