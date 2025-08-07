import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from typing import Generator
import os
import sys

# Add the parent directories to Python path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings

# Create a test database engine
TEST_DATABASE_URL = settings.DATABASE_URL + "_test"
engine = create_engine(TEST_DATABASE_URL)

# Create a TestingSessionLocal
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """
    Create a fresh database for each test, then drop it afterwards.
    """
    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create session
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop tables after test
        Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    """
    Create a test client using the test database.
    """
    def override_get_db():
        try:
            yield db
        finally:
            pass

    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as c:
        yield c
        
    # Clear dependency override
    app.dependency_overrides.clear() 