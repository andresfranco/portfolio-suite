# Career Operating System — User Guide

The Career OS helps you track job opportunities, map them against your portfolio, and generate an AI-powered readiness assessment that scores your skill gaps and produces a personalised action plan.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites & Permissions](#prerequisites--permissions)
3. [Concepts](#concepts)
4. [Step-by-Step Workflow](#step-by-step-workflow)
   - [Step 1 — Add Jobs](#step-1--add-jobs)
   - [Step 2 — Tag Skills on Each Job](#step-2--tag-skills-on-each-job)
   - [Step 3 — Create a Career Objective](#step-3--create-a-career-objective)
   - [Step 4 — Link Jobs to the Objective](#step-4--link-jobs-to-the-objective)
   - [Step 5 — Run an Assessment](#step-5--run-an-assessment)
   - [Step 6 — Read the Results](#step-6--read-the-results)
5. [Assessment Results Reference](#assessment-results-reference)
   - [Skill Level Scale](#skill-level-scale)
   - [Priority Labels](#priority-labels)
   - [Job Fit Verdicts](#job-fit-verdicts)
   - [Readiness Score](#readiness-score)
6. [Managing Jobs](#managing-jobs)
7. [Managing Objectives](#managing-objectives)
8. [AI Sections: Resume Issues & Action Plan](#ai-sections-resume-issues--action-plan)
9. [API Quick Reference](#api-quick-reference)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Career OS has three main building blocks:

| Concept | What it is |
|---------|------------|
| **Job** | A role you are targeting. Contains the job description and required skills. |
| **Career Objective** | A named goal (e.g. "Senior Backend Engineer roles") that groups related jobs under one portfolio. |
| **Assessment Run** | A snapshot analysis of your portfolio against a set of jobs. Produces a scorecard, job-fit scores, resume issues, and a 12-week action plan. |

A job can belong to multiple objectives, and an objective can have many assessment runs over time.

---

## Prerequisites & Permissions

- Your account needs the **`VIEW_CAREER`** permission to access all Career OS features.
- You can only edit or delete records you created. System Admins can modify any record.
- The portfolio you link to an objective must already exist in the system with projects and experiences populated — the scoring engine reads those to evaluate your skills.
- The AI sections (Resume Issues, Action Plan) require a valid `ANTHROPIC_API_KEY` configured in the backend environment. Contact your admin if those tabs always show a failure state.

---

## Concepts

### How scoring works

When you create an assessment run, the system immediately computes two sections using pure rule-based logic (no AI, no waiting):

1. **Skills Scorecard** — Every skill required by the selected jobs is evaluated against your portfolio projects.
2. **Job Fit Analysis** — Each job gets a fit score based on how well your skills match its requirements.

Then, in the background, an AI task (Claude Haiku) generates:

3. **Resume Issues** — Specific gaps the AI identifies between your profile and the job descriptions.
4. **Action Plan** — A prioritised 12-week learning plan addressing your highest-priority gaps.

---

## Step-by-Step Workflow

### Step 1 — Add Jobs

Navigate to **Career → Jobs** and click **New Job**.

Fill in the form:

| Field | Notes |
|-------|-------|
| **Title** *(required)* | Role title exactly as posted |
| **Company** *(required)* | Employer name |
| **Description** | Paste the full job description — the AI uses this text to write resume issues and the action plan |
| **Status** | `saved` → `applied` → `interviewing` → `offer` / `rejected` |
| Salary range | Optional; used for your reference only |
| Location / Remote | Optional |
| URL | Link to the original posting |

Click **Save**. The job is now in your library.

### Step 2 — Tag Skills on Each Job

The skills scorecard is only as good as the skills you attach to each job.

1. Open a job (from the Jobs list or from an Objective's Jobs tab).
2. Go to the **Required Skills** tab.
3. Click **Edit Skills** to open the skill-search dialog.
4. Search for each skill, toggle it on/off, and save.

For each skill you can also mark whether it is **Required** or **Optional** and set the **years required**. Required skills are weighted twice as heavily in the fit score formula.

> **Tip:** Add at least the 5–8 most important skills from the job description for a meaningful scorecard.

### Step 3 — Create a Career Objective

Navigate to **Career → Objectives** and click **New Objective**.

| Field | Notes |
|-------|-------|
| **Name** *(required)* | e.g. "Senior Backend Engineer — 2026 Q2" |
| **Portfolio** *(required)* | The portfolio whose projects and experiences the scoring engine will read |
| Description | Free text — your notes on this goal |
| Status | `active` or `archived` |

### Step 4 — Link Jobs to the Objective

Open the objective and go to the **Jobs** tab.

- Click **Add Job** to search and link existing jobs from your library.
- Use the trash icon to remove a job from this objective (it stays in your job library).
- A job can be linked to multiple objectives simultaneously.

### Step 5 — Run an Assessment

From the objective's **Overview** tab, click **Run Assessment**.

In the dialog:

1. **Select jobs** — all linked jobs are pre-checked; uncheck any you want to exclude.
2. **Run Name** (optional) — a label for this snapshot (e.g. "After completing AWS cert").
3. Click **Run**.

The system immediately creates the run and redirects you to the Assessment Run page. The Skills Scorecard and Job Fit tabs are populated within seconds. The Resume Issues and Action Plan tabs show a loading indicator while the AI processes in the background (typically 10–30 seconds).

### Step 6 — Read the Results

The Assessment Run page has five tabs:

| Tab | Contents | Available |
|-----|----------|-----------|
| **Overview** | Readiness %, verdict, stats grid, top bottlenecks | Immediately |
| **Skills Scorecard** | Per-skill level, priority, evidence, gap description | Immediately |
| **Job Fit Analysis** | Per-job fit score and verdict with skill breakdown | Immediately |
| **Resume Issues** | AI-identified gaps with impact rating and fix suggestion | After AI completes |
| **Action Plan** | AI-generated 12-week prioritised plan | After AI completes |

---

## Assessment Results Reference

### Skill Level Scale

Levels are computed from how many of your portfolio **projects** include the skill and your total **years of experience**:

| Level | Criteria | What it means |
|-------|----------|----------------|
| **5** | 4+ projects AND 5+ years experience | Expert |
| **4** | 3+ projects AND 3+ years experience | Proficient |
| **3** | 3+ projects (any experience) | Competent |
| **2** | 2 projects | Developing |
| **1** | 1 project | Beginner |
| **0** | No projects | Not demonstrated |

> The scoring engine counts projects linked to your selected portfolio that include the skill — it does **not** look at unlinked projects or other portfolios.

### Priority Labels

Each skill in the scorecard gets a priority label that drives the AI action plan ordering:

| Priority | Condition | Colour |
|----------|-----------|--------|
| **CRITICAL** | Level 0 + skill is **required** | Red |
| **HIGH** | Level 0 (optional) or Level 1 (any) | Orange |
| **MEDIUM** | Level 2 or 3 | Blue |
| **LOW** | Level 4 or 5 | Green |

### Job Fit Verdicts

Each job gets a **fit score** computed as:

```
fit_score = (2 × matched_required + matched_optional)
            ─────────────────────────────────────────── × 100
            (2 × total_required   + total_optional)
```

Where "matched" means the skill has at least one project (level > 0).

| Verdict | Fit Score | Alert colour |
|---------|-----------|--------------|
| **BEST FIT** | ≥ 60% | Info (blue) |
| **STRETCH** | 40–59% | Warning (amber) |
| **ASPIRATIONAL** | < 40% | Error (red) |

### Readiness Score

The **Overall Readiness** shown on the Overview tab is the simple average of fit scores across all jobs in the run:

```
readiness = average(fit_score per job)
```

Color coding: **green** ≥ 60%, **amber** 40–59%, **red** < 40%.

---

## Managing Jobs

### Editing a job

Open the job from **Career → Jobs** → click the job title. Use the **Edit** button in the Overview tab to update any field. Skills are managed separately in the Required Skills tab.

### Changing job status

Update the **Status** field as you progress through the application pipeline:

`saved` → `applied` → `interviewing` → `offer` or `rejected`

The Jobs list supports filtering by status and company name.

### Deleting a job

Delete from the job detail page. This removes the job from all linked objectives. Assessment runs that included the job retain their snapshot data — historical runs are immutable.

---

## Managing Objectives

### Archiving vs. deleting

Set status to **archived** to hide the objective from active views while keeping its history. Delete only when you want to permanently remove all associated runs.

### Multiple runs over time

Run a new assessment after adding projects, earning certifications, or gaining new experience. Each run is an independent snapshot — you can compare readiness scores across runs to track progress using the **Runs** tab on the objective detail page.

---

## AI Sections: Resume Issues & Action Plan

### What the AI analyses

The AI receives:
- Your portfolio name, project list (with skills), and experience history
- The objective name
- Job titles, descriptions, and required skills for each selected job
- The computed scorecard (so it can focus on real gaps)

### Timing and polling

The UI polls for the AI result every 3 seconds. It stops when `ai_status` becomes `complete` or `failed`. After **5 minutes** the polling stops and shows a warning — the result may still arrive; refresh the page to check.

### Resume Issues

Each issue has:
- **Issue** — a description of the gap or weakness
- **Impact** — CRITICAL / HIGH / MEDIUM / LOW
- **Fix** — a concrete suggestion to address it

Issues are displayed as expandable accordion rows, sorted by impact.

### Action Plan

A 12-week prioritised learning plan. Each phase has:
- **Week range** — e.g. "1–2"
- **Focus** — the theme for that period
- **Tasks** — specific steps to complete
- **Hours** — estimated weekly time commitment

CRITICAL and HIGH gaps are addressed first.

### If the AI fails

The Resume Issues and Action Plan tabs show a red error alert. Common causes:
- `ANTHROPIC_API_KEY` not set in the backend environment
- API timeout (the task has a 60-second hard limit)
- Malformed JSON returned by the model

Re-running a fresh assessment is the easiest recovery path.

---

## API Quick Reference

All endpoints are under `/api/v1/career/` and require the `VIEW_CAREER` permission (JWT cookie or Bearer token).

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/career/jobs` | Create a job |
| `GET` | `/career/jobs` | List jobs (`?status=saved&company=Acme&limit=50&offset=0`) |
| `GET` | `/career/jobs/{id}` | Get a job |
| `PUT` | `/career/jobs/{id}` | Update a job |
| `DELETE` | `/career/jobs/{id}` | Delete a job |
| `PUT` | `/career/jobs/{id}/skills` | Replace all skills (`{"skills": [{skill_id, is_required, years_required}]}`) |

### Objectives

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/career/objectives` | Create an objective |
| `GET` | `/career/objectives` | List objectives |
| `GET` | `/career/objectives/{id}` | Get an objective (includes linked jobs) |
| `PUT` | `/career/objectives/{id}` | Update an objective |
| `DELETE` | `/career/objectives/{id}` | Delete an objective (cascades to runs) |
| `POST` | `/career/objectives/{id}/jobs/{job_id}` | Link a job |
| `DELETE` | `/career/objectives/{id}/jobs/{job_id}` | Unlink a job |

### Assessment Runs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/career/objectives/{id}/runs` | Create a run (`{"job_ids": [...], "name": "optional"}`) |
| `GET` | `/career/objectives/{id}/runs` | List runs for an objective |
| `GET` | `/career/runs/{run_id}` | Get full run record |
| `GET` | `/career/runs/{run_id}/scorecard` | Scorecard JSON only |
| `GET` | `/career/runs/{run_id}/job-fit` | Job fit JSON only |
| `GET` | `/career/runs/{run_id}/resume-issues` | `{"status": "pending\|running\|complete\|failed", "data": {...}}` |
| `GET` | `/career/runs/{run_id}/action-plan` | Same shape as resume-issues |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Scorecard shows all Level 0 | Portfolio has no projects, or projects have no skills tagged | Add projects to the portfolio and tag their skills |
| Fit score is 100% even with gaps | Job has no skills tagged | Add required skills to the job (Required Skills tab) |
| AI tabs stuck on "pending" forever | Celery worker not running or API key missing | Check Celery worker logs; verify `ANTHROPIC_API_KEY` in `.env` |
| AI tabs show "failed" | API timeout or model error | Check backend logs for the `run_career_ai_assessment` task |
| 403 on create/edit | You don't own the record | Only the creator or a System Admin can modify records |
| Career menu not visible | Missing `VIEW_CAREER` permission | Ask an admin to grant the permission to your role |
