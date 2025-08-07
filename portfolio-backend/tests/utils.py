"""
Test Utilities
-------------

Utility functions and classes for testing
"""
import uuid
import logging
from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Factory function to create TestDataManager instances
def get_test_data_manager(db: Session):
    """Factory function to create a TestDataManager instance.
    
    Args:
        db: SQLAlchemy database session
        
    Returns:
        A TestDataManager instance
    """
    return TestDataManager(db)

# Not a test class - helper for test data management
class TestDataManager:
    """Manager for test data creation and cleanup."""
    
    def __init__(self, db: Session):
        """Initialize with database session."""
        self.db = db
        self.created_records = []
    
    def create_test_permission(self, name_prefix="TEST_PERM", **kwargs):
        """Create a test permission and track it for cleanup."""
        from app.models.permission import Permission
        from app.schemas.permission import PermissionCreate
        from app.crud.permission import create_permission
        
        # Generate a unique name if not provided
        if "name" not in kwargs:
            unique_id = str(uuid.uuid4())[:8].upper()
            kwargs["name"] = f"{name_prefix}_{unique_id}"
        
        # Set a default description if not provided
        if "description" not in kwargs:
            kwargs["description"] = f"Test permission created for automated testing"
        
        # Create the permission
        permission_data = PermissionCreate(**kwargs)
        created_permission = create_permission(db=self.db, permission_in=permission_data)
        
        # Track the created record
        self.created_records.append({
            "type": "permission",
            "id": created_permission.id, 
            "name": created_permission.name
        })
        
        logger.info(f"Created test permission: {created_permission.name} (ID: {created_permission.id})")
        return created_permission
    
    def create_test_role(self, name_prefix="TEST_ROLE", permissions=None, **kwargs):
        """Create a test role with optional permissions and track it for cleanup."""
        from app.models.role import Role
        from app.schemas.role import RoleCreate
        from app.crud.role import create_role
        
        # Generate a unique name if not provided
        if "name" not in kwargs:
            unique_id = str(uuid.uuid4())[:8].upper()
            kwargs["name"] = f"{name_prefix}_{unique_id}"
        
        # Set a default description if not provided
        if "description" not in kwargs:
            kwargs["description"] = f"Test role created for automated testing"
        
        # Create the role
        role_data = RoleCreate(**kwargs)
        created_role = create_role(db=self.db, role_in=role_data)
        
        # Assign permissions if provided
        if permissions:
            try:
                from app.models.role_permission import RolePermission
                
                for permission_id in permissions:
                    role_permission = RolePermission(
                        role_id=created_role.id,
                        permission_id=permission_id
                    )
                    self.db.add(role_permission)
                
                self.db.commit()
                logger.info(f"Assigned {len(permissions)} permissions to role {created_role.name}")
            except Exception as e:
                logger.error(f"Error assigning permissions to role: {str(e)}")
                self.db.rollback()
        
        # Track the created record
        self.created_records.append({
            "type": "role",
            "id": created_role.id,
            "name": created_role.name
        })
        
        logger.info(f"Created test role: {created_role.name} (ID: {created_role.id})")
        return created_role
    
    def create_test_user(self, username_prefix="test_user", roles=None, **kwargs):
        """Create a test user with optional roles and track it for cleanup."""
        from app.models.user import User
        from app.schemas.user import UserCreate
        from app.crud.user import create_user
        
        # Generate a unique username if not provided
        if "username" not in kwargs:
            unique_id = str(uuid.uuid4())[:8].lower()
            kwargs["username"] = f"{username_prefix}_{unique_id}"
        
        # Generate a unique email if not provided
        if "email" not in kwargs:
            if "username" in kwargs:
                unique_name = kwargs["username"]
            else:
                unique_name = f"{username_prefix}_{str(uuid.uuid4())[:8].lower()}"
            kwargs["email"] = f"{unique_name}@example.com"
        
        # Set a default strong password if not provided
        if "password" not in kwargs:
            kwargs["password"] = f"TestP@ssw0rd{str(uuid.uuid4())[:4]}"
        
        # Add roles if specified
        if roles is not None:
            kwargs["roles"] = roles
        
        # Create the user
        user_data = UserCreate(**kwargs)
        created_user = create_user(db=self.db, user_create=user_data)
        
        # Track the created record
        self.created_records.append({
            "type": "user",
            "id": created_user.id,
            "username": created_user.username
        })
        
        logger.info(f"Created test user: {created_user.username} (ID: {created_user.id})")
        return created_user
    
    def cleanup(self):
        """Clean up all tracked test data."""
        if not self.created_records:
            logger.info("No test data to clean up")
            return
        
        logger.info(f"Cleaning up {len(self.created_records)} test records")
        
        # Reverse the order to handle dependencies correctly (delete children before parents)
        for record in reversed(self.created_records):
            record_type = record["type"]
            record_id = record["id"]
            
            try:
                if record_type == "permission":
                    from app.crud.permission import delete_permission
                    delete_permission(db=self.db, permission_id=record_id)
                elif record_type == "role":
                    from app.crud.role import delete_role
                    delete_role(db=self.db, role_id=record_id)
                elif record_type == "user":
                    from app.crud.user import delete_user
                    delete_user(db=self.db, user_id=record_id)
                # Add more types as needed
                
                logger.info(f"Deleted {record_type} with ID {record_id}")
            except Exception as e:
                logger.error(f"Error deleting {record_type} with ID {record_id}: {str(e)}")
                # Continue with other deletions even if one fails
        
        # Clear the list of tracked records
        self.created_records.clear()
        
        # Commit the changes
        try:
            self.db.commit()
            logger.info("Cleanup completed successfully")
        except Exception as e:
            logger.error(f"Error committing cleanup changes: {str(e)}")
            self.db.rollback() 