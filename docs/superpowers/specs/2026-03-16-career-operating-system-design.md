# Career Operating System — Design Spec

**Date:** 2026-03-16
**Status:** Approved (v2 — post spec-review fixes)
**Approach:** Hybrid analysis engine (rule-based + AI) with progressive section loading

---

## Overview

A Career Operating System (Career OS) module embedded in `backend-ui`. It measures how compatible a portfolio is against a set of target jobs, tracks career objectives over time, and produces actionable assessments combining instant rule-based analysis with AI-generated narrative sections.

The prototype file `career_assessment.jsx` defines the visual reference for the assessment dashboard. All UI components follow the existing MUI v6 theme used throughout `backend-ui`.

---

## Architecture Summary

```
Portfolio ──< CareerObjective ──< AssessmentRun
CareerJob >──< CareerObjective  (M2M via objective_job)
CareerJob ──< CareerJobSkill >── Skill (existing)
AssessmentRun >──< CareerJob   (M2M via run_job — snapshot)
AssessmentRun >── PortfolioAttachment (resume evaluated)
```

Assessment runs use **Approach C — progressive sectioned loading**:
- Rule-based sections (scorecard, job fit) computed synchronously on run creation → available immediately
- AI sections (resume issues, action plan) queued as a Celery task → frontend polls until complete
- All sections stored as JSONB snapshots; runs are immutable after completion

---

## Data Models

### `career_objective`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `portfolio_id` | FK → Portfolio, `ON DELETE CASCADE` | |
| `name` | String | Default: "Career Growth" |
| `description` | Text, nullable | |
| `status` | String | `active` / `archived` |
| `created_at` | DateTime | server default |
| `updated_at` | DateTime | auto-update |
| `created_by` | Integer | user ID |
| `updated_by` | Integer | user ID |

### `career_job`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `title` | String | |
| `company` | String | |
| `salary_min` | Integer, nullable | |
| `salary_max` | Integer, nullable | |
| `currency` | String | default `USD` |
| `location` | String, nullable | |
| `is_remote` | Boolean | default false |
| `url` | String, nullable | |
| `description` | Text, nullable | Full JD text; used for AI skill extraction |
| `status` | String | `saved` / `applied` / `interviewing` / `offer` / `rejected` |
| `notes` | Text, nullable | |
| `created_at` | DateTime | server default |
| `updated_at` | DateTime | auto-update |
| `created_by` | Integer | user ID |
| `updated_by` | Integer | user ID |

Jobs are global (not owned by an objective) — one job can appear in multiple objectives.
**Ownership:** only the `created_by` user or a user with `MANAGE_CAREER` may edit or delete a job.
**Cascade:** deleting a job cascades to `career_job_skill` and `career_objective_job` rows. `career_assessment_run_job` rows for that job are also deleted (the run snapshot retains its JSONB data independently).

### `career_job_skill`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `job_id` | FK → career_job, `ON DELETE CASCADE` | |
| `skill_id` | FK → skills (existing), `ON DELETE CASCADE` | |
| `years_required` | Integer, nullable | |
| `is_required` | Boolean | default true |

AI-extracted on job creation; user-editable afterward via the Job Detail page.

### `career_objective_job` (M2M association)
| Field | Type | Notes |
|---|---|---|
| `objective_id` | FK → career_objective, `ON DELETE CASCADE` | composite PK |
| `job_id` | FK → career_job, `ON DELETE CASCADE` | composite PK |
| `added_at` | DateTime | |

**Primary key:** `(objective_id, job_id)`

### `career_assessment_run`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `objective_id` | FK → career_objective, `ON DELETE CASCADE` | |
| `portfolio_id` | FK → Portfolio, `ON DELETE CASCADE` | snapshot at run time |
| `resume_attachment_id` | FK → PortfolioAttachment, `ON DELETE SET NULL`, nullable | which resume was evaluated |
| `name` | String, nullable | optional user label |
| `scorecard_json` | JSONB | rule-based; populated synchronously |
| `job_fit_json` | JSONB | rule-based; populated synchronously |
| `resume_issues_json` | JSONB, nullable | AI; populated by Celery task |
| `action_plan_json` | JSONB, nullable | AI; populated by Celery task |
| `ai_status` | String | `pending` / `running` / `complete` / `failed` |
| `ai_task_id` | String, nullable | Celery task ID for status polling |
| `created_at` | DateTime | server default |
| `created_by` | Integer | user ID |

Runs are immutable after completion — never updated, only created and read.
Deletion of completed assessment runs is not supported in v1.

### `career_assessment_run_job` (M2M: run snapshot ↔ jobs)
| Field | Type | Notes |
|---|---|---|
| `run_id` | FK → career_assessment_run, `ON DELETE CASCADE` | composite PK |
| `job_id` | FK → career_job, `ON DELETE CASCADE` | composite PK |

**Primary key:** `(run_id, job_id)`

---

## API Layer

All routes under `/api/v1/career/`. New RBAC permissions: `VIEW_CAREER`, `MANAGE_CAREER`.

**Authorization scoping:** All objective and run endpoints verify that the requesting user is the `created_by` owner of the objective's associated portfolio, or holds `MANAGE_CAREER`. All job mutation endpoints (PUT, DELETE) verify that the requesting user is the `created_by` owner of the job, or holds `MANAGE_CAREER`.

### Jobs — `/api/v1/career/jobs`

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/` | `MANAGE_CAREER` | Create job → triggers async Haiku skill extraction |
| `GET` | `/` | `VIEW_CAREER` | List jobs (paginated, filter by status/company) |
| `GET` | `/{job_id}` | `VIEW_CAREER` | Get job with required skills |
| `PUT` | `/{job_id}` | `MANAGE_CAREER` + ownership | Update job fields |
| `DELETE` | `/{job_id}` | `MANAGE_CAREER` + ownership | Delete job |
| `POST` | `/{job_id}/extract-skills` | `MANAGE_CAREER` + ownership | Re-run AI skill extraction on existing JD |
| `PUT` | `/{job_id}/skills` | `MANAGE_CAREER` + ownership | Replace required skills list (manual override) |

### Objectives — `/api/v1/career/objectives`

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/` | `MANAGE_CAREER` | Create objective (default name: "Career Growth") |
| `GET` | `/` | `VIEW_CAREER` | List objectives (with portfolio + run counts) |
| `GET` | `/{objective_id}` | `VIEW_CAREER` + ownership | Get objective with linked jobs + run list |
| `PUT` | `/{objective_id}` | `MANAGE_CAREER` + ownership | Update objective |
| `DELETE` | `/{objective_id}` | `MANAGE_CAREER` + ownership | Delete objective |
| `POST` | `/{objective_id}/jobs/{job_id}` | `MANAGE_CAREER` + ownership | Link job to objective |
| `DELETE` | `/{objective_id}/jobs/{job_id}` | `MANAGE_CAREER` + ownership | Unlink job from objective |

### Assessment Runs — `/api/v1/career/objectives/{objective_id}/runs`

| Method | Path | Permission | Description |
|---|---|---|---|
| `POST` | `/` | `MANAGE_CAREER` + ownership | Create run: computes rule-based sections sync, queues AI sections |
| `GET` | `/` | `VIEW_CAREER` + ownership | List runs for objective (newest first) |
| `GET` | `/{run_id}` | `VIEW_CAREER` + ownership | Get full run (all sections; AI sections may be pending) |

### Flat Run Endpoints (progressive loading)

| Method | Path | Permission | Notes |
|---|---|---|---|
| `GET` | `/api/v1/career/runs/{run_id}` | `VIEW_CAREER` + ownership | Get full run — same as nested endpoint above |
| `GET` | `/api/v1/career/runs/{run_id}/scorecard` | `VIEW_CAREER` + ownership | Rule-based, always complete |
| `GET` | `/api/v1/career/runs/{run_id}/job-fit` | `VIEW_CAREER` + ownership | Rule-based, always complete |
| `GET` | `/api/v1/career/runs/{run_id}/resume-issues` | `VIEW_CAREER` + ownership | AI; returns `{"status": "pending"}` until complete |
| `GET` | `/api/v1/career/runs/{run_id}/action-plan` | `VIEW_CAREER` + ownership | AI; returns `{"status": "pending"}` until complete |

Section endpoints authorize by `run_id` only (no `objective_id` in the URL). Ownership is verified by tracing `run → objective → portfolio → created_by`.

---

## Pydantic Schemas

### Job schemas
```python
class CareerJobCreate(BaseModel):
    title: str
    company: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: str = "USD"
    location: Optional[str] = None
    is_remote: bool = False
    url: Optional[str] = None
    description: Optional[str] = None
    status: str = "saved"
    notes: Optional[str] = None

class CareerJobSkillItem(BaseModel):
    skill_id: int
    years_required: Optional[int] = None
    is_required: bool = True

class CareerJobSkillsUpdate(BaseModel):
    skills: List[CareerJobSkillItem]
```

### Objective schemas
```python
class CareerObjectiveCreate(BaseModel):
    portfolio_id: int
    name: str = "Career Growth"
    description: Optional[str] = None
    status: str = "active"
```

### Run schemas
```python
class AssessmentRunCreate(BaseModel):
    job_ids: List[int]                       # jobs from this objective to include
    resume_attachment_id: Optional[int] = None
    name: Optional[str] = None

class AssessmentRunOut(BaseModel):
    id: int
    objective_id: int
    portfolio_id: int
    resume_attachment_id: Optional[int]
    name: Optional[str]
    scorecard_json: Optional[dict]
    job_fit_json: Optional[dict]
    resume_issues_json: Optional[dict]
    action_plan_json: Optional[dict]
    ai_status: str
    created_at: datetime
    created_by: int
```

---

## Analysis Engine

### Rule-Based Sections (synchronous, no API cost)

**Skill Scorecard** — computed from portfolio's linked projects only (skills are attached to projects via the existing `project_skills` table):

Level scale (0–5) — evaluated top-to-bottom, first match wins:
1. level = 5: skill appears in 4+ projects AND total `Experience.years` across portfolio experiences ≥ 5
2. level = 4: skill appears in 3+ projects AND total `Experience.years` ≥ 3
3. level = 3: skill appears in 3+ projects (regardless of experience years)
4. level = 2: skill appears in exactly 2 projects
5. level = 1: skill appears in exactly 1 project
6. level = 0: skill not found in any portfolio project

Note: `Experience.years` is used as a career-depth proxy (sum of all experience years linked to the portfolio). It is not skill-specific; it amplifies project evidence at higher levels only.

Priority assignment — evaluated top-to-bottom, first match wins:
1. CRITICAL: `level = 0` AND `is_required = true`
2. HIGH: `level = 0` (not required) OR `level = 1`
3. MEDIUM: `level = 2` OR `level = 3`
4. LOW: `level ≥ 4`

Evidence text: comma-separated list of project names where skill appears (empty string if level = 0).
Gap text: `"Required but not found in any project"` (level 0) or `"Found in N project(s); target level for this role is 4+"` (levels 1–3).

**Job Fit %** — per job and overall:

Single unambiguous formula:
```
fit_score = (2 × matched_required + matched_optional) / (2 × total_required + total_optional) × 100
```
where "matched" = skill level > 0 (any evidence found).

Verdict thresholds: ≥ 60% → BEST FIT, 40–59% → STRETCH, < 40% → ASPIRATIONAL

Overall readiness %: simple average of per-job fit scores across all jobs in the run.

Edge cases:
- Portfolio with no projects: all skill levels = 0; all job fits = 0%; ai_status proceeds normally
- Job with no required skills: fit = 100% (no requirements = no gaps); scorecard section is empty for that job
- Objective with no jobs linked at run creation: run creation returns 400 Bad Request

### AI Sections (Celery task, single Haiku call per run)

**Model:** `claude-haiku-4-5-20251001` — fastest, cheapest Anthropic model; suitable for structured summarisation tasks.
**Estimated cost per run:** ~$0.002–0.005 depending on JD length.

**Celery task specification:**
- Task name: `app.queue.tasks.career.run_career_ai_assessment`
- `task_time_limit`: 60 seconds (hard kill after 60s)
- `task_soft_time_limit`: 50 seconds (raises `SoftTimeLimitExceeded` for graceful handling)
- Retry policy: **no retries** (`max_retries=0`) — AI calls fail immediately to avoid duplicate API charges
- The task **must** write `ai_status = "failed"` in a `finally` block if any exception occurs, ensuring the frontend polling loop terminates

**Input context sent to Haiku:**
- Portfolio summary: name, linked project names + their skills
- Experience records: name + years
- Resume attachment filename (as a presence signal; PDF parsing is out of scope v1)
- All job titles + descriptions + required skills for jobs in the run
- Computed scorecard output from rule-based engine
- Objective name

**Output schema (strict JSON, no free text):**
```json
{
  "resume_issues": [
    { "issue": "string", "impact": "CRITICAL|HIGH|MEDIUM|LOW", "fix": "string" }
  ],
  "action_plan": [
    { "week_range": "string", "focus": "string", "tasks": ["string"], "hours": "string" }
  ]
}
```

Haiku is instructed to:
1. Identify resume issues based on skill gaps and missing evidence surfaced by the scorecard
2. Generate a 12-week prioritised action plan with CRITICAL/HIGH gaps addressed first
3. Return only valid JSON matching the above schema

---

## Frontend Structure

### New Routes (added to `App.js`)

```
/career                              → CareerIndex
/career/jobs                         → JobIndex
/career/jobs/:jobId                  → JobDetailPage
/career/objectives/:objectiveId      → ObjectiveDetailPage
/career/runs/:runId                  → AssessmentRunPage
```

### Component Tree

```
src/components/career/
  CareerIndex.js              — Objective list with "New Objective" action
  ObjectiveForm.js            — Create/edit: name, description, portfolio selector, status
  ObjectiveDetailPage.js      — 3-tab page
    Tab 1: Overview           — Name, description, portfolio, status, "Run Assessment" button
    Tab 2: Jobs               — Link/unlink jobs; shows fit % badge per job
    Tab 3: Runs               — List of past runs (newest first); click to open
  JobIndex.js                 — Paginated table: title, company, salary, status, # objectives
  JobForm.js                  — Create/edit: fields + JD textarea + "Extract Skills" button
  JobDetailPage.js            — 2-tab page
    Tab 1: Overview           — Job fields, status, notes
    Tab 2: Required Skills    — Editable skill tags (AI-extracted; user can add/remove)
  AssessmentRunPage.js        — 5-tab dashboard (mirrors career_assessment.jsx prototype)
    Tab 1: Overview           — Readiness %, feasibility alert, key stats, top bottlenecks
    Tab 2: Skills Scorecard   — Skill bars + evidence + gap (rule-based, loads instantly)
    Tab 3: Job Fit Analysis   — Per-job fit cards with strengths/gaps (rule-based, loads instantly)
    Tab 4: Resume Issues      — Issue list with fix suggestions (AI; skeleton while pending)
    Tab 5: Action Plan        — 12-week plan + AI tool strategy (AI; skeleton while pending)
```

### State Management

**`CareerContext.js` state shape:**
```js
{
  objectives: [],          // paginated list of objectives
  jobs: [],                // paginated list of jobs
  totalObjectives: 0,
  totalJobs: 0,
  loading: false,
  error: null,
  // methods: fetchObjectives, createObjective, updateObjective, deleteObjective,
  //          fetchJobs, createJob, updateJob, deleteJob,
  //          linkJob, unlinkJob
}
```
Context pre-fetches objectives and jobs on mount. Assessment run data is NOT stored in context — fetched locally in `AssessmentRunPage.js`.

**`useAssessmentRun` hook:**
- Fetches full run on mount
- Polls `/api/v1/career/runs/{run_id}/resume-issues` and `/action-plan` every 3s while `ai_status = "pending"` or `"running"`
- Stops polling when `ai_status = "complete"` or `"failed"`
- **Maximum poll duration:** 5 minutes — after timeout, displays an error state to the user without further polling

### Authorization — `AuthorizationContext.js` updates required

`MODULE_PERMISSIONS` must be extended:
```js
'career': ['VIEW_CAREER', 'MANAGE_CAREER']
```

`managePermissions` must be extended:
```js
'MANAGE_CAREER': ['VIEW_CAREER', 'MANAGE_CAREER']
```

This ensures `canAccessModule('career')` works and that a user with only `MANAGE_CAREER` can also pass `hasPermission('VIEW_CAREER')` checks.

### Theme & Design Consistency

- Uses MUI v6 throughout — no custom dark theme
- Priority levels map to MUI severity: CRITICAL → `error`, HIGH → `warning`, MEDIUM → `info`, LOW → `success`
- Skill level bars implemented as MUI `LinearProgress` with color-coded values
- Fit verdict badges use MUI `Chip` with severity colors
- Skeleton loaders (`MUI Skeleton`) for AI sections while `ai_status = pending`
- Dashboard stats use MUI `Card` grid matching existing admin UI card style
- Career OS added to existing sidebar navigation under a "Career" section
- Dashboard gets a new card linking to `/career`

### i18n

- All new string keys added to all supported language files simultaneously
- Follows existing `LanguageContext` pattern

---

## Alembic Migration

One migration file covering all six new tables:
- `career_objective`
- `career_job`
- `career_job_skill`
- `career_objective_job`
- `career_assessment_run`
- `career_assessment_run_job`

New RBAC permissions inserted: `VIEW_CAREER`, `MANAGE_CAREER`.

---

## Out of Scope (v1)

- PDF parsing of resume attachment (filename used as presence signal only)
- Real-time streaming of AI output (Celery task + polling is sufficient)
- Public website exposure of Career OS data
- Email/notification when AI sections complete
- Deletion of completed assessment runs
- Experience-level skill tagging (skills are project-linked only in v1)
