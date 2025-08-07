import json
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body, status, Response
from sqlalchemy.orm import Session
from typing import Any, List, Optional, Dict
from pydantic import ValidationError
from app import models, schemas
from app.api import deps
from app.crud import category as category_crud
from app.core.logging import setup_logger
from app.core.security_decorators import require_permission
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut, PaginatedCategoryResponse, Filter

# Set up logger using centralized logging
logger = setup_logger("app.api.endpoints.categories")

# Define router
router = APIRouter()

# --- Helper Functions ---

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
    response_model=PaginatedCategoryResponse,
    summary="Get paginated list of categories",
    description="Retrieves a list of categories with pagination, filtering, and sorting."
)
@require_permission("VIEW_CATEGORIES")
def read_categories(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page (max 100)"),
    filters: Optional[str] = Query(None, description='JSON string representing an array of filter objects. E.g., `[{"field":"name", "value":"general", "operator":"contains"}]`'),
    sort_field: Optional[str] = Query(None, description="Field to sort by (e.g., 'code', 'name')"),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: 'asc' or 'desc'"),
    # Legacy filter parameters (for backward compatibility)
    code: Optional[str] = Query(None, description="Filter by category code (contains)"),
    name: Optional[str] = Query(None, description="Filter by category name (contains)"),
    type_code: Optional[str] = Query(None, description="Filter by category type code (contains)")
) -> Any:
    """
    Retrieve categories with pagination, filtering, and sorting.
    """
    logger.info(f"Fetching categories with page={page}, page_size={page_size}, filters={filters}, code={code}, name={name}, type_code={type_code}, sort={sort_field} {sort_order}")
    
    try:
        parsed_filters = None
        
        # Handle individual query parameters first
        if code or name or type_code:
            logger.debug(f"Processing direct query parameters: code={code}, name={name}, type_code={type_code}")
            parsed_filters = []
            
            if code:
                logger.debug(f"Adding code filter: {code}")
                parsed_filters.append(Filter(field="code", value=code, operator="contains"))
            
            if name:
                logger.debug(f"Adding name filter: {name}")
                parsed_filters.append(Filter(field="name", value=name, operator="contains"))
            
            if type_code:
                logger.debug(f"Adding type_code filter: {type_code}")
                parsed_filters.append(Filter(field="type_code", value=type_code, operator="contains"))
        
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
        
        # Get categories with pagination, filtering, and sorting
        categories, total = category_crud.get_categories_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=parsed_filters,
            sort_field=sort_field,
            sort_order=sort_order
        )
        
        # Process categories to ensure language objects are properly serialized as dictionaries
        processed_categories = []
        for category in categories:
            # Create a dict representation of the category
            category_dict = {
                "id": category.id,
                "code": category.code,
                "type_code": category.type_code,
                "category_texts": []
            }
            
            # Process each category_text to ensure language is a dictionary
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
                
                category_dict["category_texts"].append(text_dict)
            
            processed_categories.append(category_dict)
        
        # Return the paginated response using Pydantic model with processed data
        return PaginatedCategoryResponse(
            items=processed_categories,
            total=total,
            page=page,
            page_size=page_size
        )
    except ValueError as e:
        logger.warning(f"Value error in read_categories: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in read_categories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving categories: {str(e)}"
        )

@router.get(
    "/by-type/{category_type}", 
    response_model=List[CategoryOut],
    summary="Get categories by type",
    description="Retrieves categories filtered by a specific type code."
)
@require_permission("VIEW_CATEGORIES")
def read_categories_by_type(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_type: str = Path(..., description="Type code to filter by"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of items to return")
) -> Any:
    """
    Retrieve categories by type.
    """
    logger.info(f"Fetching categories with type {category_type}")
    
    try:
        categories = category_crud.get_categories_by_type(
            db=db, 
            category_type=category_type, 
            skip=skip, 
            limit=limit
        )
        
        # Process categories to ensure language objects are properly serialized as dictionaries
        processed_categories = []
        for category in categories:
            # Create a dict representation of the category
            category_dict = {
                "id": category.id,
                "code": category.code,
                "type_code": category.type_code,
                "category_texts": []
            }
            
            # Process each category_text to ensure language is a dictionary
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
                
                category_dict["category_texts"].append(text_dict)
            
            processed_categories.append(category_dict)
        
        logger.info(f"Retrieved {len(processed_categories)} categories of type '{category_type}'")
        return processed_categories
    except Exception as e:
        logger.exception(f"Error fetching categories by type: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving categories by type: {str(e)}"
        )

@router.get(
    "/by-code-pattern/{pattern}", 
    response_model=List[CategoryOut],
    summary="Get categories by code pattern",
    description="Retrieves categories with codes containing a specific pattern."
)
@require_permission("VIEW_CATEGORIES")
def read_categories_by_code_pattern(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    pattern: str = Path(..., description="Pattern to search for in category codes"),
    limit: int = Query(100, ge=1, description="Maximum number of items to return")
) -> Any:
    """
    Retrieve categories by code pattern.
    """
    logger.info(f"Fetching categories with code pattern {pattern}")
    
    try:
        # Create a filter for code pattern
        filters = [Filter(field="code", value=pattern, operator="contains")]
        
        # Use the paginated function but with a large page size
        categories, _ = category_crud.get_categories_paginated(
            db=db,
            page=1,
            page_size=limit,
            filters=filters
        )
        
        # Process categories to ensure language objects are properly serialized as dictionaries
        processed_categories = []
        for category in categories:
            # Create a dict representation of the category
            category_dict = {
                "id": category.id,
                "code": category.code,
                "type_code": category.type_code,
                "category_texts": []
            }
            
            # Process each category_text to ensure language is a dictionary
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
                
                category_dict["category_texts"].append(text_dict)
            
            processed_categories.append(category_dict)
        
        logger.info(f"Retrieved {len(processed_categories)} categories with code pattern '{pattern}'")
        return processed_categories
    except Exception as e:
        logger.exception(f"Error fetching categories by code pattern: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while retrieving categories by code pattern: {str(e)}"
        )

@router.post(
    "/", 
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category",
    description="Creates a new category with the provided data."
)
@require_permission("CREATE_CATEGORY")
def create_category(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_in: CategoryCreate = Body(...),
) -> Any:
    """
    Create new category.
    """
    logger.info(f"Creating category with code: {category_in.code}")
    
    try:
        # Attempt to create the category
        category = category_crud.create_category(db, category=category_in)
        
        # Process category to ensure language objects are properly serialized as dictionaries
        category_dict = {
            "id": category.id,
            "code": category.code,
            "type_code": category.type_code,
            "category_texts": []
        }
        
        # Process each category_text to ensure language is a dictionary
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
            
            category_dict["category_texts"].append(text_dict)
        
        logger.info(f"Category created successfully with ID: {category.id}")
        return category_dict
    except ValueError as e:
        # Handle validation errors (e.g., duplicate code)
        logger.warning(f"Error creating category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error creating category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating category: {str(e)}",
        )

@router.get(
    "/check-code/{code}", 
    response_model=Dict[str, bool],
    summary="Check if a category code exists",
    description="Checks whether a category code is already in use."
)
@require_permission("VIEW_CATEGORIES")
def check_code_exists(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    code: str = Path(..., description="The category code to check"),
    category_id: Optional[int] = Query(None, description="Optionally exclude a specific category ID from the check")
) -> Any:
    """
    Check if a category code already exists.
    """
    logger.debug(f"Checking if category code exists: {code}, excluding ID: {category_id}")
    
    try:
        # Get the category by code
        category = category_crud.get_category_by_code(db, code=code)
        
        # If we found a category and it's not the one we're excluding
        exists = category is not None and (category_id is None or category.id != category_id)
        
        return {"exists": exists}
    except Exception as e:
        logger.exception(f"Error checking category code: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking category code: {str(e)}",
        )

@router.get(
    "/{category_id}", 
    response_model=CategoryOut,
    summary="Get a specific category",
    description="Retrieves a single category by its ID."
)
@require_permission("VIEW_CATEGORIES")
def read_category(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_id: int = Path(..., gt=0, description="The ID of the category to retrieve"),
) -> Any:
    """
    Get category by ID.
    """
    logger.info(f"Fetching category with ID: {category_id}")
    
    # Get the category
    category = category_crud.get_category(db, category_id=category_id)
    if not category:
        logger.warning(f"Category not found: {category_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    
    # Process category to ensure language objects are properly serialized as dictionaries
    category_dict = {
        "id": category.id,
        "code": category.code,
        "type_code": category.type_code,
        "category_texts": []
    }
    
    # Process each category_text to ensure language is a dictionary
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
        
        category_dict["category_texts"].append(text_dict)
    
    logger.info(f"Category found: {category_id}")
    return category_dict

@router.put(
    "/{category_id}", 
    response_model=CategoryOut,
    summary="Update a category",
    description="Updates an existing category with the provided data."
)
@require_permission("EDIT_CATEGORY")
def update_category(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_id: int = Path(..., gt=0, description="The ID of the category to update"),
    category_in: CategoryUpdate = Body(...),
) -> Any:
    """
    Update a category.
    """
    logger.info(f"Updating category {category_id} with data: {category_in.model_dump(exclude_unset=True)}")
    
    try:
        # Attempt to update the category
        category = category_crud.update_category(db, category_id=category_id, category=category_in)
        
        if not category:
            logger.warning(f"Category not found: {category_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        
        # Process category to ensure language objects are properly serialized as dictionaries
        category_dict = {
            "id": category.id,
            "code": category.code,
            "type_code": category.type_code,
            "category_texts": []
        }
        
        # Process each category_text to ensure language is a dictionary
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
            
            category_dict["category_texts"].append(text_dict)
        
        logger.info(f"Category updated successfully: {category_id}")
        return category_dict
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Error updating category: {str(e)}")
        
        # Use 409 Conflict for conflicts (e.g., duplicate code)
        if "already exists" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error updating category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating category: {str(e)}",
        )

@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a category",
    description="Deletes a category and its associated texts."
)
@require_permission("DELETE_CATEGORY")
def delete_category(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    category_id: int = Path(..., gt=0, description="The ID of the category to delete"),
) -> None:
    """
    Delete a category.
    """
    logger.info(f"Deleting category with ID: {category_id}")
    
    try:
        # Attempt to delete the category
        category = category_crud.delete_category(db, category_id=category_id)
        
        if not category:
            logger.warning(f"Category not found: {category_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        
        logger.info(f"Category deleted successfully: {category_id}")
        # Don't return anything for 204 response
        return None
    except ValueError as e:
        # Handle validation errors (e.g., category is in use)
        logger.warning(f"Error deleting category: {str(e)}")
        
        # Use 409 Conflict if the category is associated with entities
        if "associated with" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # Handle unexpected errors
        logger.exception(f"Unexpected error deleting category: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting category: {str(e)}",
        )
