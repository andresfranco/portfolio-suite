import os


def chunk_text(text: str, target_chars: int | None = None, overlap_chars: int | None = None):
    if not text:
        return []
    if target_chars is None:
        target_chars = int(os.getenv("CHUNK_CHARS", "4000"))
    if overlap_chars is None:
        overlap_chars = int(os.getenv("CHUNK_OVERLAP", "500"))
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + target_chars)
        chunks.append(text[start:end])
        if end == n:
            break
        start = max(0, end - overlap_chars)
    return chunks


