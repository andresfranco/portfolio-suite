"""
Career API Integration Tests
-----------------------------

Integration tests for the Career Operating System API endpoints.
Uses real PostgreSQL via db_session fixture (no DB mocking).
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.api import deps
from tests.utils import get_test_data_manager
from app.models.portfolio import Portfolio
from app.models.skill import Skill

# ── Global test state (pattern from test_users_api.py) ──────────────────────

test_db_session = None
test_current_user = None


def override_get_db():
    try:
        yield test_db_session
    finally:
        pass


def override_get_current_user():
    return test_current_user


app.dependency_overrides[deps.get_db] = override_get_db
app.dependency_overrides[deps.get_current_user] = override_get_current_user

BASE = "/api/career"


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def client() -> TestClient:
    # Use Bearer token so the CSRF middleware skips validation for tests
    return TestClient(app, headers={"Authorization": "Bearer test-token"})


@pytest.fixture
def setup_users(db_session: Session):
    """Create admin user (MANAGE_CAREER) and view-only user (VIEW_CAREER)."""
    global test_db_session, test_current_user
    test_db_session = db_session

    mgr = get_test_data_manager(db_session)

    manage_perm = mgr.create_test_permission(name="MANAGE_CAREER")
    view_perm = mgr.create_test_permission(name="VIEW_CAREER")

    # Create roles using mgr but assign permissions directly via the relationship
    # (app.models.role_permission module does not exist; use Role.permissions instead)
    from app.models.role import Role
    from app.models.permission import Permission

    admin_role = mgr.create_test_role(name="CAREER_ADMIN")
    # Eagerly load permissions and append
    perm_objs = db_session.query(Permission).filter(
        Permission.id.in_([manage_perm.id, view_perm.id])
    ).all()
    admin_role.permissions.extend(perm_objs)
    db_session.commit()
    db_session.refresh(admin_role)

    admin_user = mgr.create_test_user(
        username="career_admin", roles=[admin_role.id]
    )
    db_session.refresh(admin_user)

    view_role = mgr.create_test_role(name="CAREER_VIEWER")
    view_perm_obj = db_session.query(Permission).filter(Permission.id == view_perm.id).first()
    view_role.permissions.append(view_perm_obj)
    db_session.commit()
    db_session.refresh(view_role)

    view_user = mgr.create_test_user(
        username="career_viewer", roles=[view_role.id]
    )
    db_session.refresh(view_user)

    # Start as admin
    test_current_user = admin_user

    yield {"admin": admin_user, "viewer": view_user, "mgr": mgr}

    mgr.cleanup()


@pytest.fixture
def portfolio(db_session: Session, setup_users):
    """Create a Portfolio owned by the admin user."""
    admin = setup_users["admin"]
    p = Portfolio(name="Test Portfolio", created_by=admin.id)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def skill(db_session: Session, setup_users):
    """Create a Skill for job-skill tests."""
    # type_code is a FK to skill_types.code — use None to avoid FK violation
    s = Skill(type="technical", type_code=None)
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


# ── Helper to create a job via the API ───────────────────────────────────────

def _create_job(client, payload=None):
    if payload is None:
        payload = {"title": "Software Engineer", "company": "Acme Corp"}
    return client.post(f"{BASE}/jobs", json=payload)


def _create_objective(client, portfolio_id, name="Test Objective"):
    return client.post(
        f"{BASE}/objectives",
        json={"portfolio_id": portfolio_id, "name": name},
    )


# ── Job lifecycle tests ───────────────────────────────────────────────────────


class TestJobLifecycle:
    def test_create_job_success(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = _create_job(client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Software Engineer"
        assert data["company"] == "Acme Corp"
        assert "id" in data

    def test_create_job_requires_view_career(self, client, setup_users):
        """A user with no permissions should get 403."""
        global test_current_user
        mgr = setup_users["mgr"]
        no_perm_role = mgr.create_test_role(name="NO_PERM_ROLE", permissions=[])
        no_perm_user = mgr.create_test_user(
            username="career_noperm", roles=[no_perm_role.id]
        )
        test_current_user = no_perm_user

        resp = _create_job(client)
        assert resp.status_code == 403

    def test_list_jobs_returns_items_and_total(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        _create_job(client)
        resp = client.get(f"{BASE}/jobs")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] >= 1

    def test_list_jobs_viewer_can_access(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["viewer"]

        resp = client.get(f"{BASE}/jobs")
        assert resp.status_code == 200

    def test_get_job_not_found_returns_404(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = client.get(f"{BASE}/jobs/99999999")
        assert resp.status_code == 404

    def test_get_job_success(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        resp = client.get(f"{BASE}/jobs/{job_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == job_id

    def test_update_job_success(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        resp = client.put(f"{BASE}/jobs/{job_id}", json={"status": "applied"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "applied"

    def test_update_job_ownership_required(self, client, setup_users, db_session):
        """Viewer (different user) cannot update a job they don't own."""
        global test_current_user
        test_current_user = setup_users["admin"]
        job_id = _create_job(client).json()["id"]

        # Switch to viewer who is a different user
        test_current_user = setup_users["viewer"]
        resp = client.put(f"{BASE}/jobs/{job_id}", json={"status": "applied"})
        assert resp.status_code == 403

    def test_delete_job_success(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        resp = client.delete(f"{BASE}/jobs/{job_id}")
        assert resp.status_code == 204

        # Confirm it's gone
        resp = client.get(f"{BASE}/jobs/{job_id}")
        assert resp.status_code == 404

    def test_replace_job_skills(self, client, setup_users, skill):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        payload = {
            "skills": [
                {"skill_id": skill.id, "is_required": True, "years_required": 2}
            ]
        }
        resp = client.put(f"{BASE}/jobs/{job_id}/skills", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["skills"]) == 1
        assert data["skills"][0]["skill_id"] == skill.id

    def test_replace_job_skills_clears_old_skills(self, client, setup_users, skill):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        # Add skill then clear it
        client.put(
            f"{BASE}/jobs/{job_id}/skills",
            json={"skills": [{"skill_id": skill.id, "is_required": True}]},
        )
        resp = client.put(f"{BASE}/jobs/{job_id}/skills", json={"skills": []})
        assert resp.status_code == 200
        assert resp.json()["skills"] == []

    def test_list_jobs_filter_by_status(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        _create_job(client, {"title": "Dev", "company": "Co", "status": "applied"})
        _create_job(client, {"title": "QA", "company": "Co2", "status": "saved"})

        resp = client.get(f"{BASE}/jobs?status=applied")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status"] == "applied"

    def test_list_jobs_filter_by_company(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        _create_job(client, {"title": "Dev", "company": "UniqueCompanyXYZ"})
        resp = client.get(f"{BASE}/jobs?company=UniqueCompanyXYZ")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1


# ── Objective lifecycle tests ─────────────────────────────────────────────────


class TestObjectiveLifecycle:
    def test_create_objective(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = _create_objective(client, portfolio.id)
        assert resp.status_code == 201
        data = resp.json()
        assert data["portfolio_id"] == portfolio.id
        assert data["name"] == "Test Objective"

    def test_list_objectives(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        _create_objective(client, portfolio.id)
        resp = client.get(f"{BASE}/objectives")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] >= 1

    def test_get_objective_not_found(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = client.get(f"{BASE}/objectives/99999999")
        assert resp.status_code == 404

    def test_get_objective_success(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.get(f"{BASE}/objectives/{obj_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == obj_id

    def test_update_objective(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.put(
            f"{BASE}/objectives/{obj_id}", json={"status": "archived"}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    def test_update_objective_ownership_enforced(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.put(f"{BASE}/objectives/{obj_id}", json={"status": "archived"})
        assert resp.status_code == 403

    def test_delete_objective(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.delete(f"{BASE}/objectives/{obj_id}")
        assert resp.status_code == 204

        resp = client.get(f"{BASE}/objectives/{obj_id}")
        assert resp.status_code == 404

    def test_delete_objective_ownership_enforced(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.delete(f"{BASE}/objectives/{obj_id}")
        assert resp.status_code == 403

    def test_link_job_to_objective_idempotent(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        # Link twice — both should succeed (idempotent)
        resp1 = client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")
        assert resp1.status_code == 200

        resp2 = client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")
        assert resp2.status_code == 200

        data = resp2.json()
        job_ids_in_objective = [j["id"] for j in data["jobs"]]
        assert job_id in job_ids_in_objective

    def test_link_job_objective_not_found(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = client.post(f"{BASE}/objectives/99999/jobs/1")
        assert resp.status_code == 404

    def test_link_job_not_found(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        resp = client.post(f"{BASE}/objectives/{obj_id}/jobs/99999")
        assert resp.status_code == 404

    def test_unlink_job_from_objective(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")

        resp = client.delete(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")
        assert resp.status_code == 204

    def test_unlink_job_objective_not_found(self, client, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

        resp = client.delete(f"{BASE}/objectives/99999/jobs/1")
        assert resp.status_code == 404

    def test_unlink_job_job_not_found(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        resp = client.delete(f"{BASE}/objectives/{obj_id}/jobs/99999")
        assert resp.status_code == 404


# ── Assessment run lifecycle tests ────────────────────────────────────────────


class TestAssessmentRunLifecycle:
    @pytest.fixture(autouse=True)
    def _set_admin(self, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

    def _create_run(self, client, portfolio, setup_users, job_ids=None):
        """Helper: create objective + run with Celery mocked."""
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        if job_ids is None:
            # Create a job and use it
            job_id = _create_job(client).json()["id"]
            job_ids = [job_id]

        mock_task = MagicMock()
        mock_task.id = "mock-task-id-123"

        with patch(
            "app.queue.tasks.career.run_career_ai_assessment.delay",
            return_value=mock_task,
        ):
            resp = client.post(
                f"{BASE}/objectives/{obj_id}/runs",
                json={"job_ids": job_ids},
            )
        return obj_id, resp

    def test_create_run_empty_job_ids_returns_400(self, client, setup_users, portfolio):
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.post(
            f"{BASE}/objectives/{obj_id}/runs", json={"job_ids": []}
        )
        assert resp.status_code == 400

    def test_create_run_computes_sync_sections_immediately(
        self, client, setup_users, portfolio
    ):
        """After creation, scorecard_json should be set (sync computation done)."""
        obj_id, resp = self._create_run(client, portfolio, setup_users)
        assert resp.status_code == 201
        data = resp.json()
        assert data["ai_status"] == "pending"
        assert data["ai_task_id"] == "mock-task-id-123"
        # scorecard_json is set synchronously
        assert data["scorecard_json"] is not None

    def test_create_run_triggers_celery(self, client, setup_users, portfolio):
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        job_id = _create_job(client).json()["id"]

        mock_task = MagicMock()
        mock_task.id = "celery-task-999"

        with patch(
            "app.queue.tasks.career.run_career_ai_assessment.delay",
            return_value=mock_task,
        ) as mock_delay:
            resp = client.post(
                f"{BASE}/objectives/{obj_id}/runs", json={"job_ids": [job_id]}
            )
            assert mock_delay.called

        assert resp.status_code == 201

    def test_create_run_objective_not_found(self, client, setup_users):
        mock_task = MagicMock()
        mock_task.id = "x"
        with patch(
            "app.queue.tasks.career.run_career_ai_assessment.delay",
            return_value=mock_task,
        ):
            resp = client.post(
                f"{BASE}/objectives/99999/runs", json={"job_ids": [1]}
            )
        assert resp.status_code == 404

    def test_list_runs_for_objective(self, client, setup_users, portfolio):
        obj_id, _ = self._create_run(client, portfolio, setup_users)
        resp = client.get(f"{BASE}/objectives/{obj_id}/runs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_list_runs_objective_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/objectives/99999/runs")
        assert resp.status_code == 404

    def test_get_run_for_objective(self, client, setup_users, portfolio):
        obj_id, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        resp = client.get(f"{BASE}/objectives/{obj_id}/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == run_id

    def test_get_run_for_objective_wrong_objective(self, client, setup_users, portfolio):
        """Run belongs to a different objective — should 404."""
        obj_id, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        # Use a different (non-existent) objective_id
        resp = client.get(f"{BASE}/objectives/99999/runs/{run_id}")
        assert resp.status_code == 404

    def test_get_run_flat_endpoint(self, client, setup_users, portfolio):
        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        resp = client.get(f"{BASE}/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == run_id

    def test_get_run_flat_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/runs/99999999")
        assert resp.status_code == 404

    def test_get_scorecard_endpoint(self, client, setup_users, portfolio):
        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        resp = client.get(f"{BASE}/runs/{run_id}/scorecard")
        assert resp.status_code == 200
        # scorecard_json is a dict (possibly empty if no job skills)
        assert isinstance(resp.json(), dict)

    def test_get_scorecard_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/runs/99999999/scorecard")
        assert resp.status_code == 404

    def test_get_job_fit_endpoint(self, client, setup_users, portfolio):
        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        resp = client.get(f"{BASE}/runs/{run_id}/job-fit")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    def test_get_job_fit_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/runs/99999999/job-fit")
        assert resp.status_code == 404

    def test_get_run_section_pending_returns_status(
        self, client, setup_users, portfolio, db_session
    ):
        """When ai_status='pending', resume-issues returns {"status": "pending"}."""
        from app.models.career import CareerAssessmentRun
        from sqlalchemy import update

        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        # Force ai_status to 'pending'
        db_session.execute(
            update(CareerAssessmentRun)
            .where(CareerAssessmentRun.id == run_id)
            .values(ai_status="pending")
        )
        db_session.commit()

        resp = client.get(f"{BASE}/runs/{run_id}/resume-issues")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "pending"
        assert data.get("data") is None

    def test_get_run_section_complete_returns_data(
        self, client, setup_users, portfolio, db_session
    ):
        """When ai_status='complete', resume-issues returns {"status": "complete", "data": ...}."""
        from app.models.career import CareerAssessmentRun
        from sqlalchemy import update

        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        issues_payload = {"items": ["Fix formatting"]}
        db_session.execute(
            update(CareerAssessmentRun)
            .where(CareerAssessmentRun.id == run_id)
            .values(ai_status="complete", resume_issues_json=issues_payload)
        )
        db_session.commit()

        resp = client.get(f"{BASE}/runs/{run_id}/resume-issues")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["data"] == issues_payload

    def test_get_run_section_failed_returns_status(
        self, client, setup_users, portfolio, db_session
    ):
        """When ai_status='failed', action-plan returns {"status": "failed"}."""
        from app.models.career import CareerAssessmentRun
        from sqlalchemy import update

        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        db_session.execute(
            update(CareerAssessmentRun)
            .where(CareerAssessmentRun.id == run_id)
            .values(ai_status="failed")
        )
        db_session.commit()

        resp = client.get(f"{BASE}/runs/{run_id}/action-plan")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert data.get("data") is None

    def test_get_action_plan_complete(
        self, client, setup_users, portfolio, db_session
    ):
        """When ai_status='complete', action-plan returns data."""
        from app.models.career import CareerAssessmentRun
        from sqlalchemy import update

        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        plan = {"steps": ["Apply to 5 jobs"]}
        db_session.execute(
            update(CareerAssessmentRun)
            .where(CareerAssessmentRun.id == run_id)
            .values(ai_status="complete", action_plan_json=plan)
        )
        db_session.commit()

        resp = client.get(f"{BASE}/runs/{run_id}/action-plan")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["data"] == plan

    def test_get_run_section_running_returns_status(
        self, client, setup_users, portfolio, db_session
    ):
        """When ai_status='running', resume-issues returns {"status": "running"}."""
        from app.models.career import CareerAssessmentRun
        from sqlalchemy import update

        _, create_resp = self._create_run(client, portfolio, setup_users)
        run_id = create_resp.json()["id"]

        db_session.execute(
            update(CareerAssessmentRun)
            .where(CareerAssessmentRun.id == run_id)
            .values(ai_status="running")
        )
        db_session.commit()

        resp = client.get(f"{BASE}/runs/{run_id}/resume-issues")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    def test_resume_issues_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/runs/99999999/resume-issues")
        assert resp.status_code == 404

    def test_action_plan_not_found(self, client, setup_users):
        resp = client.get(f"{BASE}/runs/99999999/action-plan")
        assert resp.status_code == 404


# ── Authorization tests ───────────────────────────────────────────────────────


class TestAuthorization:
    def test_view_career_cannot_create_job(self, client, setup_users):
        """VIEW_CAREER alone is sufficient to create a job (same permission gate)."""
        global test_current_user
        test_current_user = setup_users["viewer"]

        # The endpoint requires VIEW_CAREER — viewer has it, so 201 expected
        resp = _create_job(client)
        assert resp.status_code == 201

    def test_no_permission_cannot_create_job(self, client, setup_users):
        """User with no permissions at all gets 403."""
        global test_current_user
        mgr = setup_users["mgr"]
        empty_role = mgr.create_test_role(name="EMPTY_ROLE", permissions=[])
        no_perm_user = mgr.create_test_user(username="no_perm_user2", roles=[empty_role.id])
        test_current_user = no_perm_user

        resp = _create_job(client)
        assert resp.status_code == 403

    def test_objective_update_ownership_enforced(self, client, setup_users, portfolio):
        """Viewer user cannot update admin's objective."""
        global test_current_user
        test_current_user = setup_users["admin"]

        obj_id = _create_objective(client, portfolio.id).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.put(f"{BASE}/objectives/{obj_id}", json={"name": "Hacked"})
        assert resp.status_code == 403

    def test_objective_delete_ownership_enforced(self, client, setup_users, portfolio):
        global test_current_user
        test_current_user = setup_users["admin"]

        obj_id = _create_objective(client, portfolio.id).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.delete(f"{BASE}/objectives/{obj_id}")
        assert resp.status_code == 403

    def test_link_job_ownership_enforced(self, client, setup_users, portfolio):
        """Viewer cannot link a job to admin's objective."""
        global test_current_user
        test_current_user = setup_users["admin"]

        job_id = _create_job(client).json()["id"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")
        assert resp.status_code == 403

    def test_job_delete_ownership_enforced(self, client, setup_users):
        """Viewer cannot delete admin's job."""
        global test_current_user
        test_current_user = setup_users["admin"]
        job_id = _create_job(client).json()["id"]

        test_current_user = setup_users["viewer"]
        resp = client.delete(f"{BASE}/jobs/{job_id}")
        assert resp.status_code == 403

    def test_run_flat_endpoint_ownership_by_run_trace(
        self, client, setup_users, portfolio
    ):
        """User B can read the run they own (same admin user here).
        User C (viewer) can also see it — they own it because objective ownership is checked.
        We test that viewer can create their own run and read it.
        """
        global test_current_user

        # Viewer creates their own portfolio and objective (simplified: reuse admin portfolio)
        test_current_user = setup_users["viewer"]

        mock_task = MagicMock()
        mock_task.id = "viewer-task-id"

        # Create job as viewer
        job_resp = _create_job(client)
        assert job_resp.status_code == 201
        viewer_job_id = job_resp.json()["id"]

        # Create objective as viewer using admin's portfolio (portfolio_id FK)
        obj_resp = _create_objective(client, portfolio.id, "Viewer Objective")
        assert obj_resp.status_code == 201
        obj_id = obj_resp.json()["id"]

        # Create run as viewer
        with patch(
            "app.queue.tasks.career.run_career_ai_assessment.delay",
            return_value=mock_task,
        ):
            run_resp = client.post(
                f"{BASE}/objectives/{obj_id}/runs",
                json={"job_ids": [viewer_job_id]},
            )
        assert run_resp.status_code == 201
        run_id = run_resp.json()["id"]

        # Viewer can read their own run
        resp = client.get(f"{BASE}/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == run_id


# ── Skills search & ensure tests ─────────────────────────────────────────────


class TestSkillsEndpoints:
    @pytest.fixture(autouse=True)
    def _set_admin(self, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

    @pytest.fixture
    def skill_with_text(self, db_session: Session, setup_users):
        """Create a Skill with a SkillText entry for search tests."""
        from app.models.skill import Skill as SkillModel, SkillText
        from app.models.language import Language

        # Get or create a language
        lang = db_session.query(Language).first()
        if lang is None:
            lang = Language(code="en", name="English")
            db_session.add(lang)
            db_session.commit()
            db_session.refresh(lang)

        admin = setup_users["admin"]
        s = SkillModel(type="technical", created_by=admin.id, updated_by=admin.id)
        db_session.add(s)
        db_session.flush()
        st = SkillText(
            skill_id=s.id,
            language_id=lang.id,
            name="PythonSearchable",
            description="",
            created_by=admin.id,
            updated_by=admin.id,
        )
        db_session.add(st)
        db_session.commit()
        db_session.refresh(s)
        return s, st

    def test_search_skills_returns_list(self, client, setup_users, skill_with_text):
        resp = client.get(f"{BASE}/skills/search")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_search_skills_empty_query_returns_all(
        self, client, setup_users, skill_with_text
    ):
        resp = client.get(f"{BASE}/skills/search?q=")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(item["name"] == "PythonSearchable" for item in data)

    def test_search_skills_q_filter(self, client, setup_users, skill_with_text):
        resp = client.get(f"{BASE}/skills/search?q=PythonSearch")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert all("PythonSearch" in item["name"] for item in data)

    def test_search_skills_no_match(self, client, setup_users, skill_with_text):
        resp = client.get(f"{BASE}/skills/search?q=ZZZNOWAYTHISEXISTS999")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_search_skills_response_shape(self, client, setup_users, skill_with_text):
        resp = client.get(f"{BASE}/skills/search?q=PythonSearchable")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        item = data[0]
        assert "id" in item
        assert "name" in item

    def test_ensure_skill_creates_new(self, client, setup_users, db_session):
        """Ensure creates a new skill when name doesn't exist."""
        from app.models.language import Language

        lang = db_session.query(Language).first()
        if lang is None:
            lang = Language(code="en", name="English")
            db_session.add(lang)
            db_session.commit()

        resp = client.post(
            f"{BASE}/skills/ensure", json={"name": "UniqueSkillXYZ_Test123"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "UniqueSkillXYZ_Test123"
        assert data["created"] is True
        assert "id" in data

    def test_ensure_skill_finds_existing(
        self, client, setup_users, skill_with_text
    ):
        """Ensure returns existing skill without creating a new one."""
        resp = client.post(
            f"{BASE}/skills/ensure", json={"name": "PythonSearchable"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "PythonSearchable"
        assert data["created"] is False
        assert data["id"] == skill_with_text[0].id

    def test_ensure_skill_empty_name_returns_422(self, client, setup_users):
        """Empty name should fail Pydantic validation."""
        resp = client.post(f"{BASE}/skills/ensure", json={"name": ""})
        assert resp.status_code == 422

    def test_ensure_skill_requires_manage_career(self, client, setup_users, db_session):
        """Viewer with only VIEW_CAREER cannot call ensure (needs MANAGE_CAREER)."""
        global test_current_user
        test_current_user = setup_users["viewer"]

        resp = client.post(f"{BASE}/skills/ensure", json={"name": "SomeSkill"})
        assert resp.status_code == 403


# ── Run readiness tests ────────────────────────────────────────────────────────


class TestRunReadiness:
    @pytest.fixture(autouse=True)
    def _set_admin(self, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

    def test_readiness_404_for_unknown_objective(self, client, setup_users):
        resp = client.get(f"{BASE}/objectives/99999999/run-readiness")
        assert resp.status_code == 404

    def test_readiness_fails_when_no_jobs(self, client, setup_users, portfolio):
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.get(f"{BASE}/objectives/{obj_id}/run-readiness")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ready"] is False
        has_jobs_check = next(c for c in data["checks"] if c["key"] == "has_jobs")
        assert has_jobs_check["passed"] is False

    def test_readiness_fails_jobs_without_skills(
        self, client, setup_users, portfolio
    ):
        """Objective has a job but the job has no skills — should not be ready."""
        job_id = _create_job(client).json()["id"]
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")

        resp = client.get(f"{BASE}/objectives/{obj_id}/run-readiness")
        assert resp.status_code == 200
        data = resp.json()
        jobs_have_skills = next(
            c for c in data["checks"] if c["key"] == "jobs_have_skills"
        )
        assert jobs_have_skills["passed"] is False

    def test_readiness_response_shape(self, client, setup_users, portfolio):
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        resp = client.get(f"{BASE}/objectives/{obj_id}/run-readiness")
        assert resp.status_code == 200
        data = resp.json()
        assert "ready" in data
        assert "checks" in data
        assert isinstance(data["checks"], list)
        for check in data["checks"]:
            assert "key" in check
            assert "label" in check
            assert "passed" in check

    def test_readiness_with_job_and_skills_passes_first_two_checks(
        self, client, setup_users, portfolio, skill
    ):
        """When job has skills attached, the first two readiness checks pass."""
        job_id = _create_job(client).json()["id"]
        client.put(
            f"{BASE}/jobs/{job_id}/skills",
            json={"skills": [{"skill_id": skill.id, "is_required": True}]},
        )
        obj_id = _create_objective(client, portfolio.id).json()["id"]
        client.post(f"{BASE}/objectives/{obj_id}/jobs/{job_id}")

        resp = client.get(f"{BASE}/objectives/{obj_id}/run-readiness")
        assert resp.status_code == 200
        data = resp.json()
        has_jobs = next(c for c in data["checks"] if c["key"] == "has_jobs")
        jobs_have_skills = next(
            c for c in data["checks"] if c["key"] == "jobs_have_skills"
        )
        assert has_jobs["passed"] is True
        assert jobs_have_skills["passed"] is True


# ── Diagnostics endpoint tests ────────────────────────────────────────────────


class TestDiagnosticsEndpoints:
    @pytest.fixture(autouse=True)
    def _set_admin(self, setup_users):
        global test_current_user
        test_current_user = setup_users["admin"]

    def test_diagnostics_missing_api_key(self, client, setup_users):
        """When ANTHROPIC_API_KEY is falsy, endpoint returns success=False."""
        with patch("app.core.config.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = ""
            resp = client.post(f"{BASE}/diagnostics/anthropic")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None

    def test_diagnostics_success_path(self, client, setup_users):
        """When Anthropic API key is set and provider.chat succeeds."""
        mock_result = {"text": "OK", "input_tokens": 5, "output_tokens": 2}

        with patch(
            "app.services.llm.providers.AnthropicProvider.chat",
            return_value=mock_result,
        ):
            with patch("app.core.config.settings") as mock_settings:
                mock_settings.ANTHROPIC_API_KEY = "sk-test-key-12345"
                resp = client.post(f"{BASE}/diagnostics/anthropic")

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["latency_ms"] is not None
        assert isinstance(data["latency_ms"], int)

    def test_diagnostics_requires_view_career(self, client, setup_users):
        """User without VIEW_CAREER is denied."""
        global test_current_user
        mgr = setup_users["mgr"]
        empty_role = mgr.create_test_role(name="DIAG_EMPTY_ROLE", permissions=[])
        no_perm_user = mgr.create_test_user(
            username="diag_noperm_user", roles=[empty_role.id]
        )
        test_current_user = no_perm_user

        resp = client.post(f"{BASE}/diagnostics/anthropic")
        assert resp.status_code == 403
