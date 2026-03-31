"""Unit test configuration — overrides DB fixtures so pure-logic tests need no database."""
import pytest


@pytest.fixture(scope="session")
def test_engine():
    """No-op override: unit tests don't need a database engine."""
    return None


@pytest.fixture(scope="session", autouse=True)
def cleanup_database(test_engine):
    """No-op override: unit tests have nothing to clean up."""
    yield
