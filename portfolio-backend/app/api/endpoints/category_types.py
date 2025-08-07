import json
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, Response
from sqlalchemy.orm import Session
from pydantic import ValidationError
from typing import Any, List, Optional
from app import schemas, models
from app.api import deps
from app.crud import category_type as category_type_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
from app.schemas.category_type import CategoryTypeCreate, CategoryTypeUpdate, CategoryTypeOut, PaginatedCategoryTypeResponse, Filter

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.category_types")

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
    response_model=PaginatedCategoryTypeResponse,
    summary="Get paginated list of category types",
    description="Retrieves a list of category types with pagination, filtering, and sorting."
)
@require_permission("VIEW_CATEGORY_TYPES")
def read_category_types(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"general", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'code', 'name')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    # Legacy filter parameters (for backward compatibility)
    code: Optional[str] = Query(None, description="Filter by category type code (contains)"),
    name: Optional[str] = Query(None, description="Filter by category type name (contains)")
) -> Any:
    """
    Get paginated list of category types with filtering and sorting.
    """
    logger.info(f"Fetching category types with page={page}, page_size={page_size}, filters={filters}, code={code}, name={name}, sort={sort_field} {sort_order}")
    
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
        
        # Get the category types with pagination, filtering, and sorting
        category_types, total = category_type_crud.get_category_types_paginated(
            db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Return the paginated response with correct field names matching the schema
        response = PaginatedCategoryTypeResponse(
            items=category_types,
            total=total,
            page=page,
            pageSize=page_size  # Changed from page_size to pageSize to match the schema
        )
        
        logger.info(f"Category types fetched: {len(category_types)} of {total} total")
        return response
        
    except ValueError as e:
        logger.warning(f"Value error in read_category_types: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error in read_category_types: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred while retrieving category types: {str(e)}")

@router.get(
    "/codes", 
    response_model=List[str],
    summary="Get all category type codes",
    description="Retrieves a list containing only the codes of all category types."
)
@require_permission("VIEW_CATEGORY_TYPES")
def get_all_category_type_codes(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    response: Response = None
):
    """
    Get a list of all category type codes.
    """
    logger.info("Fetching all category type codes")
    
    try:
        # Set cache headers to improve performance
        if response:
            # Cache for 5 minutes
            response.headers["Cache-Control"] = "public, max-age=300"
        
        # Get all category types and extract codes
        category_types = category_type_crud.get_category_types(db, limit=1000)
        codes = [ct.code for ct in category_types]
        
        logger.info(f"Returning {len(codes)} category type codes")
        return codes
    except Exception as e:
        logger.exception(f"Error fetching category type codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving category type codes: {str(e)}"
        )

@router.post(
    "/", 
    response_model=CategoryTypeOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category type",
    description="Creates a new category type record in the database."
)
@require_permission("CREATE_CATEGORY_TYPE")
def create_category_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_type_in: CategoryTypeCreate = Body(...),
) -> Any:
    """
    Create new category type.
    """
    logger.info(f"Creating category type with data: {category_type_in}")
    
    try:
        # Attempt to create the category type
        category_type = category_type_crud.create_category_type(db, category_type=category_type_in)
        logger.info(f"Category type created successfully with code: {category_type.code}")
        return category_type
    except ValueError as e:
        # Handle validation errors (e.g., duplicate code)
        logger.warning(f"Error creating category type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error creating category type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating category type: {str(e)}",
        )

@router.get(
    "/check-code/{code}", 
    response_model=dict,
    summary="Check if a category type code exists",
    description="Checks whether a category type code is already in use."
)
@require_permission("VIEW_CATEGORY_TYPES")
def check_code_exists(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The category type code to check"),
) -> Any:
    """
    Check if a category type code already exists.
    """
    logger.debug(f"Checking if category type code exists: {code}")
    
    try:
        # Get the category type by code
        category_type = category_type_crud.get_category_type_by_code(db, code=code)
        return {"exists": bool(category_type)}
    except Exception as e:
        logger.exception(f"Error checking category type code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking category type code: {str(e)}",
        )

@router.get(
    "/{code}", 
    response_model=CategoryTypeOut,
    summary="Get a specific category type by code",
    description="Retrieves details for a single category type specified by its code."
)
@require_permission("VIEW_CATEGORY_TYPES")
def read_category_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the category type to retrieve"),
) -> Any:
    """
    Get category type by code.
    """
    logger.info(f"Fetching category type with code: {code}")
    
    # Get the category type
    category_type = category_type_crud.get_category_type(db, code=code)
    if not category_type:
        logger.warning(f"Category type not found: {code}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category type not found",
        )
    
    logger.info(f"Category type found: {code}")
    return category_type

@router.put(
    "/{code}", 
    response_model=CategoryTypeOut,
    summary="Update a category type",
    description="Updates an existing category type's details."
)
@require_permission("EDIT_CATEGORY_TYPE")
def update_category_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the category type to update"),
    category_type_in: CategoryTypeUpdate = Body(...),
) -> Any:
    """
    Update a category type.
    """
    logger.info(f"Updating category type {code} with data: {category_type_in.model_dump(exclude_unset=True)}")
    
    try:
        # Attempt to update the category type
        category_type = category_type_crud.update_category_type(db, code=code, category_type=category_type_in)
        
        if not category_type:
            logger.warning(f"Category type not found: {code}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category type not found",
            )
        
        logger.info(f"Category type updated successfully: {code}")
        return category_type
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Error updating category type: {str(e)}")
        
        # Use 409 Conflict for conflicts (e.g., duplicate code)
        if "already exists" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error updating category type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating category type: {str(e)}",
        )

@router.delete(
    "/{code}", 
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category type",
    description="Deletes a category type from the database."
)
@require_permission("DELETE_CATEGORY_TYPE")
def delete_category_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The code of the category type to delete"),
) -> None:
    """
    Delete a category type.
    """
    logger.info(f"Deleting category type with code: {code}")
    
    try:
        # Attempt to delete the category type
        category_type = category_type_crud.delete_category_type(db, code=code)
        
        if not category_type:
            logger.warning(f"Category type not found: {code}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category type not found",
            )
        
        logger.info(f"Category type deleted successfully: {code}")
        # Don't return anything for 204 response
        return None 
    except ValueError as e:
        # Handle validation errors (e.g., category type is in use)
        logger.warning(f"Error deleting category type: {str(e)}")
        
        # Use 409 Conflict if the category type is associated with categories
        if "associated with" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error deleting category type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting category type: {str(e)}",
        )
