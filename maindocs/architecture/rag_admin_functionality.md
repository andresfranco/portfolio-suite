# RAG Admin — Simple Guide

RAG Admin is the operations panel for the “brain” of your app. It helps you make sure new and updated content is available for the AI to read and use when answering questions.

---

## What you can do with RAG Admin

- Reindex All
  - Rebuild the AI’s knowledge from the current database.
  - Useful after changing settings or importing lots of content.

- Settings
  - Control how text is split into chunks and cleaned before the AI reads it.
  - Includes:
    - Chunk size and overlap (how big each piece of text is).
    - Debounce (avoid reprocessing the same record too often).
    - Allow fields (which fields are allowed to be embedded).
    - Redact regex (hide sensitive text before embedding).

- Metrics
  - Simple counters that show indexing activity:
    - Index Jobs, Retire Jobs, Chunks Retired.
  - “Last reindex started/finished” timestamps for quick status checks.

- Dead Letters
  - A list of items that failed to index.
  - You can retry them individually or in bulk.

---

## Where the AI-ready data is stored

- In your PostgreSQL database, in special tables:
  - rag_chunk — each small piece of text the AI can retrieve (a “snippet”).
  - rag_embedding — the numeric “fingerprint” of each snippet used for AI search.
  - rag_dead_letter — failed indexing jobs (for review and retry).
- Nothing is stored inside the AI model itself. It reads from these tables at query time.

---

## What happens when content changes

After you save a change and it’s committed to the database, the app automatically queues a job:

- Insert (new record)
  1) A new “index” job is queued.
  2) The worker fetches the record, cleans the text, and splits it into chunks.
  3) Each chunk gets an embedding (the numeric fingerprint).
  4) The chunks and embeddings are saved to rag_chunk and rag_embedding.

- Update (existing record changes)
  1) An “index” job is queued.
  2) The worker rechecks the content and only processes pieces that actually changed.
  3) New/changed chunks are added; unchanged chunks are skipped (saves time).
  4) Old chunks that no longer apply are retired.

- Delete (record removed)
  1) A “retire” job is queued.
  2) Related chunks are retired so they no longer show up in search.

- Attachments (documents, images)
  - Upload: documents are converted to text; images can get captions/OCR (if enabled). Those texts become chunks and embeddings.
  - Delete: related chunks are retired.

This end-to-end flow ensures the AI can use the latest content.

---

## How to check it’s working (no technical steps required)

1) Make a simple change (e.g., edit a title or add a new item). Click Save.
2) Open RAG Admin.
3) Optional: click “Reindex All” if you want to force a full refresh.
4) Watch the “Last reindex started/finished” timestamps update.
5) Look at the Metrics cards:
   - “Index Jobs” should increase for new/updated items.
   - “Retire Jobs” and “Chunks Retired” increase when things are removed.
6) If anything fails, it appears in “Dead Letters.” Click “Retry” to re-run it.

Tip: You can also use the app’s search/AI feature to look for a phrase you just added. If it appears in results or answers, the pipeline worked.

---

## A tiny technical peek (optional)

- rag_chunk grows with new rows when content is added.
- rag_embedding stores an entry for each chunk (this is what powers AI search).
- rag_dead_letter should be empty most of the time. If not, retry and check the error.

---

## Common questions

- Why do metrics sometimes stay at 0?
  - If nothing has changed, indexing can be a quick “no-op,” so counters may barely move.
  - If work happens in another process, the counters update as that process runs; give it a moment.

- What if I see failures?
  - Open Dead Letters, review the error, and click Retry. Most failures are transient and clear on retry.

- When should I use “Reindex All”?
  - After changing RAG settings.
  - After large imports or bulk edits.
  - When you want to refresh everything to be safe.

---

## Quick troubleshooting

- I made a change but don’t see it in answers:
  - Wait a moment; then try again.
  - Check RAG Admin → Dead Letters (retry if needed).
  - Click “Reindex All” to force a rebuild.

- The page shows errors for RAG Admin endpoints:
  - Make sure you’re logged in as a system administrator.
  - Ensure database migrations have been applied (so the RAG tables exist).

---

## Glossary

- Chunk: a small piece of text used by the AI to retrieve relevant information.
- Embedding: a numeric “fingerprint” of a chunk that allows similarity search.
- Retire: mark old chunks so they’re no longer used by search.
- Dead Letter: a failed indexing job kept for diagnosis and