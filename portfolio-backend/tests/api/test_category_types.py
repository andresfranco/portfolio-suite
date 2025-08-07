from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.db.session import SessionLocal
from app.models.category_type import CategoryType
from sqlalchemy.orm import Session
import json
from app.crud.category_type import get_category_type, get_category_types_paginated
from unittest.mock import patch

client = TestClient(app)

@pytest.fixture
def db_session():
    """Fixture to provide a database session for tests"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_read_category_types():
    """Test reading paginated category types"""
    response = client.get("/api/category-types/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pageSize" in data

def test_read_category_types_with_filters():
    """Test reading category types with filters"""
    # Test with direct query parameters
    response = client.get("/api/category-types/?code=TEST")
    assert response.status_code == 200
    
    # Test with JSON filters
    filters = [{"field": "name", "value": "test", "operator": "contains"}]
    response = client.get(f"/api/category-types/?filters={json.dumps(filters)}")
    assert response.status_code == 200

def test_read_category_type_not_found():
    """Test reading a non-existent category type"""
    response = client.get("/api/category-types/NONEXISTENT")
    assert response.status_code == 404
    assert response.json()["detail"] == "Category type not found"

def test_create_update_delete_category_type():
    """Test the full CRUD lifecycle for a category type"""
    # Create a test category type
    category_type_data = {
        "code": "TEST",
        "name": "Test Category Type"
    }
    
    # Create
    create_response = client.post("/api/category-types/", json=category_type_data)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["code"] == "TEST"
    assert created_data["name"] == "Test Category Type"
    
    # Read
    read_response = client.get(f"/api/category-types/{created_data['code']}")
    assert read_response.status_code == 200
    assert read_response.json()["code"] == created_data["code"]
    
    # Update
    update_data = {"name": "Updated Test Category Type"}
    update_response = client.put(f"/api/category-types/{created_data['code']}", json=update_data)
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["name"] == "Updated Test Category Type"
    
    # Delete
    delete_response = client.delete(f"/api/category-types/{created_data['code']}")
    assert delete_response.status_code == 204
    
    # Verify deletion
    verify_response = client.get(f"/api/category-types/{created_data['code']}")
    assert verify_response.status_code == 404

def test_check_code_exists(db_session: Session):
    """Test checking if a category type code exists"""
    # Create a test category type directly in the database
    test_category_type = CategoryType(code="CHECK", name="Check Category Type")
    db_session.add(test_category_type)
    db_session.commit()
    
    try:
        # Check existing code
        response = client.get("/api/category-types/check-code/CHECK")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/category-types/check-code/NONEXISTENT")
        assert response.status_code == 200
        assert response.json()["exists"] is False
    finally:
        # Clean up
        db_session.delete(test_category_type)
        db_session.commit()

def test_get_all_category_type_codes():
    """Test getting all category type codes"""
    response = client.get("/api/category-types/codes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    
    # Check cache header
    assert "Cache-Control" in response.headers
    assert "public, max-age=300" in response.headers["Cache-Control"]

class TestCategoryTypesAPI:
    """Test suite for Category Types API endpoints"""

    def test_read_category_types_success(self, db_session: Session):
        """Test successful retrieval of category types with pagination"""
        response = client.get("/api/category-types/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pageSize" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_read_category_types_with_pagination(self, db_session: Session):
        """Test category types retrieval with custom pagination parameters"""
        response = client.get("/api/category-types/?page=1&page_size=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["pageSize"] == 5

    def test_read_category_types_with_filters(self, db_session: Session):
        """Test category types retrieval with filtering"""
        filters = [{"field": "code", "value": "TEST", "operator": "contains"}]
        response = client.get(f"/api/category-types/?filters={json.dumps(filters)}")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_read_category_types_with_legacy_filters(self, db_session: Session):
        """Test category types retrieval with legacy filter parameters"""
        response = client.get("/api/category-types/?code=GEN&name=General")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_read_category_types_with_sorting(self, db_session: Session):
        """Test category types retrieval with sorting"""
        response = client.get("/api/category-types/?sort_field=code&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_get_all_category_type_codes(self, db_session: Session):
        """Test retrieval of all category type codes"""
        response = client.get("/api/category-types/codes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_category_type_success(self, db_session: Session):
        """Test successful category type creation"""
        category_type_data = {
            "code": "TEST",
            "name": "Test Category Type"
        }
        
        response = client.post("/api/category-types/", json=category_type_data)
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "TEST"
        assert data["name"] == "Test Category Type"
        
        # Clean up
        client.delete(f"/api/category-types/{data['code']}")

    def test_create_category_type_duplicate_code(self, db_session: Session):
        """Test category type creation with duplicate code returns 409"""
        category_type_data = {
            "code": "DUP",
            "name": "Duplicate Test"
        }
        
        # Create first category type
        response1 = client.post("/api/category-types/", json=category_type_data)
        assert response1.status_code == 201
        
        # Try to create duplicate
        response2 = client.post("/api/category-types/", json=category_type_data)
        assert response2.status_code == 409
        assert "already exists" in response2.json()["detail"]
        
        # Clean up
        client.delete(f"/api/category-types/{category_type_data['code']}")

    def test_create_category_type_invalid_data(self, db_session: Session):
        """Test category type creation with invalid data returns 422"""
        category_type_data = {
            "code": "",  # Invalid empty code
            "name": ""   # Invalid empty name
        }
        
        response = client.post("/api/category-types/", json=category_type_data)
        assert response.status_code == 422

    def test_create_category_type_code_too_long(self, db_session: Session):
        """Test category type creation with code longer than 5 characters"""
        category_type_data = {
            "code": "TOOLONG",  # More than 5 characters
            "name": "Test"
        }
        
        response = client.post("/api/category-types/", json=category_type_data)
        assert response.status_code == 422

    def test_check_category_type_code_exists(self, db_session: Session):
        """Test category type code existence check"""
        # First create a category type
        category_type_data = {
            "code": "EXIST",
            "name": "Existence Test"
        }
        
        create_response = client.post("/api/category-types/", json=category_type_data)
        assert create_response.status_code == 201
        
        # Check existing code
        response = client.get("/api/category-types/check-code/EXIST")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/category-types/check-code/NONEXIST")
        assert response.status_code == 200
        assert response.json()["exists"] is False
        
        # Clean up
        client.delete("/api/category-types/EXIST")

    def test_read_category_type_by_code_success(self, db_session: Session):
        """Test successful retrieval of category type by code"""
        # First create a category type
        category_type_data = {
            "code": "READ",
            "name": "Read Test"
        }
        
        create_response = client.post("/api/category-types/", json=category_type_data)
        assert create_response.status_code == 201
        
        # Now read it by code
        response = client.get("/api/category-types/READ")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "READ"
        assert data["name"] == "Read Test"
        
        # Clean up
        client.delete("/api/category-types/READ")

    def test_read_category_type_not_found(self, db_session: Session):
        """Test reading non-existent category type returns 404"""
        response = client.get("/api/category-types/NONEXIST")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_category_type_success(self, db_session: Session):
        """Test successful category type update"""
        # First create a category type
        category_type_data = {
            "code": "UPD",
            "name": "Original Name"
        }
        
        create_response = client.post("/api/category-types/", json=category_type_data)
        assert create_response.status_code == 201
        
        # Update the category type
        update_data = {
            "name": "Updated Name"
        }
        
        response = client.put("/api/category-types/UPD", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "UPD"
        assert data["name"] == "Updated Name"
        
        # Clean up
        client.delete("/api/category-types/UPD")

    def test_update_category_type_code_change(self, db_session: Session):
        """Test category type update with code change"""
        # First create a category type
        category_type_data = {
            "code": "OLD",
            "name": "Old Code"
        }
        
        create_response = client.post("/api/category-types/", json=category_type_data)
        assert create_response.status_code == 201
        
        # Update with new code
        update_data = {
            "code": "NEW",
            "name": "New Code"
        }
        
        response = client.put("/api/category-types/OLD", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "NEW"
        
        # Verify old code doesn't exist
        old_response = client.get("/api/category-types/OLD")
        assert old_response.status_code == 404
        
        # Clean up
        client.delete("/api/category-types/NEW")

    def test_update_category_type_not_found(self, db_session: Session):
        """Test updating non-existent category type returns 404"""
        update_data = {
            "name": "Updated Name"
        }
        
        response = client.put("/api/category-types/NONEXIST", json=update_data)
        assert response.status_code == 404

    def test_delete_category_type_success(self, db_session: Session):
        """Test successful category type deletion"""
        # First create a category type
        category_type_data = {
            "code": "DEL",
            "name": "Delete Test"
        }
        
        create_response = client.post("/api/category-types/", json=category_type_data)
        assert create_response.status_code == 201
        
        # Delete the category type
        response = client.delete("/api/category-types/DEL")
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = client.get("/api/category-types/DEL")
        assert get_response.status_code == 404

    def test_delete_category_type_not_found(self, db_session: Session):
        """Test deleting non-existent category type returns 404"""
        response = client.delete("/api/category-types/NONEXIST")
        assert response.status_code == 404


class TestCategoryTypesCRUD:
    """Test suite for Category Types CRUD operations"""
    
    @patch('app.crud.category_type.db')
    def test_get_category_type(self, mock_db):
        """Test getting a category type by code"""
        mock_category_type = CategoryType(code="TEST", name="Test Type")
        mock_db.query.return_value.filter.return_value.first.return_value = mock_category_type
        
        result = get_category_type(mock_db, "TEST")
        assert result == mock_category_type
        
    @patch('app.crud.category_type.db')
    def test_get_category_types_paginated(self, mock_db):
        """Test getting paginated category types"""
        mock_category_types = [
            CategoryType(code="TEST1", name="Test Type 1"),
            CategoryType(code="TEST2", name="Test Type 2")
        ]
        
        # This would need more detailed mocking for the actual QueryBuilder implementation
        # The test structure is provided for reference
        pass

    def test_category_type_validation(self):
        """Test category type model validation"""
        # Test valid category type
        valid_type = CategoryType(code="VALID", name="Valid Type")
        assert valid_type.code == "VALID"
        assert valid_type.name == "Valid Type"
        
        # Additional validation tests can be added here
        pass 