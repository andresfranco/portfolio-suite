from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.db.session import SessionLocal
from app.models.category import Category, CategoryText
from app.models.language import Language
from sqlalchemy.orm import Session
import json
from app.models.category_type import CategoryType
from app.crud.category import get_category, get_categories_paginated
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

@pytest.fixture
def default_language(db_session: Session):
    """Fixture to ensure there's a default language for testing"""
    language = db_session.query(Language).filter(Language.is_default == True).first()
    if not language:
        language = db_session.query(Language).first()
    
    if not language:
        # Create a language if none exists
        language = Language(
            code="en",
            name="English",
            is_default=True
        )
        db_session.add(language)
        db_session.commit()
    
    return language

def test_read_categories():
    """Test reading paginated categories"""
    response = client.get("/api/categories/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

def test_read_categories_with_pagination():
    """Test reading categories with different pagination parameters"""
    # Test with custom page and page_size
    response = client.get("/api/categories/?page=2&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 2
    assert data["page_size"] == 5
    
    # Test with invalid pagination (should return 422)
    response = client.get("/api/categories/?page=0&page_size=5")
    assert response.status_code == 422
    
    response = client.get("/api/categories/?page=1&page_size=101")
    assert response.status_code == 422

def test_read_categories_with_filters():
    """Test reading categories with filters"""
    # Test with direct query parameters
    response = client.get("/api/categories/?code=TEST")
    assert response.status_code == 200
    
    # Test with JSON filters
    filters = [{"field": "name", "value": "test", "operator": "contains"}]
    response = client.get(f"/api/categories/?filters={json.dumps(filters)}")
    assert response.status_code == 200
    
    # Test with multiple filters
    filters = [
        {"field": "code", "value": "TEST", "operator": "contains"},
        {"field": "name", "value": "test", "operator": "contains"}
    ]
    response = client.get(f"/api/categories/?filters={json.dumps(filters)}")
    assert response.status_code == 200
    
    # Test with invalid filter operator
    filters = [{"field": "name", "value": "test", "operator": "invalid_operator"}]
    response = client.get(f"/api/categories/?filters={json.dumps(filters)}")
    assert response.status_code == 422
    
    # Test with invalid JSON format
    response = client.get("/api/categories/?filters=invalid_json")
    assert response.status_code == 400

def test_read_categories_with_sorting():
    """Test reading categories with sorting"""
    # Test sorting by code ascending
    response = client.get("/api/categories/?sort_field=code&sort_order=asc")
    assert response.status_code == 200
    
    # Test sorting by code descending
    response = client.get("/api/categories/?sort_field=code&sort_order=desc")
    assert response.status_code == 200
    
    # Test sorting by name
    response = client.get("/api/categories/?sort_field=name&sort_order=asc")
    assert response.status_code == 200
    
    # Test with invalid sort_order
    response = client.get("/api/categories/?sort_field=code&sort_order=invalid")
    assert response.status_code == 422

def test_read_category_not_found():
    """Test reading a non-existent category"""
    response = client.get("/api/categories/999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Category not found"

def test_create_update_delete_category(db_session: Session, default_language: Language):
    """Test the full CRUD lifecycle for a category"""
    # Create a test category
    category_data = {
        "code": "TEST-CATEGORY",
        "type_code": "GEN",
        "category_texts": [
            {
                "language_id": default_language.id,
                "name": "Test Category",
                "description": "This is a test category"
            }
        ]
    }
    
    # Create
    create_response = client.post("/api/categories/", json=category_data)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["code"] == "TEST-CATEGORY"
    assert created_data["type_code"] == "GEN"
    assert len(created_data["category_texts"]) == 1
    assert created_data["category_texts"][0]["name"] == "Test Category"
    
    # Read
    read_response = client.get(f"/api/categories/{created_data['id']}")
    assert read_response.status_code == 200
    assert read_response.json()["id"] == created_data["id"]
    
    # Update
    update_data = {
        "code": "TEST-UPDATED",
        "category_texts": [
            {
                "language_id": default_language.id,
                "name": "Updated Test Category",
                "description": "This is an updated test category"
            }
        ]
    }
    update_response = client.put(f"/api/categories/{created_data['id']}", json=update_data)
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["code"] == "TEST-UPDATED"
    assert updated_data["category_texts"][0]["name"] == "Updated Test Category"
    
    # Delete
    delete_response = client.delete(f"/api/categories/{created_data['id']}")
    assert delete_response.status_code == 204
    
    # Verify deletion
    verify_response = client.get(f"/api/categories/{created_data['id']}")
    assert verify_response.status_code == 404

def test_create_category_validation(db_session: Session, default_language: Language):
    """Test validation when creating a category"""
    # Test with empty code
    category_data = {
        "code": "",
        "type_code": "GEN",
        "category_texts": [
            {
                "language_id": default_language.id,
                "name": "Test Category",
                "description": "This is a test category"
            }
        ]
    }
    response = client.post("/api/categories/", json=category_data)
    assert response.status_code == 422
    
    # Test with missing category_texts
    category_data = {
        "code": "TEST-VALIDATION",
        "type_code": "GEN",
        "category_texts": []
    }
    response = client.post("/api/categories/", json=category_data)
    assert response.status_code == 422
    
    # Test with invalid language_id
    category_data = {
        "code": "TEST-VALIDATION",
        "type_code": "GEN",
        "category_texts": [
            {
                "language_id": 999999,  # Non-existent language ID
                "name": "Test Category",
                "description": "This is a test category"
            }
        ]
    }
    response = client.post("/api/categories/", json=category_data)
    assert response.status_code == 409 or response.status_code == 400  # Either conflict or bad request

def test_create_duplicate_category(db_session: Session, default_language: Language):
    """Test creating a category with a duplicate code"""
    # Create a test category
    test_category = Category(code="DUPLICATE-TEST", type_code="GEN")
    db_session.add(test_category)
    db_session.flush()
    
    # Add a category text
    test_category_text = CategoryText(
        category_id=test_category.id,
        language_id=default_language.id,
        name="Duplicate Test Category",
        description="This is a test category for duplicate code testing"
    )
    db_session.add(test_category_text)
    db_session.commit()
    
    try:
        # Try to create a category with the same code
        category_data = {
            "code": "DUPLICATE-TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": default_language.id,
                    "name": "Another Test Category",
                    "description": "This is another test category"
                }
            ]
        }
        response = client.post("/api/categories/", json=category_data)
        assert response.status_code == 409  # Conflict
        assert "already exists" in response.json()["detail"]
    finally:
        # Clean up
        db_session.delete(test_category)
        db_session.commit()

def test_check_code_exists(db_session: Session, default_language: Language):
    """Test checking if a category code exists"""
    # Create a test category directly in the database
    test_category = Category(code="CHECK-CODE", type_code="GEN")
    db_session.add(test_category)
    db_session.flush()
    
    # Add a category text
    test_category_text = CategoryText(
        category_id=test_category.id,
        language_id=default_language.id,
        name="Check Code Category",
        description="This is a test category for checking code existence"
    )
    db_session.add(test_category_text)
    db_session.commit()
    
    try:
        # Check existing code
        response = client.get("/api/categories/check-code/CHECK-CODE")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/categories/check-code/NONEXISTENT")
        assert response.status_code == 200
        assert response.json()["exists"] is False
        
        # Check existing code but excluding the category's ID
        response = client.get(f"/api/categories/check-code/CHECK-CODE?category_id={test_category.id}")
        assert response.status_code == 200
        assert response.json()["exists"] is False
    finally:
        # Clean up
        db_session.delete(test_category)
        db_session.commit()

def test_read_categories_by_type(db_session: Session, default_language: Language):
    """Test getting categories by type"""
    # Create test categories with different types
    test_categories = [
        Category(code="TYPE-TEST-1", type_code="TEST"),
        Category(code="TYPE-TEST-2", type_code="TEST"),
        Category(code="TYPE-OTHER", type_code="OTHER")
    ]
    
    for cat in test_categories:
        db_session.add(cat)
        db_session.flush()
        
        # Add a category text
        text = CategoryText(
            category_id=cat.id,
            language_id=default_language.id,
            name=f"Test Category {cat.code}",
            description=f"This is a test category with code {cat.code}"
        )
        db_session.add(text)
    
    db_session.commit()
    
    try:
        # Get categories by type
        response = client.get("/api/categories/by-type/TEST")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(cat["type_code"] == "TEST" for cat in data)
        
        # Get categories by another type
        response = client.get("/api/categories/by-type/OTHER")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["type_code"] == "OTHER"
        
        # Get categories by non-existent type
        response = client.get("/api/categories/by-type/NONEXISTENT")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0
    finally:
        # Clean up
        for cat in test_categories:
            db_session.delete(cat)
        db_session.commit()

def test_read_categories_by_code_pattern():
    """Test getting categories by code pattern"""
    response = client.get("/api/categories/by-code-pattern/TEST")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    
    # Test with empty pattern
    response = client.get("/api/categories/by-code-pattern/")
    assert response.status_code == 404  # Path parameter is required

class TestCategoriesAPI:
    """Test suite for Categories API endpoints"""

    def test_read_categories_success(self, db_session: Session):
        """Test successful retrieval of categories with pagination"""
        response = client.get("/api/categories/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    def test_read_categories_with_pagination(self, db_session: Session):
        """Test categories retrieval with custom pagination parameters"""
        response = client.get("/api/categories/?page=1&page_size=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5

    def test_read_categories_with_filters(self, db_session: Session):
        """Test categories retrieval with filtering"""
        filters = [{"field": "code", "value": "TEST", "operator": "contains"}]
        import json
        response = client.get(f"/api/categories/?filters={json.dumps(filters)}")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_read_categories_with_sorting(self, db_session: Session):
        """Test categories retrieval with sorting"""
        response = client.get("/api/categories/?sort_field=code&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    def test_create_category_success(self, db_session: Session):
        """Test successful category creation"""
        category_data = {
            "code": "TEST_CAT",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Test Category",
                    "description": "This is a test category"
                }
            ]
        }
        
        response = client.post("/api/categories/", json=category_data)
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "TEST_CAT"
        assert data["type_code"] == "GEN"
        assert len(data["category_texts"]) == 1
        assert data["category_texts"][0]["name"] == "Test Category"
        
        # Clean up
        category_id = data["id"]
        client.delete(f"/api/categories/{category_id}")

    def test_create_category_duplicate_code(self, db_session: Session):
        """Test category creation with duplicate code returns 409"""
        category_data = {
            "code": "DUPLICATE_TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "First Category",
                    "description": "First category description"
                }
            ]
        }
        
        # Create first category
        response1 = client.post("/api/categories/", json=category_data)
        assert response1.status_code == 201
        category_id = response1.json()["id"]
        
        # Try to create duplicate
        response2 = client.post("/api/categories/", json=category_data)
        assert response2.status_code == 409
        assert "already exists" in response2.json()["detail"]
        
        # Clean up
        client.delete(f"/api/categories/{category_id}")

    def test_create_category_invalid_data(self, db_session: Session):
        """Test category creation with invalid data returns 422"""
        category_data = {
            "code": "",  # Invalid empty code
            "type_code": "GEN",
            "category_texts": []  # Invalid empty texts
        }
        
        response = client.post("/api/categories/", json=category_data)
        assert response.status_code == 422

    def test_read_category_by_id_success(self, db_session: Session):
        """Test successful retrieval of category by ID"""
        # First create a category
        category_data = {
            "code": "READ_TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Read Test Category",
                    "description": "Category for read testing"
                }
            ]
        }
        
        create_response = client.post("/api/categories/", json=category_data)
        assert create_response.status_code == 201
        category_id = create_response.json()["id"]
        
        # Now read it by ID
        response = client.get(f"/api/categories/{category_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == category_id
        assert data["code"] == "READ_TEST"
        
        # Clean up
        client.delete(f"/api/categories/{category_id}")

    def test_read_category_not_found(self, db_session: Session):
        """Test reading non-existent category returns 404"""
        response = client.get("/api/categories/999999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_update_category_success(self, db_session: Session):
        """Test successful category update"""
        # First create a category
        category_data = {
            "code": "UPDATE_TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Original Name",
                    "description": "Original description"
                }
            ]
        }
        
        create_response = client.post("/api/categories/", json=category_data)
        assert create_response.status_code == 201
        category_id = create_response.json()["id"]
        
        # Update the category
        update_data = {
            "code": "UPDATED_TEST",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Updated Name",
                    "description": "Updated description"
                }
            ]
        }
        
        response = client.put(f"/api/categories/{category_id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == "UPDATED_TEST"
        assert data["category_texts"][0]["name"] == "Updated Name"
        
        # Clean up
        client.delete(f"/api/categories/{category_id}")

    def test_update_category_not_found(self, db_session: Session):
        """Test updating non-existent category returns 404"""
        update_data = {
            "code": "NONEXISTENT",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Test Name",
                    "description": "Test description"
                }
            ]
        }
        
        response = client.put("/api/categories/999999", json=update_data)
        assert response.status_code == 404

    def test_delete_category_success(self, db_session: Session):
        """Test successful category deletion"""
        # First create a category
        category_data = {
            "code": "DELETE_TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Delete Test Category",
                    "description": "Category for delete testing"
                }
            ]
        }
        
        create_response = client.post("/api/categories/", json=category_data)
        assert create_response.status_code == 201
        category_id = create_response.json()["id"]
        
        # Delete the category
        response = client.delete(f"/api/categories/{category_id}")
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = client.get(f"/api/categories/{category_id}")
        assert get_response.status_code == 404

    def test_delete_category_not_found(self, db_session: Session):
        """Test deleting non-existent category returns 404"""
        response = client.delete("/api/categories/999999")
        assert response.status_code == 404

    def test_check_category_code_exists(self, db_session: Session):
        """Test category code existence check"""
        # First create a category
        category_data = {
            "code": "EXIST_TEST",
            "type_code": "GEN",
            "category_texts": [
                {
                    "language_id": 1,
                    "name": "Existence Test",
                    "description": "Test existence check"
                }
            ]
        }
        
        create_response = client.post("/api/categories/", json=category_data)
        assert create_response.status_code == 201
        category_id = create_response.json()["id"]
        
        # Check existing code
        response = client.get("/api/categories/check-code/EXIST_TEST")
        assert response.status_code == 200
        assert response.json()["exists"] is True
        
        # Check non-existing code
        response = client.get("/api/categories/check-code/NONEXISTENT")
        assert response.status_code == 200
        assert response.json()["exists"] is False
        
        # Clean up
        client.delete(f"/api/categories/{category_id}")

class TestCategoriesCRUD:
    """Test suite for Categories CRUD operations"""
    
    @patch('app.crud.category.db')
    def test_get_category(self, mock_db):
        """Test getting a category by ID"""
        mock_category = Category(id=1, code="TEST", type_code="GEN")
        mock_db.query.return_value.options.return_value.filter.return_value.first.return_value = mock_category
        
        result = get_category(mock_db, 1)
        assert result == mock_category
        
    @patch('app.crud.category.db')
    def test_get_categories_paginated(self, mock_db):
        """Test getting paginated categories"""
        mock_categories = [
            Category(id=1, code="TEST1", type_code="GEN"),
            Category(id=2, code="TEST2", type_code="GEN")
        ]
        
        mock_db.query.return_value = mock_categories
        
        # This would need more detailed mocking for the actual implementation
        # The test structure is provided for reference
        pass 