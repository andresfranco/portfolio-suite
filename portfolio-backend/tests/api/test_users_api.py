"""
User API Tests
---------------

This module contains tests for the User API endpoints using FastAPI TestClient.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.api import deps
from tests.utils import get_test_data_manager
from app.models.user import User
from typing import Dict, Any, Generator

# Define global variables to store session and user between fixtures
test_db_session = None
test_current_user = None

# Override the dependency to get the test database session
def override_get_db():
    """Override get_db dependency for testing."""
    try:
        yield test_db_session
    finally:
        if test_db_session:
            test_db_session.close()

# Override the dependency to get the current user for testing
def override_get_current_user():
    """Override get_current_user dependency for testing."""
    return test_current_user

# Apply the overrides
app.dependency_overrides[deps.get_db] = override_get_db
app.dependency_overrides[deps.get_current_user] = override_get_current_user

@pytest.fixture
def client() -> TestClient:
    """Return a TestClient instance for API testing."""
    return TestClient(app)

@pytest.fixture
def test_user(db_session: Session) -> User:
    """Create a test user to use for testing."""
    global test_db_session, test_current_user
    test_db_session = db_session
    
    test_manager = get_test_data_manager(db_session)
    user = test_manager.create_test_user()
    test_current_user = user
    
    yield user
    test_manager.cleanup()

@pytest.fixture
def test_admin_and_role(db_session: Session) -> Dict[str, Any]:
    """Create a test admin user and role for testing."""
    global test_db_session, test_current_user
    test_db_session = db_session
    
    test_manager = get_test_data_manager(db_session)
    
    # Create a test role
    role = test_manager.create_test_role(name="TEST_ADMIN_ROLE")
    
    # Create a test admin user with the role
    admin = test_manager.create_test_user(
        username="test_admin",
        email="test_admin@example.com",
        roles=[role.id]
    )
    
    test_current_user = admin
    
    yield {"admin": admin, "role": role}
    test_manager.cleanup()

class TestUsersAPI:
    """Tests for the users API endpoints."""
    
    def test_read_users(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test reading users list."""
        # Create some test users to retrieve
        test_manager = get_test_data_manager(db_session)
        for i in range(3):
            test_manager.create_test_user(username=f"test_list_user_{i}")
        
        try:
            # Call the API to get users
            response = client.get("/api/users/")
            
            # Check that the response is successful
            assert response.status_code == 200
            
            # Check the response structure
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data
            assert "pageSize" in data or "page_size" in data
            
            # Check that we have at least the admin user and the 3 created users
            assert data["total"] >= 4
            
            # Clean up the test users
        finally:
            test_manager.cleanup()
    
    def test_read_user(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test reading a specific user."""
        # Create a test user to retrieve
        test_manager = get_test_data_manager(db_session)
        test_user = test_manager.create_test_user(username="test_get_user")
        
        try:
            # Call the API to get the user
            response = client.get(f"/api/users/{test_user.id}")
            
            # Check that the response is successful
            assert response.status_code == 200
            
            # Check the response data
            data = response.json()
            assert data["id"] == test_user.id
            assert data["username"] == test_user.username
            assert data["email"] == test_user.email
        finally:
            test_manager.cleanup()
    
    def test_create_user(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test creating a user."""
        # Get the role to assign to the new user
        role_id = test_admin_and_role["role"].id
        
        # Create user data
        user_data = {
            "username": "test_create_user",
            "email": "test_create_user@example.com",
            "password": "TestP@ssw0rd123",
            "roles": [role_id]
        }
        
        # Call the API to create the user
        response = client.post("/api/users/", json=user_data)
        
        # Check that the response is successful
        assert response.status_code == 200
        
        # Check the response data
        data = response.json()
        assert data["username"] == user_data["username"]
        assert data["email"] == user_data["email"]
        
        # Clean up the created user
        from app.crud.user import delete_user
        delete_user(db_session, data["id"])
    
    def test_update_user(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test updating a user."""
        # Create a test user to update
        test_manager = get_test_data_manager(db_session)
        test_user = test_manager.create_test_user(username="test_update_user")
        
        try:
            # Update data
            update_data = {
                "email": "updated_email@example.com"
            }
            
            # Call the API to update the user
            response = client.put(f"/api/users/{test_user.id}", json=update_data)
            
            # Check that the response is successful
            assert response.status_code == 200
            
            # Check the response data
            data = response.json()
            assert data["id"] == test_user.id
            assert data["username"] == test_user.username
            assert data["email"] == update_data["email"]
        finally:
            test_manager.cleanup()
    
    def test_delete_user(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test deleting a user."""
        # Create a test user to delete
        test_manager = get_test_data_manager(db_session)
        test_user = test_manager.create_test_user(username="test_delete_user")
        user_id = test_user.id
        
        # Call the API to delete the user
        response = client.delete(f"/api/users/{user_id}")
        
        # Check that the response is successful (204 No Content)
        assert response.status_code == 204
        
        # Verify the user was deleted by trying to get it
        from app.crud.user import get_user
        deleted_user = get_user(db_session, user_id)
        assert deleted_user is None
        
        # No need to clean up as the user was deleted
        test_manager.created_records.clear()
    
    def test_change_password(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test changing a user's password."""
        # Create a test user to change password
        test_manager = get_test_data_manager(db_session)
        password = "TestP@ssw0rd123"
        test_user = test_manager.create_test_user(
            username="test_change_pwd_user",
            password=password
        )
        
        try:
            # Password change data
            password_data = {
                "username": test_user.username,
                "password": "NewP@ssw0rd456",
                "password_confirmation": "NewP@ssw0rd456"
            }
            
            # Call the API to change the password
            response = client.post(f"/api/users/{test_user.id}/change-password", json=password_data)
            
            # Check that the response is successful
            assert response.status_code == 200
            
            # Check the response data
            data = response.json()
            assert data["id"] == test_user.id
            
            # Verify the password was changed
            from app.models.user import User
            db_user = db_session.query(User).filter(User.id == test_user.id).first()
            assert db_user.verify_password(password_data["password"])
            assert not db_user.verify_password(password)
        finally:
            test_manager.cleanup()
    
    def test_user_not_found(self, client: TestClient, test_admin_and_role: Dict[str, Any]):
        """Test error handling when a user is not found."""
        # Use a non-existent user ID
        non_existent_id = 99999
        
        # Call the API to get a non-existent user
        response = client.get(f"/api/users/{non_existent_id}")
        
        # Check that the response is 404 Not Found
        assert response.status_code == 404
        
        # Check the error message
        error = response.json()
        assert "detail" in error
        assert "not found" in error["detail"].lower()
    
    def test_username_already_exists(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test error handling when creating a user with an existing username."""
        # Create a test user first
        test_manager = get_test_data_manager(db_session)
        existing_user = test_manager.create_test_user(username="existing_username")
        role_id = test_admin_and_role["role"].id
        
        try:
            # Try to create another user with the same username
            user_data = {
                "username": existing_user.username,
                "email": "different_email@example.com",
                "password": "TestP@ssw0rd123",
                "roles": [role_id]
            }
            
            # Call the API to create the user
            response = client.post("/api/users/", json=user_data)
            
            # Check that the response is 400 Bad Request
            assert response.status_code == 400
            
            # Check the error message
            error = response.json()
            assert "detail" in error
            assert "username already exists" in error["detail"].lower()
        finally:
            test_manager.cleanup()
    
    def test_email_already_exists(self, client: TestClient, test_admin_and_role: Dict[str, Any], db_session: Session):
        """Test error handling when creating a user with an existing email."""
        # Create a test user first
        test_manager = get_test_data_manager(db_session)
        existing_user = test_manager.create_test_user(email="existing_email@example.com")
        role_id = test_admin_and_role["role"].id
        
        try:
            # Try to create another user with the same email
            user_data = {
                "username": "different_username",
                "email": existing_user.email,
                "password": "TestP@ssw0rd123",
                "roles": [role_id]
            }
            
            # Call the API to create the user
            response = client.post("/api/users/", json=user_data)
            
            # Check that the response is 400 Bad Request
            assert response.status_code == 400
            
            # Check the error message
            error = response.json()
            assert "detail" in error
            assert "email already exists" in error["detail"].lower()
        finally:
            test_manager.cleanup() 