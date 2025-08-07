import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from pydantic import ValidationError

from app import models, schemas
from app.api import deps
from app.crud import experience as experience_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.experiences")

# Define router
router = APIRouter()

# --- Helper Functions ---

def parse_filters(filters_json: Optional[str]) -> Optional[List[schemas.experience.Filter]]:
    """Parses the JSON filter string into a list of Filter objects."""
    if not filters_json:
        return None
    
    try:
        filters_data = json.loads(filters_json)
        if not isinstance(filters_data, list):
            raise ValueError("Filters must be a JSON array")
        
        filters = []
        for filter_data in filters_data:
            if not isinstance(filter_data, dict):
                raise ValueError("Each filter must be a JSON object")
            
            # Validate required fields
            if 'field' not in filter_data or 'value' not in filter_data:
                raise ValueError("Each filter must have 'field' and 'value' properties")
            
            # Create Filter object with validation
            filter_obj = schemas.experience.Filter(
                field=filter_data['field'],
                value=str(filter_data['value']),  # Ensure value is string
                operator=filter_data.get('operator', 'contains')
            )
            filters.append(filter_obj)
        
        return filters
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON format in filters: {str(e)}")
    except ValidationError as e:
        raise ValueError(f"Invalid filter format: {str(e)}")

@router.get(
    "/",
    response_model=schemas.PaginatedResponse[schemas.Experience],
    summary="Get paginated list of experiences",
    description="Retrieves a list of experiences with pagination, filtering, and sorting."
)
@require_permission("VIEW_EXPERIENCES")
def read_experiences(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"code", "value":"backend", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'code', 'years', 'name')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    # Legacy filter parameters (for backward compatibility)
    code: Optional[str] = Query(None, description="Filter by experience code (contains)"),
    name: Optional[str] = Query(None, description="Filter by experience name (contains)"),
    description: Optional[str] = Query(None, description="Filter by experience description (contains)")
) -> Any:
    """
    Retrieve experiences with pagination, filtering, and sorting.
    """
    logger.info(f"Fetching experiences with page={page}, page_size={page_size}, filters={filters}, code={code}, name={name}, sort={sort_field} {sort_order}")
    
    try:
        parsed_filters = None
        
        # Handle individual query parameters first
        if code or name or description:
            logger.debug(f"Processing direct query parameters: code={code}, name={name}, description={description}")
            parsed_filters = []
            
            if code:
                logger.debug(f"Adding code filter: {code}")
                parsed_filters.append(schemas.experience.Filter(field="code", value=code, operator="contains"))
            
            if name:
                logger.debug(f"Adding name filter: {name}")
                parsed_filters.append(schemas.experience.Filter(field="name", value=name, operator="contains"))
            
            if description:
                logger.debug(f"Adding description filter: {description}")
                parsed_filters.append(schemas.experience.Filter(field="description", value=description, operator="contains"))
        
        # Parse JSON filters if provided, which override direct parameters
        if filters:
            logger.debug(f"Processing JSON filters: {filters}")
            json_filters = parse_filters(filters)
            
            if json_filters:
                # If we had direct parameters but now have JSON, replace them
                if parsed_filters:
                    logger.debug("JSON filters are replacing direct query parameters")
                parsed_filters = json_filters
                
        logger.debug(f"Final filters to apply: {parsed_filters}")
        
        # Get experiences with pagination, filtering, and sorting
        experiences, total = experience_crud.get_experiences_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Return the paginated response using Pydantic model
        return {
            "items": experiences,
            "total": total,
            "page": page,
            "pageSize": page_size
        }
    except ValueError as e:
        logger.warning(f"Value error in read_experiences: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in read_experiences: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving experiences: {str(e)}"
        )

@router.get(
    "/full", 
    response_model=schemas.experience.PaginatedExperienceResponse,
    summary="Get paginated list of experiences with full details (legacy endpoint)",
    description="Legacy endpoint for backward compatibility. Use '/' endpoint instead."
)
@require_permission("VIEW_EXPERIENCES")
def read_experiences_full(
    page: int = Query(1, gt=0),
    pageSize: int = Query(10, gt=0, le=100),
    code: Optional[str] = None,
    name: Optional[str] = None,
    description: Optional[str] = None,
    language_id: Optional[List[str]] = Query(None),
    filterField: Optional[List[str]] = Query(None),
    filterValue: Optional[List[str]] = Query(None),
    filterOperator: Optional[List[str]] = Query(None),
    sortField: Optional[str] = None,
    sortOrder: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Legacy endpoint for getting paginated list of experiences with full details.
    This endpoint is maintained for backward compatibility but may be deprecated.
    """
    logger.debug(f"Legacy endpoint called: page={page}, pageSize={pageSize}, code={code}, name={name}, description={description}")
    
    # Convert legacy parameters to new format
    parsed_filters = []
    
    # Handle direct filter parameters
    if code:
        parsed_filters.append(schemas.experience.Filter(field="code", value=code, operator="contains"))
    
    if name:
        parsed_filters.append(schemas.experience.Filter(field="name", value=name, operator="contains"))
    
    if description:
        parsed_filters.append(schemas.experience.Filter(field="description", value=description, operator="contains"))
    
    # Handle language_id filter
    if language_id:
        for lang_id in language_id:
            parsed_filters.append(schemas.experience.Filter(field="language_id", value=lang_id, operator="eq"))
    
    # Handle array-based filters
    if filterField and filterValue:
        operators = filterOperator if filterOperator else ['contains'] * len(filterField)
        
        for i, field in enumerate(filterField):
            if i < len(filterValue):
                op = operators[i] if i < len(operators) else "contains"
                parsed_filters.append(schemas.experience.Filter(field=field, value=filterValue[i], operator=op))
    
    # Call the new endpoint logic
    try:
        experiences, total = experience_crud.get_experiences_paginated(
            db=db,
            page=page,
            page_size=pageSize,
            filters=parsed_filters if parsed_filters else None,
            sort_field=sortField,
            sort_order=sortOrder
        )
        
        return {
            "items": experiences,
            "total": total,
            "page": page,
            "pageSize": pageSize
        }
    except Exception as e:
        logger.error(f"Error in legacy endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching experiences: {str(e)}"
        )

@router.get("/check-code/{code}", response_model=schemas.experience.UniqueCheckResponse)
@require_permission("VIEW_EXPERIENCES")
def check_code(
    code: str,
    experience_id: Optional[int] = None,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Check if a code already exists.
    """
    logger.debug(f"Checking code uniqueness: {code}, excluding ID: {experience_id}")
    
    try:
        exists = experience_crud.check_code_exists(db, code, exclude_id=experience_id)
        return {"exists": exists, "code": code}
    except Exception as e:
        logger.error(f"Error checking code uniqueness: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking code uniqueness: {str(e)}"
        )

@router.post("/", response_model=schemas.Experience)
@require_permission("CREATE_EXPERIENCE")
def create_experience(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    experience_in: schemas.ExperienceCreate,
) -> Any:
    """
    Create new experience.
    """
    logger.info(f"Creating experience with code: {experience_in.code}")
    
    try:
        # Check if code already exists
        if experience_crud.check_code_exists(db, experience_in.code):
            raise HTTPException(
                status_code=400,
                detail=f"Experience with code '{experience_in.code}' already exists"
            )
        
        experience = experience_crud.create_experience(db, experience=experience_in)
        logger.info(f"Experience created successfully with ID: {experience.id}")
        return experience
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.error(f"Error creating experience: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating experience: {str(e)}"
        )

@router.get("/{experience_id}", response_model=schemas.Experience)
@require_permission("VIEW_EXPERIENCES")
def read_experience(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    experience_id: int,
) -> Any:
    """
    Get experience by ID.
    """
    logger.debug(f"Fetching experience with ID: {experience_id}")
    
    try:
        experience = experience_crud.get_experience(db, experience_id=experience_id)
        if not experience:
            raise HTTPException(
                status_code=404,
                detail="Experience not found",
            )
        return experience
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.error(f"Error fetching experience {experience_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching experience: {str(e)}"
        )

@router.put("/{experience_id}", response_model=schemas.Experience)
@require_permission("EDIT_EXPERIENCE")
def update_experience(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    experience_id: int,
    experience_in: schemas.ExperienceUpdate,
) -> Any:
    """
    Update an experience.
    """
    logger.info(f"Updating experience with ID: {experience_id}")
    logger.info(f"Received experience data: {experience_in}")
    logger.info(f"Experience code in request: {experience_in.code} (type: {type(experience_in.code)})")
    logger.info(f"Experience years in request: {experience_in.years} (type: {type(experience_in.years)})")
    logger.info(f"Experience texts count: {len(experience_in.experience_texts) if experience_in.experience_texts else 0}")
    
    try:
        experience = experience_crud.get_experience(db, experience_id=experience_id)
        if not experience:
            raise HTTPException(
                status_code=404,
                detail="Experience not found",
            )
        
        # Check if code already exists (if code is being updated)
        if experience_in.code is not None and experience_in.code != experience.code:
            if experience_crud.check_code_exists(db, experience_in.code, exclude_id=experience_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Experience with code '{experience_in.code}' already exists"
                )
        
        experience = experience_crud.update_experience(db, experience_id=experience_id, experience=experience_in)
        logger.info(f"Experience updated successfully with ID: {experience.id}")
        logger.info(f"Updated experience final values - code: {experience.code}, years: {experience.years}")
        return experience
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.error(f"Error updating experience {experience_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating experience: {str(e)}"
        )

@router.delete("/{experience_id}", response_model=schemas.Experience)
@require_permission("DELETE_EXPERIENCE")
def delete_experience(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    experience_id: int,
) -> Any:
    """
    Delete an experience.
    """
    logger.info(f"Deleting experience with ID: {experience_id}")
    
    try:
        experience = experience_crud.get_experience(db, experience_id=experience_id)
        if not experience:
            raise HTTPException(
                status_code=404,
                detail="Experience not found",
            )
        
        experience = experience_crud.delete_experience(db, experience_id=experience_id)
        logger.info(f"Experience deleted successfully with ID: {experience_id}")
        return experience
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.error(f"Error deleting experience {experience_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting experience: {str(e)}"
        )
