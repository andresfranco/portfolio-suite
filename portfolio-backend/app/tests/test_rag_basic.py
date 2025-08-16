from app.main import app
from app.api import deps
from fastapi.testclient import TestClient


def test_search_endpoints_smoke():
    # Override auth to bypass JWT for this smoke test
    class _User:
        is_active = True
        id = 1
        roles = []

    app.dependency_overrides[deps.get_current_user] = lambda: _User()
    c = TestClient(app)
    r = c.get('/api/search/embedding', params={'limit': 3})
    assert r.status_code == 200
    r = c.get('/api/search/vector', params={'q': 'hello world', 'limit': 3})
    assert r.status_code == 200
    r = c.get('/api/search/hybrid', params={'q': 'hello world', 'limit': 3})
    assert r.status_code == 200
    app.dependency_overrides.clear()


