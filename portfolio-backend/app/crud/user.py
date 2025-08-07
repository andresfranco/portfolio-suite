from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import asc, desc, func
from typing import List, Optional, Tuple, Any, Dict
from app.models import User, Role
from app.schemas.user import UserCreate, UserUpdate, Filter
import logging
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder

# Set up logger
logger = logging.getLogger(__name__)

def get_user(db: Session, user_id: int) -> Optional[User]:
    """
    Get a single user by ID with roles and permissions loaded
    """
    logger.debug(f"Getting user with id={user_id}")
    return db.query(User).options(
        selectinload(User.roles).selectinload(Role.permissions)
    ).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get a single user by email with roles and permissions loaded
    """
    logger.debug(f"Getting user with email={email}")
    return db.query(User).options(
        selectinload(User.roles).selectinload(Role.permissions)
    ).filter(User.email == email).first()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """
    Get a single user by username with roles and permissions loaded
    """
    logger.debug(f"Getting user with username={username}")
    return db.query(User).options(
        selectinload(User.roles).selectinload(Role.permissions)
    ).filter(User.username == username).first()

def get_users_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    sort_field: str = "id",
    sort_order: str = "asc",
    include_full_details: bool = False,
    filters: Optional[List[Filter]] = None,
) -> Tuple[List[User], int]:
    """
    Retrieve paginated users with optional sorting, filtering, and full details.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        sort_field: Field to sort by
        sort_order: Sort direction ('asc' or 'desc')
        include_full_details: Whether to include additional details
        filters: List of Filter objects for filtering
        
    Returns:
        Tuple of (list of users, total count)
    """
    logger.debug(f"Getting users with page={page}, page_size={page_size}, sort_field={sort_field}, sort_order={sort_order}")
    
    # Initialize the base query
    query = db.query(User)
    
    # Always load roles and permissions relationship for each user
    query = query.options(selectinload(User.roles).selectinload(Role.permissions))
    
    # Convert Filter objects to dictionaries for QueryBuilder
    filter_dicts = []
    if filters:
        for filter_item in filters:
            filter_dict = {
                'field': filter_item.field,
                'value': filter_item.value,
                'operator': filter_item.operator
            }
            logger.debug(f"Applying filter: {filter_dict}")
            
            # Special handling for roles to ensure proper query building
            if filter_item.field == 'roles' and filter_item.value:
                try:
                    # If value is a string, try to convert to integer for role ID
                    if isinstance(filter_item.value, str):
                        filter_dict['value'] = int(filter_item.value)
                    filter_dict['field'] = 'roles.id'  # Use dot notation for relationship
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid role ID for filtering: {filter_item.value}. Error: {str(e)}")
                    continue  # Skip this filter
                    
            # Add to the filter dictionaries list
            filter_dicts.append(filter_dict)
    
    # Use the QueryBuilder to construct and execute the query
    query_builder = QueryBuilder(query_or_model=query, db_session=db, model=User)
    
    # Apply filters
    if filter_dicts:
        query_builder.apply_filters(filter_dicts)
    
    # Apply sorting
    query_builder.apply_sort(sort_field, sort_order)
    
    # Get paginated results
    users, total = query_builder.paginate(page, page_size)
    
    return users, total

def create_user(db: Session, user_create: UserCreate, current_user_id: Optional[int] = None) -> User:
    """
    Create a new user
    """
    logger.info(f"Creating new user with username={user_create.username}")
    
    # Create the user instance
    db_user = User(
        username=user_create.username,
        email=user_create.email,
        created_by=current_user_id,
        updated_by=current_user_id
    )
    
    # Set the password
    db_user.set_password(user_create.password)
    
    # Add to session
    db.add(db_user)
    db.flush()
    
    # Set roles if provided
    if user_create.roles:
        roles = db.query(Role).filter(Role.id.in_(user_create.roles)).all()
        db_user.roles = roles
    
    # Commit the transaction
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"Created user id={db_user.id} successfully")
    return db_user

def update_user(
    db: Session, 
    user_id: int, 
    user_update: UserUpdate,
    current_user_id: Optional[int] = None
) -> Optional[User]:
    """
    Update a user by ID
    """
    logger.info(f"Updating user id={user_id}")
    
    # Get the user
    db_user = get_user(db, user_id)
    if not db_user:
        logger.warning(f"User id={user_id} not found")
        return None
    
    # Update fields if provided
    if user_update.username is not None:
        db_user.username = user_update.username
    
    if user_update.email is not None:
        db_user.email = user_update.email
    
    # Update the is_active field if provided
    if user_update.is_active is not None:
        logger.info(f"Updating is_active from {db_user.is_active} to {user_update.is_active} for user id={user_id}")
        db_user.is_active = user_update.is_active
    
    # Always update the updated_by field
    if current_user_id:
        db_user.updated_by = current_user_id
    
    # Update roles if provided
    if user_update.roles is not None:
        roles = db.query(Role).filter(Role.id.in_(user_update.roles)).all()
        db_user.roles = roles
    
    # Commit changes
    db.commit()
    
    # Refresh the db_user object to ensure it has the latest data
    db.refresh(db_user)
    
    logger.info(f"Updated user id={user_id} successfully, is_active={db_user.is_active}")
    return db_user

def delete_user(db: Session, user_id: int) -> bool:
    """
    Delete a user by ID
    """
    logger.info(f"Deleting user id={user_id}")
    
    # Get the user
    db_user = get_user(db, user_id)
    if not db_user:
        logger.warning(f"User id={user_id} not found")
        return False
    
    # Delete the user
    db.delete(db_user)
    db.commit()
    
    logger.info(f"Deleted user id={user_id} successfully")
    return True

def change_user_password(db: Session, user_id: int, new_password: str, current_user_id: Optional[int] = None) -> Optional[User]:
    """
    Change a user's password
    """
    logger.info(f"Changing password for user id={user_id}")
    
    # Get the user
    db_user = get_user(db, user_id)
    if not db_user:
        logger.warning(f"User id={user_id} not found")
        return None
    
    # Set the new password
    db_user.set_password(new_password)
    
    # Update the updated_by field
    if current_user_id:
        db_user.updated_by = current_user_id
    
    # Commit changes
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"Changed password for user id={user_id} successfully")
    return db_user

# Export functions explicitly for clarity
__all__ = [
    "get_user",
    "get_user_by_email",
    "get_user_by_username",
    "get_users_paginated",
    "create_user",
    "update_user",
    "delete_user",
    "change_user_password"
]