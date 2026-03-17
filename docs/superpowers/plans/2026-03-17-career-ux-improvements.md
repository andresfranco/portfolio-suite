# Career UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four Career OS UX issues: skill ID hidden from UI (skills use autocomplete), resume upload before runs with text extraction, pre-run readiness validation, and Anthropic API connectivity test.

**Architecture:** Backend adds 4 new endpoints (skills search/ensure, run-readiness, diagnostics), fixes the AnthropicProvider system-prompt bug causing run failures, and extracts resume text in the Celery task. Frontend replaces the skill-ID dialog with a searchable autocomplete, adds resume selection/upload to the run dialog, shows a pre-flight checklist, and adds a diagnostics section to CareerIndex.

**Tech Stack:** FastAPI, SQLAlchemy sync, Celery, pypdf (already installed), React 19, MUI v6 Autocomplete, React Hook Form, Axios.

---

## Chunk 1: Backend Fixes & New Endpoints

### Task 1: Fix AnthropicProvider — system prompt passed incorrectly

**Root cause:** `AnthropicProvider.chat()` in `app/services/llm/providers.py:104` passes `{"role": "system", ...}` inside the `messages` list. The Anthropic API only accepts `user` and `assistant` roles there; the system prompt must be passed as a separate `system=` kwarg. This causes every Career AI run to fail with a 400 error.

**Files:**
- Modify: `portfolio-backend/app/services/llm/providers.py:97-107`

- [ ] **Step 1: Fix AnthropicProvider.chat()**

Replace lines 97–107 in `portfolio-backend/app/services/llm/providers.py`:

```python
def chat(self, *, model: str, system_prompt: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
    started = time.time()
    resp = self.client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )
    content = "".join([b.text for b in resp.content if getattr(b, "type", "") == "text"])
    latency_ms = int((time.time() - started) * 1000)
    return {"text": content, "usage": {}, "latency_ms": latency_ms}
```

- [ ] **Step 2: Commit**

```bash
cd portfolio-backend
git add app/services/llm/providers.py
git commit -m "fix(career): pass system prompt as kwarg in AnthropicProvider, not as messages role"
```

---

### Task 2: Backend — skills search & ensure endpoints

**Files:**
- Modify: `portfolio-backend/app/schemas/career.py` — add `SkillSearchItem`, `SkillEnsureRequest`
- Modify: `portfolio-backend/app/api/endpoints/career.py` — add two endpoints

- [ ] **Step 1: Add schemas** to end of `portfolio-backend/app/schemas/career.py`:

```python
# ── Skill search / ensure schemas ─────────────────────────────────────────────

class SkillSearchItem(BaseModel):
    id: int
    name: str


class SkillEnsureRequest(BaseModel):
    name: str


class SkillEnsureOut(BaseModel):
    id: int
    name: str
    created: bool  # True if a new skill was created
```

- [ ] **Step 2: Add endpoints** at the bottom of `portfolio-backend/app/api/endpoints/career.py` (before the final blank line):

```python
# ── Skill search & ensure ──────────────────────────────────────────────────────


@router.get("/skills/search", response_model=List)
@require_permission("VIEW_CAREER")
def search_skills(
    q: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Full-text search of skills by name. Returns [{id, name}]."""
    from sqlalchemy import or_
    from app.models.skill import Skill, SkillText

    stmt = (
        select(Skill.id, SkillText.name)
        .join(SkillText, SkillText.skill_id == Skill.id)
        .where(SkillText.name.ilike(f"%{q}%"))
        .distinct(Skill.id, SkillText.name)
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    seen_ids: set[int] = set()
    results = []
    for skill_id, name in rows:
        if skill_id not in seen_ids:
            seen_ids.add(skill_id)
            results.append({"id": skill_id, "name": name or f"Skill {skill_id}"})
    return results


@router.post("/skills/ensure", status_code=status.HTTP_200_OK)
@require_permission("MANAGE_CAREER")
def ensure_skill(
    data: SkillEnsureRequest,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Find an existing skill by name (case-insensitive) or create it.

    Returns {id, name, created}.
    """
    from app.models.skill import Skill, SkillText
    from app.models.language import Language

    # Try to find existing skill with this name
    row = db.execute(
        select(Skill.id, SkillText.name)
        .join(SkillText, SkillText.skill_id == Skill.id)
        .where(SkillText.name.ilike(data.name.strip()))
        .limit(1)
    ).first()

    if row:
        return {"id": row[0], "name": row[1], "created": False}

    # Get default language (first available)
    lang = db.execute(select(Language.id).limit(1)).scalar_one_or_none()
    if lang is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No languages configured — cannot create skill",
        )

    # Create new skill
    skill = Skill(type="hard", created_by=current_user.id, updated_by=current_user.id)
    db.add(skill)
    db.flush()
    skill_text = SkillText(
        skill_id=skill.id,
        language_id=lang,
        name=data.name.strip(),
        description="",
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(skill_text)
    db.commit()
    return {"id": skill.id, "name": data.name.strip(), "created": True}
```

- [ ] **Step 3: Add missing imports** to the top of `portfolio-backend/app/api/endpoints/career.py`. Ensure `select` is imported (it is already via SQLAlchemy). Add `List` to the typing import if not present (it already is). Also add `SkillEnsureRequest` to the schema imports block:

```python
from app.schemas.career import (
    AssessmentRunCreate,
    AssessmentRunOut,
    CareerJobCreate,
    CareerJobListOut,
    CareerJobOut,
    CareerJobSkillsUpdate,
    CareerJobUpdate,
    CareerObjectiveCreate,
    CareerObjectiveListOut,
    CareerObjectiveOut,
    CareerObjectiveUpdate,
    SectionStatusOut,
    SkillEnsureRequest,
)
```

- [ ] **Step 4: Verify the server starts without errors**

```bash
cd portfolio-backend && source venv/bin/activate
python -c "from app.api.endpoints.career import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add app/schemas/career.py app/api/endpoints/career.py
git commit -m "feat(career): add skills/search and skills/ensure endpoints"
```

---

### Task 3: Backend — pre-run readiness endpoint

**Files:**
- Modify: `portfolio-backend/app/api/endpoints/career.py` — add `GET /objectives/{id}/run-readiness`
- Modify: `portfolio-backend/app/schemas/career.py` — add `RunReadinessOut`

- [ ] **Step 1: Add schema** to `portfolio-backend/app/schemas/career.py`:

```python
class ReadinessCheck(BaseModel):
    key: str
    label: str
    passed: bool
    detail: Optional[str] = None


class RunReadinessOut(BaseModel):
    ready: bool
    checks: List[ReadinessCheck]
```

- [ ] **Step 2: Add endpoint** to `portfolio-backend/app/api/endpoints/career.py`:

```python
# ── Pre-run readiness check ────────────────────────────────────────────────────


@router.get("/objectives/{objective_id}/run-readiness", response_model=RunReadinessOut)
@require_permission("VIEW_CAREER")
def get_run_readiness(
    objective_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Return a readiness checklist for running an assessment on an objective."""
    obj = career_crud.get_objective(db, objective_id)
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objective not found")

    checks: list[dict] = []

    # 1. Objective has linked jobs
    has_jobs = len(obj.jobs or []) > 0
    checks.append({
        "key": "has_jobs",
        "label": "Objective has at least one linked job",
        "passed": has_jobs,
        "detail": None if has_jobs else "Link at least one job to this objective before running.",
    })

    # 2. All linked jobs have at least one required skill
    jobs_missing_skills = [j.title for j in (obj.jobs or []) if not j.skills]
    checks.append({
        "key": "jobs_have_skills",
        "label": "All jobs have required skills defined",
        "passed": len(jobs_missing_skills) == 0,
        "detail": (
            None
            if not jobs_missing_skills
            else f"Missing skills on: {', '.join(jobs_missing_skills)}"
        ),
    })

    # 3. Anthropic API key configured
    api_key_ok = bool(settings.ANTHROPIC_API_KEY)
    checks.append({
        "key": "api_key_configured",
        "label": "Anthropic API key is configured",
        "passed": api_key_ok,
        "detail": None if api_key_ok else "Set ANTHROPIC_API_KEY in the backend environment.",
    })

    # 4. Celery enabled
    celery_ok = _celery_is_enabled()
    checks.append({
        "key": "celery_enabled",
        "label": "AI processing queue (Celery) is running",
        "passed": celery_ok,
        "detail": None if celery_ok else "AI analysis will be queued but won't run until Celery is started.",
    })

    ready = all(c["passed"] for c in checks[:3])  # Celery is advisory only
    return RunReadinessOut(ready=ready, checks=[ReadinessCheck(**c) for c in checks])
```

- [ ] **Step 3: Add `RunReadinessOut` and `ReadinessCheck` to the imports** in the endpoint file:

```python
from app.schemas.career import (
    AssessmentRunCreate,
    AssessmentRunOut,
    CareerJobCreate,
    CareerJobListOut,
    CareerJobOut,
    CareerJobSkillsUpdate,
    CareerJobUpdate,
    CareerObjectiveCreate,
    CareerObjectiveListOut,
    CareerObjectiveOut,
    CareerObjectiveUpdate,
    ReadinessCheck,
    RunReadinessOut,
    SectionStatusOut,
    SkillEnsureRequest,
)
```

Also add `from app.core.config import settings` if not already present (check — it's not there, add it):

```python
from app.core.config import settings
```

- [ ] **Step 4: Verify**

```bash
python -c "from app.api.endpoints.career import router; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add app/schemas/career.py app/api/endpoints/career.py
git commit -m "feat(career): add run-readiness pre-flight check endpoint"
```

---

### Task 4: Backend — Anthropic diagnostics endpoint

**Files:**
- Modify: `portfolio-backend/app/api/endpoints/career.py`

- [ ] **Step 1: Add endpoint**

```python
# ── AI Diagnostics ─────────────────────────────────────────────────────────────


@router.post("/diagnostics/anthropic")
@require_permission("VIEW_CAREER")
def test_anthropic_connectivity(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Send a minimal test message to Anthropic and return latency/status."""
    import time as _time
    from app.services.llm.providers import AnthropicProvider, ProviderConfig

    if not settings.ANTHROPIC_API_KEY:
        return {
            "success": False,
            "error": "ANTHROPIC_API_KEY is not configured",
            "latency_ms": None,
        }

    started = _time.time()
    try:
        provider = AnthropicProvider(
            ProviderConfig(name="anthropic", api_key=settings.ANTHROPIC_API_KEY)
        )
        result = provider.chat(
            model="claude-haiku-4-5-20251001",
            system_prompt="You are a test assistant. Reply with exactly: OK",
            messages=[{"role": "user", "content": "ping"}],
        )
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": True,
            "response": result["text"][:100],
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = int((_time.time() - started) * 1000)
        return {
            "success": False,
            "error": str(exc),
            "latency_ms": latency_ms,
        }
```

- [ ] **Step 2: Verify**

```bash
python -c "from app.api.endpoints.career import router; print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add app/api/endpoints/career.py
git commit -m "feat(career): add Anthropic connectivity diagnostics endpoint"
```

---

### Task 5: Backend — extract resume text in Celery task

Instead of passing just the filename, read the PDF from disk and extract its text. No DB migration needed — the text is extracted fresh on each run.

**Files:**
- Modify: `portfolio-backend/app/queue/tasks/career.py` — replace `_get_resume_filename` with `_get_resume_text`
- Modify: `portfolio-backend/app/services/career_service.py` — update `build_ai_context` signature

- [ ] **Step 1: Replace `_get_resume_filename` in `portfolio-backend/app/queue/tasks/career.py`**

Remove the existing `_get_resume_filename` function (lines 179–187) and add this:

```python
def _get_resume_text(db, attachment_id: int | None) -> str:
    """Extract text from the resume PDF/file stored on disk.

    Returns an empty string if no attachment, file not found, or extraction fails.
    """
    if not attachment_id:
        return ""
    row = db.execute(
        select(PortfolioAttachment.file_path, PortfolioAttachment.file_name)
        .where(PortfolioAttachment.id == attachment_id)
    ).first()
    if not row:
        return ""
    file_path, file_name = row[0], row[1]
    try:
        from pathlib import Path
        import pypdf

        full_path = Path(file_path)
        if not full_path.is_absolute():
            from app.core.config import settings
            full_path = settings.UPLOADS_DIR / file_path
        if not full_path.exists():
            logger.warning("Resume file not found: %s", full_path)
            return f"[Resume: {file_name} — file not found on disk]"
        reader = pypdf.PdfReader(str(full_path))
        pages_text = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages_text).strip()
        if not text:
            return f"[Resume: {file_name} — could not extract text]"
        # Truncate to ~4000 chars to keep prompt manageable
        return text[:4000]
    except Exception as exc:
        logger.warning("Failed to extract resume text from %s: %s", file_path, exc)
        return f"[Resume: {file_name} — extraction failed]"
```

- [ ] **Step 2: Update the call-site** in `run_career_ai_assessment` (line ~264):

Replace:
```python
resume_filename = _get_resume_filename(db, run.resume_attachment_id)
```
With:
```python
resume_text = _get_resume_text(db, run.resume_attachment_id)
```

And in the `build_ai_context(...)` call, replace `resume_filename=resume_filename` with `resume_text=resume_text`.

- [ ] **Step 3: Update `build_ai_context` signature** in `portfolio-backend/app/services/career_service.py`

Change parameter name from `resume_filename` to `resume_text` and update the body:

```python
def build_ai_context(
    *,
    portfolio_name: str,
    project_summaries: list[dict],
    experience_summaries: list[dict],
    resume_text: str | None,          # ← was resume_filename
    objective_name: str,
    job_summaries: list[dict],
    scorecard_json: dict,
) -> str:
```

And update the resume section inside the function:

```python
    # Resume
    if resume_text and resume_text.strip():
        lines.append("RESUME CONTENT:")
        lines.append(resume_text[:4000])
    else:
        lines.append("RESUME: Not provided")
    lines.append("")
```

- [ ] **Step 4: Verify imports are complete** (pypdf is already in requirements.txt)

```bash
python -c "import pypdf; print(pypdf.__version__)"
```

- [ ] **Step 5: Commit**

```bash
git add app/queue/tasks/career.py app/services/career_service.py
git commit -m "feat(career): extract resume PDF text and include full content in AI context"
```

---

## Chunk 2: Frontend Updates

### Task 6: careerApi.js — add new API calls

**Files:**
- Modify: `backend-ui/src/services/careerApi.js`

- [ ] **Step 1: Add new calls** to the end of the file:

```javascript
// Skills
export const searchSkills = (q) => api.get('/api/career/skills/search', { params: { q, limit: 20 } });
export const ensureSkill  = (name) => api.post('/api/career/skills/ensure', { name });

// Run readiness
export const getRunReadiness = (objectiveId) => api.get(`/api/career/objectives/${objectiveId}/run-readiness`);

// Diagnostics
export const testAnthropicConnectivity = () => api.post('/api/career/diagnostics/anthropic');

// Portfolio attachments (for resume selection)
export const getPortfolioAttachments = (portfolioId) => api.get(`/api/portfolios/${portfolioId}/attachments`);
export const uploadPortfolioAttachment = (portfolioId, formData) =>
  api.post(`/api/portfolios/${portfolioId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
```

- [ ] **Step 2: Commit**

```bash
cd backend-ui
git add src/services/careerApi.js
git commit -m "feat(career): add skills search/ensure, run-readiness, diagnostics, and attachment API calls"
```

---

### Task 7: Frontend — skills autocomplete in JobDetailPage

Replace the "Skill ID + Skill Name" text-input pattern in `EditSkillsDialog` with a single MUI `Autocomplete` that searches by name and auto-creates missing skills.

**Files:**
- Modify: `backend-ui/src/components/career/JobDetailPage.js`

- [ ] **Step 1: Replace `EditSkillsDialog`** (lines 34–129 in `JobDetailPage.js`) with this new version:

```jsx
import { Autocomplete } from '@mui/material';

const EditSkillsDialog = ({ open, onClose, job, onUpdated }) => {
  const [skills, setSkills] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && job) {
      // Seed dialog with existing skills, normalised to {skill_id, name}
      setSkills(
        (job.required_skills || []).map((s) => ({
          skill_id: s.skill_id ?? s.id,
          name: s.name || `Skill ${s.skill_id ?? s.id}`,
        }))
      );
      setInputValue('');
      setOptions([]);
      setError(null);
    }
  }, [open, job]);

  // Debounced search
  useEffect(() => {
    if (!inputValue) { setOptions([]); return; }
    const timer = setTimeout(async () => {
      setOptionsLoading(true);
      try {
        const res = await careerApi.searchSkills(inputValue);
        setOptions(res.data || []);
      } catch {
        setOptions([]);
      } finally {
        setOptionsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const handleSelect = async (_, newValue) => {
    if (!newValue) return;
    const name = typeof newValue === 'string' ? newValue : newValue.name ?? newValue.inputValue;
    if (!name?.trim()) return;

    // Check for duplicate by name
    if (skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;

    setError(null);
    try {
      // Resolve or create skill
      const res = await careerApi.ensureSkill(name.trim());
      const { id, name: resolvedName } = res.data;
      if (!skills.some((s) => s.skill_id === id)) {
        setSkills((prev) => [...prev, { skill_id: id, name: resolvedName }]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add skill');
    }
    setInputValue('');
  };

  const handleRemove = (skillId) => {
    setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await careerApi.updateJobSkills(
        job.id,
        skills.map((s) => ({ skill_id: s.skill_id, name: s.name }))
      );
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update skills');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Required Skills</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Autocomplete
          freeSolo
          options={options}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name || '')}
          filterOptions={(opts, params) => {
            const filtered = opts.filter((o) =>
              o.name.toLowerCase().includes(params.inputValue.toLowerCase())
            );
            if (
              params.inputValue.trim() &&
              !filtered.some((o) => o.name.toLowerCase() === params.inputValue.toLowerCase())
            ) {
              filtered.push({ inputValue: params.inputValue, name: `Add "${params.inputValue}"` });
            }
            return filtered;
          }}
          loading={optionsLoading}
          inputValue={inputValue}
          onInputChange={(_, val) => setInputValue(val)}
          onChange={handleSelect}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Search or add skill"
              placeholder="Type a skill name…"
            />
          )}
        />

        {skills.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No skills added yet.</Typography>
        ) : (
          <Box display="flex" flexWrap="wrap" gap={1}>
            {skills.map((s) => (
              <Chip
                key={s.skill_id}
                label={s.name}
                onDelete={() => handleRemove(s.skill_id)}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>
          {submitting ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 2: Add `Autocomplete` to the MUI imports** at line 3:

```jsx
import {
  Box, Tabs, Tab, Typography, Chip, Button, Paper, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, IconButton,
  Autocomplete,
} from '@mui/material';
```

Also add `required_skills` mapping — the `CareerJobOut.skills` returns `CareerJobSkillOut` items with `skill_id` and `id`. In `JobDetailPage` the job detail page renders `job.required_skills`, but the API returns `job.skills` (array of `CareerJobSkillOut`). Check the existing render in the skills tab: it uses `job.required_skills`. This means either the API normalises it or there's a naming mismatch.

Looking at `CareerJobOut.skills: List[CareerJobSkillOut]`, the frontend accesses `job.required_skills`. This means the frontend must be mapping `skills → required_skills` somewhere. Looking at `JobDetailPage.js:346` it uses `job.required_skills` directly. This is probably just a field name from the API that the job has a `required_skills` key that's populated. Looking at `CareerJobOut` it has `skills: List[CareerJobSkillOut]` — so the API returns `skills`, but the UI uses `required_skills`. This is actually a bug in the existing code — the job response has `skills` not `required_skills`. For the skill chips in the read-only tab (line 346), use `job.skills`:

Update `JobDetailPage.js:341-354` — replace `job.required_skills` with `job.skills` and use the correct field names (`s.skill_id`, `s.name` doesn't exist in `CareerJobSkillOut` — there is no name field there):

The `CareerJobSkillOut` only has `{id, skill_id, years_required, is_required}` — no `name`. So the UI currently shows `Skill ${skill.skill_id}` fallback. We need to either:

a) Enrich `CareerJobOut.skills` with skill names from the DB, or
b) Keep using the name from the EditSkillsDialog state (which fetches names via ensure/search).

**Simplest fix**: Enrich the `CareerJobOut` response by having the backend include skill names. Add a `name` field to `CareerJobSkillOut`:

In `portfolio-backend/app/schemas/career.py`, update `CareerJobSkillOut`:

```python
class CareerJobSkillOut(CareerJobSkillItem):
    id: int
    name: Optional[str] = None   # ← add this
    model_config = {"from_attributes": True}
```

Then in `portfolio-backend/app/crud/career.py`, after loading skills for a job, enrich with names. **Simplest approach**: add a `name` property via a join in `get_job`.

Actually the cleanest approach is to add a `name` hybrid property or update the CRUD to do a second query. Let's update `get_job` in crud to fetch skill names:

```python
def get_job(db: Session, job_id: int) -> Optional[CareerJob]:
    """Fetch a single career job by ID, with skills and their names loaded."""
    result = db.execute(
        select(CareerJob)
        .options(
            selectinload(CareerJob.skills).selectinload(CareerJobSkill.skill).selectinload(Skill.skill_texts)
        )
        .where(CareerJob.id == job_id)
    )
    job = result.scalars().first()
    if job:
        # Attach name to each CareerJobSkill via skill_texts
        for js in job.skills:
            texts = getattr(js.skill, 'skill_texts', []) if js.skill else []
            js._name = (texts[0].name if texts else None) or f"Skill {js.skill_id}"
    return job
```

But this is messy because Pydantic serialises from ORM and won't pick up `_name`.

**Better approach**: Serialise manually in the endpoint or use a computed property. **Simplest approach**: Add `name` as a `@property` on `CareerJobSkill` that reads from the relationship, and expose it via a validator in Pydantic.

Actually, the simplest approach that requires minimal changes: Change `CareerJobSkillOut` to include name, and in the `get_job` CRUD query, eagerly load `skill.skill_texts` then manually populate `name` before returning.

Use a different strategy — override `__init__` or use a custom serializer. Let's just do it in the API endpoint layer:

In `career.py` endpoint `get_job`, after fetching, enrich the skills:

```python
@router.get("/jobs/{job_id}", response_model=CareerJobOut)
@require_permission("VIEW_CAREER")
def get_job(job_id: int, db: Session = Depends(deps.get_db), current_user = Depends(deps.get_current_user)):
    job = career_crud.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Enrich skills with names
    _enrich_job_skill_names(db, [job])
    return job
```

Where `_enrich_job_skill_names` does a bulk query for names and patches the ORM objects. However, Pydantic `from_attributes=True` reads the `name` attribute, so if we set `js.name = "..."` it will be picked up.

Let me add a helper and update the relevant endpoints. Actually this is getting complicated. The simplest approach is to just make the `required_skills` field in the UI use a custom enrichment.

Wait - I realize the issue. `CareerJobSkillOut` model has `from_attributes=True`, which means Pydantic reads from the ORM object's attributes. `CareerJobSkill` model doesn't have a `name` column. But if we set `js.name = "..."` dynamically on the ORM object before returning, Pydantic will pick it up since `CareerJobSkillOut` has `name: Optional[str] = None`.

So the plan is:
1. Add `name: Optional[str] = None` to `CareerJobSkillOut`
2. Add a helper function `_enrich_skill_names(db, jobs)` that fetches names and sets them on the `CareerJobSkill` ORM instances
3. Call this helper in `get_job`, `list_jobs`, `replace_job_skills` endpoints
4. In the frontend, use `skill.name` for display (fallback to `Skill ${skill.skill_id}`)

This is clean and doesn't require any model changes. Let me document this in the plan.

- [ ] **Step 3: Add name enrichment to backend skill endpoints** (do this before frontend work)

In `portfolio-backend/app/schemas/career.py`, update `CareerJobSkillOut`:

```python
class CareerJobSkillOut(CareerJobSkillItem):
    id: int
    name: Optional[str] = None
    model_config = {"from_attributes": True}
```

In `portfolio-backend/app/api/endpoints/career.py`, add a helper function near the top (after imports):

```python
def _enrich_skill_names(db: Session, jobs) -> None:
    """Set .name on each CareerJobSkill instance for serialisation."""
    from app.models.skill import SkillText
    skill_ids = list({js.skill_id for job in jobs for js in job.skills})
    if not skill_ids:
        return
    rows = db.execute(
        select(SkillText.skill_id, SkillText.name)
        .where(SkillText.skill_id.in_(skill_ids))
        .distinct(SkillText.skill_id)
    ).all()
    name_map = {row[0]: row[1] for row in rows}
    for job in jobs:
        for js in job.skills:
            js.name = name_map.get(js.skill_id) or f"Skill {js.skill_id}"
```

Then call `_enrich_skill_names(db, [job])` inside `get_job`, `update_job`, `replace_job_skills` endpoints before returning, and `_enrich_skill_names(db, items)` inside `list_jobs`.

- [ ] **Step 4: Update frontend** — in `JobDetailPage.js` Required Skills tab, replace `job.required_skills` with `job.skills`:

```jsx
{(job.skills || []).length === 0 ? (
  <Typography color="text.secondary">No required skills defined.</Typography>
) : (
  <Box display="flex" flexWrap="wrap" gap={1}>
    {job.skills.map((skill) => (
      <Chip
        key={skill.id}
        label={skill.name || `Skill ${skill.skill_id}`}
        variant="outlined"
      />
    ))}
  </Box>
)}
```

Also seed the `EditSkillsDialog` from `job.skills` (not `job.required_skills`). Update line in dialog `useEffect`:

```jsx
setSkills(
  (job.skills || []).map((s) => ({
    skill_id: s.skill_id,
    name: s.name || `Skill ${s.skill_id}`,
  }))
);
```

- [ ] **Step 5: Commit**

```bash
cd portfolio-backend
git add app/schemas/career.py app/api/endpoints/career.py
git commit -m "feat(career): enrich CareerJobSkillOut with skill name from SkillText"

cd ../backend-ui
git add src/components/career/JobDetailPage.js src/services/careerApi.js
git commit -m "feat(career): replace skill-ID input with searchable autocomplete, show skill names"
```

---

### Task 8: Frontend — AssessmentRunDialog with resume + pre-flight check

**Files:**
- Modify: `backend-ui/src/components/career/ObjectiveDetailPage.js`

- [ ] **Step 1: Add `ReadinessCheckDialog` component** — insert before `AssessmentRunDialog` in `ObjectiveDetailPage.js`:

```jsx
const ReadinessCheckDialog = ({ open, onClose, objectiveId, onProceed }) => {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    careerApi.getRunReadiness(objectiveId)
      .then((res) => {
        setChecks(res.data.checks || []);
        setReady(res.data.ready);
      })
      .catch(() => setChecks([]))
      .finally(() => setLoading(false));
  }, [open, objectiveId]);

  const iconFor = (passed) => passed ? '✅' : '❌';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assessment Readiness Check</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}><CircularProgress /></Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={1.5}>
            {checks.map((c) => (
              <Box key={c.key}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography>{iconFor(c.passed)}</Typography>
                  <Typography variant="body2" fontWeight={c.passed ? 400 : 600}>
                    {c.label}
                  </Typography>
                </Box>
                {!c.passed && c.detail && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 3 }}>
                    {c.detail}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onProceed}
          disabled={!ready || loading}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 2: Update `AssessmentRunDialog`** to include resume selection/upload. Replace the existing `AssessmentRunDialog` component:

```jsx
const AssessmentRunDialog = ({ open, onClose, objective, onCreated }) => {
  const navigate = useNavigate();
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [runName, setRunName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Resume state
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && objective?.jobs) {
      setSelectedJobs(objective.jobs.map((j) => j.id));
      setRunName('');
      setError(null);
      setSelectedAttachmentId('');
      setResumeFile(null);
      // Load existing portfolio attachments
      if (objective.portfolio_id) {
        setAttachmentsLoading(true);
        careerApi.getPortfolioAttachments(objective.portfolio_id)
          .then((res) => setAttachments(res.data || []))
          .catch(() => setAttachments([]))
          .finally(() => setAttachmentsLoading(false));
      }
    }
  }, [open, objective]);

  const toggleJob = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const handleSubmit = async () => {
    if (selectedJobs.length === 0) { setError('Select at least one job.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      let resumeAttachmentId = selectedAttachmentId ? parseInt(selectedAttachmentId, 10) : null;

      // Upload new file if provided
      if (resumeFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', resumeFile);
        formData.append('file_name', resumeFile.name);
        const uploadRes = await careerApi.uploadPortfolioAttachment(
          objective.portfolio_id,
          formData
        );
        resumeAttachmentId = uploadRes.data.id;
        setUploading(false);
      }

      const res = await careerApi.createRun(objective.id, {
        name: runName || undefined,
        job_ids: selectedJobs,
        resume_attachment_id: resumeAttachmentId || null,
      });
      onClose();
      navigate(`/career/runs/${res.data.id}`);
    } catch (err) {
      setUploading(false);
      setError(err.response?.data?.message || err.message || 'Failed to create run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Run Assessment</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Run Name (optional)"
          value={runName}
          onChange={(e) => setRunName(e.target.value)}
          fullWidth
          size="small"
        />

        <Typography variant="subtitle2">Select jobs to include:</Typography>
        {objective?.jobs?.length === 0 && (
          <Typography color="text.secondary" variant="body2">No jobs linked.</Typography>
        )}
        {objective?.jobs?.map((job) => (
          <FormControlLabel
            key={job.id}
            control={
              <Checkbox
                checked={selectedJobs.includes(job.id)}
                onChange={() => toggleJob(job.id)}
              />
            }
            label={`${job.title} — ${job.company}`}
          />
        ))}

        <Divider />
        <Typography variant="subtitle2">Resume (optional but recommended)</Typography>

        {attachmentsLoading ? (
          <CircularProgress size={20} />
        ) : attachments.length > 0 ? (
          <FormControl fullWidth size="small">
            <InputLabel>Select existing resume</InputLabel>
            <Select
              value={selectedAttachmentId}
              label="Select existing resume"
              onChange={(e) => { setSelectedAttachmentId(e.target.value); setResumeFile(null); }}
            >
              <MenuItem value="">— None —</MenuItem>
              {attachments.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.file_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        <Box>
          <Typography variant="caption" color="text.secondary">
            Or upload a new resume (PDF):
          </Typography>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'block', marginTop: 4 }}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setResumeFile(f);
              if (f) setSelectedAttachmentId('');
            }}
          />
          {resumeFile && (
            <Typography variant="caption" color="success.main">
              {resumeFile.name} selected
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || selectedJobs.length === 0}
          startIcon={(submitting || uploading) ? <CircularProgress size={16} /> : <RunIcon />}
        >
          {uploading ? 'Uploading…' : 'Run'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

- [ ] **Step 3: Wire up the readiness check** in `ObjectiveDetailPage` — add state and replace the "Run Assessment" button flow:

Add state:
```jsx
const [readinessOpen, setReadinessOpen] = useState(false);
```

Replace the Run Assessment button onClick:
```jsx
onClick={() => setReadinessOpen(true)}
```

Add `ReadinessCheckDialog` to the dialogs section:
```jsx
<ReadinessCheckDialog
  open={readinessOpen}
  onClose={() => setReadinessOpen(false)}
  objectiveId={objectiveId}
  onProceed={() => { setReadinessOpen(false); setRunDialogOpen(true); }}
/>
```

- [ ] **Step 4: Add missing MUI imports** (`Select`, `InputLabel`, `FormControl`, `Divider`) to the imports at the top of `ObjectiveDetailPage.js`:

```jsx
import {
  Box, Tabs, Tab, Typography, Chip, Button, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox,
  TextField, Alert, Divider, Select, InputLabel, FormControl,
} from '@mui/material';
```

- [ ] **Step 5: Commit**

```bash
cd backend-ui
git add src/components/career/ObjectiveDetailPage.js
git commit -m "feat(career): add pre-run readiness checklist and resume upload to AssessmentRunDialog"
```

---

### Task 9: Frontend — Anthropic diagnostics in CareerIndex

Add a collapsible diagnostics section at the bottom of `CareerIndex.js`.

**Files:**
- Modify: `backend-ui/src/components/career/CareerIndex.js`

- [ ] **Step 1: Replace `CareerIndex.js`** with an updated version that adds a diagnostics section:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Chip, CircularProgress, Accordion,
  AccordionSummary, AccordionDetails, Alert,
} from '@mui/material';
import { Add as AddIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useCareer } from '../../contexts/CareerContext';
import { useAuthorization } from '../../contexts/AuthorizationContext';
import ObjectiveForm from './ObjectiveForm';
import * as careerApi from '../../services/careerApi';

const DiagnosticsPanel = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await careerApi.testAnthropicConnectivity();
      setResult(res.data);
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.detail || err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">AI Diagnostics</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" flexDirection="column" gap={1.5}>
          <Typography variant="body2" color="text.secondary">
            Test connectivity to the Anthropic API used for AI assessments.
          </Typography>
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={handleTest}
              disabled={testing}
              startIcon={testing ? <CircularProgress size={14} /> : null}
            >
              {testing ? 'Testing…' : 'Test Anthropic Connection'}
            </Button>
          </Box>
          {result && (
            <Alert severity={result.success ? 'success' : 'error'}>
              {result.success
                ? `Connected — response in ${result.latency_ms}ms: "${result.response}"`
                : `Failed: ${result.error}`}
            </Alert>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

const CareerIndex = () => {
  const { objectives, loading, error } = useCareer();
  const { hasPermission } = useCareer();   // FIX: use useAuthorization not useCareer
  const { hasPermission: checkPerm } = useAuthorization();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);

  if (!checkPerm('VIEW_CAREER')) {
    return (
      <Box p={3}>
        <Typography>You do not have permission to view Career OS.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Typography color="error">Error loading objectives: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Career Objectives</Typography>
        {checkPerm('MANAGE_CAREER') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormOpen(true)}
          >
            New Objective
          </Button>
        )}
      </Box>

      {objectives.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary" mb={2}>No objectives yet.</Typography>
          {checkPerm('MANAGE_CAREER') && (
            <Button variant="outlined" onClick={() => setFormOpen(true)}>
              Create your first objective
            </Button>
          )}
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Portfolio</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Jobs</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {objectives.map((obj) => (
                <TableRow
                  key={obj.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/career/objectives/${obj.id}`)}
                >
                  <TableCell>{obj.name}</TableCell>
                  <TableCell>Portfolio #{obj.portfolio_id}</TableCell>
                  <TableCell>
                    <Chip
                      label={obj.status}
                      size="small"
                      color={obj.status === 'active' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{obj.jobs?.length || 0}</TableCell>
                  <TableCell>
                    {obj.created_at ? new Date(obj.created_at).toLocaleDateString() : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DiagnosticsPanel />

      <ObjectiveForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  );
};

export default CareerIndex;
```

**Note:** The `DiagnosticsPanel` uses `useAuthorization` indirectly through the parent's permission check, so it's only visible to users with `VIEW_CAREER`. Also fix the erroneous `useCareer()` destructure in `CareerIndex` — the `hasPermission` is from `useAuthorization`, not `useCareer`. The original code was correct; just keep `{ hasPermission }` from `useAuthorization`.

**Correct version of CareerIndex** (no duplicate `hasPermission`):

```jsx
const CareerIndex = () => {
  const { objectives, loading, error } = useCareer();
  const { hasPermission } = useAuthorization();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  // ... rest unchanged, just add <DiagnosticsPanel /> after the table
```

- [ ] **Step 2: Commit**

```bash
git add src/components/career/CareerIndex.js
git commit -m "feat(career): add Anthropic connectivity diagnostics accordion to Career index"
```

---

## Final verification

- [ ] **Backend smoke test**

```bash
cd portfolio-backend && source venv/bin/activate
python -c "
from app.api.endpoints.career import router
routes = [r.path for r in router.routes]
print('skills/search:', any('skills/search' in r for r in routes))
print('skills/ensure:', any('skills/ensure' in r for r in routes))
print('run-readiness:', any('run-readiness' in r for r in routes))
print('diagnostics:', any('diagnostics' in r for r in routes))
"
```

Expected output:
```
skills/search: True
skills/ensure: True
run-readiness: True
diagnostics: True
```

- [ ] **Frontend build check**

```bash
cd backend-ui && npm run build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(career): complete Career UX improvements — skills autocomplete, resume upload, pre-run validation, AI diagnostics"
```
