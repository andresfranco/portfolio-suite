import json
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, Response
from sqlalchemy.orm import Session
from typing import Any, List, Optional, Dict
from pydantic import ValidationError
from app import models, schemas
from app.models.skill import Skill, SkillText
from app.models.category import Category
from app.api import deps
from app.crud import skill as skill_crud  # Fixed import to match section implementation
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
import traceback
from app.rag.rag_events import stage_event

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.skills")

# Define router
router = APIRouter()

# --- Helper Functions ---

def parse_filters(filters_json: Optional[str]) -> Optional[List[schemas.skill.Filter]]:
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
                filter_obj = schemas.skill.Filter(**filter_dict)
                result_filters.append(filter_obj)
                logger.debug(f"Validated filter {i}: {filter_obj.model_dump()}")
            except ValidationError as e:
                logger.error(f"Validation error in filter {i}: {filter_dict}, error: {e}")
                raise ValidationError(f"Invalid filter at position {i}: {e}", model=schemas.skill.Filter)
        
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

# Helper function to process skills before sending them in the response
def process_skills_for_response(skills: List[models.skill.Skill]) -> List[Dict[str, Any]]:
    """
    Process the skill objects to ensure they can be properly serialized.
    Particularly important for handling relationships like categories.
    """
    processed_skills = []
    
    for skill in skills:
        try:
            # Create a dictionary with the skill's attributes
            skill_dict = {
                "id": skill.id,
                "type": skill.type or "",  # Provide default empty string if None
                "type_code": skill.type_code,
                "skill_texts": [],
                "categories": [],
                "skill_type": None  # Default to None
            }
            
            # Process skill_texts
            if hasattr(skill, 'skill_texts') and skill.skill_texts:
                for text in skill.skill_texts:
                    text_dict = {
                        "id": text.id,
                        "language_id": text.language_id,
                        "name": text.name,
                        "description": text.description
                    }
                    
                    # Convert the language object to a dictionary if it exists
                    if hasattr(text, "language") and text.language is not None:
                        language = text.language
                        text_dict["language"] = {
                            "id": language.id,
                            "code": language.code,
                            "name": language.name,
                            "is_default": language.is_default if hasattr(language, "is_default") else False
                        }
                    
                    skill_dict["skill_texts"].append(text_dict)
            
            # Process categories to be dictionaries
            if hasattr(skill, 'categories') and skill.categories:
                for category in skill.categories:
                    cat_dict = {
                        "id": category.id,
                        "code": category.code,
                        "type_code": category.type_code,
                        "category_texts": []
                    }
                    
                    # Include category texts if they exist
                    if hasattr(category, 'category_texts') and category.category_texts:
                        for text in category.category_texts:
                            text_dict = {
                                "id": text.id,
                                "language_id": text.language_id,
                                "name": text.name,
                                "description": text.description
                            }
                            
                            # Convert the language object to a dictionary if it exists
                            if hasattr(text, "language") and text.language is not None:
                                language = text.language
                                text_dict["language"] = {
                                    "id": language.id,
                                    "code": language.code,
                                    "name": language.name,
                                    "is_default": language.is_default if hasattr(language, "is_default") else False
                                }
                            
                            cat_dict["category_texts"].append(text_dict)
                    
                    skill_dict["categories"].append(cat_dict)
            
            # Safely add skill_type if it exists
            if hasattr(skill, 'skill_type') and skill.skill_type is not None:
                skill_dict["skill_type"] = {
                    "code": skill.skill_type.code,
                    "name": skill.skill_type.name
                }
                
            processed_skills.append(skill_dict)
        except Exception as e:
            logger.error(f"Error processing skill {skill.id if hasattr(skill, 'id') else 'unknown'}: {e}")
            # Add basic info without the problematic fields
            skill_dict = {
                "id": skill.id if hasattr(skill, 'id') else None,
                "type": skill.type if hasattr(skill, 'type') and skill.type else "",
                "type_code": skill.type_code if hasattr(skill, 'type_code') else None,
                "skill_texts": [],
                "categories": [],
                "skill_type": None
            }
            processed_skills.append(skill_dict)
    
    return processed_skills

@router.get(
    "/",
    response_model=schemas.PaginatedResponse[schemas.Skill],
    summary="Get paginated list of skills",
    description="Retrieves a list of skills with pagination, filtering, and sorting."
)
@require_permission("VIEW_SKILLS")
def read_skills(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"python", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'id', 'type_code')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    # Legacy filter parameters (for backward compatibility)
    type_code: Optional[str] = Query(None, description="Filter by skill type code (contains)"),
    name: Optional[str] = Query(None, description="Filter by skill name (contains)")
) -> Any:
    """
    Retrieve skills with pagination, filtering, and sorting.
    """
    logger.info(f"Fetching skills with page={page}, page_size={page_size}, filters={filters}, type_code={type_code}, name={name}, sort={sort_field} {sort_order}")
    
    try:
        parsed_filters = None
        
        # Handle individual query parameters first
        if type_code or name:
            logger.debug(f"Processing direct query parameters: type_code={type_code}, name={name}")
            parsed_filters = []
            
            if type_code:
                logger.debug(f"Adding type_code filter: {type_code}")
                parsed_filters.append(schemas.skill.Filter(field="type_code", value=type_code, operator="contains"))
            
            if name:
                logger.debug(f"Adding name filter: {name}")
                parsed_filters.append(schemas.skill.Filter(field="name", value=name, operator="contains"))
        
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
        
        # Get skills with pagination, filtering, and sorting
        skills, total = skill_crud.get_skills_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Process skills to ensure proper serialization
        processed_skills = process_skills_for_response(skills)
        
        # Return the paginated response using Pydantic model with processed data
        return {
            "items": processed_skills,
            "total": total,
            "page": page,
            "pageSize": page_size
        }
    except ValueError as e:
        logger.warning(f"Value error in read_skills: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in read_skills: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving skills: {str(e)}"
        )

@router.get(
    "/full", 
    response_model=schemas.skill.PaginatedSkillResponse,
    summary="Get paginated list of skills with full details (legacy endpoint)",
    description="Legacy endpoint for backward compatibility. Use '/' endpoint instead."
)
@require_permission("VIEW_SKILLS")
def read_skills_full(
    page: int = Query(1, gt=0),
    pageSize: int = Query(10, gt=0, le=100),
    type: Optional[str] = None,
    type_code: Optional[str] = None,
    name: Optional[str] = None,
    filterField: Optional[List[str]] = Query(None),
    filterValue: Optional[List[str]] = Query(None),
    filterOperator: Optional[List[str]] = Query(None),
    sortField: Optional[str] = None,
    sortOrder: Optional[str] = Query(None, pattern="^(asc|desc)$"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Legacy endpoint for getting paginated list of skills with full details.
    This endpoint is maintained for backward compatibility but may be deprecated.
    """
    logger.debug(f"Legacy endpoint called: page={page}, pageSize={pageSize}, type={type}, type_code={type_code}, name={name}")
    
    # Convert legacy parameters to new format
    parsed_filters = []
    
    # Handle direct filter parameters
    if type_code or type:
        filter_value = type_code or type
        parsed_filters.append(schemas.skill.Filter(field="type_code", value=filter_value, operator="contains"))
    
    if name:
        parsed_filters.append(schemas.skill.Filter(field="name", value=name, operator="contains"))
    
    # Handle array-based filters
    if filterField and filterValue:
        operators = filterOperator if filterOperator else ['contains'] * len(filterField)
        
        for i, field in enumerate(filterField):
            if i < len(filterValue):
                op = operators[i] if i < len(operators) else "contains"
                parsed_filters.append(schemas.skill.Filter(field=field, value=filterValue[i], operator=op))
    
    # Call the new endpoint logic
    skills, total = skill_crud.get_skills_paginated(
        db=db,
        page=page,
        page_size=pageSize,
        filters=parsed_filters if parsed_filters else None,
        sort_field=sortField,
        sort_order=sortOrder
    )
    
    processed_skills = process_skills_for_response(skills)
    
    return {
        "items": processed_skills,
        "total": total,
        "page": page,
        "pageSize": pageSize
    }

@router.get("/check-unique", response_model=schemas.skill.UniqueCheckResponse)
@require_permission("VIEW_SKILLS")
def check_skill_name_unique(
    name: str = Query(..., description="Skill name to check for uniqueness"),
    language_id: int = Query(..., description="Language ID for the name"),
    exclude_id: Optional[int] = Query(None, description="Skill ID to exclude from the check"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
) -> Any:
    """
    Check if a skill name is unique for a given language.
    """
    
    # Get skill by name and language
    skill = skill_crud.get_skill_by_name_and_language(db, name=name, language_id=language_id)
    
    # If skill exists and it's not the one we're excluding, it's not unique
    exists = skill is not None and (exclude_id is None or skill.id != exclude_id)
    
    return {
        "exists": exists,
        "name": name,
        "language_id": language_id
    }

@router.get("/by-type/{skill_type}", response_model=List[schemas.Skill])
@require_permission("VIEW_SKILLS")
def read_skills_by_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_type: str,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve skills by type.
    """
    
    skills = skill_crud.get_skills_by_type(
        db, skill_type=skill_type, skip=skip, limit=limit
    )
    
    # Process skills for response
    processed_skills = process_skills_for_response(skills)
    return processed_skills

@router.get("/{skill_id}", response_model=schemas.Skill)
@require_permission("VIEW_SKILLS")
def read_skill(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_id: int,
) -> Any:
    """
    Get skill by ID.
    """
    
    skill = skill_crud.get_skill(db, skill_id=skill_id)
    if not skill:
        raise HTTPException(
            status_code=404,
            detail="Skill not found",
        )
    
    # Process skill for response
    processed_skills = process_skills_for_response([skill])
    return processed_skills[0] if processed_skills else None

@router.post("/", response_model=schemas.Skill)
@require_permission("CREATE_SKILL")
def create_skill(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_in: schemas.SkillCreate,
) -> Any:
    """
    Create new skill.
    """
    
    skill = skill_crud.create_skill(db, skill_in)
    stage_event(db, {"op":"insert","source_table":"skills","source_id":str(skill.id),"changed_fields":["type","type_code"]})
    db.commit()
    db.refresh(skill)
    
    # Process skill for response
    processed_skills = process_skills_for_response([skill])
    return processed_skills[0] if processed_skills else None

@router.put("/{skill_id}", response_model=schemas.Skill)
@require_permission("EDIT_SKILL")
def update_skill(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_id: int,
    skill_in: schemas.SkillUpdate,
) -> Any:
    """
    Update a skill.
    """
    
    skill = skill_crud.get_skill(db, skill_id=skill_id)
    if not skill:
        raise HTTPException(
            status_code=404,
            detail="Skill not found",
        )
    
    skill = skill_crud.update_skill(db, skill_id=skill_id, skill=skill_in)
    stage_event(db, {"op":"update","source_table":"skills","source_id":str(skill_id),"changed_fields":list(skill_in.model_dump(exclude_unset=True).keys())})
    db.commit()
    db.refresh(skill)
    
    # Process skill for response
    processed_skills = process_skills_for_response([skill])
    return processed_skills[0] if processed_skills else None

@router.delete("/{skill_id}", status_code=status.HTTP_200_OK)
@require_permission("DELETE_SKILL")
def delete_skill(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    skill_id: int,
) -> Any:
    """
    Delete a skill.
    """
    
    skill = skill_crud.get_skill(db, skill_id=skill_id)
    if not skill:
        raise HTTPException(
            status_code=404,
            detail="Skill not found",
        )
    
    skill_crud.delete_skill(db, skill_id=skill_id)
    stage_event(db, {"op":"delete","source_table":"skills","source_id":str(skill_id),"changed_fields":[]})
    db.commit()
