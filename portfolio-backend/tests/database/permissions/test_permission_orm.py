#!/usr/bin/env python3
"""
Permission ORM Tests
-------------------

This module tests permissions using SQLAlchemy ORM operations.
"""
import logging
import uuid
import pytest
from sqlalchemy.orm import Session

from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate, Filter
from app.crud.permission import (
    create_permission, 
    get_permission_by_id, 
    get_permission_by_name,
    update_permission,
    delete_permission,
    get_permissions_paginated
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def generate_test_permission_data():
    """Generate unique test permission data."""
    unique_suffix = str(uuid.uuid4())[:8]
    return {
        "name": f"TEST_ORM_PERMISSION_{unique_suffix.upper()}",
        "description": "Test permission for ORM operations"
    }

def test_create_permission_orm(db_session: Session):
    """Test creating a permission using ORM operations."""
    # Generate unique test data
    test_data = generate_test_permission_data()
    logger.info(f"Testing permission creation with data: {test_data}")
    
    # Create permission using schema
    permission_in = PermissionCreate(**test_data)
    permission = create_permission(db=db_session, permission_in=permission_in)
    
    assert permission is not None, "Failed to create permission"
    assert permission.name == test_data["name"], "Permission name does not match"
    assert permission.description == test_data["description"], "Permission description does not match"
    
    logger.info(f"Created permission with ID: {permission.id}")
    
    # Clean up
    db_session.delete(permission)
    db_session.commit()
    logger.info(f"Cleaned up test permission with ID: {permission.id}")

def test_get_permission_by_id_orm(db_session: Session):
    """Test retrieving a permission by ID using ORM operations."""
    # Create a test permission first
    test_data = generate_test_permission_data()
    permission_in = PermissionCreate(**test_data)
    created_permission = create_permission(db=db_session, permission_in=permission_in)
    
    try:
        # Get permission by ID
        logger.info(f"Retrieving permission with ID: {created_permission.id}")
        permission = get_permission_by_id(db=db_session, permission_id=created_permission.id)
        
        assert permission is not None, f"Failed to retrieve permission with ID: {created_permission.id}"
        assert permission.name == test_data["name"], "Retrieved permission name does not match"
        
        logger.info(f"Successfully retrieved permission: {permission.name}")
    finally:
        # Clean up
        db_session.delete(created_permission)
        db_session.commit()

def test_get_permission_by_name_orm(db_session: Session):
    """Test retrieving a permission by name using ORM operations."""
    # Create a test permission first
    test_data = generate_test_permission_data()
    permission_in = PermissionCreate(**test_data)
    created_permission = create_permission(db=db_session, permission_in=permission_in)
    
    try:
        # Get permission by name
        logger.info(f"Retrieving permission with name: {test_data['name']}")
        permission = get_permission_by_name(db=db_session, name=test_data["name"])
        
        assert permission is not None, f"Failed to retrieve permission with name: {test_data['name']}"
        assert permission.id == created_permission.id, "Retrieved permission ID does not match"
        
        logger.info(f"Successfully retrieved permission by name: {permission.name}")
    finally:
        # Clean up
        db_session.delete(created_permission)
        db_session.commit()

def test_update_permission_orm(db_session: Session):
    """Test updating a permission using ORM operations."""
    # Create a test permission first
    test_data = generate_test_permission_data()
    permission_in = PermissionCreate(**test_data)
    created_permission = create_permission(db=db_session, permission_in=permission_in)
    
    try:
        # Update the permission
        update_data = {"description": "Updated description for test permission"}
        permission_update = PermissionUpdate(**update_data)
        
        logger.info(f"Updating permission {created_permission.id} with: {update_data}")
        updated_permission = update_permission(
            db=db_session, 
            permission_id=created_permission.id, 
            permission_in=permission_update
        )
        
        assert updated_permission is not None, "Failed to update permission"
        assert updated_permission.id == created_permission.id, "Updated permission ID does not match"
        assert updated_permission.description == update_data["description"], "Description was not updated correctly"
        
        # Verify that name was not changed
        assert updated_permission.name == test_data["name"], "Permission name should not have changed"
        
        logger.info(f"Successfully updated permission: {updated_permission.name}")
    finally:
        # Clean up
        db_session.delete(created_permission)
        db_session.commit()

def test_delete_permission_orm(db_session: Session):
    """Test deleting a permission using ORM operations."""
    # Create a test permission first
    test_data = generate_test_permission_data()
    permission_in = PermissionCreate(**test_data)
    created_permission = create_permission(db=db_session, permission_in=permission_in)
    
    # Save the ID for later verification
    permission_id = created_permission.id
    
    # Delete the permission
    logger.info(f"Deleting permission with ID: {permission_id}")
    deleted_permission = delete_permission(db=db_session, permission_id=permission_id)
    
    assert deleted_permission is not None, "Failed to delete permission"
    assert deleted_permission.id == permission_id, "Deleted permission ID does not match"
    
    # Verify it's deleted
    verification = get_permission_by_id(db=db_session, permission_id=permission_id)
    assert verification is None, f"Permission with ID {permission_id} still exists after deletion"
    
    logger.info(f"Successfully verified deletion of permission ID: {permission_id}")

def test_permissions_pagination_orm(db_session: Session):
    """Test paginated retrieval of permissions using ORM operations."""
    # Create multiple test permissions
    created_permissions = []
    for i in range(5):
        test_data = generate_test_permission_data()
        test_data["name"] = f"PAGINATION_TEST_{i}_{test_data['name']}"
        permission_in = PermissionCreate(**test_data)
        perm = create_permission(db=db_session, permission_in=permission_in)
        created_permissions.append(perm)
    
    try:
        logger.info("Testing paginated permission retrieval")
        
        # Test without filters
        permissions, total = get_permissions_paginated(
            db=db_session, 
            page=1, 
            page_size=3
        )
        
        assert len(permissions) <= 3, f"Expected at most 3 permissions per page, got {len(permissions)}"
        assert total >= 5, f"Expected at least 5 total permissions, got {total}"
        
        logger.info(f"Retrieved {len(permissions)} permissions (total: {total})")
        
        # Test with page 2
        permissions_page2, total2 = get_permissions_paginated(
            db=db_session, 
            page=2, 
            page_size=3
        )
        
        # Verify different pages return different results
        if len(permissions) > 0 and len(permissions_page2) > 0:
            assert permissions[0].id != permissions_page2[0].id, "Pages are returning the same results"
        
        logger.info(f"Retrieved {len(permissions_page2)} permissions on page 2")
        
        # Test with filters for pagination test permissions
        filters = [Filter(field="name", value="PAGINATION_TEST", operator="contains")]
        
        filtered_permissions, filtered_total = get_permissions_paginated(
            db=db_session, 
            page=1, 
            page_size=10,
            filters=filters
        )
        
        assert len(filtered_permissions) >= 5, f"Expected at least 5 filtered permissions, got {len(filtered_permissions)}"
        assert all("PAGINATION_TEST" in p.name for p in filtered_permissions), "Filter not working correctly"
        
        logger.info(f"Retrieved {len(filtered_permissions)} filtered permissions")
        
    finally:
        # Clean up all created permissions
        for perm in created_permissions:
            db_session.delete(perm)
        db_session.commit()
        logger.info(f"Cleaned up {len(created_permissions)} test permissions")

def test_permission_duplicate_error(db_session: Session):
    """Test that creating a permission with a duplicate name raises an error."""
    # Create a permission first
    test_data = generate_test_permission_data()
    permission_in = PermissionCreate(**test_data)
    created_permission = create_permission(db=db_session, permission_in=permission_in)
    
    try:
        # Try to create another permission with the same name
        logger.info(f"Testing duplicate error with name: {test_data['name']}")
        duplicate_permission_in = PermissionCreate(**test_data)
        
        with pytest.raises(ValueError) as excinfo:
            create_permission(db=db_session, permission_in=duplicate_permission_in)
        
        assert "already exists" in str(excinfo.value), "Expected error message not found"
        logger.info("Successfully caught duplicate permission error")
    finally:
        # Clean up
        db_session.delete(created_permission)
        db_session.commit() 