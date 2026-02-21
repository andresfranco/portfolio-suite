from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc, or_, inspect
from app.models.experience import Experience, ExperienceText, ExperienceImage
from app.models.language import Language
from app.schemas.experience import ExperienceCreate, ExperienceUpdate, ExperienceTextCreate, Filter
from typing import List, Optional, Tuple
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.core.db import db_transaction

# Set up logger using centralized logging
logger = setup_logger("app.crud.experience")

# Helper to detect optional table support
EXPERIENCE_IMAGES_TABLE = "experience_images"

def experience_images_supported(db: Session) -> bool:
    """
    Detect whether the experience_images table exists.
    """
    try:
        engine = db.get_bind()
        inspector = inspect(engine)
        exists = inspector.has_table(EXPERIENCE_IMAGES_TABLE)
        if not exists:
            logger.debug("%s table not found; skipping experience image joins", EXPERIENCE_IMAGES_TABLE)
        return exists
    except Exception as exc:
        logger.warning(
            "Unable to inspect for %s table (assuming unavailable): %s",
            EXPERIENCE_IMAGES_TABLE,
            exc,
        )
        return False

# CRUD Functions
def get_experience(db: Session, experience_id: int):
    logger.debug(f"Fetching experience with ID {experience_id}")
    loader_options = [
        joinedload(Experience.experience_texts).joinedload(ExperienceText.language)
    ]
    if experience_images_supported(db):
        loader_options.append(joinedload(Experience.images))
    return (
        db.query(Experience)
        .options(*loader_options)
        .filter(Experience.id == experience_id)
        .first()
    )

def get_experience_by_code(db: Session, code: str):
    logger.debug(f"Fetching experience by code: {code}")
    loader_options = [
        joinedload(Experience.experience_texts).joinedload(ExperienceText.language)
    ]
    if experience_images_supported(db):
        loader_options.append(joinedload(Experience.images))
    return (
        db.query(Experience)
        .options(*loader_options)
        .filter(Experience.code == code)
        .first()
    )

@db_transaction
def create_experience(db: Session, experience: ExperienceCreate):
    logger.debug(f"Starting experience creation with code {experience.code} and {len(experience.experience_texts)} texts")
    
    # Create the experience
    db_experience = Experience(
        code=experience.code,
        years=experience.years,
        # Set default values for user tracking fields
        created_by=1,  # Default user ID
        updated_by=1   # Default user ID
    )
    db.add(db_experience)
    db.flush()  # Flush to get the experience ID
    
    # Create experience texts
    for text_data in experience.experience_texts:
        # Verify language exists
        language = db.query(Language).filter(Language.id == text_data.language_id).first()
        if not language:
            logger.error(f"Invalid language ID: {text_data.language_id}")
            raise ValueError(f"Invalid language ID: {text_data.language_id}")
        
        db_experience_text = ExperienceText(
            experience_id=db_experience.id,
            language_id=text_data.language_id,
            name=text_data.name,
            description=text_data.description,
            # Set default values for user tracking fields
            created_by=1,  # Default user ID
            updated_by=1   # Default user ID
        )
        db.add(db_experience_text)
    
    logger.debug("Experience added to session")
    db.refresh(db_experience)
    return db_experience

def update_experience(db: Session, experience_id: int, experience: ExperienceUpdate):
    logger.debug(f"Updating experience with ID {experience_id}")
    logger.debug(f"Received experience data: {experience}")
    logger.debug(f"Experience code: {experience.code} (type: {type(experience.code)})")
    logger.debug(f"Experience years: {experience.years} (type: {type(experience.years)})")
    
    try:
        # Get the existing experience
        db_experience = get_experience(db, experience_id)
        if not db_experience:
            logger.error(f"Experience with ID {experience_id} not found")
            return None
        
        logger.debug(f"Current experience before update - code: {db_experience.code}, years: {db_experience.years}")
        
        # Update experience fields
        if experience.code is not None:
            logger.debug(f"Updating code from '{db_experience.code}' to '{experience.code}'")
            db_experience.code = experience.code
        else:
            logger.warning("Code is None, not updating")
            
        if experience.years is not None:
            logger.debug(f"Updating years from '{db_experience.years}' to '{experience.years}'")
            db_experience.years = experience.years
        else:
            logger.warning("Years is None, not updating")
        
        # Update user tracking fields
        db_experience.updated_by = 1  # Default user ID
        
        logger.debug(f"Experience after field updates - code: {db_experience.code}, years: {db_experience.years}")
        
        # Handle removed languages if provided
        if experience.removed_language_ids:
            logger.debug(f"Removing languages with IDs: {experience.removed_language_ids}")
            for lang_id in experience.removed_language_ids:
                # Find and delete experience_texts for this language
                texts_to_delete = db.query(ExperienceText).filter(
                    ExperienceText.experience_id == experience_id,
                    ExperienceText.language_id == lang_id
                ).all()
                
                for text in texts_to_delete:
                    logger.debug(f"Deleting experience_text with ID {text.id} for language {lang_id}")
                    db.delete(text)
        
        # Update experience texts if provided
        if experience.experience_texts:
            # Get existing texts
            existing_texts = {text.language_id: text for text in db_experience.experience_texts}
            
            # Process each text in the update
            for text_data in experience.experience_texts:
                # Verify language exists
                language = db.query(Language).filter(Language.id == text_data.language_id).first()
                if not language:
                    logger.error(f"Invalid language ID: {text_data.language_id}")
                    raise ValueError(f"Invalid language ID: {text_data.language_id}")
                
                # If the text has an ID, try to find it directly
                if text_data.id:
                    existing_text = db.query(ExperienceText).filter(ExperienceText.id == text_data.id).first()
                    if existing_text:
                        # Update existing text
                        if text_data.name is not None:
                            existing_text.name = text_data.name
                        if text_data.description is not None:
                            existing_text.description = text_data.description
                        existing_text.updated_by = 1  # Default user ID
                        continue
                
                # Check if text for this language already exists
                if text_data.language_id in existing_texts:
                    # Update existing text
                    existing_text = existing_texts[text_data.language_id]
                    if text_data.name is not None:
                        existing_text.name = text_data.name
                    if text_data.description is not None:
                        existing_text.description = text_data.description
                    existing_text.updated_by = 1  # Default user ID
                else:
                    # Create new text
                    db_experience_text = ExperienceText(
                        experience_id=db_experience.id,
                        language_id=text_data.language_id,
                        name=text_data.name or "",
                        description=text_data.description or "",
                        created_by=1,  # Default user ID
                        updated_by=1   # Default user ID
                    )
                    db.add(db_experience_text)
        
        # Flush the session to ensure all changes are written to the database
        db.flush()
        
        # Log the experience state before refresh
        logger.debug(f"Experience before refresh - code: {db_experience.code}, years: {db_experience.years}")
        
        # Refresh the experience object to get the latest state from the database
        db.refresh(db_experience)
        
        # Log the experience state after refresh
        logger.debug(f"Experience after refresh - code: {db_experience.code}, years: {db_experience.years}")
        
        # Manually commit the transaction
        db.commit()
        logger.debug(f"Transaction manually committed for update_experience")
        
        # Final verification
        logger.debug(f"Final experience values - code: {db_experience.code}, years: {db_experience.years}")
        
        return db_experience
        
    except Exception as e:
        # Error occurred - rollback the transaction
        db.rollback()
        logger.error(f"Transaction rolled back for update_experience: {str(e)}")
        raise


def get_experience_image(db: Session, experience_image_id: int) -> Optional[ExperienceImage]:
    """Retrieve a single experience image by ID."""
    if not experience_images_supported(db):
        return None
    return (
        db.query(ExperienceImage)
        .filter(ExperienceImage.id == experience_image_id)
        .first()
    )


def get_experience_images(
    db: Session,
    experience_id: int,
    category: Optional[str] = None,
    language_id: Optional[int] = None,
) -> List[ExperienceImage]:
    """
    Retrieve images for an experience, optionally filtered by category and language.
    Falls back to language-agnostic images when language_id is provided.
    """
    if not experience_images_supported(db):
        logger.debug("experience_images table unavailable; returning empty image list")
        return []

    query = db.query(ExperienceImage).filter(ExperienceImage.experience_id == experience_id)

    if category:
        query = query.filter(ExperienceImage.category == category)

    if language_id is not None:
        query = query.filter(
            or_(
                ExperienceImage.language_id == language_id,
                ExperienceImage.language_id.is_(None),
            )
        )

    return query.order_by(ExperienceImage.created_at.desc()).all()


def create_experience_image(
    db: Session,
    *,
    experience_id: int,
    image_path: str,
    file_name: Optional[str] = None,
    category: str = "content",
    language_id: Optional[int] = None,
    experience_text_id: Optional[int] = None,
    created_by: Optional[int] = None,
) -> ExperienceImage:
    """Persist a new experience image record."""
    if not experience_images_supported(db):
        raise ValueError("Experience images table is not available. Run migrations before uploading images.")

    db_image = ExperienceImage(
        experience_id=experience_id,
        experience_text_id=experience_text_id,
        image_path=image_path,
        file_name=file_name,
        category=category,
        language_id=language_id,
        created_by=created_by,
        updated_by=created_by,
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


def delete_experience_image(db: Session, experience_image_id: int) -> bool:
    """Delete an experience image by ID."""
    if not experience_images_supported(db):
        return False

    image = get_experience_image(db, experience_image_id)
    if not image:
        return False

    db.delete(image)
    db.commit()
    return True

@db_transaction
def delete_experience(db: Session, experience_id: int):
    logger.debug(f"Deleting experience with ID {experience_id}")
    
    # Get the existing experience
    db_experience = get_experience(db, experience_id)
    if not db_experience:
        logger.error(f"Experience with ID {experience_id} not found")
        return None
    
    # Delete associated texts first
    for text in db_experience.experience_texts:
        db.delete(text)
    
    # Delete the experience
    db.delete(db_experience)
    return db_experience

def get_experiences(db: Session, skip: int = 0, limit: int = 100):
    logger.debug(f"Fetching experiences with skip={skip}, limit={limit}")
    return db.query(Experience).options(
        joinedload(Experience.experience_texts).joinedload(ExperienceText.language)
    ).offset(skip).limit(limit).all()

def check_code_exists(db: Session, code: str, exclude_id: Optional[int] = None):
    """Check if a code already exists, optionally excluding a specific experience ID."""
    query = db.query(Experience).filter(Experience.code == code)
    if exclude_id:
        query = query.filter(Experience.id != exclude_id)
    return query.first() is not None

def get_experiences_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: str = "asc"
) -> Tuple[List[Experience], int]:
    """
    Get paginated experiences with improved filtering and sorting using QueryBuilder.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        filters: List of Filter objects for flexible filtering
        sort_field: Field to sort by
        sort_order: Sort direction ('asc' or 'desc')
        
    Returns:
        Tuple of (experiences, total_count)
    """
    logger.debug(f"Fetching paginated experiences with page={page}, page_size={page_size}, filters={filters}, sort={sort_field} {sort_order}")
    
    try:
        # Start with base query, including eager loading of related data
        loader_options = [
            joinedload(Experience.experience_texts).joinedload(ExperienceText.language)
        ]
        include_images = experience_images_supported(db)
        if include_images:
            loader_options.append(joinedload(Experience.images))

        base_query = db.query(Experience).options(*loader_options)
        
        # Use the QueryBuilder with the base query
        query_builder = QueryBuilder(
            query_or_model=base_query,
            model=Experience,
            db_session=db
        )
        
        # Apply filters if provided
        if filters:
            logger.debug(f"Applying {len(filters)} filters")
            
            # Collect language_id filters separately to handle them as a group
            language_ids = []
            other_filters = []
            
            # Separate language_id filters from other filters
            for filter_item in filters:
                try:
                    field = getattr(filter_item, 'field', None)
                    value = getattr(filter_item, 'value', None)
                    
                    if field == 'language_id' and value is not None:
                        try:
                            language_ids.append(int(value))
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid language_id value: {value}")
                    else:
                        other_filters.append(filter_item)
                except Exception as filter_error:
                    logger.error(f"Error processing filter {filter_item}: {str(filter_error)}", exc_info=True)
                    continue
            
            # Handle language_id filters with a single JOIN and IN clause
            if language_ids:
                logger.debug(f"Applying language_id filter for languages: {language_ids}")
                query_builder.query = query_builder.query.join(ExperienceText).filter(
                    ExperienceText.language_id.in_(language_ids)
                )
            
            # Process other filters
            for filter_item in other_filters:
                logger.debug(f"Processing filter: {filter_item}")
                
                try:
                    # Handle different filter formats - ensure we have field and value attributes
                    field = getattr(filter_item, 'field', None)
                    value = getattr(filter_item, 'value', None)
                    operator = getattr(filter_item, 'operator', 'contains')
                    
                    # Skip if missing essential attributes
                    if field is None or value is None:
                        logger.warning(f"Skipping filter without field or value: {filter_item}")
                        continue
                    
                    # Direct field filtering for code and years
                    if field in ["code", "years"]:
                        # Convert old operators to new ones if needed
                        if operator == "equals": operator = "eq"
                        if operator == "startsWith": operator = "startswith"
                        if operator == "endsWith": operator = "endswith"
                        
                        # Apply the filter using the QueryBuilder's dictionary format
                        filter_dict = {
                            "field": field,
                            "value": value,
                            "operator": operator
                        }
                        logger.debug(f"Applying direct field filter: {filter_dict}")
                        query_builder.apply_filters([filter_dict])
                    
                    # Special handling for name and description (need to join with ExperienceText)
                    elif field in ["name", "description"]:
                        # We need to handle this manually as it's a joined table
                        if field == "name":
                            # Check if this filter has a language_id specified
                            language_id = getattr(filter_item, 'language_id', None)
                            
                            # For name filtering
                            if operator == "contains":
                                if language_id:
                                    # Filter by name in a specific language
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.name.ilike(f"%{value}%"),
                                        ExperienceText.language_id == language_id
                                    )
                                    logger.debug(f"Applied name filter with language_id {language_id}: {value}")
                                else:
                                    # Filter by name across all languages (original behavior)
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.name.ilike(f"%{value}%")
                                    )
                                    logger.debug(f"Applied name filter across all languages: {value}")
                            elif operator in ["equals", "eq"]:
                                if language_id:
                                    # Exact match by name in a specific language
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.name == value,
                                        ExperienceText.language_id == language_id
                                    )
                                    logger.debug(f"Applied exact name filter with language_id {language_id}: {value}")
                                else:
                                    # Exact match by name across all languages (original behavior)
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.name == value
                                    )
                                    logger.debug(f"Applied exact name filter across all languages: {value}")
                        
                        # For description filtering
                        elif field == "description":
                            # Check if this filter has a language_id specified
                            language_id = getattr(filter_item, 'language_id', None)
                            
                            if operator == "contains":
                                if language_id:
                                    # Filter by description in a specific language
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.description.ilike(f"%{value}%"),
                                        ExperienceText.language_id == language_id
                                    )
                                else:
                                    # Filter by description across all languages (original behavior)
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.description.ilike(f"%{value}%")
                                    )
                            elif operator in ["equals", "eq"]:
                                if language_id:
                                    # Exact match by description in a specific language
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.description == value,
                                        ExperienceText.language_id == language_id
                                    )
                                else:
                                    # Exact match by description across all languages (original behavior)
                                    if not language_ids:  # Only join if not already joined for language_id filters
                                        query_builder.query = query_builder.query.join(ExperienceText)
                                    query_builder.query = query_builder.query.filter(
                                        ExperienceText.description == value
                                    )
                            
                except Exception as filter_error:
                    logger.error(f"Error processing filter {filter_item}: {str(filter_error)}", exc_info=True)
                    # Continue with other filters instead of failing completely
                    continue
        
        # Important: Ensure distinct results before getting count or applying sorting
        # This is important when joining with ExperienceText which could result in duplicates
        query_builder.query = query_builder.query.distinct()
        
        # Get total count (for distinct experiences without ORDER BY)
        # We need to select only Experience.id to avoid duplicate counting
        # Create a count query without any ordering (to avoid SQL error)
        count_query = query_builder.query.with_entities(Experience.id).order_by(None)
        total_count = count_query.distinct().count()
        
        # Now apply sorting for the data retrieval query
        if sort_field:
            # Handle special cases for sorting by joined fields
            if sort_field in ["name", "description"]:
                # We need to join with ExperienceText and use the first text for an experience
                if sort_field == "name":
                    # Join with ExperienceText if not already done
                    if not language_ids and "ExperienceText" not in str(query_builder.query):
                        query_builder.query = query_builder.query.join(ExperienceText)
                    
                    # Apply the sort
                    sort_expr = ExperienceText.name
                    if sort_order.lower() == "desc":
                        query_builder.query = query_builder.query.order_by(desc(sort_expr))
                    else:
                        query_builder.query = query_builder.query.order_by(asc(sort_expr))
                
                # Similar approach for description
                elif sort_field == "description":
                    # Join with ExperienceText if not already done
                    if not language_ids and "ExperienceText" not in str(query_builder.query):
                        query_builder.query = query_builder.query.join(ExperienceText)
                    
                    # Apply the sort
                    sort_expr = ExperienceText.description
                    if sort_order.lower() == "desc":
                        query_builder.query = query_builder.query.order_by(desc(sort_expr))
                    else:
                        query_builder.query = query_builder.query.order_by(asc(sort_expr))
            else:
                # For direct fields, use the QueryBuilder's sort method
                query_builder.apply_sort(sort_field, sort_order)
        else:
            # Default sorting by ID
            query_builder.apply_sort("id", "asc")
        
        # Apply pagination and get results
        offset = (page - 1) * page_size
        experiences = query_builder.query.offset(offset).limit(page_size).all()
        
        logger.debug(f"Query executed successfully: {len(experiences)} experiences retrieved, {total_count} total")
        
        return experiences, total_count
        
    except Exception as e:
        logger.error(f"Error in get_experiences_paginated: {str(e)}", exc_info=True)
        raise
