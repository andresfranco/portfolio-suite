from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.db.session import SessionLocal
from app.models.skill_type import SkillType
from sqlalchemy.orm import Session
import json
from app.crud.skill_type import get_skill_type, get_skill_types_paginated
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

def test_read_skill_types():
    """Test reading paginated skill types"""
    response = client.get("/api/skill-types/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pageSize" in data

def test_read_skill_types_with_filters():
    """Test reading skill types with filters"""
    # Test with direct query parameters
    response = client.get("/api/skill-types/?code=TEST")
    assert response.status_code == 200
    
    # Test with JSON filters
    filters = [{"field": "name", "value": "test", "operator": "contains"}]
    response = client.get(f"/api/skill-types/?filters={json.dumps(filters)}")
    assert response.status_code == 200

def test_read_skill_type_not_found():
    """Test reading a non-existent skill type"""
    response = client.get("/api/skill-types/NONEXISTENT")
    assert response.status_code == 404
    assert response.json()["detail"] == "Skill type not found"

def test_create_update_delete_skill_type():
    """Test the full CRUD lifecycle for a skill type"""
    # Create a test skill type
    skill_type_data = {
        "code": "TEST",
        "name": "Test Skill Type"
    }
    
    # Create
    create_response = client.post("/api/skill-types/", json=skill_type_data)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["code"] == "TEST"
    assert created_data["name"] == "Test Skill Type"
    
    # Read
    read_response = client.get(f"/api/skill-types/{created_data['code']}")
    assert read_response.status_code == 200
    assert read_response.json()["code"] == created_data["code"]
    
    # Update
    update_data = {"name": "Updated Test Skill Type"}
    update_response = client.put(f"/api/skill-types/{created_data['code']}", json=update_data)
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["name"] == "Updated Test Skill Type"
    
    # Delete
    delete_response = client.delete(f"/api/skill-types/{created_data['code']}")
    assert delete_response.status_code == 204
    
    # Verify deletion
    verify_response = client.get(f"/api/skill-types/{created_data['code']}")
    assert verify_response.status_code == 404

def test_check_code_exists(db_session: Session):
    """Test checking if a skill type code exists"""
    # Create a test skill type directly in the database
    test_skill_type = SkillType(code="CHECK", name="Check Skill Type")
    db_session.add(test_skill_type)
    db_session.commit()
    
    try:
        # Check existing code
        response = client.get("/api/skill-types/check-code/CHECK")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/skill-types/check-code/NONEXISTENT")
        assert response.status_code == 200
        assert response.json()["exists"] is False
    finally:
        # Clean up
        db_session.delete(test_skill_type)
        db_session.commit()

def test_get_all_skill_type_codes():
    """Test getting all skill type codes"""
    response = client.get("/api/skill-types/codes")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    
    # Check cache header
    assert "Cache-Control" in response.headers
    assert "public, max-age=300" in response.headers["Cache-Control"]

class TestSkillTypesAPI:
    """Test suite for Skill Types API endpoints"""

    def test_read_skill_types_success(self, db_session: Session):
        """Test successful retrieval of skill types with pagination"""
        response = client.get("/api/skill-types/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "pageSize" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_read_skill_types_with_pagination(self, db_session: Session):
        """Test skill types retrieval with custom pagination parameters"""
        response = client.get("/api/skill-types/?page=1&page_size=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["pageSize"] == 5

    def test_read_skill_types_with_filters(self, db_session: Session):
        """Test skill types retrieval with filtering"""
        filters = [{"field": "code", "value": "TEST", "operator": "contains"}]
        response = client.get(f"/api/skill-types/?filters={json.dumps(filters)}")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_read_skill_types_with_legacy_filters(self, db_session: Session):
        """Test skill types retrieval with legacy filter parameters"""
        response = client.get("/api/skill-types/?code=PROG&name=Programming")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_read_skill_types_with_sorting(self, db_session: Session):
        """Test skill types retrieval with sorting"""
        response = client.get("/api/skill-types/?sort_field=code&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_get_all_skill_type_codes(self, db_session: Session):
        """Test retrieval of all skill type codes"""
        response = client.get("/api/skill-types/codes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_skill_type_success(self, db_session: Session):
        """Test successful skill type creation"""
        skill_type_data = {
            "code": "TEST",
            "name": "Test Skill Type"
        }
        
        response = client.post("/api/skill-types/", json=skill_type_data)
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "TEST"
        assert data["name"] == "Test Skill Type"
        
        # Clean up
        client.delete(f"/api/skill-types/{data['code']}")

    def test_create_skill_type_duplicate_code(self, db_session: Session):
        """Test skill type creation with duplicate code returns 409"""
        skill_type_data = {
            "code": "DUP",
            "name": "Duplicate Test"
        }
        
        # Create first skill type
        response1 = client.post("/api/skill-types/", json=skill_type_data)
        assert response1.status_code == 201
        
        # Try to create duplicate
        response2 = client.post("/api/skill-types/", json=skill_type_data)
        assert response2.status_code == 409
        assert "already exists" in response2.json()["detail"]
        
        # Clean up
        client.delete(f"/api/skill-types/{skill_type_data['code']}")

    def test_create_skill_type_invalid_data(self, db_session: Session):
        """Test skill type creation with invalid data returns 422"""
        skill_type_data = {
            "code": "",  # Invalid empty code
            "name": ""   # Invalid empty name
        }
        
        response = client.post("/api/skill-types/", json=skill_type_data)
        assert response.status_code == 422

    def test_create_skill_type_code_too_long(self, db_session: Session):
        """Test skill type creation with code longer than 5 characters"""
        skill_type_data = {
            "code": "TOOLONG",  # More than 5 characters
            "name": "Test"
        }
        
        response = client.post("/api/skill-types/", json=skill_type_data)
        assert response.status_code == 422

    def test_check_skill_type_code_exists(self, db_session: Session):
        """Test skill type code existence check"""
        # First create a skill type
        skill_type_data = {
            "code": "EXIST",
            "name": "Existence Test"
        }
        
        create_response = client.post("/api/skill-types/", json=skill_type_data)
        assert create_response.status_code == 201
        
        # Check existing code
        response = client.get("/api/skill-types/check-code/EXIST")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/skill-types/check-code/NONEXIST")
        assert response.status_code == 200
        assert response.json()["exists"] is False
        
        # Clean up
        client.delete("/api/skill-types/EXIST")

    def test_read_skill_type_by_code_success(self, db_session: Session):
        """Test successful retrieval of skill type by code"""
        # First create a skill type
        skill_type_data = {
            "code": "READ",
            "name": "Read Test"
        }
        
        create_response = client.post("/api/skill-types/", json=skill_type_data)
        assert create_response.status_code == 201
        
        # Now read it by code
        response = client.get("/api/skill-types/READ")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "READ"
        assert data["name"] == "Read Test"
        
        # Clean up
        client.delete("/api/skill-types/READ")

    def test_read_skill_type_not_found(self, db_session: Session):
        """Test reading non-existent skill type returns 404"""
        response = client.get("/api/skill-types/NONEXIST")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_skill_type_success(self, db_session: Session):
        """Test successful skill type update"""
        # First create a skill type
        skill_type_data = {
            "code": "UPD",
            "name": "Original Name"
        }
        
        create_response = client.post("/api/skill-types/", json=skill_type_data)
        assert create_response.status_code == 201
        
        # Update the skill type
        update_data = {
            "name": "Updated Name"
        }
        
        response = client.put("/api/skill-types/UPD", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "UPD"
        assert data["name"] == "Updated Name"
        
        # Clean up
        client.delete("/api/skill-types/UPD")

    def test_update_skill_type_code_change(self, db_session: Session):
        """Test skill type update with code change"""
        # First create a skill type
        skill_type_data = {
            "code": "OLD",
            "name": "Old Code"
        }
        
        create_response = client.post("/api/skill-types/", json=skill_type_data)
        assert create_response.status_code == 201
        
        # Update with new code
        update_data = {
            "code": "NEW",
            "name": "New Code"
        }
        
        response = client.put("/api/skill-types/OLD", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "NEW"
        
        # Verify old code doesn't exist
        old_response = client.get("/api/skill-types/OLD")
        assert old_response.status_code == 404
        
        # Clean up
        client.delete("/api/skill-types/NEW")

    def test_update_skill_type_not_found(self, db_session: Session):
        """Test updating non-existent skill type returns 404"""
        update_data = {
            "name": "Updated Name"
        }
        
        response = client.put("/api/skill-types/NONEXIST", json=update_data)
        assert response.status_code == 404

    def test_delete_skill_type_success(self, db_session: Session):
        """Test successful skill type deletion"""
        # First create a skill type
        skill_type_data = {
            "code": "DEL",
            "name": "Delete Test"
        }
        
        create_response = client.post("/api/skill-types/", json=skill_type_data)
        assert create_response.status_code == 201
        
        # Delete the skill type
        response = client.delete("/api/skill-types/DEL")
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = client.get("/api/skill-types/DEL")
        assert get_response.status_code == 404

    def test_delete_skill_type_not_found(self, db_session: Session):
        """Test deleting non-existent skill type returns 404"""
        response = client.delete("/api/skill-types/NONEXIST")
        assert response.status_code == 404


class TestSkillTypesCRUD:
    """Test suite for Skill Types CRUD operations"""
    
    @patch('app.crud.skill_type.db')
    def test_get_skill_type(self, mock_db):
        """Test getting a skill type by code"""
        mock_skill_type = SkillType(code="TEST", name="Test Type")
        mock_db.query.return_value.filter.return_value.first.return_value = mock_skill_type
        
        result = get_skill_type(mock_db, "TEST")
        assert result == mock_skill_type
        
    @patch('app.crud.skill_type.db')
    def test_get_skill_types_paginated(self, mock_db):
        """Test getting paginated skill types"""
        mock_skill_types = [
            SkillType(code="TEST1", name="Test Type 1"),
            SkillType(code="TEST2", name="Test Type 2")
        ]
        
        # This would need more detailed mocking for the actual QueryBuilder implementation
        # The test structure is provided for reference
        pass

    def test_skill_type_validation(self):
        """Test skill type model validation"""
        # Test valid skill type
        valid_type = SkillType(code="VALID", name="Valid Type")
        assert valid_type.code == "VALID"
        assert valid_type.name == "Valid Type"
        
        # Additional validation tests can be added here
        pass 