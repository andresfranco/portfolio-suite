# Implementation Plan: Centralize AI Credentials in the Agents Module

> **Status:** Draft
> **Date:** 2026-03-31
> **Scope:** Migrate all AI API keys and provider configs from `.env` to encrypted `agent_credentials` DB records; make the agents module the single source of truth for credentials across the entire application.

---

## 1. Problem Statement

AI credentials are currently split across two unrelated systems:

| Consumer | Where credentials live today | How they're resolved |
|----------|------------------------------|----------------------|
| **RAG chat agents** | `agent_credentials` table (pgcrypto-encrypted) | Decrypted at runtime via `AGENT_KMS_KEY` |
| **RAG embeddings** | `OPENAI_API_KEY` in `.env` (fallback: first OpenAI agent credential) | `os.getenv()` or pgcrypto decrypt at startup |
| **Career AI assessment** | `CAREER_AI_PROVIDER/MODEL/API_KEY/BASE_URL` in `.env` | `settings.CAREER_AI_*` direct env read |
| **Career AI fallback** | `CAREER_AI_FALLBACK_*` in `.env` | `settings.CAREER_AI_FALLBACK_*` direct env read |
| **Career diagnostics** | `ANTHROPIC_API_KEY` + `CAREER_AI_*` in `.env` | `settings.ANTHROPIC_API_KEY` direct env read |
| **Career skill extraction** | Same as career AI assessment | Same provider factory |
| **Embedding indexer** | `EMBED_PROVIDER/EMBED_MODEL` in `.env` or `system_settings` table | Applied to env at startup from DB |

**Problems:**
1. **Secrets in plaintext** — `.env` has 4+ raw API keys (Anthropic, Groq, OpenAI) visible to anyone with file access
2. **No rotation** — Changing a key requires `.env` edit + service restart
3. **No audit trail** — No record of when keys were added/changed
4. **Duplicated logic** — `_decrypt_api_key()` is copy-pasted in `chat_service.py`, `rag_service.py`, and `agents.py`
5. **Fragile startup** — `main.py` decrypts OpenAI credential at boot and puts it in `os.environ`
6. **Career module is disconnected** — Career tasks build providers from hardcoded env vars, ignoring the credential store entirely

---

## 2. Target Architecture

```
                  ┌───────────────────────────────────┐
                  │    agent_credentials table         │
                  │  (pgcrypto-encrypted API keys)     │
                  │                                    │
                  │  id | name        | provider | ... │
                  │  1  | groq-main   | openai   |     │
                  │  2  | anthropic   | anthropic|     │
                  │  3  | openai-emb  | openai   |     │
                  └──────────┬────────────────────────┘
                             │
              ┌──────────────┼──────────────────────┐
              │              │                      │
              ▼              ▼                      ▼
     ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐
     │ Agents     │  │ Career AI    │  │ RAG / Embeddings     │
     │ (chat/RAG) │  │ (assessment, │  │ (indexing, query)    │
     │            │  │  skills,     │  │                      │
     │ credential │  │  diagnostics)│  │ credential_id in     │
     │ FK on agent│  │              │  │ system_settings or   │
     └────────────┘  │ credential_id│  │ agent.embedding ref  │
                     │ in system_   │  │                      │
                     │ settings     │  │                      │
                     └──────────────┘  └──────────────────────┘

     CredentialService (single decryption helper — replaces all copies)
```

**Core principle:** `agent_credentials` is the **only** place API keys are stored. All consumers reference a credential by ID, and a single `CredentialService` handles encryption/decryption.

---

## 3. Design Decisions

### 3.1 Keep pgcrypto (not Fernet) for credential encryption

The project has two encryption systems:
- **Fernet** (`app/core/encryption.py`) — used for PII fields (user data, personal info)
- **pgcrypto** (`pgp_sym_encrypt/decrypt`) — used for agent API keys, keyed by `AGENT_KMS_KEY`

**Decision:** Keep pgcrypto for agent credentials. It's already proven, the data lives in the DB, and decryption happens in SQL which avoids shipping the ciphertext to Python. The only env var needed is `AGENT_KMS_KEY` (the encryption passphrase), which is not itself a service API key.

### 3.2 Use `purpose` tags on credentials (not a new table)

Rather than creating a separate "career credential" or "embedding credential" table, add a `purpose` JSON column to `agent_credentials` that tags what a credential is used for. System settings then reference credential IDs.

### 3.3 Credential resolution with env fallback during migration

To avoid a breaking deployment, the migration will:
1. Seed `agent_credentials` rows from existing `.env` values (one-time migration script)
2. Update all consumers to prefer DB credentials but fall back to env vars
3. After validation, `.env` AI keys can be removed (documented, not enforced)

---

## 4. Database Changes

### 4.1 Add columns to `agent_credentials`

| Column | Type | Notes |
|--------|------|-------|
| `purpose` | `JSONB` | Tags: `["chat"]`, `["career_primary"]`, `["career_fallback"]`, `["embedding"]` — a credential can serve multiple purposes |
| `model_default` | `String(100)` | Default model to use with this credential (e.g. `qwen/qwen3-32b`) |
| `base_url` | `String(2048)` | Provider base URL override (e.g. `https://api.groq.com/openai/v1`) — moves out of `extra` JSON for first-class access |
| `is_active` | `Boolean` | Default `True` — soft-disable without deleting |
| `last_used_at` | `DateTime(tz)` | Updated on each successful decryption/use |
| `created_by` | `Integer` | Audit: user who created |
| `updated_by` | `Integer` | Audit: user who last modified |

**Note:** `base_url` currently lives inside the `extra` JSONB column. Promoting it to a first-class column makes it queryable, visible in the UI, and consistent with how the career provider uses it.

### 4.2 Add system_settings keys for credential references

| Key | Value | Purpose |
|-----|-------|---------|
| `career.credential_id` | `int` | Primary credential for career AI tasks |
| `career.model` | `string` | Model override (e.g. `qwen/qwen3-32b`) |
| `career.fallback_credential_id` | `int` | Fallback credential (used on 429) |
| `career.fallback_model` | `string` | Fallback model override |
| `embed.credential_id` | `int` | Credential for embedding provider |
| `embed.model` | `string` | Embedding model (already exists) |
| `embed.provider` | `string` | Embedding provider name (already exists) |

### 4.3 Alembic Migration

```
alembic revision --autogenerate -m "add purpose and base_url to agent_credentials"
```

Migration steps:
1. Add `purpose`, `model_default`, `base_url`, `is_active`, `last_used_at`, `created_by`, `updated_by` columns
2. Backfill `base_url` from `extra->>'base_url'` for existing rows
3. Backfill `purpose` for existing credentials based on current usage (tag all existing as `["chat"]`)
4. Add index on `purpose` (GIN index for JSONB containment queries)

---

## 5. Backend Implementation

### 5.1 CredentialService (new centralized helper)

**File:** `app/services/credential_service.py`

This replaces the 3 separate `_decrypt_api_key()` copies scattered across `chat_service.py`, `rag_service.py`, and `agents.py`.

```python
class CredentialService:
    """Single source of truth for agent credential operations."""

    @staticmethod
    def encrypt_api_key(db: Session, api_key: str) -> str:
        """Encrypt an API key using pgcrypto. Returns base64-encoded ciphertext."""

    @staticmethod
    def decrypt_api_key(db: Session, encrypted: str) -> str:
        """Decrypt a base64-encoded pgcrypto ciphertext. Returns plaintext key."""

    @staticmethod
    def get_credential(db: Session, credential_id: int) -> AgentCredential:
        """Load a credential by ID. Raises 404 if not found."""

    @staticmethod
    def resolve_api_key(db: Session, credential_id: int) -> str:
        """Load + decrypt a credential's API key in one call. Updates last_used_at."""

    @staticmethod
    def get_credential_by_purpose(db: Session, purpose: str) -> AgentCredential | None:
        """Find the first active credential tagged with the given purpose."""

    @staticmethod
    def resolve_provider_config(
        db: Session, credential_id: int, model_override: str | None = None
    ) -> dict:
        """Return {provider, api_key, base_url, model} ready for build_provider().
        
        Falls back to credential.model_default if no model_override given.
        """
```

### 5.2 Career Provider Factory (refactored)

**File:** `app/queue/tasks/career.py` — replace `_build_career_provider()` and `_build_career_fallback_provider()`

```python
def _build_career_provider(db: Session):
    """Build career AI provider from DB credential, with env fallback."""
    from app.services.credential_service import CredentialService

    # 1. Try system_settings → credential_id
    cred_id = _get_system_setting(db, "career.credential_id")
    model = _get_system_setting(db, "career.model")
    
    if cred_id:
        config = CredentialService.resolve_provider_config(db, int(cred_id), model)
        return build_provider(
            config["provider"],
            api_key=config["api_key"],
            base_url=config["base_url"],
        ), config["model"]
    
    # 2. Fallback: legacy env vars (migration period)
    api_key = settings.CAREER_AI_API_KEY or settings.ANTHROPIC_API_KEY
    provider_name = settings.CAREER_AI_PROVIDER or "anthropic"
    return build_provider(
        provider_name,
        api_key=api_key,
        base_url=settings.CAREER_AI_BASE_URL,
    ), settings.CAREER_AI_MODEL


def _build_career_fallback_provider(db: Session):
    """Build fallback provider from DB credential, with env fallback."""
    from app.services.credential_service import CredentialService

    cred_id = _get_system_setting(db, "career.fallback_credential_id")
    model = _get_system_setting(db, "career.fallback_model")
    
    if cred_id:
        config = CredentialService.resolve_provider_config(db, int(cred_id), model)
        return build_provider(
            config["provider"],
            api_key=config["api_key"],
            base_url=config["base_url"],
        ), config["model"]
    
    # Fallback: legacy env vars
    if not settings.CAREER_AI_FALLBACK_PROVIDER:
        return None, None
    api_key = settings.CAREER_AI_FALLBACK_API_KEY or settings.ANTHROPIC_API_KEY
    provider = build_provider(
        settings.CAREER_AI_FALLBACK_PROVIDER,
        api_key=api_key,
        base_url=settings.CAREER_AI_FALLBACK_BASE_URL,
    )
    return provider, settings.CAREER_AI_FALLBACK_MODEL
```

### 5.3 Career Diagnostics (refactored)

**File:** `app/api/endpoints/career.py`

Replace the two diagnostics endpoints to resolve credentials from DB:

```python
@router.post("/diagnostics/career-provider")
def test_career_provider_connectivity(db, current_user):
    """Test the configured career AI provider — now reads from agent_credentials."""
    cred_id = _get_system_setting(db, "career.credential_id")
    if cred_id:
        config = CredentialService.resolve_provider_config(db, int(cred_id))
        # ... test with config
    else:
        # Legacy env fallback
        # ... existing code
```

The `POST /diagnostics/anthropic` endpoint becomes a generic credential test that accepts a `credential_id` parameter — test any credential, not just Anthropic.

### 5.4 Readiness Check (refactored)

**File:** `app/api/endpoints/career.py` — `get_run_readiness()`

Change the "API key configured" check from:
```python
api_key_ok = bool(_settings.ANTHROPIC_API_KEY)
```
To:
```python
cred_id = _get_system_setting(db, "career.credential_id")
api_key_ok = bool(cred_id) or bool(_settings.CAREER_AI_API_KEY) or bool(_settings.ANTHROPIC_API_KEY)
```

Update the label and detail message accordingly.

### 5.5 RAG Embedding Fallback (refactored)

**File:** `app/services/rag_service.py` — `embed_query()`

Replace the inline pgcrypto SQL with:
```python
from app.services.credential_service import CredentialService

# Fallback: resolve embedding credential from system_settings
cred_id = _get_system_setting(db, "embed.credential_id")
if cred_id:
    api_key = CredentialService.resolve_api_key(db, int(cred_id))
```

**File:** `app/rag/embedding.py` — `embed_text_batch()`

This function currently reads `OPENAI_API_KEY` from env (set at startup by `main.py`). After migration, startup will resolve the embedding credential from DB and the function stays the same — the env var just gets populated from the DB credential instead of `.env`.

### 5.6 Startup Simplification

**File:** `app/main.py` — lifespan startup

Replace the current block that decrypts OpenAI credentials at boot:
```python
# Before: decrypt first OpenAI credential into os.environ['OPENAI_API_KEY']
# After: resolve embed.credential_id from system_settings, decrypt, set env
cred_id = _get_system_setting_from_db(db, "embed.credential_id")
if cred_id:
    api_key = CredentialService.resolve_api_key(db, int(cred_id))
    os.environ['OPENAI_API_KEY'] = api_key
```

### 5.7 Chat Service Cleanup

**File:** `app/services/chat_service.py`

Replace `_decrypt_api_key()` (lines 664-673) with a call to `CredentialService.decrypt_api_key()`.

**File:** `app/services/chat_service_async.py`

Same — replace inline decryption with `CredentialService`.

### 5.8 Agent Endpoints Cleanup

**File:** `app/api/endpoints/agents.py`

Replace `_encrypt_api_key()` (lines 29-37) with `CredentialService.encrypt_api_key()`.

---

## 6. API Changes

### 6.1 Updated Credential Endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST /agents/credentials` | Add `purpose`, `model_default`, `base_url` to create schema |
| `PUT /agents/credentials/{id}` | Allow updating `purpose`, `model_default`, `base_url`, `is_active` |
| `GET /agents/credentials` | Return new fields; add `?purpose=` filter param |
| `POST /agents/credentials/{id}/test` | **New** — test any credential with a ping (replaces career-specific diagnostics) |
| `POST /agents/credentials/{id}/rotate` | **New** — replace API key on an existing credential (currently you must delete and re-create) |

### 6.2 Updated Credential Schemas

```python
class AgentCredentialCreate(AgentCredentialBase):
    api_key: str = Field(..., min_length=1)
    model_default: str | None = None        # NEW
    base_url: str | None = None             # NEW (promoted from extra)
    purpose: list[str] | None = None        # NEW: ["chat", "career_primary", "embedding"]

class AgentCredentialUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    extra: dict | None = None
    model_default: str | None = None        # NEW
    base_url: str | None = None             # NEW
    purpose: list[str] | None = None        # NEW
    is_active: bool | None = None           # NEW

class AgentCredentialRotate(BaseModel):     # NEW
    api_key: str = Field(..., min_length=1)

class AgentCredentialOut(AgentCredentialBase):
    id: int
    model_default: str | None = None        # NEW
    base_url: str | None = None             # NEW
    purpose: list[str] | None = None        # NEW
    is_active: bool                         # NEW
    last_used_at: datetime | None = None    # NEW
    created_at: datetime
    updated_at: datetime
```

### 6.3 Career Settings Endpoints

Use the existing `system_settings` API to configure credential references:

```
PUT /system-settings/career.credential_id          → {"value": "2"}
PUT /system-settings/career.model                  → {"value": "qwen/qwen3-32b"}
PUT /system-settings/career.fallback_credential_id → {"value": "2"}
PUT /system-settings/career.fallback_model         → {"value": "meta-llama/llama-4-scout-17b-16e-instruct"}
PUT /system-settings/embed.credential_id           → {"value": "3"}
```

No new endpoints needed — `system_settings` CRUD already exists.

### 6.4 Deprecate Career-Specific Diagnostics

| Current | After |
|---------|-------|
| `POST /career/diagnostics/anthropic` | **Deprecated** — use `POST /agents/credentials/{id}/test` |
| `POST /career/diagnostics/career-provider` | **Deprecated** — use `POST /agents/credentials/{id}/test` |

Keep the old endpoints during migration (they will read from DB if configured, env otherwise). Remove in a future release.

---

## 7. Frontend Changes (backend-ui)

### 7.1 Agent Credentials Page — Enhancements

**File:** `src/components/agents/` (existing)

Update the credentials management UI:
- Add `Purpose` multi-select chips (career_primary, career_fallback, embedding, chat)
- Add `Default Model` text field
- Add `Base URL` text field
- Add `Active` toggle switch
- Add `Last Used` timestamp column
- Add "Test" button per credential (calls `POST /credentials/{id}/test`)
- Add "Rotate Key" button (calls `POST /credentials/{id}/rotate`)

### 7.2 Career Settings — Credential Picker

**File:** `src/components/career/CareerSettingsPage.js` (new or extend existing)

Add a settings panel where the user can:
1. **Primary AI Provider** — Dropdown of active `agent_credentials` + model text field
2. **Fallback AI Provider** — Same dropdown + model field
3. Save buttons that write to `system_settings` via existing API

This replaces the need to edit `.env` for career AI configuration.

### 7.3 Embedding Settings — Credential Picker

**File:** `src/components/settings/` (existing system settings UI)

Add an "Embeddings" section:
1. **Credential** — Dropdown of active `agent_credentials` filtered to OpenAI-compatible
2. **Model** — Text field (default: `text-embedding-3-small`)
3. **Provider** — Read-only from selected credential

### 7.4 Career Diagnostics Page — Updated

**File:** `src/components/career/CareerDiagnosticsPage.js` (existing)

- Replace "Test Anthropic" button with a credential-aware test (dropdown → pick credential → test)
- Replace "Test Career Provider" with test using the credential from `career.credential_id` system setting
- Show which credential is configured and when it was last used

### 7.5 Navigation

Add a "Career AI Settings" link under the Career section in the sidebar (or as a tab within the existing Career page).

### 7.6 i18n

Add keys to all language files:
- `agents.credential.purpose`, `agents.credential.modelDefault`, `agents.credential.baseUrl`
- `agents.credential.rotate`, `agents.credential.test`, `agents.credential.lastUsed`
- `career.settings.primaryProvider`, `career.settings.fallbackProvider`
- `career.settings.selectCredential`, `career.settings.noCredentialConfigured`

---

## 8. Migration Script

**File:** `scripts/migrate_credentials_to_db.py` (one-time, run manually)

```python
"""
One-time migration: seed agent_credentials from .env values.
Run after the Alembic migration adds the new columns.

Usage:
    cd portfolio-backend && source venv/bin/activate
    python scripts/migrate_credentials_to_db.py
"""

def migrate():
    # 1. Read current .env values
    # 2. For each AI key found, create/update an agent_credential:
    #    - CAREER_AI_API_KEY + CAREER_AI_PROVIDER → credential with purpose=["career_primary"]
    #    - CAREER_AI_FALLBACK_API_KEY → credential with purpose=["career_fallback"]
    #    - ANTHROPIC_API_KEY → credential with purpose=["chat"] (if not already in table)
    #    - OPENAI_API_KEY → credential with purpose=["embedding"] (if not already in table)
    # 3. Set system_settings:
    #    - career.credential_id → newly created credential ID
    #    - career.model → CAREER_AI_MODEL value
    #    - career.fallback_credential_id → fallback credential ID
    #    - career.fallback_model → CAREER_AI_FALLBACK_MODEL value
    #    - embed.credential_id → OpenAI credential ID
    # 4. Print summary of what was created
```

---

## 9. Env Vars After Migration

### Still required in `.env`

| Variable | Why it stays |
|----------|-------------|
| `AGENT_KMS_KEY` | Encryption passphrase for pgcrypto — cannot live in DB (chicken-and-egg) |
| `ENCRYPTION_MASTER_KEY` | Fernet key for PII — unrelated to AI credentials |
| `ENCRYPTION_SALT` | Fernet salt — unrelated |
| `DATABASE_URL` | DB connection — must exist before DB is reachable |
| `CELERY_BROKER_URL` | Redis connection — infrastructure, not a service key |
| `SECRET_KEY` | JWT signing — infrastructure |

### Can be removed from `.env` after migration

| Variable | Replacement |
|----------|-------------|
| `ANTHROPIC_API_KEY` | `agent_credentials` row |
| `CAREER_AI_PROVIDER` | `career.credential_id` system setting → credential.provider |
| `CAREER_AI_MODEL` | `career.model` system setting |
| `CAREER_AI_API_KEY` | `career.credential_id` → credential encrypted key |
| `CAREER_AI_BASE_URL` | `career.credential_id` → credential.base_url |
| `CAREER_AI_FALLBACK_PROVIDER` | `career.fallback_credential_id` → credential.provider |
| `CAREER_AI_FALLBACK_MODEL` | `career.fallback_model` system setting |
| `CAREER_AI_FALLBACK_API_KEY` | `career.fallback_credential_id` → credential encrypted key |
| `CAREER_AI_FALLBACK_BASE_URL` | `career.fallback_credential_id` → credential.base_url |
| `OPENAI_API_KEY` | `embed.credential_id` → credential encrypted key |
| `EMBED_PROVIDER` | `embed.provider` system setting (already supported) |
| `EMBED_MODEL` | `embed.model` system setting (already supported) |

---

## 10. Implementation Order

### Phase 1: Foundation (backend)

| # | Task | Files |
|---|------|-------|
| 1 | Add new columns to `AgentCredential` model | `app/models/agent.py` |
| 2 | Alembic migration | `alembic/versions/xxx_add_credential_columns.py` |
| 3 | Create `CredentialService` | `app/services/credential_service.py` |
| 4 | Update `AgentCredential` schemas (Create, Update, Out, Rotate) | `app/schemas/agent.py` |
| 5 | Update agent credential endpoints (purpose filter, test, rotate) | `app/api/endpoints/agents.py` |

### Phase 2: Consumer migration (backend)

| # | Task | Files |
|---|------|-------|
| 6 | Refactor `chat_service.py` — use `CredentialService` | `app/services/chat_service.py` |
| 7 | Refactor `chat_service_async.py` — use `CredentialService` | `app/services/chat_service_async.py` |
| 8 | Refactor `rag_service.py` — use `CredentialService` | `app/services/rag_service.py` |
| 9 | Refactor career task provider factories — DB-first with env fallback | `app/queue/tasks/career.py` |
| 10 | Refactor career diagnostics — credential-aware | `app/api/endpoints/career.py` |
| 11 | Refactor readiness check — credential-aware | `app/api/endpoints/career.py` |
| 12 | Simplify startup — use `CredentialService` for embed key | `app/main.py` |

### Phase 3: Frontend

| # | Task | Files |
|---|------|-------|
| 13 | Enhance credentials UI (purpose, base_url, model, test, rotate) | `src/components/agents/` |
| 14 | Career AI settings page (credential picker + model) | `src/components/career/CareerSettingsPage.js` |
| 15 | Embedding settings (credential picker) | `src/components/settings/` |
| 16 | Update diagnostics page — credential-aware testing | `src/components/career/CareerDiagnosticsPage.js` |
| 17 | i18n keys for all language files | `src/locales/*` |

### Phase 4: Migration & cleanup

| # | Task | Files |
|---|------|-------|
| 18 | Write one-time migration script | `scripts/migrate_credentials_to_db.py` |
| 19 | Update `.env.example` — document which vars are now optional | `.env.example` |
| 20 | Remove deprecated career-specific diagnostics (or mark deprecated) | `app/api/endpoints/career.py` |
| 21 | Test full flow: credential CRUD → career assessment → embedding → chat | Integration tests |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `AGENT_KMS_KEY` compromise | All API keys decryptable | Same risk as today; key rotation script needed (future enhancement) |
| DB down = no credentials | All AI features fail | Same as today (DB required for all operations anyway); credentials cached in-process after first decrypt |
| Migration script fails | Credentials not seeded | Script is idempotent (uses ON CONFLICT); can be re-run safely |
| Breaking change for existing deployment | VPS stops working | Env fallback in all consumers ensures backward compatibility; no forced migration |
| Celery tasks can't access DB session easily | Provider resolution fails | Career tasks already open sync sessions; `CredentialService` uses sync session |

---

## 12. Future Enhancements

- **Credential key rotation** — Decrypt with old KMS key, re-encrypt with new one (batch script)
- **Per-credential usage tracking** — Token counts and cost per credential (extend Agent usage tracking)
- **Credential sharing across modules** — A single Groq credential usable by career, chat, and future scraper AI
- **Credential health monitoring** — Periodic background checks for expired/revoked keys
- **Multi-tenant credentials** — Per-portfolio credential overrides (different API keys per portfolio)
