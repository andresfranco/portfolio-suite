# Implementation Plan: Job Scraper Module

> **Status:** Draft  
> **Date:** 2026-03-31  
> **Reference project:** `/home/andres/projects/multisite-webscraper`  
> **Scope:** New sub-module inside the existing Career section (backend + admin UI)

---

## 1. Overview

Add a configuration-driven job scraper that lets users define scraping configs for LinkedIn, Indeed, Glassdoor, and other job portals, then run scrape jobs (via Celery) that extract job listings and automatically create `CareerJob` records. The module reuses the universal `ScrapingEngine` pattern from the multisite-webscraper project, adapted to portfolio-suite's architecture (async SQLAlchemy, Alembic migrations, PermissionChecker RBAC, Material-UI admin).

### Goals

1. **Scrape configs** — User-defined CSS/XPath selector configs per job portal (reusable)
2. **Scrape jobs** — Background Celery tasks that execute configs against live sites
3. **Auto-import** — Scraped listings become `CareerJob` rows (with deduplication by URL)
4. **Pre-built templates** — Ship ready-made configs for LinkedIn, Indeed, RemoteOK, and WeWorkRemotely
5. **Admin UI** — Full CRUD for configs, job runner, results browser, and import flow

### Non-goals (out of scope for v1)

- Headless browser / Playwright support (httpx only; add later if JS-rendered sites need it)
- WebSocket real-time progress (use polling on `scrape_job.status` instead)
- Scheduled recurring scrapes via Celery Beat (manual trigger only in v1)
- Auto-detect selector wizard (can be added in v2)
- Public website integration (admin-only feature)

---

## 2. Architecture

```
┌─────────────────── Admin UI (backend-ui) ───────────────────┐
│  ScrapeConfigIndex  ScrapeConfigForm  ScrapeJobsIndex       │
│  ScrapeResultsBrowser  ImportToCareerDialog                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ Axios (careerScraperApi.js)
                           ▼
┌─────────────────── FastAPI Backend ──────────────────────────┐
│  /api/v1/career/scraper/configs      (CRUD)                 │
│  /api/v1/career/scraper/jobs         (run, list, cancel)    │
│  /api/v1/career/scraper/results      (list, import, delete) │
│  /api/v1/career/scraper/templates    (list pre-built)       │
├─────────────────────────────────────────────────────────────┤
│  Endpoint → Service → CRUD → Model                          │
│                ↓                                             │
│  Celery task: execute_scrape_job (async scraping engine)     │
│                ↓                                             │
│  ScrapingEngine (httpx + BeautifulSoup + rate limiting)      │
└─────────────────────────────────────────────────────────────┘
```

### Layer mapping (portfolio-suite conventions)

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Models** | `app/models/scraper.py` | ORM: `ScrapeConfig`, `ScrapeJob`, `ScrapedJobItem` |
| **Schemas** | `app/schemas/scraper.py` | Pydantic: Create/Update/Out for each model |
| **CRUD** | `app/crud/scraper.py` | Database operations (async, `selectinload`) |
| **Service** | `app/services/scraper_service.py` | Orchestration: run job, import results → CareerJob |
| **Engine** | `app/services/scraping/engine.py` | Universal scraping engine (ported from reference) |
| **Fetcher** | `app/services/scraping/fetcher.py` | httpx async page fetcher |
| **Templates** | `app/services/scraping/templates.py` | Pre-built configs for known job portals |
| **Celery task** | `app/queue/tasks/scraper.py` | `execute_scrape_job` background task |
| **Endpoints** | `app/api/endpoints/career_scraper.py` | REST routes under `/career/scraper/` |
| **Frontend** | `backend-ui/src/components/career/scraper/` | React pages & components |
| **API service** | `backend-ui/src/services/careerScraperApi.js` | Axios wrapper |

---

## 3. Database Schema (Alembic migration)

### 3.1 `career_scrape_config`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `Integer PK` | |
| `name` | `String(255)` | Human label, e.g. "LinkedIn Python Jobs" |
| `base_url` | `String(2048)` | Starting URL to scrape |
| `domain` | `String(255)` | Extracted domain, indexed |
| `item_selector` | `String(500)` | CSS/XPath for job card containers |
| `fields` | `JSONB` | Array of `{name, selector, attribute?, transform?, required?}` |
| `pagination_type` | `String(20)` | `none`, `next_link`, `page_param` |
| `pagination_selector` | `String(500)` | CSS selector for next-page link |
| `max_pages` | `Integer` | Default 1 |
| `request_delay_ms` | `Integer` | Default 2000 (be polite) |
| `custom_headers` | `JSONB` | Optional extra headers |
| `is_active` | `Boolean` | Soft-disable |
| `created_at` | `DateTime(tz)` | `server_default=func.now()` |
| `updated_at` | `DateTime(tz)` | `onupdate=func.now()` |
| `created_by` | `Integer` | User ID |
| `updated_by` | `Integer` | User ID |

### 3.2 `career_scrape_job`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `Integer PK` | |
| `config_id` | `FK → career_scrape_config.id` | `SET NULL` on delete |
| `status` | `String(20)` | `pending` / `running` / `completed` / `failed` / `cancelled` |
| `started_at` | `DateTime(tz)` | Nullable |
| `completed_at` | `DateTime(tz)` | Nullable |
| `pages_scraped` | `Integer` | Default 0 |
| `items_found` | `Integer` | Default 0 |
| `items_created` | `Integer` | Default 0 |
| `items_skipped` | `Integer` | Dedup skips |
| `errors` | `Integer` | Default 0 |
| `error_message` | `Text` | Nullable |
| `celery_task_id` | `String(255)` | For cancellation |
| `created_at` | `DateTime(tz)` | |
| `created_by` | `Integer` | |

### 3.3 `career_scraped_item`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `Integer PK` | |
| `job_id` | `FK → career_scrape_job.id` | `CASCADE` |
| `config_id` | `FK → career_scrape_config.id` | `SET NULL` |
| `source_url` | `String(2048)` | Page the item was found on |
| `item_url` | `String(2048)` | Direct link to the job posting (UNIQUE) |
| `data` | `JSONB` | All extracted fields |
| `content_hash` | `String(64)` | SHA-256 for dedup, unique |
| `imported` | `Boolean` | Default `False` — set to `True` after import to CareerJob |
| `career_job_id` | `FK → career_job.id` | `SET NULL` — link after import |
| `created_at` | `DateTime(tz)` | |

**Indexes:**
- `career_scrape_config.domain`
- `career_scrape_job.status`
- `career_scrape_job.config_id`
- `career_scraped_item.content_hash` (unique)
- `career_scraped_item.item_url` (unique)
- `career_scraped_item.job_id`
- `career_scraped_item.imported`

---

## 4. Backend Implementation

### 4.1 Scraping Engine (port from reference)

**Source:** `multisite-webscraper/backend/app/core/scraping/engine.py`  
**Target:** `portfolio-backend/app/services/scraping/engine.py`

Port the `ScrapingEngine` class with these adaptations:

| Reference | Portfolio-suite adaptation |
|-----------|---------------------------|
| `structlog` logging | Use portfolio-suite's `logging` (standard lib) |
| Playwright fetcher | Omit for v1 — httpx only |
| `robots.txt` checker | Port `utils/robots.py` into `app/services/scraping/robots.py` |
| `url_utils.py` | Port `extract_domain()` helper |
| `date_parser.py` | Port multi-format parser |
| lxml XPath support | Keep as optional (import-guarded) |

**Files to create:**
```
app/services/scraping/__init__.py
app/services/scraping/engine.py        — ScrapingEngine class
app/services/scraping/fetcher.py       — fetch_page_http() async
app/services/scraping/robots.py        — is_allowed(), get_crawl_delay()
app/services/scraping/templates.py     — LINKEDIN_CONFIG, INDEED_CONFIG, etc.
app/services/scraping/utils.py         — extract_domain(), parse_date()
```

### 4.2 Pre-built Templates

```python
# app/services/scraping/templates.py

TEMPLATES = {
    "linkedin_jobs": {
        "name": "LinkedIn Jobs Search",
        "base_url": "https://www.linkedin.com/jobs/search/?keywords={query}&location={location}",
        "domain": "linkedin.com",
        "item_selector": "div.base-card",
        "fields": [
            {"name": "title",    "selector": "h3.base-search-card__title",    "transform": "strip"},
            {"name": "company",  "selector": "h4.base-search-card__subtitle", "transform": "strip"},
            {"name": "location", "selector": "span.job-search-card__location","transform": "strip"},
            {"name": "url",      "selector": "a.base-card__full-link",        "attribute": "href", "transform": "to_absolute_url"},
            {"name": "date",     "selector": "time",                          "attribute": "datetime"},
        ],
        "pagination_type": "page_param",
        "max_pages": 5,
        "request_delay_ms": 3000,
    },
    "indeed_jobs": {
        "name": "Indeed Jobs Search",
        "base_url": "https://www.indeed.com/jobs?q={query}&l={location}",
        "domain": "indeed.com",
        "item_selector": "div.job_seen_beacon",
        "fields": [
            {"name": "title",    "selector": "h2.jobTitle span",              "transform": "strip"},
            {"name": "company",  "selector": "span[data-testid='company-name']", "transform": "strip"},
            {"name": "location", "selector": "div[data-testid='text-location']", "transform": "strip"},
            {"name": "url",      "selector": "h2.jobTitle a",                 "attribute": "href", "transform": "to_absolute_url"},
            {"name": "salary",   "selector": "div.salary-snippet-container",  "transform": "strip", "required": false},
        ],
        "pagination_type": "next_link",
        "pagination_selector": "a[data-testid='pagination-page-next']",
        "max_pages": 5,
        "request_delay_ms": 3000,
    },
    "remoteok": {
        "name": "RemoteOK",
        "base_url": "https://remoteok.com/remote-dev-jobs",
        "domain": "remoteok.com",
        "item_selector": "tr.job",
        "fields": [
            {"name": "title",    "selector": "h2[itemprop='title']",          "transform": "strip"},
            {"name": "company",  "selector": "h3[itemprop='name']",           "transform": "strip"},
            {"name": "location", "selector": "div.location",                  "transform": "strip", "required": false},
            {"name": "url",      "selector": "a[itemprop='url']",             "attribute": "href", "transform": "to_absolute_url"},
            {"name": "salary",   "selector": "div.salary",                    "transform": "strip", "required": false},
        ],
        "pagination_type": "none",
        "max_pages": 1,
        "request_delay_ms": 2000,
    },
    "weworkremotely": {
        "name": "We Work Remotely",
        "base_url": "https://weworkremotely.com/categories/remote-programming-jobs",
        "domain": "weworkremotely.com",
        "item_selector": "li.feature",
        "fields": [
            {"name": "title",    "selector": "span.title",                    "transform": "strip"},
            {"name": "company",  "selector": "span.company",                  "transform": "strip"},
            {"name": "location", "selector": "span.region",                   "transform": "strip", "required": false},
            {"name": "url",      "selector": "a",                             "attribute": "href", "transform": "to_absolute_url"},
        ],
        "pagination_type": "none",
        "max_pages": 1,
        "request_delay_ms": 2000,
    },
}
```

> **Note:** LinkedIn's public job search page serves static HTML for the first page of results without authentication. Templates will need periodic selector updates as sites change their markup. Templates are starting points — users can clone and customize.

### 4.3 Scraper Service

**File:** `app/services/scraper_service.py`

```python
async def run_scrape_job(db, config_id, user_id) -> ScrapeJob:
    """Create a ScrapeJob record and dispatch Celery task."""

async def import_scraped_items(db, item_ids: list[int], user_id) -> list[CareerJob]:
    """Convert selected ScrapedJobItems into CareerJob records.
    - Maps: title, company, location, url, is_remote (heuristic from location)
    - Skips items already imported (imported=True)
    - Triggers extract_job_skills Celery task for each created CareerJob
    """

async def import_all_unimported(db, scrape_job_id, user_id) -> list[CareerJob]:
    """Bulk import all un-imported items from a completed scrape job."""
```

### 4.4 Celery Task

**File:** `app/queue/tasks/scraper.py`

```python
@celery_app.task(bind=True, max_retries=0, time_limit=300, soft_time_limit=280)
def execute_scrape_job(self, scrape_job_id: int):
    """
    1. Load ScrapeJob + ScrapeConfig from DB (sync session)
    2. Set status = 'running', celery_task_id = self.request.id
    3. Instantiate ScrapingEngine(config_dict)
    4. Run engine.run() in asyncio event loop
    5. For each returned item:
       a. Compute content_hash
       b. INSERT ScrapedJobItem (skip on hash conflict = dedup)
    6. Update ScrapeJob stats (pages_scraped, items_found, items_created, items_skipped)
    7. Set status = 'completed' (or 'failed' on exception)
    """
```

Register in `app/queue/tasks/__init__.py` alongside the existing career tasks.

### 4.5 API Endpoints

**File:** `app/api/endpoints/career_scraper.py`  
**Router prefix:** `/career/scraper`  
**RBAC:** `MANAGE_CAREER` for mutations, `VIEW_CAREER` for reads

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/configs` | List scrape configs (paginated) |
| `POST` | `/configs` | Create config |
| `GET` | `/configs/{id}` | Get single config |
| `PUT` | `/configs/{id}` | Update config |
| `DELETE` | `/configs/{id}` | Delete config (cascade jobs+items) |
| `POST` | `/configs/{id}/test` | Run 1-page test scrape, return preview items (no DB save) |
| `GET` | `/templates` | List pre-built template configs |
| `POST` | `/templates/{key}/create` | Create a ScrapeConfig from a template |
| `GET` | `/jobs` | List scrape jobs (filter by config_id, status) |
| `POST` | `/jobs` | Start new scrape job from config_id |
| `GET` | `/jobs/{id}` | Get job details + stats |
| `POST` | `/jobs/{id}/cancel` | Cancel running job (revoke Celery task) |
| `GET` | `/results` | List scraped items (filter by job_id, imported, search) |
| `GET` | `/results/{id}` | Get single scraped item |
| `DELETE` | `/results/{id}` | Delete scraped item |
| `POST` | `/results/import` | Import selected items → CareerJob (body: `{item_ids: [...]}`) |
| `POST` | `/results/import-all/{job_id}` | Import all un-imported items from a job |

Register in `app/api/router.py` under the existing career router.

### 4.6 Pydantic Schemas

**File:** `app/schemas/scraper.py`

```python
# ── Field config (nested in ScrapeConfig) ──
class FieldConfig(BaseModel):
    name: str
    selector: str
    attribute: str | None = None
    transform: str | None = None       # strip, parse_date, to_absolute_url, regex:...
    required: bool = True
    default_value: str | None = None

# ── ScrapeConfig ──
class ScrapeConfigCreate(BaseModel):
    name: str
    base_url: HttpUrl
    item_selector: str
    fields: list[FieldConfig]
    pagination_type: Literal["none", "next_link", "page_param"] = "none"
    pagination_selector: str | None = None
    max_pages: int = Field(1, ge=1, le=50)
    request_delay_ms: int = Field(2000, ge=500, le=30000)
    custom_headers: dict | None = None

class ScrapeConfigUpdate(BaseModel):  # all optional
    ...

class ScrapeConfigOut(BaseModel):
    id: int
    name: str
    base_url: str
    domain: str
    item_selector: str
    fields: list[FieldConfig]
    pagination_type: str
    max_pages: int
    request_delay_ms: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

# ── ScrapeJob ──
class ScrapeJobOut(BaseModel):
    id: int
    config_id: int | None
    config_name: str | None           # enriched from relationship
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    pages_scraped: int
    items_found: int
    items_created: int
    items_skipped: int
    errors: int
    error_message: str | None
    created_at: datetime
    model_config = {"from_attributes": True}

# ── ScrapedItem ──
class ScrapedItemOut(BaseModel):
    id: int
    source_url: str
    item_url: str | None
    data: dict                        # {title, company, location, url, salary?, date?}
    imported: bool
    career_job_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}

# ── Import request ──
class ImportItemsRequest(BaseModel):
    item_ids: list[int]

class ImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    career_job_ids: list[int]

# ── Test scrape response ──
class TestScrapeResult(BaseModel):
    items: list[dict]
    pages_scraped: int
    items_found: int
    errors: int
    error_message: str | None = None
```

---

## 5. Frontend Implementation (backend-ui)

### 5.1 New Files

```
src/
  components/career/scraper/
    ScrapeConfigIndex.js          — List/grid of scrape configs + create button
    ScrapeConfigForm.js           — Create/edit config (field builder UI)
    ScrapeConfigDetail.js         — View config, test scrape, run job
    ScrapeJobsIndex.js            — Table of scrape jobs with status badges
    ScrapeJobDetail.js            — Job stats + results preview
    ScrapeResultsBrowser.js       — Filterable table of scraped items
    ImportToCareerDialog.js       — Confirmation dialog for importing items
    TemplateSelector.js           — Pick from pre-built templates
    FieldBuilder.js               — Dynamic form for adding/removing field configs
  services/
    careerScraperApi.js           — Axios wrappers for all /career/scraper/* endpoints
```

### 5.2 Routing (add to App.js)

```jsx
<Route path="/career/scraper/configs"            element={<ScrapeConfigIndex />} />
<Route path="/career/scraper/configs/new"        element={<ScrapeConfigForm />} />
<Route path="/career/scraper/configs/:id"        element={<ScrapeConfigDetail />} />
<Route path="/career/scraper/configs/:id/edit"   element={<ScrapeConfigForm />} />
<Route path="/career/scraper/jobs"               element={<ScrapeJobsIndex />} />
<Route path="/career/scraper/jobs/:id"           element={<ScrapeJobDetail />} />
<Route path="/career/scraper/results"            element={<ScrapeResultsBrowser />} />
```

### 5.3 Navigation

Add a "Job Scraper" sub-item under the existing Career section in the sidebar. Use the `SearchIcon` or `WorkIcon` from MUI.

### 5.4 Key UI Flows

**Flow 1: Create config from template**
1. User clicks "New Config" → TemplateSelector shows available templates
2. User picks "LinkedIn Jobs", enters search query and location
3. Template fields pre-fill the config form (ScrapeConfigForm)
4. User optionally customizes selectors, saves

**Flow 2: Run a scrape**
1. From ScrapeConfigDetail, user clicks "Run Scrape"
2. API creates ScrapeJob → Celery task dispatched
3. UI polls `GET /jobs/{id}` every 5s while status is `pending`/`running`
4. Once `completed`, shows stats and "View Results" button

**Flow 3: Import results to Career Jobs**
1. ScrapeResultsBrowser shows all scraped items from the job
2. User selects items (checkbox) → clicks "Import to Career"
3. ImportToCareerDialog confirms count
4. `POST /results/import` creates CareerJob records
5. Each new CareerJob triggers `extract_job_skills` (existing Celery task)
6. User navigated to CareerIndex to see new jobs

### 5.5 i18n

Add keys to **all** language files under `src/locales/`:
- `career.scraper.configs`, `career.scraper.jobs`, `career.scraper.results`
- `career.scraper.templates.linkedin`, `career.scraper.templates.indeed`, etc.
- Action labels: `career.scraper.runScrape`, `career.scraper.importAll`, `career.scraper.testScrape`

---

## 6. Migration & Permissions

### 6.1 Alembic Migration

Create via: `alembic revision --autogenerate -m "add career scraper tables"`

Tables: `career_scrape_config`, `career_scrape_job`, `career_scraped_item`

### 6.2 RBAC Permissions

No new permissions needed — reuse existing `VIEW_CAREER` and `MANAGE_CAREER`.

---

## 7. Dependencies

### Backend (add to requirements.txt)

```
httpx>=0.27.0           # Async HTTP client (may already be installed)
beautifulsoup4>=4.12.0  # HTML parsing
lxml>=5.0.0             # Optional XPath support
```

> `httpx` may already be a transitive dependency. Check before adding. No new infrastructure (Redis, Celery) needed — already in place.

### Frontend

No new npm packages — MUI + Axios already cover everything needed.

---

## 8. Implementation Order

### Phase 1: Backend Core (est. scope: 8 tasks)

1. **Models** — Create `app/models/scraper.py` with 3 ORM classes
2. **Alembic migration** — Generate and review
3. **Scraping engine** — Port `engine.py`, `fetcher.py`, `robots.py`, `utils.py`
4. **Templates** — Create pre-built config templates
5. **Schemas** — Create Pydantic schemas
6. **CRUD** — Create `app/crud/scraper.py`
7. **Service** — Create `app/services/scraper_service.py` (import logic)
8. **Celery task** — Create `app/queue/tasks/scraper.py`

### Phase 2: API Endpoints (est. scope: 4 tasks)

9. **Config endpoints** — CRUD + test scrape
10. **Template endpoints** — List + create-from-template
11. **Job endpoints** — Start, list, detail, cancel
12. **Results endpoints** — List, detail, delete, import, import-all

### Phase 3: Frontend (est. scope: 7 tasks)

13. **API service** — `careerScraperApi.js`
14. **ScrapeConfigIndex + TemplateSelector**
15. **ScrapeConfigForm + FieldBuilder**
16. **ScrapeConfigDetail** (with test scrape preview)
17. **ScrapeJobsIndex + ScrapeJobDetail**
18. **ScrapeResultsBrowser + ImportToCareerDialog**
19. **Routing, navigation, i18n keys**

### Phase 4: Testing & Polish (est. scope: 3 tasks)

20. **Backend integration tests** — Config CRUD, job execution, import flow (Testcontainers)
21. **Engine unit tests** — Selector extraction, pagination, dedup, rate limiting
22. **Manual E2E validation** — Run against real LinkedIn/Indeed, verify import flow

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Job portal markup changes | Scraper breaks silently | Pre-built templates are starting points; test-scrape endpoint lets users validate before running |
| Rate limiting / IP blocking | Scrapes fail or return captchas | Generous `request_delay_ms` defaults (2-3s), `robots.txt` compliance, max 5 pages |
| LinkedIn blocks unauthenticated scraping | No results | LinkedIn public search works for first ~25 results; document limitation; add cookie-auth option in v2 |
| Large result sets fill DB | Storage growth | `max_pages` cap (50), periodic cleanup of old scrape jobs |
| Celery worker overload | Slow career AI tasks | Scrape tasks use same queue but have independent time limits; consider dedicated queue in v2 |

---

## 10. Future Enhancements (v2+)

- **Playwright support** — JS-rendered pages (LinkedIn authenticated, Glassdoor)
- **Scheduled scrapes** — Celery Beat cron schedules per config
- **Auto-detect wizard** — Heuristic selector detection (port `auto_detect.py`)
- **WebSocket progress** — Real-time scrape progress via Redis pub/sub
- **Duplicate detection** — Cross-reference scraped items with existing CareerJobs by title+company
- **Salary parsing** — Extract min/max/currency from salary strings
- **Notification** — Email/Slack when new jobs matching criteria are found
- **Export** — CSV/Excel export of scraped results
