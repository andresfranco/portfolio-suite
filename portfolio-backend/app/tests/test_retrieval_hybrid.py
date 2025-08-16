from app.main import app
from app.api import deps
from fastapi.testclient import TestClient


def test_hybrid_accepts_websearch_query():
	class _U:
		is_active = True
		tenant_id = 'default'
		id = 1
		roles = []
	app.dependency_overrides[deps.get_current_user] = lambda: _U()
	c = TestClient(app)
	r = c.get('/api/search/hybrid', params={'q': 'healthcare OR data -diagram', 'limit': 5})
	assert r.status_code == 200
	app.dependency_overrides.clear()
