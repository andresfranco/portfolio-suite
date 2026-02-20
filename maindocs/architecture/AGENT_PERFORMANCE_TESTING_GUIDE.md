# Agent Performance Testing Guide

Quick reference for testing the Phase 2 & 3 optimizations.

## Prerequisites

```bash
# Ensure backend is running with Redis
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate
python run.py  # Backend on port 8000
```

## Test Scenarios

### 1. Cache Performance Test

**First Query (Cache Miss)**
```bash
time curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What React projects are there?",
    "portfolio_id": 1,
    "language_id": 1
  }'
```
Expected: 5-10 seconds

**Second Query (Cache Hit)**
```bash
time curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What React projects are there?",
    "portfolio_id": 1,
    "language_id": 1
  }'
```
Expected: <50ms, response includes `"cached": true`

### 2. Streaming Endpoint Test

```bash
curl -N -X POST http://localhost:8000/api/agents/1/chat/stream \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about your React projects",
    "portfolio_id": 1,
    "language_id": 1
  }'
```

Expected output (Server-Sent Events):
```
data: {"type":"token","content":"In"}
data: {"type":"token","content":" the"}
data: {"type":"token","content":" portfolio"}
...
data: {"type":"done","citations":[...],"cached":false}
```

### 3. Query Complexity Tests

**Trivial (No RAG)**
```bash
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "portfolio_id": 1}'
```
Expected: <1s, no citations

**Simple (k=3)**
```bash
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is React?", "portfolio_id": 1}'
```
Expected: ~3-5s, 3 chunks retrieved

**Medium (k=8)**
```bash
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What React projects?", "portfolio_id": 1}'
```
Expected: ~5-8s, 8 chunks retrieved

**Comprehensive (k=15)**
```bash
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "List all projects", "portfolio_id": 1}'
```
Expected: ~10-15s, 15 chunks retrieved

### 4. Cache Invalidation Test

```bash
# Make a cached query
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "React projects?", "portfolio_id": 1}'

# Invalidate cache (if exposed via API, or run in Python)
python -c "from app.services.cache_service import cache_service; cache_service.invalidate_portfolio(1)"

# Query again - should be cache miss
curl -X POST http://localhost:8000/api/agents/1/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "React projects?", "portfolio_id": 1}'
```

## Monitoring Commands

### Check Redis Cache
```bash
# Connect to Redis
redis-cli

# Check cache stats
INFO stats
# Look for: keyspace_hits, keyspace_misses

# List all agent cache keys
KEYS agent:response:*

# Check specific cache entry
GET agent:response:HASH_VALUE

# Check TTL
TTL agent:response:HASH_VALUE
```

### Check Database Sessions
```sql
-- Recent agent messages
SELECT 
    am.id, 
    am.role, 
    LEFT(am.content, 50) as content_preview,
    am.latency_ms,
    am.created_at
FROM agent_message am
JOIN agent_session ases ON am.session_id = ases.id
WHERE ases.agent_id = 1
ORDER BY am.created_at DESC
LIMIT 10;
```

## Performance Benchmarks

Run the profiling script to measure improvements:

```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate

# Profile uncached query
python profile_agent_performance.py --agent-id 1 --query "React projects?" --portfolio-id 1

# Profile cached query (run twice)
python profile_agent_performance.py --agent-id 1 --query "React projects?" --portfolio-id 1
python profile_agent_performance.py --agent-id 1 --query "React projects?" --portfolio-id 1
```

## Expected Performance Metrics

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Greeting ("Hello") | 37s timeout | <1s | 97% |
| First query | 7.9s | 7.5s | 5% (dynamic context) |
| Cached query | 7.9s | <5ms | 99.9% |
| Simple query (k=3) | 7.9s | 5.2s | 34% |
| Streaming TTFT | 7.9s | <500ms | 93% perceived |

## Troubleshooting

### Cache Not Working
```python
# Check Redis connection
from app.services.cache_service import cache_service
cache_service.client.ping()  # Should return True
```

### Streaming Not Working
- Check nginx buffering is disabled: `proxy_buffering off;`
- Verify headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- Test with curl `-N` flag (no buffering)

### Dynamic Context Not Applied
```python
# Test query complexity analyzer
from app.services.query_complexity import analyze_query_complexity
complexity, top_k, max_tokens = analyze_query_complexity("Hello")
print(f"{complexity} - k={top_k}, tokens={max_tokens}")
# Should output: trivial - k=0, tokens=500
```

## Integration Testing (Frontend)

Once frontend is updated to support streaming:

```javascript
// Test streaming in browser console
const response = await fetch('/api/agents/1/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Tell me about React projects',
    portfolio_id: 1
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log('Received:', chunk);
}
```

---

**Last Updated:** 2024-01-XX
**Version:** 1.0
