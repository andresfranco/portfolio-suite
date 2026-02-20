from pathlib import Path
from typing import Optional
import logging
import os

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resolve_path(uri: str) -> Path:
    """
    Resolve a stored URI/path to a local filesystem path.
    Accepts absolute paths, relative paths, or '/uploads/...' URLs.
    """
    if not uri:
        return Path("")
    p = Path(uri)
    # If it's a URL-like to uploads, strip prefix
    if str(uri).startswith("/uploads/"):
        rel = uri[len("/uploads/"):]
        return Path(settings.UPLOADS_DIR) / rel
    # If already absolute and exists
    if p.is_absolute():
        return p
    # Otherwise try relative to BASE_DIR
    return Path(settings.BASE_DIR) / uri


def read_text_best_effort(path: Path) -> str:
    try:
        if path.exists() and path.is_file():
            return path.read_text(errors="ignore")
    except Exception:
        return ""
    return ""


def extract_text_from_pdf(path: Path) -> str:
    try:
        import PyPDF2  # type: ignore
        text_parts = []
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                try:
                    text_parts.append(page.extract_text() or "")
                except Exception:
                    continue
        return "\n\n".join([t for t in text_parts if t])
    except Exception:
        return ""


def extract_text_from_docx(path: Path) -> str:
    try:
        import docx  # python-docx
        doc = docx.Document(str(path))
        return "\n".join([p.text for p in doc.paragraphs if p.text])
    except Exception:
        return ""


def extract_text_from_html(path: Path) -> str:
    try:
        # Prefer bs4 if available, fallback to stripping tags roughly
        try:
            from bs4 import BeautifulSoup  # type: ignore
            content = path.read_text(errors="ignore")
            soup = BeautifulSoup(content, "html.parser")
            return soup.get_text(" ", strip=True)
        except Exception:
            content = path.read_text(errors="ignore")
            # Naive strip of tags
            import re
            return re.sub(r"<[^>]+>", " ", content)
    except Exception:
        return ""


def extract_text_from_uri(uri: str, mime_hint: Optional[str] = None) -> str:
    """
    Minimal extractor:
    - If .txt/.md/.csv/.json/.xml: read as text
    - If .pdf: attempt PyPDF2
    - If .docx: python-docx
    - If .html/.htm: BeautifulSoup strip
    - Else: best-effort text read
    """
    path = _resolve_path(uri)
    if not path or not path.exists():
        logger.debug(f"Path not found for extraction: {uri}")
        return ""

    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".csv", ".json", ".xml"}:
        return read_text_best_effort(path)
    if suffix == ".pdf":
        text = extract_text_from_pdf(path)
        if text:
            return text
        # fallback
        return read_text_best_effort(path)
    if suffix == ".docx":
        text = extract_text_from_docx(path)
        if text:
            return text
        return read_text_best_effort(path)
    if suffix in {".html", ".htm"}:
        text = extract_text_from_html(path)
        if text:
            return text
        return read_text_best_effort(path)
    # Fallback: try to read as text
    return read_text_best_effort(path)


def get_blob_text(uri: str) -> str:
    # Backward-compat wrapper
    try:
        return extract_text_from_uri(uri)
    except Exception:
        return ""


