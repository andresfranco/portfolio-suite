"""Pure rule-based scoring functions for the Career OS analysis engine.

All functions are synchronous and dependency-free (no DB, no I/O).
Input data is passed as plain dicts/lists pre-fetched by the service layer.
"""
from typing import TypedDict


class SkillEvidence(TypedDict):
    skill_id: int
    skill_name: str
    project_names: list[str]
    is_required: bool
    years_required: int | None


class ScorecardItem(TypedDict):
    skill_id: int
    skill_name: str
    level: int          # 0–5
    priority: str       # CRITICAL | HIGH | MEDIUM | LOW
    evidence: str       # comma-separated project names, "" if level=0
    gap: str            # "" if level >= 4
    is_required: bool   # needed by compute_job_fit


class JobFitResult(TypedDict):
    job_id: int
    job_title: str
    fit_score: float
    verdict: str        # BEST FIT | STRETCH | ASPIRATIONAL
    scorecard: list[ScorecardItem]


def compute_skill_level(project_count: int, total_experience_years: int) -> int:
    """Level scale 0-5, top-to-bottom first-match wins per spec."""
    if project_count >= 4 and total_experience_years >= 5:
        return 5
    if project_count >= 3 and total_experience_years >= 3:
        return 4
    if project_count >= 3:
        return 3
    if project_count == 2:
        return 2
    if project_count == 1:
        return 1
    return 0


def assign_priority(level: int, is_required: bool) -> str:
    """Priority assignment, top-to-bottom first-match wins per spec."""
    if level == 0 and is_required:
        return "CRITICAL"
    if level == 0 or level == 1:
        return "HIGH"
    if level in (2, 3):
        return "MEDIUM"
    return "LOW"


def compute_gap_text(level: int, project_count: int) -> str:
    """Gap description text. Empty string if level >= 4."""
    if level >= 4:
        return ""
    if level == 0:
        return "Required but not found in any project"
    return f"Found in {project_count} project(s); target level for this role is 4+"


def compute_scorecard(
    skill_evidences: list[SkillEvidence],
    total_experience_years: int,
) -> list[ScorecardItem]:
    """Build a scorecard item for each skill evidence entry."""
    items: list[ScorecardItem] = []
    for ev in skill_evidences:
        project_count = len(ev["project_names"])
        level = compute_skill_level(project_count, total_experience_years)
        priority = assign_priority(level, ev["is_required"])
        evidence = ", ".join(ev["project_names"]) if project_count > 0 else ""
        gap = compute_gap_text(level, project_count)
        items.append(ScorecardItem(
            skill_id=ev["skill_id"],
            skill_name=ev["skill_name"],
            level=level,
            priority=priority,
            evidence=evidence,
            gap=gap,
            is_required=ev["is_required"],
        ))
    return items


def compute_job_fit(scorecard: list[ScorecardItem]) -> tuple[float, str]:
    """
    Formula: (2 * matched_required + matched_optional) / (2 * total_required + total_optional) * 100
    'matched' = level >= 2 (meaningful proficiency, not just exposure).
    Edge case: no skills → 100% (no requirements = no gaps).
    """
    if not scorecard:
        return 100.0, "BEST FIT"

    total_required = sum(1 for s in scorecard if s["is_required"])
    total_optional = sum(1 for s in scorecard if not s["is_required"])
    matched_required = sum(1 for s in scorecard if s["is_required"] and s["level"] >= 2)
    matched_optional = sum(1 for s in scorecard if not s["is_required"] and s["level"] >= 2)

    denominator = 2 * total_required + total_optional
    if denominator == 0:
        return 100.0, "BEST FIT"

    fit_score = (2 * matched_required + matched_optional) / denominator * 100

    if fit_score >= 60:
        verdict = "BEST FIT"
    elif fit_score >= 40:
        verdict = "STRETCH"
    else:
        verdict = "ASPIRATIONAL"

    return fit_score, verdict


def compute_overall_readiness(job_fits: list[JobFitResult]) -> float:
    """Simple average of per-job fit scores; returns 0.0 for empty list."""
    if not job_fits:
        return 0.0
    return sum(jf["fit_score"] for jf in job_fits) / len(job_fits)
