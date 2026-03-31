"""Unit tests for the Career OS rule-based scoring engine.

All tests use plain Python data structures — no database, no fixtures.
"""
import pytest
from app.services.career_scoring import (
    compute_skill_level,
    assign_priority,
    compute_gap_text,
    compute_scorecard,
    compute_job_fit,
    compute_overall_readiness,
)


class TestComputeSkillLevel:
    """Level scale (0-5), top-to-bottom, first match wins."""

    def test_level_5_four_projects_five_years(self):
        assert compute_skill_level(project_count=4, total_experience_years=5) == 5

    def test_level_5_requires_both_conditions(self):
        # 4 projects but only 4 years → level 4 not 5
        assert compute_skill_level(project_count=4, total_experience_years=4) == 4

    def test_level_5_many_projects_six_years(self):
        assert compute_skill_level(project_count=6, total_experience_years=10) == 5

    def test_level_4_three_projects_three_years(self):
        assert compute_skill_level(project_count=3, total_experience_years=3) == 4

    def test_level_4_requires_both_conditions(self):
        # 3 projects but only 2 years → drops to level 3
        assert compute_skill_level(project_count=3, total_experience_years=2) == 3

    def test_level_3_three_projects_zero_years(self):
        assert compute_skill_level(project_count=3, total_experience_years=0) == 3

    def test_level_2_two_projects(self):
        assert compute_skill_level(project_count=2, total_experience_years=10) == 2

    def test_level_1_one_project(self):
        assert compute_skill_level(project_count=1, total_experience_years=10) == 1

    def test_level_0_no_projects(self):
        assert compute_skill_level(project_count=0, total_experience_years=10) == 0

    def test_level_0_no_projects_no_years(self):
        assert compute_skill_level(project_count=0, total_experience_years=0) == 0


class TestAssignPriority:
    """Priority assignment, top-to-bottom, first match wins."""

    def test_critical_level0_required(self):
        assert assign_priority(level=0, is_required=True) == "CRITICAL"

    def test_high_level0_optional(self):
        assert assign_priority(level=0, is_required=False) == "HIGH"

    def test_high_level1_any(self):
        assert assign_priority(level=1, is_required=True) == "HIGH"
        assert assign_priority(level=1, is_required=False) == "HIGH"

    def test_medium_level2(self):
        assert assign_priority(level=2, is_required=True) == "MEDIUM"

    def test_medium_level3(self):
        assert assign_priority(level=3, is_required=False) == "MEDIUM"

    def test_low_level4(self):
        assert assign_priority(level=4, is_required=True) == "LOW"

    def test_low_level5(self):
        assert assign_priority(level=5, is_required=False) == "LOW"


class TestComputeGapText:
    """Gap text descriptions."""

    def test_gap_level_0(self):
        text = compute_gap_text(level=0, project_count=0)
        assert text == "Required but not found in any project"

    def test_gap_level_1(self):
        text = compute_gap_text(level=1, project_count=1)
        assert "1 project" in text
        assert "4+" in text

    def test_gap_level_2(self):
        text = compute_gap_text(level=2, project_count=2)
        assert "2 project" in text
        assert "4+" in text

    def test_gap_level_3(self):
        text = compute_gap_text(level=3, project_count=3)
        assert "3 project" in text

    def test_gap_empty_at_level_4(self):
        assert compute_gap_text(level=4, project_count=4) == ""

    def test_gap_empty_at_level_5(self):
        assert compute_gap_text(level=5, project_count=5) == ""


class TestComputeJobFit:
    """
    Formula: (2 * matched_required + matched_optional) / (2 * total_required + total_optional) * 100
    'matched' means level > 0.
    """

    def _make_scorecard(self, items):
        """Helper: items is list of (level, is_required)."""
        return [
            {
                "skill_id": i,
                "skill_name": f"Skill{i}",
                "level": level,
                "priority": "LOW",
                "evidence": "p" if level > 0 else "",
                "gap": "" if level >= 4 else "gap",
                "is_required": is_req,
            }
            for i, (level, is_req) in enumerate(items)
        ]

    def test_all_required_matched(self):
        scorecard = self._make_scorecard([(3, True), (4, True), (2, True)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(100.0)

    def test_no_required_matched(self):
        scorecard = self._make_scorecard([(0, True), (0, True)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(0.0)

    def test_mixed_required_optional(self):
        # 1 required matched (level>0), 1 required unmatched, 1 optional matched
        # (2*1 + 1) / (2*2 + 1) * 100 = 3/5 * 100 = 60.0
        scorecard = self._make_scorecard([(3, True), (0, True), (2, False)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(60.0)

    def test_no_skills_returns_100(self):
        """Job with no required skills → no gaps → 100% fit."""
        score, verdict = compute_job_fit([])
        assert score == pytest.approx(100.0)

    def test_verdict_best_fit_at_60(self):
        scorecard = self._make_scorecard([(3, True), (0, True), (2, False)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(60.0)
        assert verdict == "BEST FIT"

    def test_verdict_stretch_at_50(self):
        # 2 required matched out of 4 required → (2*2 + 0) / (2*4) * 100 = 50.0
        scorecard = self._make_scorecard([(3, True), (3, True), (0, True), (0, True)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(50.0)
        assert verdict == "STRETCH"

    def test_verdict_aspirational_below_40(self):
        # 1 required matched out of 4 required → (2*1) / (2*4) * 100 = 25.0
        scorecard = self._make_scorecard([(3, True), (0, True), (0, True), (0, True)])
        score, verdict = compute_job_fit(scorecard)
        assert score == pytest.approx(25.0)
        assert verdict == "ASPIRATIONAL"

    def test_all_required_matched_at_level_1(self):
        """level=1 counts as matched (level > 0)."""
        scorecard = self._make_scorecard([(1, True), (1, True)])
        score, verdict = compute_job_fit(scorecard)
        # both level=1 matched → (2*2)/(2*2)*100 = 100.0
        assert score == pytest.approx(100.0)
        assert verdict == "BEST FIT"


class TestComputeScorecard:
    """Integration of compute_skill_level + assign_priority + compute_gap_text."""

    def _make_evidence(self, project_names, is_required=True):
        return {
            "skill_id": 1,
            "skill_name": "Python",
            "project_names": project_names,
            "is_required": is_required,
            "years_required": None,
        }

    def test_evidence_text_comma_separated(self):
        ev = self._make_evidence(["Alpha", "Beta", "Gamma"])
        result = compute_scorecard([ev], total_experience_years=5)
        assert result[0]["evidence"] == "Alpha, Beta, Gamma"

    def test_evidence_empty_at_level_0(self):
        ev = self._make_evidence([])
        result = compute_scorecard([ev], total_experience_years=0)
        assert result[0]["evidence"] == ""
        assert result[0]["level"] == 0

    def test_gap_text_level_0_required(self):
        ev = self._make_evidence([], is_required=True)
        result = compute_scorecard([ev], total_experience_years=0)
        assert result[0]["gap"] == "Required but not found in any project"

    def test_gap_text_level_1_to_3(self):
        ev = self._make_evidence(["Alpha"])  # 1 project → level 1
        result = compute_scorecard([ev], total_experience_years=10)
        assert "1 project" in result[0]["gap"]
        assert "4+" in result[0]["gap"]

    def test_no_gap_at_level_4(self):
        ev = self._make_evidence(["A", "B", "C", "D"])  # 4 projects, 5 years → level 5
        result = compute_scorecard([ev], total_experience_years=5)
        assert result[0]["gap"] == ""

    def test_priority_critical(self):
        ev = self._make_evidence([], is_required=True)
        result = compute_scorecard([ev], total_experience_years=0)
        assert result[0]["priority"] == "CRITICAL"

    def test_multiple_skills(self):
        evidences = [
            {"skill_id": 1, "skill_name": "Python", "project_names": [], "is_required": True, "years_required": None},
            {"skill_id": 2, "skill_name": "SQL", "project_names": ["A", "B", "C", "D"], "is_required": False, "years_required": None},
        ]
        result = compute_scorecard(evidences, total_experience_years=5)
        assert len(result) == 2
        python_item = next(r for r in result if r["skill_id"] == 1)
        sql_item = next(r for r in result if r["skill_id"] == 2)
        assert python_item["level"] == 0
        assert sql_item["level"] == 5


class TestComputeOverallReadiness:
    def test_average_of_job_fits(self):
        job_fits = [
            {"job_id": 1, "job_title": "A", "fit_score": 80.0, "verdict": "BEST FIT", "scorecard": []},
            {"job_id": 2, "job_title": "B", "fit_score": 40.0, "verdict": "STRETCH", "scorecard": []},
        ]
        assert compute_overall_readiness(job_fits) == pytest.approx(60.0)

    def test_empty_returns_zero(self):
        assert compute_overall_readiness([]) == pytest.approx(0.0)

    def test_single_job(self):
        job_fits = [{"job_id": 1, "job_title": "A", "fit_score": 72.5, "verdict": "BEST FIT", "scorecard": []}]
        assert compute_overall_readiness(job_fits) == pytest.approx(72.5)
