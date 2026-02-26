"""
Image compression utilities using Pillow.

Compresses and resizes raster images before they are written to disk.
GIF and SVG are passed through unchanged.
PNG without transparency is converted to JPEG for better compression.
"""

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Content-types that we actively compress / re-encode
_COMPRESSIBLE = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

# Content-types that pass through unchanged
_PASSTHROUGH = {"image/gif", "image/svg+xml"}

# Mapping from content-type to Pillow format string
_FORMAT_MAP = {
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}


def compress_image(
    content: bytes,
    content_type: str,
    max_width: int = 1920,
    max_height: int = 1080,
    jpeg_quality: int = 85,
) -> tuple[bytes, str]:
    """Compress and resize a raster image.

    Args:
        content: Raw image bytes.
        content_type: MIME type of the original file (e.g. ``"image/jpeg"``).
        max_width: Maximum output width in pixels. Aspect ratio is preserved.
        max_height: Maximum output height in pixels. Aspect ratio is preserved.
        jpeg_quality: Quality factor (1-95) used when writing JPEG or WebP.

    Returns:
        A tuple ``(compressed_bytes, final_content_type)``.  The
        ``final_content_type`` may differ from the input when a PNG without
        transparency is converted to JPEG.
    """
    # Pass through formats we don't process
    if content_type in _PASSTHROUGH or content_type not in _COMPRESSIBLE:
        return content, content_type

    try:
        from PIL import Image  # noqa: PLC0415 – lazy import keeps startup fast

        img = Image.open(io.BytesIO(content))

        # Detect alpha channel *before* any conversion
        has_alpha = img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        )

        # ── Resize ────────────────────────────────────────────────────────────
        w, h = img.size
        if w > max_width or h > max_height:
            img.thumbnail((max_width, max_height), Image.LANCZOS)
            logger.debug(
                "Resized image %dx%d → %dx%d (limit %dx%d)",
                w,
                h,
                img.size[0],
                img.size[1],
                max_width,
                max_height,
            )

        # ── Re-encode ─────────────────────────────────────────────────────────
        output = io.BytesIO()

        if content_type == "image/webp":
            img.save(output, format="WEBP", quality=jpeg_quality, method=6)
            final_type = "image/webp"

        elif content_type == "image/png":
            if has_alpha:
                # Preserve transparency; keep PNG
                if img.mode not in ("RGBA", "LA"):
                    img = img.convert("RGBA")
                img.save(output, format="PNG", optimize=True)
                final_type = "image/png"
            else:
                # No alpha — convert to JPEG for much better compression
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.save(
                    output,
                    format="JPEG",
                    quality=jpeg_quality,
                    optimize=True,
                    progressive=True,
                )
                final_type = "image/jpeg"

        else:
            # JPEG (or jpg alias)
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.save(
                output,
                format="JPEG",
                quality=jpeg_quality,
                optimize=True,
                progressive=True,
            )
            final_type = "image/jpeg"

        compressed = output.getvalue()
        original_kb = len(content) / 1024
        compressed_kb = len(compressed) / 1024
        logger.info(
            "Image compressed: %.1f KB → %.1f KB (%.0f%% reduction)",
            original_kb,
            compressed_kb,
            max(0, (1 - compressed_kb / original_kb) * 100) if original_kb else 0,
        )
        return compressed, final_type

    except Exception as exc:
        # Never break an upload because of compression failure — log and proceed
        logger.warning("Image compression failed, using original: %s", exc)
        return content, content_type


def get_dimensions_for_category(category_code: Optional[str]) -> tuple[int, int]:
    """Return (max_width, max_height) for a given image category code.

    Used by backend endpoints to pass category-appropriate size limits to
    :func:`compress_image`.
    """
    if not category_code:
        return 1920, 1080

    code = category_code.upper()

    if "LOGO" in code or "ICON" in code:
        return 800, 800

    if "THUMB" in code or "THUMBNAIL" in code:
        return 800, 600

    # background, main, gallery, section, and everything else
    return 1920, 1080
