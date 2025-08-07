#!/usr/bin/env python3
"""
Permission Module Usage Example
------------------------------

This script demonstrates how to interact with the Permission module
using either SQLite or PostgreSQL backend. It shows CRUD operations
for permissions in the same way as they are used in the API endpoints.

Usage:
    python examples/permissions_example.py
"""
import sys
import os
import logging
from typing import List, Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.permission import Permission
from app.schemas.permission import PermissionCreate, PermissionUpdate, PermissionOut
import app.crud.permission as permission_crud

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_session() -> Session:
    """Get a database session."""
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        db.close()
        raise e

def create_permission(db: Session, permission_data: PermissionCreate) -> PermissionOut:
    """Create a new permission."""
    return permission_crud.create_permission(db, permission_data)

def get_permissions(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    name_filter: Optional[str] = None,
    sort_field: str = "id",
    sort_order: str = "asc"
) -> List[PermissionOut]:
    """Get a list of permissions with filtering and sorting."""
    return permission_crud.get_permissions(
        db, skip=skip, limit=limit, 
        name_filter=name_filter,
        sort_field=sort_field,
        sort_order=sort_order
    )

def get_permission(db: Session, permission_id: int) -> Optional[PermissionOut]:
    """Get a permission by ID."""
    return permission_crud.get_permission(db, permission_id)

def update_permission(
    db: Session, 
    permission_id: int, 
    permission_data: PermissionUpdate
) -> Optional[PermissionOut]:
    """Update a permission by ID."""
    return permission_crud.update_permission(db, permission_id, permission_data)

def delete_permission(db: Session, permission_id: int) -> bool:
    """Delete a permission by ID."""
    return permission_crud.delete_permission(db, permission_id)

def run_permission_example():
    """Run the permission example with all CRUD operations."""
    logger.info(f"Using database: {settings.DATABASE_URL}")
    
    # Get a database session
    db = get_db_session()
    
    try:
        # Create a new permission
        logger.info("Creating new permission...")
        new_permission_data = PermissionCreate(
            name="EXAMPLE_PERMISSION",
            description="An example permission created via the example script"
        )
        new_permission = create_permission(db, new_permission_data)
        logger.info(f"Created permission: {new_permission.name} (ID: {new_permission.id})")
        
        # Get all permissions
        logger.info("Getting all permissions...")
        permissions = get_permissions(db)
        logger.info(f"Found {len(permissions)} permissions:")
        for perm in permissions:
            logger.info(f"- {perm.id}: {perm.name} - {perm.description}")
        
        # Get a specific permission
        logger.info(f"Getting permission with ID {new_permission.id}...")
        permission = get_permission(db, new_permission.id)
        if permission:
            logger.info(f"Found permission: {permission.name} - {permission.description}")
        else:
            logger.warning(f"Permission with ID {new_permission.id} not found")
        
        # Update the permission
        logger.info(f"Updating permission with ID {new_permission.id}...")
        update_data = PermissionUpdate(
            description="Updated description for the example permission"
        )
        updated_permission = update_permission(db, new_permission.id, update_data)
        if updated_permission:
            logger.info(f"Updated permission: {updated_permission.name} - {updated_permission.description}")
        else:
            logger.warning(f"Failed to update permission with ID {new_permission.id}")
        
        # Filter permissions
        logger.info("Filtering permissions by name 'EXAMPLE'...")
        filtered_permissions = get_permissions(db, name_filter="EXAMPLE")
        logger.info(f"Found {len(filtered_permissions)} permissions matching filter:")
        for perm in filtered_permissions:
            logger.info(f"- {perm.id}: {perm.name} - {perm.description}")
        
        # Sort permissions
        logger.info("Sorting permissions by name in descending order...")
        sorted_permissions = get_permissions(db, sort_field="name", sort_order="desc")
        logger.info(f"First 3 permissions after sorting:")
        for perm in sorted_permissions[:3]:
            logger.info(f"- {perm.id}: {perm.name} - {perm.description}")
        
        # Delete the permission
        logger.info(f"Deleting permission with ID {new_permission.id}...")
        deleted = delete_permission(db, new_permission.id)
        if deleted:
            logger.info(f"Successfully deleted permission with ID {new_permission.id}")
        else:
            logger.warning(f"Failed to delete permission with ID {new_permission.id}")
        
        # Verify deletion
        logger.info(f"Verifying deletion of permission with ID {new_permission.id}...")
        deleted_permission = get_permission(db, new_permission.id)
        if deleted_permission:
            logger.warning(f"Permission with ID {new_permission.id} still exists!")
        else:
            logger.info(f"Permission with ID {new_permission.id} confirmed deleted")
            
    except Exception as e:
        logger.error(f"Error in permission example: {str(e)}")
    finally:
        db.close()
        logger.info("Database session closed")

if __name__ == "__main__":
    run_permission_example() 