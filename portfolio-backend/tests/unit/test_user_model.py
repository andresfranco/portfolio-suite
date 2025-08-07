"""
Unit tests for the User model
"""
import pytest
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.crud.user import (
    create_user,
    get_user,
    get_user_by_email,
    get_user_by_username,
    update_user,
    delete_user,
    change_user_password
)
from tests.utils import get_test_data_manager
from pydantic import ValidationError

class TestUserModel:
    """Unit tests for User model CRUD operations"""
    
    def test_create_user(self, db_session: Session):
        """Test creating a user with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test user
            user = test_manager.create_test_user()
            
            # Verify it was created correctly
            assert user is not None
            assert user.id is not None
            assert user.username.startswith("test_user_")
            assert "@example.com" in user.email
            
            # Verify we can retrieve it
            retrieved = get_user(db=db_session, user_id=user.id)
            assert retrieved is not None
            assert retrieved.id == user.id
            assert retrieved.username == user.username
            assert retrieved.email == user.email
        finally:
            # Clean up test data
            test_manager.cleanup()
            
            # Verify cleanup worked
            if hasattr(user, 'id'):
                retrieved = get_user(db=db_session, user_id=user.id)
                assert retrieved is None
    
    def test_get_user_by_email(self, db_session: Session):
        """Test retrieving a user by email with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test user with a specific email
            unique_email = "test_specific_email@example.com"
            user = test_manager.create_test_user(email=unique_email)
            
            # Verify retrieval by email works
            retrieved = get_user_by_email(db=db_session, email=unique_email)
            assert retrieved is not None
            assert retrieved.id == user.id
            assert retrieved.email == unique_email
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_get_user_by_username(self, db_session: Session):
        """Test retrieving a user by username with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test user with a specific username
            unique_username = "test_specific_username"
            user = test_manager.create_test_user(username=unique_username)
            
            # Verify retrieval by username works
            retrieved = get_user_by_username(db=db_session, username=unique_username)
            assert retrieved is not None
            assert retrieved.id == user.id
            assert retrieved.username == unique_username
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_update_user(self, db_session: Session):
        """Test updating a user with proper cleanup"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test user
            user = test_manager.create_test_user()
            original_username = user.username
            
            # Update the user
            updated_email = "updated_email@example.com"
            update_data = UserUpdate(email=updated_email)
            
            updated = update_user(
                db=db_session,
                user_id=user.id,
                user_update=update_data
            )
            
            # Verify update worked correctly
            assert updated is not None
            assert updated.id == user.id
            assert updated.username == original_username  # Username should not change
            assert updated.email == updated_email
            
            # Verify by retrieving again
            retrieved = get_user(db=db_session, user_id=user.id)
            assert retrieved.email == updated_email
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_delete_user(self, db_session: Session):
        """Test deleting a user"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        # Create test user
        user = test_manager.create_test_user()
        user_id = user.id
        
        # Delete should be handled by the manager in this case
        assert user_id is not None
        
        # Delete the user directly
        result = delete_user(db=db_session, user_id=user_id)
        assert result is True
        
        # Verify it was deleted
        retrieved = get_user(db=db_session, user_id=user_id)
        assert retrieved is None
        
        # No need for cleanup since we already deleted it
        test_manager.created_records.clear()
    
    def test_change_user_password(self, db_session: Session):
        """Test changing a user's password"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create test user
            user = test_manager.create_test_user()
            
            # Original password is set during creation
            original_password = "TestP@ssw0rd"
            
            # Set a new password
            new_password = "NewP@ssw0rd123"
            updated_user = change_user_password(
                db=db_session,
                user_id=user.id,
                new_password=new_password
            )
            
            # Verify update worked correctly
            assert updated_user is not None
            assert updated_user.id == user.id
            
            # Retrieve the user and verify password
            retrieved = get_user(db=db_session, user_id=user.id)
            assert retrieved is not None
            assert retrieved.verify_password(new_password)
            assert not retrieved.verify_password(original_password)
        finally:
            # Clean up test data
            test_manager.cleanup()
    
    def test_user_with_roles(self, db_session: Session):
        """Test creating a user with roles"""
        # Create a test data manager
        test_manager = get_test_data_manager(db_session)
        
        try:
            # Create a test role first
            role = test_manager.create_test_role()
            
            # Create a user with the role
            user = test_manager.create_test_user(roles=[role.id])
            
            # Verify the user has the role
            retrieved = get_user(db=db_session, user_id=user.id)
            assert retrieved is not None
            assert len(retrieved.roles) == 1
            assert retrieved.roles[0].id == role.id
            
            # Test validation for empty roles array
            with pytest.raises(ValidationError):
                # This should raise a validation error because a user must have at least one role
                UserUpdate(roles=[])
                
            # Create another role
            role2 = test_manager.create_test_role()
            
            # Update the user with multiple roles
            update_data = UserUpdate(roles=[role.id, role2.id])
            updated = update_user(
                db=db_session,
                user_id=user.id,
                user_update=update_data
            )
            
            # Verify the update worked
            assert updated is not None
            assert len(updated.roles) == 2
            role_ids = [r.id for r in updated.roles]
            assert role.id in role_ids
            assert role2.id in role_ids
        finally:
            # Clean up test data
            test_manager.cleanup() 