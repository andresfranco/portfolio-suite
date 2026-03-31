---
name: rag-debug
description: Use when debugging the RAG system, embedding pipeline, vector search, Celery background tasks, or AI chat functionality. Triggers on keywords like RAG, embeddings, vector search, Celery, chat not working.
---

# RAG Pipeline Debugging Workflow

## Architecture quick reference
```
Content update → RAG service debounce → Celery task queued
Celery worker → embed_content() → pgvector upsert
Chat query → query_complexity.py → rag_service.py → vector search → LLM → citation
```

## Check 1 — Is Celery running?
```bash
cd portfolio-backend && source venv/bin/activate
celery -A app.queue.celery_app inspect active
celery -A app.queue.celery_app inspect reserved
# Check Redis queue depth
redis-cli llen celery
redis-cli keys "celery-task-meta-*" | head -10
```

## Check 2 — Are embeddings being generated?
```bash
# Check embedding records in DB
psql $DATABASE_URL -c "
  SELECT content_type, COUNT(*), MAX(updated_at)
  FROM embeddings
  GROUP BY content_type
  ORDER BY content_type;
"

# Check for failed embedding tasks
redis-cli keys "celery-task-meta-*" | xargs -I{} redis-cli get {} | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        d = json.loads(line.strip())
        if d.get('status') == 'FAILURE':
            print(d)
    except: pass
"
```

## Check 3 — Is pgvector extension enabled?
```bash
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
# If missing: CREATE EXTENSION vector;
```

## Check 4 — Test vector search directly
```bash
psql $DATABASE_URL -c "
  SELECT id, content_type, 1 - (embedding <=> '[0.1,0.2,...]'::vector) AS similarity
  FROM embeddings
  ORDER BY embedding <=> '[0.1,0.2,...]'::vector
  LIMIT 5;
"
```

## Check 5 — LLM provider credentials
```bash
# Check which provider is configured
psql $DATABASE_URL -c "
  SELECT key, value FROM system_settings
  WHERE key IN ('embed_provider', 'embed_model', 'llm_provider', 'llm_model');
"

# Check agent credentials are loaded
psql $DATABASE_URL -c "
  SELECT provider, created_at, updated_at FROM agent_credentials;
"
```

## Check 6 — RAG service logs
```bash
# Run backend with debug logging
LOG_LEVEL=DEBUG LOG_SQL=True python run.py 2>&1 | grep -i "rag\|embed\|celery\|vector"
```

## Common failure patterns

### Embeddings not updating
- Celery broker not configured: `CELERY_BROKER_URL` empty in `.env` → falls back to synchronous
- Task debounce delay too long: check `RAG_DEBOUNCE_SECONDS` in system settings
- Provider API key wrong or quota exceeded

### Vector search returning irrelevant results
- Embedding dimension mismatch: model changed but old embeddings not re-indexed
- Fix: trigger full re-index via admin API or management command

### Chat returning no citations
- `citation_service.py` threshold too high
- Check `RAG_SIMILARITY_THRESHOLD` in system settings (default ~0.7)

### Streaming not working
- Check `chat_service_async.py` — Anthropic/OpenAI streaming requires SSE response
- Verify nginx doesn't buffer: `proxy_buffering off` in nginx config
