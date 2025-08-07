import pytest
from sqlalchemy.orm import Session
from app.crud import role as crud_role
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleUpdate
from app.tests.utils.role import create_test_role
from app.tests.utils.permission import create_test_permission

class TestRoleCRUD:
    """Test cases for Role CRUD operations."""
    
    def test_get_role_by_id(self, db: Session):
        """Test getting a role by ID."""
        # Create test role
        role = create_test_role(db, "Get By ID Test", "Role for get_by_id test")
        
        # Get by ID
        retrieved_role = crud_role.get_role_by_id(db, role.id)
        
        # Assertions
        assert retrieved_role is not None
        assert retrieved_role.id == role.id
        assert retrieved_role.name == role.name
        assert retrieved_role.description == role.description
        
        # Clean up
        db.delete(role)
        db.commit()
    
    def test_get_role_by_id_not_found(self, db: Session):
        """Test getting a role by ID that doesn't exist."""
        # Use a likely non-existent ID
        non_existent_id = 9999999
        
        # Try to get
        retrieved_role = crud_role.get_role_by_id(db, non_existent_id)
        
        # Assertions
        assert retrieved_role is None
    
    def test_get_role_by_name(self, db: Session):
        """Test getting a role by name."""
        # Create test role
        role_name = "Get By Name Test"
        role = create_test_role(db, role_name, "Role for get_by_name test")
        
        # Get by name
        retrieved_role = crud_role.get_role_by_name(db, role_name)
        
        # Assertions
        assert retrieved_role is not None
        assert retrieved_role.id == role.id
        assert retrieved_role.name == role_name
        
        # Clean up
        db.delete(role)
        db.commit()
    
    def test_get_role_by_name_not_found(self, db: Session):
        """Test getting a role by name that doesn't exist."""
        # Use a likely non-existent name
        non_existent_name = "Non-Existent Role Name 123456789"
        
        # Try to get
        retrieved_role = crud_role.get_role_by_name(db, non_existent_name)
        
        # Assertions
        assert retrieved_role is None
    
    def test_create_role_success(self, db: Session):
        """Test creating a role."""
        # Create test data
        role_data = RoleCreate(
            name="Create Test Role",
            description="Role for create test",
            permissions=[]
        )
        
        # Create role
        created_role = crud_role.create_role(db, role_data)
        
        # Assertions
        assert created_role is not None
        assert created_role.id is not None
        assert created_role.name == role_data.name
        assert created_role.description == role_data.description
        assert len(created_role.permissions) == 0
        
        # Verify in database
        db_role = db.query(Role).filter(Role.id == created_role.id).first()
        assert db_role is not None
        
        # Clean up
        db.delete(created_role)
        db.commit()
    
    def test_create_role_with_permissions(self, db: Session):
        """Test creating a role with permissions."""
        # Create test permissions
        perm1 = create_test_permission(db, "CREATE_TEST_PERM_1", "Permission 1 for create test")
        perm2 = create_test_permission(db, "CREATE_TEST_PERM_2", "Permission 2 for create test")
        
        # Create test data
        role_data = RoleCreate(
            name="Create Test Role With Permissions",
            description="Role for create test with permissions",
            permissions=[perm1.name, perm2.name]
        )
        
        # Create role
        created_role = crud_role.create_role(db, role_data)
        
        # Assertions
        assert created_role is not None
        assert created_role.id is not None
        assert created_role.name == role_data.name
        assert created_role.description == role_data.description
        assert len(created_role.permissions) == 2
        permission_names = [p.name for p in created_role.permissions]
        assert perm1.name in permission_names
        assert perm2.name in permission_names
        
        # Clean up
        db.delete(created_role)
        db.delete(perm1)
        db.delete(perm2)
        db.commit()
    
    def test_create_role_duplicate_name(self, db: Session):
        """Test creating a role with a name that already exists."""
        # Create existing role
        existing_role = create_test_role(db, "Duplicate Name Test", "Role for duplicate name test")
        
        # Create test data with same name
        role_data = RoleCreate(
            name=existing_role.name,
            description="Another description",
            permissions=[]
        )
        
        # Try to create role with same name
        with pytest.raises(ValueError) as excinfo:
            crud_role.create_role(db, role_data)
        
        # Assertions
        assert "already exists" in str(excinfo.value)
        
        # Clean up
        db.delete(existing_role)
        db.commit()
    
    def test_update_role_success(self, db: Session):
        """Test updating a role."""
        # Create test role
        role = create_test_role(db, "Update Test Role", "Role for update test")
        
        # Update data
        update_data = RoleUpdate(
            name="Updated Role Name",
            description="Updated description"
        )
        
        # Update role
        updated_role = crud_role.update_role(db, role.id, update_data)
        
        # Assertions
        assert updated_role is not None
        assert updated_role.id == role.id
        assert updated_role.name == update_data.name
        assert updated_role.description == update_data.description
        
        # Clean up
        db.delete(updated_role)
        db.commit()
    
    def test_update_role_with_permissions(self, db: Session):
        """Test updating a role with permissions."""
        # Create test role and permissions
        role = create_test_role(db, "Update Permissions Test Role", "Role for update permissions test")
        perm1 = create_test_permission(db, "UPDATE_TEST_PERM_1", "Permission 1 for update test")
        perm2 = create_test_permission(db, "UPDATE_TEST_PERM_2", "Permission 2 for update test")
        
        # Update data with permissions
        update_data = RoleUpdate(
            permissions=[perm1.name, perm2.name]
        )
        
        # Update role
        updated_role = crud_role.update_role(db, role.id, update_data)
        
        # Assertions
        assert updated_role is not None
        assert len(updated_role.permissions) == 2
        permission_names = [p.name for p in updated_role.permissions]
        assert perm1.name in permission_names
        assert perm2.name in permission_names
        
        # Clean up
        db.delete(updated_role)
        db.delete(perm1)
        db.delete(perm2)
        db.commit()
    
    def test_update_role_not_found(self, db: Session):
        """Test updating a role that doesn't exist."""
        # Use a likely non-existent ID
        non_existent_id = 9999999
        
        # Update data
        update_data = RoleUpdate(
            name="Updated Non-existent Role",
            description="Updated description"
        )
        
        # Try to update
        updated_role = crud_role.update_role(db, non_existent_id, update_data)
        
        # Assertions
        assert updated_role is None
    
    def test_delete_role_success(self, db: Session):
        """Test deleting a role."""
        # Create test role
        role = create_test_role(db, "Delete Test Role", "Role for delete test")
        role_id = role.id
        
        # Delete role
        deleted_role = crud_role.delete_role(db, role_id)
        
        # Assertions
        assert deleted_role is not None
        
        # Verify deletion in database
        db_role = db.query(Role).filter(Role.id == role_id).first()
        assert db_role is None
    
    def test_delete_role_not_found(self, db: Session):
        """Test deleting a role that doesn't exist."""
        # Use a likely non-existent ID
        non_existent_id = 9999999
        
        # Try to delete
        deleted_role = crud_role.delete_role(db, non_existent_id)
        
        # Assertions
        assert deleted_role is None
    
    def test_get_roles_paginated(self, db: Session):
        """Test getting paginated roles."""
        # Create test roles
        role1 = create_test_role(db, "Paginated Test Role 1", "Role 1 for pagination test")
        role2 = create_test_role(db, "Paginated Test Role 2", "Role 2 for pagination test")
        role3 = create_test_role(db, "Paginated Test Role 3", "Role 3 for pagination test")
        
        # Get paginated roles
        roles, total = crud_role.get_roles_paginated(
            db, 
            page=1, 
            page_size=2,
            sort_field="name",
            sort_order="asc"
        )
        
        # Assertions
        assert len(roles) == 2
        assert total >= 3  # At least our 3 test roles
        
        # Get second page
        roles_page2, total_page2 = crud_role.get_roles_paginated(
            db, 
            page=2, 
            page_size=2,
            sort_field="name",
            sort_order="asc"
        )
        
        # Assertions
        assert len(roles_page2) > 0
        assert total_page2 == total
        
        # Clean up
        for role in [role1, role2, role3]:
            db.delete(role)
        db.commit()
    
    def test_get_roles_with_filter(self, db: Session):
        """Test getting roles with a filter."""
        # Create test roles
        role1 = create_test_role(db, "Filtered Test Role ABC", "Role for filter test ABC")
        role2 = create_test_role(db, "Another Test Role XYZ", "Role for filter test XYZ")
        
        # Create filter
        filters = [
            {"field": "name", "value": "Filtered", "operator": "contains"}
        ]
        
        # Get filtered roles
        roles, total = crud_role.get_roles_paginated(
            db, 
            filters=filters
        )
        
        # Assertions
        assert len(roles) >= 1
        assert total >= 1
        assert any(r.name == role1.name for r in roles)
        assert not any(r.name == role2.name for r in roles)
        
        # Clean up
        db.delete(role1)
        db.delete(role2)
        db.commit() 