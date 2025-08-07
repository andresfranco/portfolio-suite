from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, asc, desc
from app.models.translation import Translation, translation_languages
from app.models.language import Language
from app.schemas.translation import TranslationCreate, TranslationUpdate, Filter
from app.core.logging import setup_logger

# Set up logger using centralized logging
logger = setup_logger("app.crud.translation")

# CRUD Functions
def get_translation(db: Session, translation_id: int):
    logger.debug(f"Fetching translation with ID {translation_id}")
    return db.query(Translation).options(joinedload(Translation.language)).filter(Translation.id == translation_id).first()

def get_translation_by_identifier(db: Session, identifier: str):
    logger.debug(f"Fetching translation by identifier: {identifier}")
    return db.query(Translation).options(joinedload(Translation.language)).filter(Translation.identifier == identifier).first()

def create_translation(db: Session, translation: TranslationCreate):
    logger.debug(f"Creating translation with identifier: {translation.identifier}")
    
    # Check if a translation with the same identifier and language already exists
    for language_id in translation.languages:
        logger.debug(f"Fetching translation by identifier: {translation.identifier} and language_id: {language_id}")
        
        # Get the language name for better error messages
        language = db.query(Language).filter(Language.id == language_id).first()
        if not language:
            raise ValueError(f"Language with ID {language_id} not found")
        
        existing_translation = db.query(Translation).join(
            Translation.language
        ).filter(
            Translation.identifier == translation.identifier,
            Language.id == language_id
        ).first()
        
        if existing_translation:
            logger.warning(f"Translation with identifier {translation.identifier} and language {language.name} already exists")
            raise ValueError(f"Translation with identifier '{translation.identifier}' and language '{language.name}' already exists. The combination of identifier and language must be unique.")
    
    # Fetch the languages
    languages = db.query(Language).filter(Language.id.in_(translation.languages)).all()
    if len(languages) != len(translation.languages):
        missing_languages = set(translation.languages) - {lang.id for lang in languages}
        logger.error(f"Invalid language IDs: {missing_languages}")
        raise ValueError(f"Invalid language IDs: {missing_languages}")
    
    db_translation = Translation(
        identifier=translation.identifier,
        text=translation.text,
        language=languages
    )
    
    db.add(db_translation)
    logger.debug("Translation added to session")
    return db_translation

def update_translation(db: Session, translation_id: int, translation: TranslationUpdate):
    logger.debug(f"Updating translation with ID {translation_id}")
    db_translation = get_translation(db, translation_id)
    
    if not db_translation:
        return None
    
    # If both identifier and languages are being updated, check for uniqueness
    if translation.identifier is not None and translation.languages is not None:
        for language_id in translation.languages:
            # Get the language name for better error messages
            language = db.query(Language).filter(Language.id == language_id).first()
            if not language:
                raise ValueError(f"Language with ID {language_id} not found")
                
            # Check if another translation with the same identifier and language exists
            existing_translation = db.query(Translation).join(
                Translation.language
            ).filter(
                Translation.identifier == translation.identifier,
                Language.id == language_id,
                Translation.id != translation_id  # Exclude the current translation
            ).first()
            
            if existing_translation:
                logger.warning(f"Another translation with identifier {translation.identifier} and language {language.name} already exists")
                raise ValueError(f"Translation with identifier '{translation.identifier}' and language '{language.name}' already exists. The combination of identifier and language must be unique.")
    
    # If only identifier is being updated but languages remain the same
    elif translation.identifier is not None:
        for language in db_translation.language:
            existing_translation = db.query(Translation).join(
                Translation.language
            ).filter(
                Translation.identifier == translation.identifier,
                Language.id == language.id,
                Translation.id != translation_id  # Exclude the current translation
            ).first()
            
            if existing_translation:
                logger.warning(f"Another translation with identifier {translation.identifier} and language {language.name} already exists")
                raise ValueError(f"Translation with identifier '{translation.identifier}' and language '{language.name}' already exists. The combination of identifier and language must be unique.")
    
    # If only languages are being updated but identifier remains the same
    elif translation.languages is not None:
        for language_id in translation.languages:
            # Get the language name for better error messages
            language = db.query(Language).filter(Language.id == language_id).first()
            if not language:
                raise ValueError(f"Language with ID {language_id} not found")
                
            existing_translation = db.query(Translation).join(
                Translation.language
            ).filter(
                Translation.identifier == db_translation.identifier,
                Language.id == language_id,
                Translation.id != translation_id  # Exclude the current translation
            ).first()
            
            if existing_translation:
                logger.warning(f"Another translation with identifier {db_translation.identifier} and language {language.name} already exists")
                raise ValueError(f"Translation with identifier '{db_translation.identifier}' and language '{language.name}' already exists. The combination of identifier and language must be unique.")
    
    # Update fields if provided
    if translation.identifier is not None:
        db_translation.identifier = translation.identifier
    
    if translation.text is not None:
        db_translation.text = translation.text
    
    # Update languages if provided
    if translation.languages is not None:
        languages = db.query(Language).filter(Language.id.in_(translation.languages)).all()
        if len(languages) != len(translation.languages):
            missing_languages = set(translation.languages) - {lang.id for lang in languages}
            logger.error(f"Invalid language IDs: {missing_languages}")
            raise ValueError(f"Invalid language IDs: {missing_languages}")
        db_translation.language = languages
    
    return db_translation

def delete_translation(db: Session, translation_id: int):
    logger.debug(f"Deleting translation with ID {translation_id}")
    db_translation = get_translation(db, translation_id)
    
    if not db_translation:
        return None
    
    db.delete(db_translation)
    return db_translation

def get_translations(db: Session, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching translations with skip={skip}, limit={limit}")
    return db.query(Translation).options(
        joinedload(Translation.language)
    ).offset(skip).limit(limit).all()

def get_translations_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    identifier_filter: str = None,
    text_filter: str = None,
    language_filter_values: List[str] = None,
    sort_field: str = None,
    sort_order: str = "asc"
) -> Tuple[List[Translation], int]:
    """
    Get paginated list of translations with filters.
    """
    # Start with a base query that includes the language relationship
    query = db.query(Translation).options(joinedload(Translation.language))
    
    # Apply filters
    if identifier_filter:
        query = query.filter(Translation.identifier.ilike(f"%{identifier_filter}%"))
    
    if text_filter:
        query = query.filter(Translation.text.ilike(f"%{text_filter}%"))
    
    if language_filter_values:
        # Convert string IDs to integers and validate
        language_ids = []
        for lang_id in language_filter_values:
            try:
                language_ids.append(int(lang_id))
            except (ValueError, TypeError):
                logger.warning(f"Invalid language ID: {lang_id}")
                continue
        
        if language_ids:
            # Join with the language relationship and filter
            # Use the many-to-many relationship
            query = query.join(Translation.language).filter(Language.id.in_(language_ids))
    
    # Apply sorting
    if sort_field:
        if sort_field == 'language':
            # Sort by the language name
            query = query.join(Translation.language).order_by(
                desc(Language.name) if sort_order == 'desc' else asc(Language.name)
            )
        else:
            sort_column = getattr(Translation, sort_field, None)
            if sort_column is not None:
                query = query.order_by(desc(sort_column) if sort_order == 'desc' else asc(sort_column))
    else:
        # Default sorting by id
        query = query.order_by(Translation.id)
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    # Execute query and return results
    translations = query.all()
    logger.debug(f"Found {len(translations)} translations matching filters")
    
    return translations, total
