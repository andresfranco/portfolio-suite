from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.api import deps
from app.crud import language as language_crud
from app.schemas.language import (
    LanguageCreate, 
    LanguageUpdate, 
    LanguageOut, 
    PaginatedLanguageResponse,
    Filter
)
from app.core.config import settings
from app.core.logging import setup_logger
from app.utils.file_utils import save_upload_file
from app.core.security_decorators import require_permission
from app import models
import os
import uuid
from app.rag.rag_events import stage_event

# Set up logger
logger = setup_logger("app.api.endpoints.languages")

# Constants - Use proper settings configuration for directory
LANGUAGE_IMAGES_DIR = os.path.join(settings.UPLOADS_DIR, "language_images")
os.makedirs(LANGUAGE_IMAGES_DIR, exist_ok=True)

router = APIRouter()


@router.get("/codes", response_model=List[str])
def list_languages(db: Session = Depends(deps.get_db), current_user: models.User = Depends(deps.get_current_user)):
    """
    Get a list of all language codes.
    
    Returns:
        List of language codes
    """
    try:
        languages = language_crud.get_languages(db)
        return [lang.code for lang in languages]
    except SQLAlchemyError as e:
        logger.error(f"Database error listing language codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while retrieving language codes"
        )


@router.get("", response_model=PaginatedLanguageResponse)
def read_languages(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    code: Optional[str] = Query(None, description="Filter by language code"),
    name: Optional[str] = Query(None, description="Filter by language name"),
    is_default: Optional[bool] = Query(None, description="Filter by default status"),
    sort_field: Optional[str] = Query(None, description="Field to sort by"),
    sort_order: Optional[str] = Query("asc", description="Sort order (asc or desc)"),
    filter_field: Optional[List[str]] = Query(None, description="Fields to filter on"),
    filter_value: Optional[List[str]] = Query(None, description="Values to filter by"),
    filter_operator: Optional[List[str]] = Query(None, description="Operators to use for filtering"),
    json_filter: Optional[str] = Query(None, description="JSON-formatted filter criteria"),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Get a paginated list of languages with optional filtering and sorting.
    
    Args:
        page: Page number (1-indexed)
        page_size: Number of items per page
        code: Optional filter for language code
        name: Optional filter for language name
        is_default: Optional filter for default language status
        sort_field: Optional field to sort by
        sort_order: Optional sort direction (asc or desc)
        filter_field: Optional list of fields to filter on
        filter_value: Optional list of values to filter by
        filter_operator: Optional list of operators for filtering
        json_filter: Optional JSON-formatted filter criteria
        db: Database session
        
    Returns:
        PaginatedLanguageResponse with items and pagination info
    """
    try:
        # Build filters from query parameters and/or JSON filter
        filters = []
        
        # Process legacy filter parameters if provided
        if code:
            filters.append(Filter(field="code", value=code.lower(), operator="contains"))
            
        if name:
            filters.append(Filter(field="name", value=name, operator="contains"))
            
        if is_default is not None:
            filters.append(Filter(field="is_default", value=is_default, operator="eq"))
        
        # Process filter_field/filter_value/filter_operator parameters if provided
        if filter_field and filter_value:
            operators = filter_operator if filter_operator else ['contains'] * len(filter_field)
            for i, field in enumerate(filter_field):
                if i < len(filter_value):
                    try:
                        op = operators[i] if i < len(operators) else "contains"
                        filters.append(Filter.from_params(
                            field=field, 
                            value=filter_value[i],
                            operator=op
                        ))
                    except ValueError as e:
                        logger.warning(f"Invalid filter: {str(e)}")
                        raise HTTPException(status_code=400, detail=str(e))
        
        # Process JSON filter if provided
        if json_filter:
            try:
                import json
                json_filters = json.loads(json_filter)
                
                if isinstance(json_filters, list):
                    for filter_item in json_filters:
                        if all(k in filter_item for k in ["field", "value"]):
                            operator = filter_item.get("operator", "contains")
                            filters.append(Filter.from_params(
                                field=filter_item["field"],
                                value=filter_item["value"],
                                operator=operator
                            ))
                elif isinstance(json_filters, dict) and all(k in json_filters for k in ["field", "value"]):
                    operator = json_filters.get("operator", "contains")
                    filters.append(Filter.from_params(
                        field=json_filters["field"],
                        value=json_filters["value"],
                        operator=operator
                    ))
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON filter format: {json_filter}")
                raise HTTPException(status_code=400, detail="Invalid JSON filter format")
            except Exception as e:
                logger.warning(f"Error processing JSON filter: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error processing filter: {str(e)}")
        
        # Log the final set of filters
        logger.debug(f"Applying filters: {filters}")
        
        # Get paginated results
        items, total = language_crud.get_languages_paginated(
            db, page, page_size, filters, sort_field, sort_order
        )
        
        logger.debug(f"Retrieved {len(items)} languages (total: {total})")
        
        # Construct and return response
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except SQLAlchemyError as e:
        logger.error(f"Database error reading languages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while retrieving languages"
        )
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.exception(f"Unexpected error reading languages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while retrieving languages"
        )


@router.post("", response_model=LanguageOut, status_code=status.HTTP_201_CREATED)
@require_permission("CREATE_LANGUAGE")
async def create_language(
    code: str = Form(..., min_length=2, max_length=10),
    name: str = Form(..., min_length=2, max_length=100),
    is_default: bool = Form(False),
    enabled: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Create a new language with optional image upload.

    Args:
        code: Language code (e.g., 'en', 'es')
        name: Language name (e.g., 'English', 'Spanish')
        is_default: Whether this language is the default
        enabled: Whether this language is enabled
        image: Optional flag image for the language
        db: Database session

    Returns:
        Created language object

    Raises:
        HTTPException: If language already exists or other errors occur
    """
    try:
        # Check if language code already exists
        existing_language = language_crud.get_language_by_code(db, code)
        if existing_language:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Language with code '{code}' already exists"
            )
        
        # Handle image upload if provided
        image_path = None
        if image:
            try:
                # Use original filename
                original_filename = image.filename
                target_path = os.path.join(LANGUAGE_IMAGES_DIR, original_filename)
                
                # Check if file with same name already exists
                if os.path.exists(target_path):
                    # Generate unique name by adding a random suffix
                    name_parts = os.path.splitext(original_filename)
                    random_suffix = uuid.uuid4().hex[:6]  # Get 6 chars from UUID
                    unique_filename = f"{name_parts[0]}_{random_suffix}{name_parts[1]}"
                    target_path = os.path.join(LANGUAGE_IMAGES_DIR, unique_filename)
                else:
                    unique_filename = original_filename
                
                # Save the file
                await save_upload_file(upload_file=image, directory=LANGUAGE_IMAGES_DIR, 
                                      filename=unique_filename, keep_original_filename=True)
                
                logger.debug(f"Saved language image to {target_path}")
                
                # Store relative path for database
                image_path = os.path.join("language_images", unique_filename)
                
            except Exception as e:
                logger.error(f"Error saving language image: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error saving language image"
                )
        
        # Create language schema
        language_data = LanguageCreate(
            code=code,
            name=name,
            is_default=is_default,
            enabled=enabled
        )
        
        # Create language in database
        db_language = language_crud.create_language(db, language_data, image_path)
        db.commit()
        
        logger.info(f"Created new language: {code} ({name})")
        return db_language
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error creating language: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language could not be created due to integrity constraints"
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating language: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating language"
        )


@router.get("/{language_id}", response_model=LanguageOut)
def read_language(language_id: int, db: Session = Depends(deps.get_db), current_user: models.User = Depends(deps.get_current_user)):
    """
    Get a single language by ID.
    
    Args:
        language_id: ID of the language to retrieve
        db: Database session
        
    Returns:
        Language object
        
    Raises:
        HTTPException: If language not found or other errors occur
    """
    try:
        db_language = language_crud.get_language(db, language_id)
        if not db_language:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Language with ID {language_id} not found"
            )
        return db_language
    except SQLAlchemyError as e:
        logger.error(f"Database error reading language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while retrieving language"
        )


@router.put("/{language_id}", response_model=LanguageOut)
@require_permission("EDIT_LANGUAGE")
async def update_language(
    language_id: int,
    code: Optional[str] = Form(None, min_length=2, max_length=10),
    name: Optional[str] = Form(None, min_length=2, max_length=100),
    is_default: Optional[bool] = Form(None),
    enabled: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """
    Update an existing language with optional image upload.

    Args:
        language_id: ID of the language to update
        code: Optional new language code
        name: Optional new language name
        is_default: Optional update to default status
        enabled: Optional update to enabled status
        image: Optional new flag image
        db: Database session

    Returns:
        Updated language object

    Raises:
        HTTPException: If language not found, code already exists, or other errors occur
    """
    try:
        # Verify language exists
        existing_language = language_crud.get_language(db, language_id)
        if not existing_language:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Language with ID {language_id} not found"
            )
        
        # If code is being updated, check it doesn't conflict with existing languages
        if code and code != existing_language.code:
            code_exists = language_crud.get_language_by_code(db, code)
            if code_exists:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Language with code '{code}' already exists"
                )
        
        # Handle image upload if provided
        image_path = None
        if image:
            try:
                # Use original filename
                original_filename = image.filename
                target_path = os.path.join(LANGUAGE_IMAGES_DIR, original_filename)
                
                # Check if file with same name already exists
                if os.path.exists(target_path):
                    # Generate unique name by adding a random suffix
                    name_parts = os.path.splitext(original_filename)
                    random_suffix = uuid.uuid4().hex[:6]  # Get 6 chars from UUID
                    unique_filename = f"{name_parts[0]}_{random_suffix}{name_parts[1]}"
                    target_path = os.path.join(LANGUAGE_IMAGES_DIR, unique_filename)
                else:
                    unique_filename = original_filename
                
                # Save the file
                await save_upload_file(upload_file=image, directory=LANGUAGE_IMAGES_DIR, 
                                      filename=unique_filename, keep_original_filename=True)
                
                logger.debug(f"Saved updated language image to {target_path}")
                
                # Store relative path for database
                image_path = os.path.join("language_images", unique_filename)
                
            except Exception as e:
                logger.error(f"Error saving updated language image: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error saving language image"
                )
        
        # Create update schema with provided fields
        language_data = LanguageUpdate(
            code=code,
            name=name,
            is_default=is_default,
            enabled=enabled
        )
        
        # Update language in database
        updated_language = language_crud.update_language(
            db, language_id, language_data, image_path
        )
        
        if not updated_language:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Language with ID {language_id} not found"
            )
        
        db.commit()
        logger.info(f"Updated language ID {language_id}")
        return updated_language
    except IntegrityError as e:
        db.rollback()
        logger.error(f"Integrity error updating language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language could not be updated due to integrity constraints"
        )
    except ValueError as e:
        db.rollback()
        logger.error(f"Value error updating language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error updating language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating language"
        )


@router.delete("/{language_id}", response_model=LanguageOut)
@require_permission("DELETE_LANGUAGE")
def delete_language(language_id: int, db: Session = Depends(deps.get_db), current_user: models.User = Depends(deps.get_current_user)):
    """
    Delete a language by ID.
    
    Args:
        language_id: ID of the language to delete
        db: Database session
        
    Returns:
        Deleted language object
        
    Raises:
        HTTPException: If language not found, is default, or other errors occur
    """
    try:
        # Attempt to delete the language
        db_language = language_crud.delete_language(db, language_id)
        
        if not db_language:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Language with ID {language_id} not found"
            )
        
        db.commit()
        logger.info(f"Deleted language ID {language_id}")
        return db_language
    except ValueError as e:
        db.rollback()
        logger.error(f"Value error deleting language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error deleting language {language_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while deleting language"
        )
