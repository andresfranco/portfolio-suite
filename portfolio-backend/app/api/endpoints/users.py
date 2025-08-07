from fastapi import APIRouter, Depends, Query, HTTPException, Body, status, Path
from fastapi.responses import JSONResponse, Response
from typing import Any, List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app import schemas, models
from app.api import deps
from app.crud import user as user_crud
from app.core.security_decorators import require_permission, require_any_permission, permission_checker
from app.core.audit_logger import audit_logger
import logging
import json

# Set up logger
logger = logging.getLogger(__name__)

router = APIRouter()

# --- Helper Function for Filter Parsing ---

def parse_filters(filters_json: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    """Parse JSON filter string to a list of filter dictionaries.
    
    Args:
        filters_json: JSON string of filters
        
    Returns:
        List of filter dictionaries or None if no filters
        
    Raises:
        HTTPException: If JSON is invalid or filter format is incorrect
    """
    if not filters_json:
        return None
        
    try:
        filters_list = json.loads(filters_json)
        if not isinstance(filters_list, list):
            raise ValueError("Filters must be a JSON array")
        
        # Validate each filter dictionary
        validated_filters = []
        for f in filters_list:
            if not isinstance(f, dict):
                raise ValueError("Each filter must be an object")
                
            if 'field' not in f or 'value' not in f:
                raise ValueError("Each filter must have 'field' and 'value' properties")
                
            # Create a valid filter object
            validated_filter = {
                'field': f['field'],
                'value': f['value'],
                'operator': f.get('operator', 'contains')
            }
            
            validated_filters.append(validated_filter)
            
        return validated_filters
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON format for filters: {filters_json}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid JSON format for filters parameter"
        )
    except ValueError as e:
        logger.error(f"Invalid filter structure: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Invalid filter structure: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error parsing filters: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Error parsing filters: {str(e)}"
        )

@router.get("/", response_model=schemas.PaginatedResponse[schemas.UserOut])
@require_permission("VIEW_USERS")
def read_users(
    db: Session = Depends(deps.get_db),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"username", "value":"admin", "operator":"contains"}]`'),
    filter_field: Optional[List[str]] = Query(None, description="Field names to filter on (legacy parameter)"),
    filter_value: Optional[List[str]] = Query(None, description="Values to filter by (legacy parameter)"),
    filter_operator: Optional[List[str]] = Query(None, description="Operators to apply (legacy parameter)"),
    sort_field: str = Query("id", description="Field to sort by"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    include_full_details: bool = Query(False, description="Include full details for each user"),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Retrieve users with pagination, sorting, and filtering.
    
    Supports two filter methods:
    1. Modern: JSON filters parameter with array of filter objects
    2. Legacy: filter_field[], filter_value[], filter_operator[] arrays
    """
    logger.debug(f"Getting users list with page={page}, page_size={page_size}")
    
    try:
        # Parse JSON filters if provided (preferred method)
        parsed_filters = []
        
        if filters:
            logger.debug(f"Parsing JSON filters: {filters}")
            filter_dicts = parse_filters(filters)
            if filter_dicts:
                for filter_dict in filter_dicts:
                    try:
                        parsed_filters.append(schemas.user.Filter.from_dict(filter_dict))
                    except ValueError as e:
                        logger.warning(f"Invalid filter parameter: {str(e)}")
                        raise HTTPException(status_code=400, detail=str(e))
        
        # Handle legacy filter parameters if JSON filters not provided
        elif filter_field and filter_value:
            logger.debug(f"Using legacy filter parameters: field={filter_field}, value={filter_value}, operator={filter_operator}")
            
            # Handle non-array filter format (for backward compatibility with FastAPI Swagger UI)
            # If parameters are provided without array notation, convert them to lists
            if isinstance(filter_field, str) and not isinstance(filter_field, list):
                filter_field = [filter_field]
            if isinstance(filter_value, str) and not isinstance(filter_value, list):
                filter_value = [filter_value]
            if isinstance(filter_operator, str) and not isinstance(filter_operator, list):
                filter_operator = [filter_operator]
                
            # Ensure operators list is same length as fields list
            operators = filter_operator if filter_operator else ['contains'] * len(filter_field)
            
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    try:
                        op = operators[i] if i < len(operators) else "contains"
                        parsed_filters.append(schemas.user.Filter.from_params(
                            field=field, 
                            value=filter_value[i],
                            operator=op
                        ))
                        logger.debug(f"Parsed filter: field={field}, value={filter_value[i]}, operator={op}")
                    except ValueError as e:
                        logger.warning(f"Invalid filter parameter: {str(e)}")
                        raise HTTPException(status_code=400, detail=str(e))
        
        users, total = user_crud.get_users_paginated(
            db=db,
            page=page,
            page_size=page_size,
            sort_field=sort_field,
            sort_order=sort_order,
            include_full_details=include_full_details,
            filters=parsed_filters,
        )
        
        return {
            "items": users,
            "total": total,
            "page": page,
            "pageSize": page_size,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting users list: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}", response_model=schemas.UserOut)
@require_permission("VIEW_USERS")
def read_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Get a specific user by ID.
    """
    logger.debug(f"Getting user with id={user_id}")
    try:
        user = user_crud.get_user(db, user_id=user_id)
        if not user:
            logger.warning(f"User not found with id={user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=schemas.UserOut, status_code=201)
@require_permission("CREATE_USER")
def create_user(
    user_create: schemas.UserCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Create a new user.
    """
    logger.debug(f"Creating new user with username={user_create.username}")
    try:
        # Check if username already exists
        db_user = user_crud.get_user_by_username(db, username=user_create.username)
        if db_user:
            logger.warning(f"Username already exists: {user_create.username}")
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email already exists
        db_user = user_crud.get_user_by_email(db, email=user_create.email)
        if db_user:
            logger.warning(f"Email already exists: {user_create.email}")
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Create the user
        db_user = user_crud.create_user(
            db=db, 
            user_create=user_create, 
            current_user_id=current_user.id
        )
        return db_user
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail="Database integrity error")
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}", response_model=schemas.UserOut)
@require_permission("EDIT_USER")
def update_user(
    user_update: schemas.UserUpdate,
    user_id: int = Path(..., ge=1),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Update a user.
    """
    logger.debug(f"Updating user with id={user_id}")
    
    # Log the update data received
    if user_update.is_active is not None:
        logger.debug(f"Updating user is_active: {user_update.is_active} (type: {type(user_update.is_active).__name__})")
    
    try:
        # Check if user exists
        existing_user = user_crud.get_user(db, user_id=user_id)
        if not existing_user:
            logger.warning(f"User not found with id={user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent systemadmin modification by non-system admins
        if existing_user.username == "systemadmin" and not permission_checker.is_system_admin(current_user):
            logger.warning(f"Non-system admin {current_user.username} attempted to modify systemadmin")
            raise HTTPException(
                status_code=403,
                detail="Cannot modify system administrator account"
            )
        
        # Check for username uniqueness if provided
        if user_update.username is not None and user_update.username != existing_user.username:
            db_user = user_crud.get_user_by_username(db, username=user_update.username)
            if db_user:
                logger.warning(f"Username already exists: {user_update.username}")
                raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check for email uniqueness if provided
        if user_update.email is not None and user_update.email != existing_user.email:
            db_user = user_crud.get_user_by_email(db, email=user_update.email)
            if db_user:
                logger.warning(f"Email already exists: {user_update.email}")
                raise HTTPException(status_code=400, detail="Email already exists")
        
        # Update the user
        updated_user = user_crud.update_user(
            db=db, 
            user_id=user_id, 
            user_update=user_update,
            current_user_id=current_user.id
        )
        if not updated_user:
            logger.warning(f"User update failed for id={user_id}")
            raise HTTPException(status_code=404, detail="User not found or update failed")
        
        # Log the updated status
        logger.debug(f"User updated successfully, is_active={updated_user.is_active}")
        
        return updated_user
    except HTTPException:
        raise
    except IntegrityError as e:
        logger.error(f"Database integrity error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail="Database integrity error")
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("DELETE_USER")
def delete_user(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Delete a user.
    """
    logger.debug(f"Deleting user with id={user_id}")
    try:
        # Check if user exists
        existing_user = user_crud.get_user(db, user_id=user_id)
        if not existing_user:
            logger.warning(f"User not found with id={user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent systemadmin deletion
        if existing_user.username == "systemadmin":
            logger.warning(f"Attempt to delete systemadmin user by {current_user.username}")
            raise HTTPException(
                status_code=403,
                detail="Cannot delete system administrator account"
            )
        
        # Prevent self-deletion
        if existing_user.id == current_user.id:
            logger.warning(f"User {current_user.username} attempted to delete their own account")
            raise HTTPException(
                status_code=400,
                detail="Cannot delete your own account"
            )
        
        # Delete the user
        success = user_crud.delete_user(db=db, user_id=user_id)
        if not success:
            logger.warning(f"User deletion failed for id={user_id}")
            raise HTTPException(status_code=500, detail="User deletion failed")
        
        # Log the deletion
        audit_logger.log_admin_action(
            admin_user=current_user,
            action="DELETE_USER",
            target=f"user:{existing_user.username}",
            details={"user_id": user_id, "deleted_username": existing_user.username}
        )
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{user_id}/change-password", response_model=schemas.UserOut)
@require_permission("RESET_USER_PASSWORD")
def change_password(
    password_data: schemas.UserPasswordChange,
    user_id: int = Path(..., ge=1),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Change a user's password.
    """
    logger.debug(f"Changing password for user with id={user_id}")
    try:
        # Check if user exists
        existing_user = user_crud.get_user(db, user_id=user_id)
        if not existing_user:
            logger.warning(f"User not found with id={user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if username matches
        if password_data.username != existing_user.username:
            logger.warning(f"Username mismatch for user id={user_id}")
            raise HTTPException(status_code=400, detail="Username does not match")
        
        # Change the password
        updated_user = user_crud.change_user_password(
            db=db, 
            user_id=user_id, 
            new_password=password_data.password,
            current_user_id=current_user.id
        )
        if not updated_user:
            logger.warning(f"Password change failed for user id={user_id}")
            raise HTTPException(status_code=500, detail="Password change failed")
        
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoints for frontend integration
@router.get("/me/permissions")
def get_current_user_permissions(
    current_user: models.User = Depends(deps.get_current_user)
):
    """Get current user's permissions and roles."""
    try:
        permissions = []
        roles = []
        
        # Check if user is system admin
        if permission_checker.is_system_admin(current_user):
            # System admin gets all permissions
            from app.crud.permission import COMPREHENSIVE_PERMISSIONS
            permissions = [perm["name"] for perm in COMPREHENSIVE_PERMISSIONS]
        else:
            # Regular user permissions
            for role in current_user.roles:
                roles.append({"id": role.id, "name": role.name})
                for permission in role.permissions:
                    if permission.name not in permissions:
                        permissions.append(permission.name)
        
        return {
            "permissions": permissions,
            "roles": roles,
            "is_systemadmin": permission_checker.is_system_admin(current_user)
        }
    
    except Exception as e:
        logger.error(f"Error getting user permissions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.get("/{user_id}/permissions")
@require_permission("VIEW_USERS")
def get_user_permissions(
    user_id: int = Path(..., ge=1),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Get specific user's permissions and roles."""
    try:
        # Get user
        user = user_crud.get_user(db, user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        permissions = []
        roles = []
        
        # Check if user is system admin
        if permission_checker.is_system_admin(user):
            # System admin gets all permissions
            from app.crud.permission import COMPREHENSIVE_PERMISSIONS
            permissions = [perm["name"] for perm in COMPREHENSIVE_PERMISSIONS]
        else:
            # Regular user permissions
            for role in user.roles:
                roles.append({"id": role.id, "name": role.name})
                for permission in role.permissions:
                    if permission.name not in permissions:
                        permissions.append(permission.name)
        
        return {
            "permissions": permissions,
            "roles": roles,
            "is_systemadmin": permission_checker.is_system_admin(user)
        }
    
    except Exception as e:
        logger.error(f"Error getting user permissions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
