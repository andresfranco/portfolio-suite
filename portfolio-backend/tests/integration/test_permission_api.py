"""
Integration tests for the Permission API endpoints
"""
import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate
from tests.utils import get_test_data_manager

class TestPermissionAPI:
    """Integration tests for Permission API endpoints"""
    
    def test_get_permissions(self, client: TestClient, db_session: Session):
        """Test getting a list of permissions"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create some test permissions
            permissions = [
                test_manager.create_test_permission(name=f"TEST_API_PERM_{i}")
                for i in range(3)
            ]
            
            # Call the API endpoint for first page
            response = client.get("/api/permissions/")
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert data["total"] >= 3  # At least our test permissions
            
            # Verify our test permissions are in the results
            perm_names = [p.name for p in permissions]
            result_names = [item["name"] for item in data["items"]]
            
            # Check if at least one of our test permissions is in the results
            found = any(name in result_names for name in perm_names)
            
            # If not found in first page, try second page
            if not found and data["total"] > len(data["items"]):
                response = client.get("/api/permissions/?page=2")
                assert response.status_code == 200
                data = response.json()
                result_names = [item["name"] for item in data["items"]]
                found = any(name in result_names for name in perm_names)
            
            assert found, f"None of our test permissions {perm_names} found in results"
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_create_permission(self, client: TestClient, db_session: Session):
        """Test creating a permission via API"""
        # Generate unique permission data
        unique_suffix = uuid.uuid4().hex[:8].upper()
        test_name = f"TEST_API_CREATE_{unique_suffix}"
        test_data = {
            "name": test_name,
            "description": "Test permission created via API"
        }
        
        # Create permission via API
        response = client.post("/api/permissions/", json=test_data)
        
        # Verify response
        assert response.status_code == 201, f"Failed to create permission: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["name"] == test_name
        
        # Verify permission was created in the database
        created_id = data["id"]
        
        try:
            # Fetch from database to confirm it exists
            created_permission = db_session.query(Permission).filter(Permission.id == created_id).first()
            assert created_permission is not None
            assert created_permission.name == test_name
        finally:
            # Clean up
            if created_id:
                # Delete the permission we created
                db_session.query(Permission).filter(Permission.id == created_id).delete()
                db_session.commit()
    
    def test_get_permission_by_id(self, client: TestClient, db_session: Session):
        """Test getting a permission by ID"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create a test permission
            permission = test_manager.create_test_permission()
            
            # Call the API endpoint
            response = client.get(f"/api/permissions/{permission.id}")
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == permission.id
            assert data["name"] == permission.name
            assert data["description"] == permission.description
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_update_permission(self, client: TestClient, db_session: Session):
        """Test updating a permission via API"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create a test permission
            permission = test_manager.create_test_permission()
            
            # Update data
            update_data = {
                "description": "Updated via API test"
            }
            
            # Call the API endpoint
            response = client.put(f"/api/permissions/{permission.id}", json=update_data)
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == permission.id
            assert data["name"] == permission.name  # Name should not change
            assert data["description"] == update_data["description"]
            
            # Verify update in database - refresh data from the database
            db_session.expire_all()  # Force refresh of all objects
            
            updated_permission = db_session.query(Permission).filter(Permission.id == permission.id).first()
            assert updated_permission is not None
            assert updated_permission.description == update_data["description"]
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_delete_permission(self, client: TestClient, db_session: Session):
        """Test deleting a permission via API"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        # Create a test permission
        permission = test_manager.create_test_permission()
        permission_id = permission.id
        
        # Call the API endpoint
        response = client.delete(f"/api/permissions/{permission_id}")
        
        # Verify response
        assert response.status_code == 204
        
        # Verify deletion in database
        deleted_permission = db_session.query(Permission).filter(Permission.id == permission_id).first()
        assert deleted_permission is None
        
        # No need for cleanup since we already deleted it
        test_manager.created_records.clear()
    
    def test_permission_name_conflict(self, client: TestClient, db_session: Session):
        """Test that creating a permission with duplicate name returns a conflict error"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create a test permission
            test_name = f"TEST_API_CONFLICT_{uuid.uuid4().hex[:8].upper()}"
            permission = test_manager.create_test_permission(name=test_name)
            
            # Try to create another permission with the same name
            duplicate_data = {
                "name": test_name,
                "description": "This should cause a conflict"
            }
            
            # Call the API endpoint
            response = client.post("/api/permissions/", json=duplicate_data)
            
            # Verify response is a conflict
            assert response.status_code == 409
            data = response.json()
            assert "detail" in data
            assert "already exists" in data["detail"].lower()
        finally:
            # Clean up test data
            test_manager.cleanup() 