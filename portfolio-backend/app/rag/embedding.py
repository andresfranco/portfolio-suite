from typing import List
import os
import math


def _l2_normalize(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _stub_vectors(texts: List[str]) -> List[List[float]]:
    vectors: List[List[float]] = []
    for t in texts:
        h = sum(ord(c) for c in (t[:256] or ''))
        vec = [((h + i * 17) % 101) / 100.0 for i in range(8)]
        vectors.append(_l2_normalize(vec))
    return vectors


def embed_text_batch(texts: List[str]) -> List[List[float]]:
    provider = os.getenv('EMBED_PROVIDER', '').lower()
    if not provider:
        return _stub_vectors(texts)
    if provider == 'openai':
        try:
            import openai
            model = os.getenv('EMBED_MODEL', 'text-embedding-3-small')
            client = openai.OpenAI()
            # Batch embed
            resp = client.embeddings.create(model=model, input=texts)
            return [_l2_normalize(list(d.embedding)) for d in resp.data]
        except Exception:
            return _stub_vectors(texts)
    # Add other providers here as needed
    return _stub_vectors(texts)


