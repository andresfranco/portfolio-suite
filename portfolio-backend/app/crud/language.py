from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc, or_, func
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.models.language import Language
from app.schemas.language import LanguageCreate, LanguageUpdate, Filter
from app.api.utils.query_builder import QueryBuilder
from typing import List, Optional, Tuple, Dict, Any, Union
from app.core.logging import setup_logger
import os
from fastapi.encoders import jsonable_encoder

# Set up logger using centralized logging
logger = setup_logger("app.crud.language")

# Helper function to delete a file if it exists
def delete_file(file_path: str) -> bool:
    """
    Delete a file if it exists and return success status
    
    Args:
        file_path: Path to the file to delete
        
    Returns:
        bool: True if file was deleted, False otherwise
    """
    if not file_path:
        return False
        
    try:
        # Convert relative path to absolute if needed
        if not os.path.isabs(file_path):
            from app.core.config import settings
            file_path = os.path.join(settings.BASE_DIR, "uploads", file_path)
            
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.debug(f"Successfully deleted file: {file_path}")
            return True
        else:
            logger.warning(f"File not found for deletion: {file_path}")
            return False
    except Exception as e:
        logger.error(f"Error deleting file {file_path}: {str(e)}")
        return False

# CRUD Functions
def get_language(db: Session, language_id: int) -> Optional[Language]:
    """
    Get a language by ID
    
    Args:
        db: Database session
        language_id: ID of the language to retrieve
        
    Returns:
        Language object or None if not found
    """
    logger.debug(f"Fetching language with ID {language_id}")
    try:
        return db.query(Language).filter(Language.id == language_id).first()
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching language {language_id}: {str(e)}")
        raise

def get_language_by_code(db: Session, code: str) -> Optional[Language]:
    """
    Get a language by code
    
    Args:
        db: Database session
        code: Language code to search for
        
    Returns:
        Language object or None if not found
    """
    logger.debug(f"Fetching language by code: {code}")
    try:
        return db.query(Language).filter(Language.code == code.lower()).first()
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching language by code {code}: {str(e)}")
        raise

def get_default_language(db: Session) -> Optional[Language]:
    """
    Get the default language
    
    Args:
        db: Database session
        
    Returns:
        Default language or None if not set
    """
    logger.debug("Fetching default language")
    try:
        return db.query(Language).filter(Language.is_default == True).first()
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching default language: {str(e)}")
        raise

def create_language(db: Session, language: LanguageCreate, image_path: str = None) -> Language:
    """
    Create a new language
    
    Args:
        db: Database session
        language: Language data to create
        image_path: Optional path to language flag image
        
    Returns:
        Created language object
        
    Raises:
        IntegrityError: If a language with the same code already exists
        SQLAlchemyError: For other database errors
    """
    logger.debug(f"Starting language creation for {language.code}")
    
    try:
        # If this language is set as default, unset any existing default language
        if language.is_default:
            current_default = get_default_language(db)
            if current_default:
                current_default.is_default = False
                db.flush()  # Flush to ensure the change is applied
        
        db_language = Language(
            code=language.code.lower(),  # Ensure lowercase for consistency
            name=language.name,
            image=image_path or "",  # Use the uploaded image path or empty string
            is_default=language.is_default,
            enabled=language.enabled
        )
        
        db.add(db_language)
        db.flush()  # Flush to get the ID assigned by the database
        db.refresh(db_language)  # Refresh to ensure we have all fields populated
        logger.debug(f"Language added to session with ID: {db_language.id}")
        return db_language
    except IntegrityError as e:
        logger.error(f"Integrity error creating language {language.code}: {str(e)}")
        db.rollback()
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error creating language {language.code}: {str(e)}")
        db.rollback()
        raise

def update_language(db: Session, language_id: int, language: LanguageUpdate, image_path: str = None) -> Optional[Language]:
    """
    Update an existing language
    
    Args:
        db: Database session
        language_id: ID of the language to update
        language: Updated language data
        image_path: Optional new image path
        
    Returns:
        Updated language object or None if not found
        
    Raises:
        IntegrityError: If update violates unique constraints
        SQLAlchemyError: For other database errors
        ValueError: If trying to update non-existent language
    """
    logger.debug(f"Updating language with ID {language_id}")
    
    try:
        db_language = get_language(db, language_id)
        
        if not db_language:
            logger.warning(f"Attempted to update non-existent language with ID {language_id}")
            return None
        
        # Store old image path in case we need to delete it
        old_image_path = db_language.image if image_path else None
        
        # Update fields if provided
        if language.code is not None:
            db_language.code = language.code.lower()  # Ensure lowercase for consistency
        
        if language.name is not None:
            db_language.name = language.name
        
        # Update image if a new one is provided
        if image_path:
            db_language.image = image_path
        
        # Handle default language logic
        if language.is_default is not None and language.is_default and not db_language.is_default:
            # Unset any existing default language
            current_default = get_default_language(db)
            if current_default and current_default.id != language_id:
                current_default.is_default = False
            db_language.is_default = True
        elif language.is_default is not None:
            db_language.is_default = language.is_default

        # Update enabled field if provided
        if language.enabled is not None:
            db_language.enabled = language.enabled

        db.flush()  # Flush to ensure changes are applied
        
        # Delete old image if it was replaced
        if old_image_path and old_image_path != db_language.image:
            delete_file(old_image_path)
            logger.debug(f"Deleted old image file: {old_image_path}")
        
        return db_language
    except IntegrityError as e:
        logger.error(f"Integrity error updating language {language_id}: {str(e)}")
        db.rollback()
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error updating language {language_id}: {str(e)}")
        db.rollback()
        raise

def delete_language(db: Session, language_id: int) -> Optional[Language]:
    """
    Delete a language
    
    Args:
        db: Database session
        language_id: ID of the language to delete
        
    Returns:
        Deleted language object or None if not found
        
    Raises:
        ValueError: If attempting to delete the default language
        SQLAlchemyError: For database errors
    """
    logger.debug(f"Deleting language with ID {language_id}")
    
    try:
        db_language = get_language(db, language_id)
        
        if not db_language:
            logger.warning(f"Attempted to delete non-existent language with ID {language_id}")
            return None
        
        # Don't allow deleting the default language
        if db_language.is_default:
            logger.error(f"Attempted to delete default language with ID {language_id}")
            raise ValueError("Cannot delete the default language")
        
        # Store image path to delete after removing from database
        image_path = db_language.image
        
        db.delete(db_language)
        db.flush()
        
        # Delete the image file if it exists
        if image_path:
            delete_file(image_path)
            logger.debug(f"Deleted image file during language deletion: {image_path}")
        
        return db_language
    except SQLAlchemyError as e:
        logger.error(f"Database error deleting language {language_id}: {str(e)}")
        db.rollback()
        raise

def get_languages(db: Session, skip: int = 0, limit: int = 100) -> List[Language]:
    """
    Get all languages with optional pagination
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of languages
    """
    logger.debug(f"Fetching languages with skip={skip}, limit={limit}")
    try:
        return db.query(Language).offset(skip).limit(limit).all()
    except SQLAlchemyError as e:
        logger.error(f"Database error fetching languages: {str(e)}")
        raise

def get_languages_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: List[Filter] = None,
    sort_field: str = None,
    sort_order: str = "asc"
) -> Tuple[List[Language], int]:
    """
    Get paginated, filtered, and sorted languages
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        filters: List of filter objects
        sort_field: Field to sort by
        sort_order: Sort direction ('asc' or 'desc')
        
    Returns:
        Tuple of (languages, total_count)
    """
    logger.debug(f"Fetching languages paginated with page={page}, page_size={page_size}, filters={filters}, sort={sort_field} {sort_order}")
    
    try:
        # Create base query
        query = db.query(Language)
        
        # Apply filters if provided
        if filters:
            for filter_item in filters:
                field_name = filter_item.field
                value = filter_item.value
                operator = filter_item.operator
                
                if hasattr(Language, field_name):
                    field = getattr(Language, field_name)
                    
                    if operator == "contains":
                        query = query.filter(field.ilike(f"%{value}%"))
                    elif operator == "eq":
                        query = query.filter(field == value)
                    elif operator == "starts_with":
                        query = query.filter(field.ilike(f"{value}%"))
                    elif operator == "ends_with":
                        query = query.filter(field.ilike(f"%{value}"))
                    elif operator == "gt":
                        query = query.filter(field > value)
                    elif operator == "lt":
                        query = query.filter(field < value)
                    elif operator == "ge":
                        query = query.filter(field >= value)
                    elif operator == "le":
                        query = query.filter(field <= value)
                    elif operator == "in" and isinstance(value, list):
                        query = query.filter(field.in_(value))
                    elif operator == "not_in" and isinstance(value, list):
                        query = query.filter(~field.in_(value))
                    else:
                        logger.warning(f"Unsupported operator: {operator}")
        
        # Apply sorting if provided
        if sort_field and hasattr(Language, sort_field):
            if sort_order.lower() == 'desc':
                query = query.order_by(desc(getattr(Language, sort_field)))
            else:
                query = query.order_by(asc(getattr(Language, sort_field)))
        else:
            # Default sort by id
            query = query.order_by(Language.id)
        
        # Get total count before pagination
        total = query.count()
        
        # Apply pagination
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        
        logger.debug(f"Retrieved {len(items)} languages (total: {total})")
        
        return items, total
    except Exception as e:
        logger.exception(f"Error in get_languages_paginated: {str(e)}")
        # Re-raise the exception for the endpoint to handle
        raise

def create_language_from_schema(db: Session, obj_in: LanguageCreate) -> Language:
    """Create a language from schema object"""
    # If this is a default language and there's already a default, unset the old default
    if obj_in.is_default:
        current_default = get_default_language(db)
        if current_default:
            current_default.is_default = False
            db.add(current_default)
    
    obj_in_data = jsonable_encoder(obj_in)
    db_obj = Language(**obj_in_data)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_language_from_schema(
    db: Session, db_obj: Language, obj_in: Union[LanguageUpdate, Dict[str, Any]]
) -> Language:
    """Update a language from schema object"""
    if isinstance(obj_in, dict):
        update_data = obj_in
    else:
        update_data = obj_in.dict(exclude_unset=True)
    
    # Handle default language changes
    if "is_default" in update_data and update_data["is_default"]:
        current_default = get_default_language(db)
        if current_default and current_default.id != db_obj.id:
            current_default.is_default = False
            db.add(current_default)
    
    # Update the model attributes with the new values
    for field in update_data:
        setattr(db_obj, field, update_data[field])
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_languages_by_filter(
    db: Session, 
    *, 
    filters: Dict = None,
    skip: int = 0, 
    limit: int = 100
) -> Dict[str, Any]:
    """Get languages by filter criteria"""
    query = db.query(Language)
    
    # Apply filters if any
    if filters:
        for field, value in filters.items():
            if field == "code" and value:
                query = query.filter(Language.code.ilike(f"%{value}%"))
            elif field == "name" and value:
                query = query.filter(Language.name.ilike(f"%{value}%"))
            elif field == "is_default" and value is not None:
                query = query.filter(Language.is_default == value)
    
    # Get total count before applying pagination
    total = query.count()
    
    # Apply pagination
    results = query.offset(skip).limit(limit).all()
    
    return {"results": results, "total": total}
