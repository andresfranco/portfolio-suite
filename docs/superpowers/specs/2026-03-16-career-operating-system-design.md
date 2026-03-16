# Career Operating System — Design Spec

**Date:** 2026-03-16
**Status:** Approved
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
| `portfolio_id` | FK → Portfolio | |
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

### `career_job_skill`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `job_id` | FK → career_job | |
| `skill_id` | FK → skills (existing) | |
| `years_required` | Integer, nullable | |
| `is_required` | Boolean | default true |

AI-extracted on job creation; user-editable afterward via the Job Detail page.

### `career_objective_job` (M2M association)
| Field | Type |
|---|---|
| `objective_id` | FK → career_objective |
| `job_id` | FK → career_job |
| `added_at` | DateTime |

### `career_assessment_run`
| Field | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `objective_id` | FK → career_objective | |
| `portfolio_id` | FK → Portfolio | snapshot at run time |
| `resume_attachment_id` | FK → PortfolioAttachment, nullable | which resume was evaluated |
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

### `career_assessment_run_job` (M2M: run snapshot ↔ jobs)
| Field | Type |
|---|---|
| `run_id` | FK → career_assessment_run |
| `job_id` | FK → career_job |

---

## API Layer

All routes under `/api/v1/career/`. New RBAC permissions: `VIEW_CAREER`, `MANAGE_CAREER`.

### Jobs — `/api/v1/career/jobs`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create job → triggers async Haiku skill extraction |
| `GET` | `/` | List jobs (paginated, filter by status/company) |
| `GET` | `/{job_id}` | Get job with required skills |
| `PUT` | `/{job_id}` | Update job fields |
| `DELETE` | `/{job_id}` | Delete job |
| `POST` | `/{job_id}/extract-skills` | Re-run AI skill extraction on existing JD |
| `PUT` | `/{job_id}/skills` | Replace required skills list (manual override) |

### Objectives — `/api/v1/career/objectives`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create objective (default name: "Career Growth") |
| `GET` | `/` | List objectives (with portfolio + run counts) |
| `GET` | `/{objective_id}` | Get objective with linked jobs + run list |
| `PUT` | `/{objective_id}` | Update objective |
| `DELETE` | `/{objective_id}` | Delete objective |
| `POST` | `/{objective_id}/jobs/{job_id}` | Link job to objective |
| `DELETE` | `/{objective_id}/jobs/{job_id}` | Unlink job from objective |

### Assessment Runs — `/api/v1/career/objectives/{objective_id}/runs`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create run: computes rule-based sections sync, queues AI sections |
| `GET` | `/` | List runs for objective (newest first) |
| `GET` | `/{run_id}` | Get full run (all sections; AI sections may be pending) |

### Section Endpoints (progressive loading)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/career/runs/{run_id}/scorecard` | Rule-based, always complete |
| `GET` | `/api/v1/career/runs/{run_id}/job-fit` | Rule-based, always complete |
| `GET` | `/api/v1/career/runs/{run_id}/resume-issues` | AI; returns `{status: "pending"}` until complete |
| `GET` | `/api/v1/career/runs/{run_id}/action-plan` | AI; returns `{status: "pending"}` until complete |

---

## Analysis Engine

### Rule-Based Sections (synchronous, no API cost)

**Skill Scorecard** — computed from portfolio's linked projects and experiences:

Level scale (0–5):
- 0: No evidence (skill absent from all portfolio projects)
- 1: Mentioned in 1 project
- 2: Appears in 2 projects
- 3: 3+ projects or appears in experiences
- 4: 3+ projects AND experience years ≥ 3
- 5: 4+ projects AND experience years ≥ 5

Priority assignment:
- CRITICAL: level = 0 and `is_required = true`
- HIGH: level ≤ 1
- MEDIUM: level ≤ 3
- LOW: level = 4+

Evidence text: list of project names where skill appears.
Gap text: computed from level delta (e.g. "Required level 4, found level 2 across 2 projects").

**Job Fit %** — per job and overall:
- Match rate: `matched_skills / total_required_skills × 100`
- Weighting: `is_required = true` skills count 2×, optional skills count 1×
- Verdict thresholds: ≥ 60% → BEST FIT, 40–59% → STRETCH, < 40% → ASPIRATIONAL
- Overall readiness: average fit % across all jobs in the run

### AI Sections (Celery task, single Haiku call per run)

**Model:** `claude-haiku-4-5` — fastest, cheapest Anthropic model; suitable for structured summarisation tasks.
**Estimated cost per run:** ~$0.002–0.005 depending on JD length.

**Input context sent to Haiku:**
- Portfolio summary: name, linked project names + their skills
- Experience records: name + years
- Resume attachment filename (as a presence signal; PDF parsing is out of scope v1)
- All job titles + descriptions + required skills for jobs in the run
- Computed scorecard output (Haiku reasons on top of rule-based evidence)
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

- New `CareerContext.js` for objectives and jobs CRUD state
- Assessment run data fetched directly in `AssessmentRunPage.js` with local state
- Custom `useAssessmentRun` hook: polls AI sections every 3s until `ai_status = complete` or `failed`
- Rule-based sections (scorecard, job-fit) render immediately from run creation response

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

One migration file covering all five new tables:
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
