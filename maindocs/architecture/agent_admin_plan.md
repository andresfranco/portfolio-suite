# Agent Admin Plan

Agent Admin panel to configure, secure, and test RAG-only chat agents . Agents must support multiple LLM vendors (LLM-agnostic params + API keys) and answer only from the RAG corpus stored in Postgres.

# Deliverables Checklist

DB migrations for agent configs, provider credentials, templates, retrieval settings, test runs, sessions, messages.

Unified LLM Provider SDK (connectors for OpenAI, Anthropic, Google, Mistral, Cohere, Azure OpenAI; easy to add more).

RAG service (query embedding → vector search in Postgres → optional rerank → context assembly).

Guardrailed Chat service (strict RAG-only answering; citation piping).

Admin APIs (CRUD for agents, credentials, templates, retrieval settings; test endpoint).

Public Chat API (agent_id + user message; streaming; includes citations + token usage).

Admin UI new menu item “Agents”: list, detail/edit, credentials, templates, retrieval, live test console, usage stats.

Observability (structured logs, latency + token metrics, trace ids).

Role-based access to Agent Admin features.

Automated tests (unit + API + minimal e2e happy path).

#Secrets & Security

Encrypt API keys in DB using pgcrypto pgp_sym_encrypt with a server-only KMS-derived key (AGENT_KMS_KEY env).

Do not return decrypted secrets to clients.

Enforce RBAC: Only admin can manage credentials/agents.

Rate limit test endpoint.

Audit log admin actions (create/update/delete).

CORS locked to admin origin(s).

# Observability

Log per request: trace_id, agent_id, provider, model, latency_ms, token_usage, chunks_k, rerank_used, http_status.

Prometheus (or statsd) counters/histograms for latency + tokens.

Store agent_test_run rows automatically after each admin test.

# Performance & Limits

Default k=8, max_context_tokens=4000.

Truncate chunk text smartly (sentence-aware) to stay within token budget.

Batch embeddings for concurrent test runs.

Add TTL cache for recent vector queries (optional).

Consider hybrid search (pg_trgm + vector) later if recall needs a boost.

# Testing Plan

Unit

Param mapping per provider.

Token counting sanity.

Vector search with threshold filtering.

Rerank ordering stable.

API

Create credential → create agent → set retrieval → add template → run test.

Chat returns fallback when no chunks pass threshold.

Streaming endpoint sends well-formed SSE.

E2E (minimal)

Seed: a few rag_chunk rows.

Admin creates agent + runs test prompt; UI renders citations and metrics.

#Acceptance Criteria

Create credential, agent, retrieval, template via UI without server errors.

Running a test shows streamed answer + citations + token usage + latency.

Asking a question not covered by RAG returns exact fallback line.

Switching providers/models works without code changes (config only).

Secrets never leak to the client or logs.

Vector search uses Postgres vector extension; queries complete < 500ms on small corpora.

All changes audited with actor + timestamp.