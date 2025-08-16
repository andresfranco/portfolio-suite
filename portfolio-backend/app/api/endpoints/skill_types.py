import json
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, Response
from sqlalchemy.orm import Session
from pydantic import ValidationError
from typing import Any, List, Optional

from app import schemas
from app.api import deps
from app.crud import skill_type as skill_type_crud
from app.crud import skill as skill_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
from app import models
from app.schemas.skill_type import SkillTypeCreate, SkillTypeUpdate, SkillTypeOut, PaginatedSkillTypeResponse, Filter
from app.rag.rag_events import stage_event

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.skill_types")

# Define router
router = APIRouter()

# --- Helper Function for Filter Parsing ---

def parse_filters(filters_json: Optional[str]) -> Optional[List[Filter]]:
    """Parses the JSON filter string into a list of Filter objects."""
    if not filters_json:
        return None
    try:
        logger.debug(f"Attempting to parse filters: {filters_json}")
        filters_list = json.loads(filters_json)
        
        if not isinstance(filters_list, list):
            logger.error(f"Filters must be a JSON array, got: {type(filters_list)}")
            raise ValueError("Filters must be a JSON array.")
            
        logger.debug(f"Successfully parsed JSON, validating filter objects: {filters_list}")
        
        # Validate each filter dictionary against the Pydantic model
        result_filters = []
        for i, filter_dict in enumerate(filters_list):
            try:
                filter_obj = Filter(**filter_dict)
                result_filters.append(filter_obj)
                logger.debug(f"Validated filter {i}: {filter_obj.model_dump()}")
            except ValidationError as e:
                logger.error(f"Validation error in filter {i}: {filter_dict}, error: {e}")
                raise ValidationError(f"Invalid filter at position {i}: {e}", model=Filter)
        
        return result_filters
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON format for filters: {filters_json}, error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                           detail=f"Invalid JSON format for filters parameter: {str(e)}")
    except ValidationError as e:
        logger.error(f"Invalid filter structure: {e}")
        # Provide more specific error details from Pydantic validation
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, 
                           detail=f"Invalid filter structure: {e.errors()}")
    except ValueError as e:
        logger.error(f"Error parsing filters: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error parsing filters: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                           detail=f"Failed to process filters: {str(e)}")

# --- API Endpoints ---

@router.get(
    "/",
    response_model=PaginatedSkillTypeResponse,
    summary="Get paginated list of skill types",
    description="Retrieves a list of skill types with pagination, filtering, and sorting."
)
@require_permission("VIEW_SKILL_TYPES")
def read_skill_types(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"general", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'code', 'name')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    # Legacy filter parameters (for backward compatibility)
    code: Optional[str] = Query(None, description="Filter by skill type code (contains)"),
    name: Optional[str] = Query(None, description="Filter by skill type name (contains)")
) -> Any:
    """
    Get paginated list of skill types with filtering and sorting.
    """
    logger.info(f"Fetching skill types with page={page}, page_size={page_size}, filters={filters}, code={code}, name={name}, sort={sort_field} {sort_order}")
    
    try:
        parsed_filters = None
        
        # Handle individual query parameters first, if they exist
        if code or name:
            logger.debug(f"Processing direct query parameters: code={code}, name={name}")
            parsed_filters = []
            
            if code:
                logger.debug(f"Adding code filter: {code}")
                parsed_filters.append(Filter(field="code", value=code, operator="contains"))
            
            if name:
                logger.debug(f"Adding name filter: {name}")
                parsed_filters.append(Filter(field="name", value=name, operator="contains"))
        
        # Parse JSON filters if provided, overriding direct parameters
        # This gives precedence to the more flexible JSON format
        if filters:
            logger.debug(f"Processing JSON filters: {filters}")
            json_filters = parse_filters(filters)
            
            if json_filters:
                # If we had direct parameters but now have JSON, replace them
                if parsed_filters:
                    logger.debug("JSON filters are replacing direct query parameters")
                parsed_filters = json_filters
                
        logger.debug(f"Final filters to apply: {parsed_filters}")
        
        # Get the skill types with pagination, filtering, and sorting
        skill_types, total = skill_type_crud.get_skill_types_paginated(
            db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Return the paginated response with correct field names matching the schema
        response = PaginatedSkillTypeResponse(
            items=skill_types,
            total=total,
            page=page,
            pageSize=page_size  # Changed from page_size to pageSize to match the schema
        )
        
        logger.info(f"Skill types fetched: {len(skill_types)} of {total} total")
        return response
        
    except ValueError as e:
        logger.warning(f"Value error in read_skill_types: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error in read_skill_types: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while retrieving skill types: {str(e)}")

@router.get(
    "/codes", 
    response_model=List[str],
    summary="Get all skill type codes",
    description="Retrieves a list containing only the codes of all skill types."
)
@require_permission("VIEW_SKILL_TYPES")
def get_all_skill_type_codes(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    response: Response = None
):
    """
    Get a list of all skill type codes.
    """
    logger.info("Fetching all skill type codes")
    
    try:
        # Set cache headers to improve performance
        if response:
            # Cache for 5 minutes
            response.headers["Cache-Control"] = "public, max-age=300"
        
        # Get all skill types and extract codes
        skill_types = skill_type_crud.get_skill_types(db, limit=1000)
        codes = [st.code for st in skill_types]
        
        logger.info(f"Returning {len(codes)} skill type codes")
        return codes
    except Exception as e:
        logger.exception(f"Error fetching skill type codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving skill type codes: {str(e)}"
        )

@router.post(
    "/", 
    response_model=SkillTypeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new skill type",
    description="Creates a new skill type record in the database."
)
@require_permission("CREATE_SKILL_TYPE")
def create_skill_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_type_in: SkillTypeCreate = Body(...),
) -> Any:
    """
    Create new skill type.
    """
    logger.info(f"Creating skill type with data: {skill_type_in}")
    
    try:
        # Attempt to create the skill type
        skill_type = skill_type_crud.create_skill_type(db, skill_type=skill_type_in)
        logger.info(f"Skill type created successfully with code: {skill_type.code}")
        stage_event(db, {"op":"insert","source_table":"skill_types","source_id":str(skill_type.id),"changed_fields":["code"]})
        return skill_type
    except ValueError as e:
        # Handle validation errors (e.g., duplicate code)
        logger.warning(f"Error creating skill type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error creating skill type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating skill type: {str(e)}",
        )

@router.get(
    "/check-code/{code}", 
    response_model=dict,
    summary="Check if a skill type code exists",
    description="Checks whether a skill type code is already in use."
)
@require_permission("VIEW_SKILL_TYPES")
def check_code_exists(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The skill type code to check"),
) -> Any:
    """
    Check if a skill type code already exists.
    """
    logger.debug(f"Checking if skill type code exists: {code}")
    
    try:
        # Get the skill type by code
        skill_type = skill_type_crud.get_skill_type_by_code(db, code=code)
        return {"exists": bool(skill_type)}
    except Exception as e:
        logger.exception(f"Error checking skill type code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking skill type code: {str(e)}",
        )

@router.get(
    "/{code}", 
    response_model=SkillTypeOut,
    summary="Get a specific skill type by code",
    description="Retrieves details for a single skill type specified by its code."
)
@require_permission("VIEW_SKILL_TYPES")
def read_skill_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the skill type to retrieve"),
) -> Any:
    """
    Get skill type by code.
    """
    logger.info(f"Fetching skill type with code: {code}")
    
    # Get the skill type
    skill_type = skill_type_crud.get_skill_type(db, code=code)
    if not skill_type:
        logger.warning(f"Skill type not found: {code}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Skill type not found",
        )
    
    logger.info(f"Skill type found: {code}")
    return skill_type

@router.put(
    "/{code}", 
    response_model=SkillTypeOut,
    summary="Update a skill type",
    description="Updates an existing skill type's details."
)
@require_permission("EDIT_SKILL_TYPE")
def update_skill_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the skill type to update"),
    skill_type_in: SkillTypeUpdate = Body(...),
) -> Any:
    """
    Update a skill type.
    """
    logger.info(f"Updating skill type {code} with data: {skill_type_in.model_dump(exclude_unset=True)}")
    
    try:
        # Attempt to update the skill type
        skill_type = skill_type_crud.update_skill_type(db, code=code, skill_type=skill_type_in)
        
        if not skill_type:
            logger.warning(f"Skill type not found: {code}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill type not found",
            )
        
        logger.info(f"Skill type updated successfully: {code}")
        stage_event(db, {"op":"update","source_table":"skill_types","source_id":str(skill_type.id),"changed_fields":list(skill_type_in.model_dump(exclude_unset=True).keys())})
        return skill_type
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Error updating skill type: {str(e)}")
        
        # Use 409 Conflict for conflicts (e.g., duplicate code)
        if "already exists" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error updating skill type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating skill type: {str(e)}",
        )

@router.delete(
    "/{code}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a skill type",
    description="Deletes a skill type from the database."
)
@require_permission("DELETE_SKILL_TYPE")
def delete_skill_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the skill type to delete"),
) -> None:
    """
    Delete a skill type.
    """
    logger.info(f"Deleting skill type {code}")
    
    try:
        # Attempt to delete the skill type
        skill_type = skill_type_crud.delete_skill_type(db, code=code)
        
        if not skill_type:
            logger.warning(f"Skill type not found: {code}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Skill type not found",
            )
        
        logger.info(f"Skill type deleted successfully: {code}")
        stage_event(db, {"op":"delete","source_table":"skill_types","source_id":str(skill_type.id),"changed_fields":[]})
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Error deleting skill type: {str(e)}")
        
        # Use 409 Conflict for conflicts (e.g., skill type in use)
        if "in use" in str(e) or "associated" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error deleting skill type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting skill type: {str(e)}",
        ) 