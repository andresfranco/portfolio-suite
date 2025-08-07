"""
Unit tests for the Permission model
"""
import pytest
from sqlalchemy.orm import Session
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate
from app.crud.permission import (
    create_permission,
    get_permission_by_id,
    get_permission_by_name,
    update_permission,
    delete_permission
)
from tests.utils import get_test_data_manager

class TestPermissionModel:
    """Unit tests for Permission model CRUD operations"""
    
    def test_create_permission(self, db_session: Session):
        """Test creating a permission with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test permission
            permission = test_manager.create_test_permission()
            
            # Verify it was created correctly
            assert permission is not None
            assert permission.id is not None
            assert permission.name.startswith("TEST_PERM_")
            
            # Verify we can retrieve it
            retrieved = get_permission_by_id(db=db_session, permission_id=permission.id)
            assert retrieved is not None
            assert retrieved.id == permission.id
        finally:
            # Clean up test data
            test_manager.cleanup()
            
            # Verify cleanup worked
            if hasattr(permission, 'id'):
                retrieved = get_permission_by_id(db=db_session, permission_id=permission.id)
                assert retrieved is None
    
    def test_get_permission_by_name(self, db_session: Session):
        """Test retrieving a permission by name with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test permission with a specific name
            unique_name = "TEST_PERM_GET_BY_NAME"
            permission = test_manager.create_test_permission(name=unique_name)
            
            # Verify retrieval by name works
            retrieved = get_permission_by_name(db=db_session, name=unique_name)
            assert retrieved is not None
            assert retrieved.id == permission.id
            assert retrieved.name == unique_name
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_update_permission(self, db_session: Session):
        """Test updating a permission with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test permission
            permission = test_manager.create_test_permission()
            original_name = permission.name
            
            # Update the permission
            updated_description = "Updated test description"
            update_data = PermissionUpdate(description=updated_description)
            
            updated = update_permission(
                db=db_session,
                permission_id=permission.id,
                permission_in=update_data
            )
            
            # Verify update worked correctly
            assert updated is not None
            assert updated.id == permission.id
            assert updated.name == original_name  # Name should not change
            assert updated.description == updated_description
            
            # Verify by retrieving again
            retrieved = get_permission_by_id(db=db_session, permission_id=permission.id)
            assert retrieved.description == updated_description
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_delete_permission(self, db_session: Session):
        """Test deleting a permission"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        # Create test permission
        permission = test_manager.create_test_permission()
        permission_id = permission.id
        
        # Delete should be handled by the manager in this case
        assert permission_id is not None
        
        # Delete the permission directly
        deleted = delete_permission(db=db_session, permission_id=permission_id)
        assert deleted is not None
        assert deleted.id == permission_id
        
        # Verify it was deleted
        retrieved = get_permission_by_id(db=db_session, permission_id=permission_id)
        assert retrieved is None
        
        # No need for cleanup since we already deleted it
        test_manager.created_records.clear() 