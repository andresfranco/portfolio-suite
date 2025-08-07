from fastapi import APIRouter, Depends, HTTPException, Query, status, Path, Body
from sqlalchemy.orm import Session
import json
from pydantic import ValidationError
from app.core.database import get_db
from app.schemas.role import (
    RoleCreate, 
    RoleOut, 
    RoleUpdate, 
    PaginatedRoleResponse,
    RoleFilter
)
from app.crud import role as crud_role
from typing import Optional, List, Any, Dict
from app.core.logging import setup_logger

router = APIRouter()

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.roles")

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

@router.post("/", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    role: RoleCreate = Body(...),
    db: Session = Depends(get_db)
):
    """Create a new role"""
    logger.debug(f"Attempting to create role with name: {role.name}")
    try:
        created_role_model = crud_role.create_role(db, role)
        db.commit()
        db.refresh(created_role_model)
        
        # Convert role to dictionary to ensure permissions are strings
        role_dict = {
            "id": created_role_model.id,
            "name": created_role_model.name,
            "description": created_role_model.description,
            "permissions": created_role_model.permission_names,  # Use the property directly
            "users_count": getattr(created_role_model, "users_count", 0)
        }
            
        logger.info(f"Role '{created_role_model.name}' created successfully with ID {created_role_model.id}")
        return role_dict
    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except ValueError as e:
        db.rollback()
        logger.error(f"Validation error creating role '{role.name}': {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating role '{role.name}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred while creating the role."
        )

@router.get("/", response_model=PaginatedRoleResponse)
def read_roles(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"admin", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'name', 'id', 'users_count')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    permission_names: Optional[str] = Query(None, description="Comma-separated list of permission names to filter roles by")
):
    """Retrieve roles with standard pagination, filtering, and sorting."""
    logger.debug(f"Fetching roles: page={page}, size={page_size}, sort={sort_field} {sort_order}, filters={filters}, permission_names={permission_names}")
    
    try:
        # Parse filters
        parsed_filters = parse_filters(filters) # Use helper to parse/validate
        
        # Add permission_names to filters if provided
        if permission_names:
            # Split by comma and strip whitespace
            perm_list = [p.strip() for p in permission_names.split(',') if p.strip()]
            
            if not parsed_filters:
                parsed_filters = []
                
            # Add as a permissions filter
            if perm_list:
                logger.debug(f"Adding permission_names filter with values: {perm_list}")
                parsed_filters.append({
                    'field': 'permissions',
                    'value': perm_list,
                    'operator': 'in'
                })
        
        # Get paginated roles
        roles, total = crud_role.get_roles_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Convert roles to dictionaries to ensure permissions are strings
        role_dicts = []
        for role in roles:
            role_dict = {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "permissions": role.permission_names,  # Use the property directly
                "users_count": getattr(role, "users_count", 0)
            }
            role_dicts.append(role_dict)
        
        response = {
            "items": role_dicts, 
            "total": total,
            "page": page,
            "page_size": page_size
        }
        
        logger.debug(f"Returning {len(roles)} roles (total: {total})")
        return response
    except ValueError as e: # Catch potential errors from QueryBuilder/CRUD
        logger.warning(f"Error during role retrieval: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching roles: {str(e)}", exc_info=True)
        # Be more specific in the error message for easier debugging
        error_message = f"An unexpected error occurred while fetching roles: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message
        )

@router.get("/{role_id}", response_model=RoleOut)
def read_role(
    role_id: int = Path(..., ge=1, description="The ID of the role to retrieve"), 
    db: Session = Depends(get_db)
):
    """Get a specific role by its ID."""
    logger.debug(f"Fetching role with id: {role_id}")
    db_role = crud_role.get_role(db, role_id)
    if not db_role:
        logger.warning(f"Role with id {role_id} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    # Convert role to dictionary to ensure permissions are strings
    role_dict = {
        "id": db_role.id,
        "name": db_role.name,
        "description": db_role.description,
        "permissions": db_role.permission_names,  # Use the property directly
        "users_count": getattr(db_role, "users_count", 0)
    }
    
    return role_dict

@router.put("/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int = Path(..., ge=1, description="The ID of the role to update"), 
    role: RoleUpdate = Body(...),
    db: Session = Depends(get_db)
):
    """Update an existing role."""
    logger.debug(f"Attempting to update role {role_id} with data: {role.model_dump(exclude_unset=True)}")
    
    if role.name is not None:
        existing_role_model = crud_role.get_role_by_name(db, role.name)
        if existing_role_model and existing_role_model.id != role_id:
            logger.warning(f"Update failed: Role name '{role.name}' already exists for ID {existing_role_model.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Role name already exists"
            )
    
    try:
        updated_role_model = crud_role.update_role(db, role_id, role)
        if not updated_role_model:
            logger.warning(f"Role with id {role_id} not found for update")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        
        db.commit()
        db.refresh(updated_role_model)
        
        # Convert role to dictionary to ensure permissions are strings
        role_dict = {
            "id": updated_role_model.id,
            "name": updated_role_model.name,
            "description": updated_role_model.description,
            "permissions": updated_role_model.permission_names,  # Use the property directly
            "users_count": getattr(updated_role_model, "users_count", 0)
        }
            
        logger.info(f"Role {role_id} updated successfully.")
        return role_dict
    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except ValueError as e:
        db.rollback()
        logger.error(f"Validation error updating role {role_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating role {role_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while updating the role."
        )

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: int = Path(..., ge=1, description="The ID of the role to delete"),
    db: Session = Depends(get_db)
):
    """Delete a role."""
    logger.debug(f"Attempting to delete role {role_id}")
    try:
        deleted_role = crud_role.delete_role(db, role_id)
        if not deleted_role:
            logger.warning(f"Role with id {role_id} not found for deletion")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        
        db.commit()
        logger.info(f"Role {role_id} deleted successfully.")
        return None
    except HTTPException as http_exc:
        db.rollback()
        raise http_exc
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting role {role_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while deleting the role."
        )
