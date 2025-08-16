# Pattern A — App-Driven Sync (After-Commit Hooks) — Implementation Blueprint

> **Purpose:** Make a FastAPI + PostgreSQL (pgvector) CMS automatically index **every create/update/delete** of CMS rows and attachments into a **RAG-ready** corpus with chunked text and embeddings.
> **Style:** Explicit contracts, schemas, and steps for a coding LLM (or human) to implement without guessing.

---

## 0) High-Level Contract

* **Source of Truth:** PostgreSQL (CMS tables + `rag_chunk` + `rag_embedding`).
* **Trigger:** Only the FastAPI app writes. After a successful DB **commit**, enqueue an **index** job (insert/update) or **retire** job (delete).
* **Worker:** Loads current state, **normalizes → chunks → embeds → upserts** rows into `rag_chunk` + `rag_embedding`. Uses **checksums** to avoid re-embedding unchanged content. **Retires** obsolete chunks.

---

## 1) Data Model (DDL)

> Requires: PostgreSQL 14+ (recommended) and `pgvector` extension installed.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Canonical retrievable units (one row per chunk)
CREATE TABLE IF NOT EXISTS rag_chunk (
  id            BIGSERIAL PRIMARY KEY,
  source_table  TEXT NOT NULL,           -- e.g., 'posts', 'attachments'
  source_id     TEXT NOT NULL,           -- CMS row id/uuid (stringified)
  source_field  TEXT,                    -- 'title' | 'body' | 'ocr' | 'caption' | ...
  source_uri    TEXT,                    -- file path / URL for attachments
  modality      TEXT NOT NULL,           -- 'text' | 'image'
  mime_type     TEXT,
  part_index    INT NOT NULL DEFAULT 0,  -- chunk ordinal in field
  version       INT NOT NULL DEFAULT 1,  -- content revision
  text          TEXT,                    -- normalized chunk text
  checksum      TEXT,                    -- SHA256 of 'text' (or file snapshot)
  lang          TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tsv           tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(text,''))) STORED
);

-- Unique identity per logical chunk version
CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_chunk_logical
  ON rag_chunk (source_table, source_id, source_field, part_index, version);

CREATE INDEX IF NOT EXISTS idx_rag_chunk_source ON rag_chunk (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunk_tsv     ON rag_chunk USING GIN(tsv);

-- 2. Embeddings per (chunk, model, modality)
CREATE TABLE IF NOT EXISTS rag_embedding (
  chunk_id   BIGINT NOT NULL REFERENCES rag_chunk(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,              -- e.g., 'text-embedding-3-large'
  modality   TEXT NOT NULL,              -- 'text' | 'image'
  dim        INT  NOT NULL,              -- e.g., 1536
  embedding  vector NOT NULL,
  PRIMARY KEY (chunk_id, model, modality)
);

-- ANN index (HNSW + cosine distance). Adjust ops for your metric.
CREATE INDEX IF NOT EXISTS idx_rag_embedding_hnsw
  ON rag_embedding USING hnsw (embedding vector_cosine_ops);
```

**Notes**

* Use **unit-normalized vectors** if you use cosine distance.
* Keep **large binaries out of Postgres** (store only URIs and checksums).

---

## 2) Event Flow

```
Client → FastAPI CRUD → Postgres (transaction)
     (commit succeeds) → After-Commit Hook → Queue Task
                         ↓
                 Worker (idempotent)
  Load current CMS row / file → Normalize → Chunk → Embedding (batch)
     → UPSERT rag_chunk, rag_embedding → Retire missing chunks
```

---

## 3) After-Commit Hook (SQLAlchemy) — API & Behavior

### Interface

* `stage_event(session, ev: RagEvent)` — call **inside** your CRUD service **before** `commit()`.
* After the session **commits**, an `after_commit` listener enqueues:

  * `enqueue_index_job(ev)` for `"insert"` | `"update"`
  * `enqueue_delete_job(ev)` for `"delete"`

### Types

```python
# rag_events.py
from typing import Literal, TypedDict, List

class RagEvent(TypedDict):
    op: Literal["insert", "update", "delete"]
    source_table: str              # e.g., "posts", "attachments"
    source_id: str                 # CMS id stringified
    changed_fields: List[str]      # optional hint for updates
```

### Staging & Hook

```python
# rag_events.py
def stage_event(session, ev: RagEvent) -> None:
    session.info.setdefault("rag_events", []).append(ev)

# hooks.py
from sqlalchemy.orm import Session
from sqlalchemy import event
from app.queue import enqueue_index_job, enqueue_delete_job

@event.listens_for(Session, "after_commit")
def _after_commit(session: Session):
    events = session.info.pop("rag_events", [])
    for ev in events:
        if ev["op"] in ("insert", "update"):
            enqueue_index_job(ev)    # async task
        else:
            enqueue_delete_job(ev)   # async task
```

**Invariant:** If the transaction **rolls back**, **no** task is queued.

---

## 4) Worker — Indexer Logic (Idempotent)

### Responsibilities

* Load current record/file by `(source_table, source_id)`.
* Build **canonical text** (e.g., `"title\n\nsummary\n\nbody\n\nTags: ..."`) and/or file-derived text (PDF/DOCX/HTML parsing; OCR/caption for images).
* **Chunk** each field (≈ 800–1000 tokens, overlap 10–15%).
* Compute **checksum** per chunk; **UPSERT** `rag_chunk`.
* **Embed** only new/changed chunks (batch).
* **UPSERT** `rag_embedding` for each embedded chunk.
* **Retire** chunks that no longer exist in the current plan (`is_deleted = TRUE`).

### Deterministic Identity

* Unique key: `(source_table, source_id, source_field, part_index, version)`
* `version`: derive from domain (e.g., row version) or conservatively `floor(updated_at/1m)` bucket.

### Pseudocode Contract

```python
def index_record(source_table: str, source_id: str) -> None:
    record = load_record(source_table, source_id)     # ORM/SQL; may join related rows
    if not record or getattr(record, "deleted_at", None):
        retire_record(source_table, source_id)
        return

    fields = build_canonical_fields(record)           # dict[field_name] = text
    planned = []  # list[(field, part_index, text, checksum)]
    for field, text in fields.items():
        for i, chunk in enumerate(chunk_text(text)):
            planned.append((field, i, chunk, sha256(chunk)))

    version = compute_version(record)

    # Upsert chunks & collect to_embed
    to_embed = []  # list[(chunk_id, text)]
    for field, i, text, cks in planned:
        change = upsert_chunk(
            source_table=source_table,
            source_id=source_id,
            source_field=field,
            part_index=i,
            version=version,
            modality="text",
            text=text,
            checksum=cks
        )  # returns {id, was_new: bool, checksum_changed: bool}

        if change.was_new or change.checksum_changed:
            to_embed.append((change.id, text))

    # Batch embed
    if to_embed:
        vectors = embed_text_batch([t for _, t in to_embed])  # returns List[List[float]]
        dim = len(vectors[0]) if vectors else None
        for (chunk_id, _), vec in zip(to_embed, vectors):
            upsert_embedding(
                chunk_id, vec,
                model="text-embedding-3-large",
                modality="text",
                dim=dim
            )

    # Retire missing chunks (present in DB but not in 'planned')
    retire_missing_chunks(source_table, source_id, version, planned)
```

### Helper Contracts

```python
def upsert_chunk(**kwargs) -> "ChangeFlags":
    """
    INSERT ... ON CONFLICT (source_table, source_id, source_field, part_index, version)
      DO UPDATE SET (text, checksum, updated_at, is_deleted=false)
    Returns: { id: int, was_new: bool, checksum_changed: bool }
    """

def upsert_embedding(chunk_id: int, vec: list[float], *, model: str, modality: str, dim: int) -> None:
    """
    INSERT ... ON CONFLICT (chunk_id, model, modality)
      DO UPDATE SET embedding = EXCLUDED.embedding
    """

def retire_missing_chunks(source_table: str, source_id: str, version: int, planned: list[tuple]) -> int:
    """
    Marks as is_deleted=TRUE any chunk for (source_table, source_id, version)
    whose (field, part_index) is not in 'planned'.
    Returns number retired.
    """

def retire_record(source_table: str, source_id: str) -> int:
    """
    UPDATE rag_chunk SET is_deleted = TRUE WHERE source_table=$1 AND source_id=$2 AND is_deleted=FALSE
    Returns number retired.
    """
```

---

## 5) Chunking & Embedding Interfaces

```python
def chunk_text(text: str, target_tokens: int = 900, overlap_tokens: int = 120) -> list[str]:
    """
    Split into chunks around ~target_tokens with overlap.
    Use tiktoken if OpenAI; fallback to sentence-aware chunking.
    """

def embed_text_batch(texts: list[str]) -> list[list[float]]:
    """
    Provider wrapper (OpenAI/Cohere/Voyage/SBERT).
    Must batch; must return unit-normalized vectors for cosine distance.
    """
```

---

## 6) Attachments & Images

* **Table:** `attachments(id, uri, mime_type, checksum, title, alt_text, created_at, updated_at, ...)`.
* **CRUD** emits `RagEvent` with `source_table='attachments'`.
* **Worker behavior:**

  * **Documents** (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/html`, etc.): parse with **unstructured/Tika** → chunk text under `source_field='doc'`.
  * **Images** (`image/*`): optional **caption** (BLIP/LLaVA) and **OCR** → chunk text under `source_field='caption'`/`'ocr'`.
  * Optional **image embeddings** (CLIP) stored as `modality='image'` rows in `rag_embedding`.

---

## 7) Retrieval (for completeness)

**Vector top-K (cosine):**

```sql
WITH q AS (SELECT CAST($1 AS vector) AS qvec)
SELECT c.*, (e.embedding <=> q.qvec) AS distance
FROM rag_embedding e
JOIN rag_chunk c ON c.id = e.chunk_id
JOIN q ON TRUE
WHERE e.model = $2
  AND e.modality = 'text'
  AND c.is_deleted = FALSE
ORDER BY distance
LIMIT $3;
```

**Hybrid:** run FTS (BM25 proxy via `ts_rank_cd`) separately and fuse with **RRF** in SQL or the app.

---

## 8) Configuration (ENV)

```ini
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db
EMBED_PROVIDER=openai
EMBED_MODEL=text-embedding-3-large
EMBED_BATCH=128
CHUNK_TOKENS=900
CHUNK_OVERLAP=120
VECTOR_DISTANCE=cosine
# Celery / Dramatiq
BROKER_URL=redis://localhost:6379/0
RESULT_BACKEND=redis://localhost:6379/1
# Storage for attachments
BLOB_BASE_URI=s3://my-bucket/cms/
```

---

## 9) Performance & Correctness

* **Batch embeddings** (64–256 per call).
* **Normalize vectors** for cosine.
* **Checksums** gate re-embedding.
* **Versioning** keeps revisions clean; consider **debouncing** rapid edits (delay job a few seconds).
* Monitor Postgres: `work_mem`, `shared_buffers`, **autovacuum**. Use **HNSW** index.

---

## 10) Observability

* Log per job: counts (**new/updated/skipped/retired**), durations, model, batch sizes.
* Optional `index_status` table for UI badges (“Indexing/Indexed/Failed”).
* Metrics: queue latency, embed throughput, error rates.

---

## 11) Security / ACLs

* Store `tenant_id`, `visibility`, role tags on `rag_chunk`.
* Enforce at **query time** (retrieval).
* **Redact PII** before embedding if required.

---

## 12) Backfill Plan

1. Deploy schema + code.
2. Create a backfill script: iterate CMS rows & attachments → call `index_record(table, id)` in batches.
3. Verify counts: `rag_chunk` and `rag_embedding` not empty; spot-check retrieval.
4. Enable UI “Ask AI”.

---

## 13) Acceptance Tests

* **Create Post** → expect N chunks + N embeddings; `is_deleted=FALSE`.
* **Update Body** → unchanged chunks skipped; changed chunks re-embedded; retired chunks marked.
* **Delete Post** → all chunks `is_deleted=TRUE`; retrieval filters them out.
* **Upload PDF** → chunks from parsed text; re-upload same file (same checksum) **skips** re-embedding.
* **Rapid Edits** → final state reflected; no duplicate active chunks.

---

## 14) Minimal Directory Layout (suggested)

```
app/
  main.py
  db.py
  models/               # CMS ORM models + RAG ORM helpers
  rag/
    rag_events.py       # RagEvent type + stage_event()
    hooks.py            # after_commit listener
    indexer.py          # index_record(), retire_record(), helpers
    chunking.py
    embedding.py
    storage.py          # get_blob(uri), checksum, etc.
  queue/
    celery_app.py
    tasks.py            # enqueue_index_job(), enqueue_delete_job()
migrations/
tests/
```

---

## 15) Definition of Done

* DDL applied (`rag_chunk`, `rag_embedding`, indexes).
* After-commit hook queues tasks.
* Indexer implements contracts above; **idempotent; checksum-aware**.
* Backfill completed for existing data.
* Retrieval returns relevant chunks and respects `is_deleted` + ACLs.
* Metrics/logs confirm healthy throughput and low error rate.

---

**This document is the authoritative spec for Pattern A.**
An implementation should copy these contracts (schemas, function signatures, and SQL) and wire them with your CMS CRUD code, embedding provider wrapper, and task runner.
