from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Any, List, Optional

from app import models, schemas
from app.api import deps
from app.crud import section as section_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.sections")

# Define router
router = APIRouter()

@router.get("/", response_model=schemas.PaginatedResponse[schemas.Section])
@require_permission("VIEW_SECTIONS")
def read_sections(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    code: Optional[str] = None,
    text: Optional[str] = None,
    language_id: Optional[List[str]] = Query(None),
    filter_field: Optional[List[str]] = Query(None),
    filter_value: Optional[List[str]] = Query(None),
    filter_operator: Optional[List[str]] = Query(None),
    include_full_details: bool = Query(False),
) -> Any:
    """
    Retrieve sections with pagination and optional filtering.
    Consolidates both basic and full endpoints - use include_full_details=True for full details.
    """
    logger.debug(f"Getting sections with page={page}, page_size={page_size}, include_full_details={include_full_details}")
    
    try:
        # Process filter parameters
        parsed_filters = []
        if filter_field and filter_value:
            operators = filter_operator if filter_operator else ['contains'] * len(filter_field)
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    try:
                        op = operators[i] if i < len(operators) else "contains"
                        parsed_filters.append(schemas.section.Filter.from_params(
                            field=field, 
                            value=filter_value[i],
                            operator=op
                        ))
                    except ValueError as e:
                        logger.error(f"Invalid filter parameter: {e}")
                        raise HTTPException(status_code=400, detail=str(e))
        
        # Direct parameter filters
        code_filter = code
        text_filter = text
        language_filter_values = language_id
        
        # If filter parameters are provided, use them for missing direct parameters
        if filter_field and filter_value:
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    if field == 'code' and not code_filter:
                        code_filter = filter_value[i]
                    elif field == 'text' and not text_filter:
                        text_filter = filter_value[i]
                    elif field == 'language_id':
                        if not language_filter_values:
                            language_filter_values = []
                        language_filter_values.append(filter_value[i])
        
        sections, total = section_crud.get_sections_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            code_filter=code_filter,
            text_filter=text_filter,
            language_filter_values=language_filter_values,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        logger.debug(f"Successfully fetched {len(sections)} sections with total={total}")
        
        return {
            "items": sections,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except ValueError as e:
        logger.error(f"Validation error in sections endpoint: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting sections: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while fetching sections"
        )


@router.get("/check-unique", response_model=schemas.section.UniqueCheckResponse)
@require_permission("VIEW_SECTIONS")
def check_section_code_unique(
    code: str = Query(..., description="Section code to check for uniqueness"),
    exclude_id: Optional[int] = Query(None, description="Section ID to exclude from the check"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Check if a section code is unique.
    """
    try:
        # Get section by code
        section = section_crud.get_section_by_code(db, code=code)
        
        # If section exists and it's not the one we're excluding, it's not unique
        exists = section is not None and (exclude_id is None or section.id != exclude_id)
        
        return {
            "exists": exists,
            "code": code
        }
    except Exception as e:
        logger.error(f"Error checking section code uniqueness: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error checking section code uniqueness"
        )


@router.post("/", response_model=schemas.Section, status_code=status.HTTP_201_CREATED)
@require_permission("CREATE_SECTION")
def create_section(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    section_in: schemas.SectionCreate,
) -> Any:
    """
    Create new section.
    """
    try:
        # Check if section with this code already exists
        section = section_crud.get_section_by_code(db, code=section_in.code)
        if section:
            raise HTTPException(
                status_code=409,
                detail="A section with this code already exists in the system.",
            )
        
        section = section_crud.create_section(db, section=section_in)
        db.commit()
        db.refresh(section)
        
        logger.info(f"Successfully created section with ID {section.id} and code {section.code}")
        return section
    except HTTPException:
        db.rollback()
        raise
    except ValueError as e:
        db.rollback()
        logger.error(f"Validation error creating section: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating section: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while creating the section"
        )


@router.get("/{section_id}", response_model=schemas.Section)
@require_permission("VIEW_SECTIONS")
def read_section(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    section_id: int,
) -> Any:
    """
    Get section by ID.
    """
    try:
        section = section_crud.get_section(db, section_id=section_id)
        if not section:
            raise HTTPException(
                status_code=404,
                detail="Section not found",
            )
        return section
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving section {section_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving the section"
        )


@router.put("/{section_id}", response_model=schemas.Section)
@require_permission("EDIT_SECTION")
def update_section(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    section_id: int,
    section_in: schemas.SectionUpdate,
) -> Any:
    """
    Update a section.
    """
    try:
        section = section_crud.get_section(db, section_id=section_id)
        if not section:
            raise HTTPException(
                status_code=404,
                detail="Section not found",
            )
        
        # If updating code, check it doesn't conflict with existing sections
        if section_in.code and section_in.code != section.code:
            existing_section = section_crud.get_section_by_code(db, code=section_in.code)
            if existing_section and existing_section.id != section_id:
                raise HTTPException(
                    status_code=409,
                    detail="A section with this code already exists in the system.",
                )
        
        section = section_crud.update_section(db, section_id=section_id, section=section_in)
        db.commit()
        db.refresh(section)
        
        logger.info(f"Successfully updated section with ID {section.id}")
        return section
    except HTTPException:
        db.rollback()
        raise
    except ValueError as e:
        db.rollback()
        logger.error(f"Validation error updating section: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating section: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while updating the section"
        )


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
@require_permission("DELETE_SECTION")
def delete_section(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    section_id: int,
) -> None:
    """
    Delete a section.
    """
    try:
        section = section_crud.get_section(db, section_id=section_id)
        if not section:
            raise HTTPException(
                status_code=404,
                detail="Section not found",
            )
        
        section_crud.delete_section(db, section_id=section_id)
        db.commit()
        
        logger.info(f"Successfully deleted section with ID {section_id}")
        # No return value for 204 status code
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error deleting section: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while deleting the section"
        )
