import json
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, Response
from sqlalchemy.orm import Session
from pydantic import ValidationError
from app.core.database import get_db
from app.schemas import permission as schemas_permission # Use aliasing
from app.crud import permission as crud_permission
from typing import Optional, List, Any
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.models.permission import Permission, role_permissions
from app.models.role import Role
from app.core.security_decorators import require_permission, require_any_permission, require_system_admin
from app.api import deps
from app import models

router = APIRouter()

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.permissions")

# --- Helper Function for Filter Parsing ---

def parse_filters(filters_json: Optional[str]) -> Optional[List[schemas_permission.Filter]]:
    """Parses the JSON filter string into a list of Filter objects."""
    if not filters_json:
        return None
    try:
        filters_list = json.loads(filters_json)
        if not isinstance(filters_list, list):
             raise ValueError("Filters must be a JSON array.")
        # Validate each filter dictionary against the Pydantic model
        return [schemas_permission.Filter(**f) for f in filters_list]
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON format for filters: {filters_json}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON format for filters parameter.")
    except ValidationError as e:
        logger.error(f"Invalid filter structure: {e}")
        # Provide more specific error details from Pydantic validation
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid filter structure: {e.errors()}")
    except ValueError as e:
        logger.error(f"Error parsing filters: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# --- API Endpoints ---

@router.post(
    "/", 
    response_model=schemas_permission.PermissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new permission",
    description="Creates a new permission record in the database."
)
@require_permission("CREATE_PERMISSION")
def create_permission(
    permission_in: schemas_permission.PermissionCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Creates a new permission based on the provided data."""
    logger.info(f"Received request to create permission: {permission_in.name}")
    try:
        created_permission = crud_permission.create_permission(db=db, permission_in=permission_in)
        logger.info(f"Successfully created permission ID: {created_permission.id}")
        return created_permission
    except ValueError as e:
        logger.warning(f"Failed to create permission '{permission_in.name}': {e}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e: # Catch unexpected errors
        logger.exception(f"Unexpected error creating permission '{permission_in.name}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while creating the permission.")

@router.get(
    "/", 
    response_model=schemas_permission.PaginatedPermissionResponse,
    summary="Get paginated list of permissions",
    description="Retrieves a list of permissions with pagination, filtering, and sorting."
)
@require_permission("VIEW_PERMISSIONS")
def read_permissions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=1000, description="Number of items per page (max 1000)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"admin", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'name', 'id', 'roles_count')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    role_names: Optional[str] = Query(None, description="Comma-separated list of role names to filter by")
):
    """Retrieves permissions with standard pagination, filtering, and sorting."""
    logger.info(f"Received request to get permissions: page={page}, size={page_size}, sort={sort_field} {sort_order}, filters={filters}, role_names={role_names}")
    
    parsed_filters = parse_filters(filters) # Use helper to parse/validate
    
    try:
        # If role_names parameter is provided, add a custom filter for roles
        role_filter = None
        if role_names:
            # Split the comma-separated list of role names
            role_list = [name.strip() for name in role_names.split(',') if name.strip()]
            if role_list:
                logger.info(f"Filtering permissions by role names: {role_list}")
                
                # Get the role IDs for the provided role names
                roles = db.query(Role).filter(Role.name.in_(role_list)).all()
                if roles:
                    role_ids = [role.id for role in roles]
                    logger.info(f"Found {len(role_ids)} role IDs for filter: {role_ids}")
                    
                    # Get permission IDs that are associated with these roles
                    permission_ids = db.query(role_permissions.c.permission_id).\
                        filter(role_permissions.c.role_id.in_(role_ids)).\
                        distinct().\
                        all()
                    
                    # Extract permission IDs from the result
                    permission_id_list = [pid[0] for pid in permission_ids]
                    logger.info(f"Found {len(permission_id_list)} permission IDs with the specified roles")
                    
                    # Custom filter function to filter permissions with these IDs
                    def role_filter_func(query):
                        return query.filter(Permission.id.in_(permission_id_list))
                    
                    role_filter = role_filter_func
                else:
                    logger.warning(f"No roles found with names: {role_list}")
                    # If no roles are found, return empty result
                    return schemas_permission.PaginatedPermissionResponse(
                        items=[],
                        total=0,
                        page=page,
                        page_size=page_size
                    )
        
        # Get permissions with the specified filters
        permissions, total_count = crud_permission.get_permissions_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order,
            custom_filter=role_filter
        )
        
        # Convert the permissions to dictionaries first
        permission_dicts = []
        for permission in permissions:
            # Create a dictionary with the needed fields
            permission_dict = {
                "id": permission.id,
                "name": permission.name,
                "description": permission.description,
                "roles_count": getattr(permission, "roles_count", 0),
                "roles": permission.role_names  # Use the property directly
            }
            permission_dicts.append(permission_dict)
        
        response = schemas_permission.PaginatedPermissionResponse(
            items=permission_dicts,
            total=total_count,
            page=page,
            page_size=page_size
        )
        logger.info(f"Returning {len(permissions)} permissions (total: {total_count}) for page {page}")
        return response
    except ValueError as e: # Catch potential errors from QueryBuilder/CRUD
        logger.warning(f"Error during permission retrieval: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e: # Catch unexpected errors
        logger.exception(f"Unexpected error retrieving permissions: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while retrieving permissions.")

@router.get(
    "/names",
    response_model=List[str],
    summary="Get all permission names",
    description="Retrieves a list of all permission names for role management. No authentication required."
)
def get_permission_names(
    db: Session = Depends(get_db)
):
    """Retrieves all permission names without authentication for role management."""
    logger.info("Received request to get all permission names")
    
    try:
        # Get all permissions directly from the database
        all_permissions = db.query(Permission).order_by(Permission.name).all()
        permission_names = [permission.name for permission in all_permissions]
        
        logger.info(f"Successfully retrieved {len(permission_names)} permission names")
        return permission_names
    except Exception as e:
        logger.exception(f"Unexpected error getting permission names: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An unexpected error occurred while retrieving permission names."
        )

@router.post(
    "/", 
    response_model=schemas_permission.PermissionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new permission",
    description="Creates a new permission record in the database."
)
@require_permission("CREATE_PERMISSION")
def create_permission(
    permission_in: schemas_permission.PermissionCreate = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Creates a new permission based on the provided data."""
    logger.info(f"Received request to create permission: {permission_in.name}")
    try:
        created_permission = crud_permission.create_permission(db=db, permission_in=permission_in)
        logger.info(f"Successfully created permission ID: {created_permission.id}")
        return created_permission
    except ValueError as e:
        logger.warning(f"Failed to create permission '{permission_in.name}': {e}")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e: # Catch unexpected errors
        logger.exception(f"Unexpected error creating permission '{permission_in.name}': {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while creating the permission.")

@router.get(
    "/{permission_id}", 
    response_model=schemas_permission.PermissionOut,
    summary="Get a specific permission by ID",
    description="Retrieves details for a single permission specified by its ID."
)
@require_permission("VIEW_PERMISSIONS")
def read_permission(
    permission_id: int = Path(..., ge=1, description="ID of the permission to retrieve"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Retrieves a single permission by its ID."""
    logger.info(f"Received request to get permission ID: {permission_id}")
    permission = crud_permission.get_permission_by_id(db, permission_id=permission_id, include_roles_count=True)
    if not permission:
        logger.warning(f"Permission ID {permission_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    
    # Convert to dictionary with the correct structure
    permission_dict = {
        "id": permission.id,
        "name": permission.name,
        "description": permission.description,
        "roles_count": getattr(permission, "roles_count", 0),
        "roles": permission.role_names  # Use the property directly
    }
    
    logger.info(f"Returning details for permission ID: {permission_id}")
    return permission_dict

@router.put(
    "/{permission_id}", 
    response_model=schemas_permission.PermissionOut,
    summary="Update a permission",
    description="Updates an existing permission's details."
)
@require_permission("EDIT_PERMISSION")
def update_permission(
    permission_id: int = Path(..., ge=1, description="ID of the permission to update"),
    permission_in: schemas_permission.PermissionUpdate = Body(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Updates an existing permission."""
    logger.info(f"Received request to update permission ID: {permission_id} with data: {permission_in.model_dump(exclude_unset=True)}")
    try:
        updated_permission = crud_permission.update_permission(
            db=db, 
            permission_id=permission_id, 
            permission_in=permission_in
        )
        if not updated_permission:
            logger.warning(f"Permission ID {permission_id} not found for update")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
        
        # Convert to dictionary with the correct structure
        permission_dict = {
            "id": updated_permission.id,
            "name": updated_permission.name,
            "description": updated_permission.description,
            "roles_count": getattr(updated_permission, "roles_count", 0),
            "roles": updated_permission.role_names  # Use the property directly
        }
        
        logger.info(f"Successfully updated permission ID: {permission_id}")
        return permission_dict
    except ValueError as e:
        logger.warning(f"Failed to update permission ID {permission_id}: {e}")
        # Distinguish between not found (handled above) and conflict
        if "already exists" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else: # Should ideally not happen if CRUD only raises ValueError for conflicts
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e: # Catch unexpected errors
        logger.exception(f"Unexpected error updating permission ID {permission_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while updating the permission.")

@router.delete(
    "/{permission_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a permission",
    description="Deletes a permission from the database. Fails if the permission is assigned to roles."
)
@require_any_permission(["DELETE_PERMISSION", "MANAGE_PERMISSIONS"])
def delete_permission(
    permission_id: int = Path(..., ge=1, description="ID of the permission to delete"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Deletes a permission, ensuring it's not currently assigned to any roles."""
    logger.info(f"Received request to delete permission ID: {permission_id}")
    
    try:
        # Attempt to delete - this will raise ValueError if permission has roles
        deleted_permission = crud_permission.delete_permission(db, permission_id=permission_id)
        
        if not deleted_permission:
            logger.warning(f"Permission ID {permission_id} not found for deletion")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
            
        logger.info(f"Successfully deleted permission ID: {permission_id}")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as e:
        # This handles the case where the permission is associated with roles
        error_message = str(e)
        logger.warning(f"Cannot delete permission ID {permission_id}: {error_message}")
        
        # Return a 409 CONFLICT status code when the error is about role associations
        # This is more specific than a 400 BAD REQUEST
        if "associated with" in error_message and "roles" in error_message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail=error_message
            )
        else:
            # For other validation errors
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_message)
    except Exception as e:
        logger.exception(f"Unexpected error deleting permission ID {permission_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while deleting the permission.")
