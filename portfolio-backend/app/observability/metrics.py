try:
    from prometheus_client import Counter, Histogram, CONTENT_TYPE_LATEST, generate_latest  # type: ignore
except Exception:  # Optional dependency
    Counter = None  # type: ignore
    Histogram = None  # type: ignore
    CONTENT_TYPE_LATEST = 'text/plain; version=0.0.4; charset=utf-8'  # type: ignore
    def generate_latest():  # type: ignore
        return b""


# Timers
rag_index_seconds = Histogram('rag_index_seconds', 'Time spent indexing a record') if Histogram else None
rag_retire_seconds = Histogram('rag_retire_seconds', 'Time spent retiring a record') if Histogram else None
rag_vector_search_seconds = Histogram('rag_vector_search_seconds', 'Vector search latency') if Histogram else None
rag_hybrid_search_seconds = Histogram('rag_hybrid_search_seconds', 'Hybrid search latency') if Histogram else None
rag_embedding_list_seconds = Histogram('rag_embedding_list_seconds', 'Embedding list latency') if Histogram else None


# Counters
rag_index_jobs = Counter('rag_index_jobs_total', 'Total index jobs processed') if Counter else None
rag_retire_jobs = Counter('rag_retire_jobs_total', 'Total retire jobs processed') if Counter else None
rag_chunks_new = Counter('rag_chunks_new_total', 'Chunks created') if Counter else None
rag_chunks_updated = Counter('rag_chunks_updated_total', 'Chunks updated (checksum changed)') if Counter else None
rag_chunks_skipped = Counter('rag_chunks_skipped_total', 'Chunks skipped (no change)') if Counter else None
rag_chunks_retired = Counter('rag_chunks_retired_total', 'Chunks retired (marked deleted)') if Counter else None
rag_embeddings_upserted = Counter('rag_embeddings_upserted_total', 'Embeddings upserted') if Counter else None


