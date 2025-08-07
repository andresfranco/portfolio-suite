from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import asc, desc, or_, func, case
from app.models.category import Category, CategoryText
from app.models.skill import Skill
from app.models.language import Language
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryTextCreate, Filter
from typing import List, Optional, Tuple, Dict, Any
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.core.db import db_transaction

# Set up logger using centralized logging
logger = setup_logger("app.crud.category")

# CRUD Functions
def get_category(db: Session, category_id: int) -> Optional[Category]:
    """
    Get a category by ID, eagerly loading category_texts and language data.
    
    Args:
        db: Database session
        category_id: ID of the category to retrieve
        
    Returns:
        Category object with related data loaded or None if not found
    """
    logger.debug(f"Fetching category with ID {category_id}")
    return db.query(Category).options(
        joinedload(Category.category_texts).joinedload(CategoryText.language)
    ).filter(Category.id == category_id).first()

def get_category_by_code(db: Session, code: str) -> Optional[Category]:
    """
    Get a category by its code.
    
    Args:
        db: Database session
        code: The category code to look up
        
    Returns:
        Category object or None if not found
    """
    logger.debug(f"Fetching category by code: {code}")
    return db.query(Category).filter(Category.code == code).first()

@db_transaction
def create_category(db: Session, category: CategoryCreate) -> Category:
    """
    Create a new category with related texts.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        category: The category data to create (Pydantic schema)
        
    Returns:
        The created Category SQLAlchemy object
        
    Raises:
        ValueError: If a category with the same code already exists or if any validation fails
        Exception: If there's a database error during creation
    """
    logger.debug(f"Starting category creation for {category.code}")
    
    # Check if category with this code already exists
    existing_category = get_category_by_code(db, category.code)
    if existing_category:
        error_msg = f"Category with code '{category.code}' already exists."
        logger.warning(error_msg)
        raise ValueError(error_msg)
    
    # Create the category
    db_category = Category(
        code=category.code,
        type_code=category.type_code
    )
    db.add(db_category)
    db.flush()  # Flush to get the category ID
    
    # Create category texts
    for text_data in category.category_texts:
        # Verify language exists
        language = db.query(Language).filter(Language.id == text_data.language_id).first()
        if not language:
            error_msg = f"Invalid language ID: {text_data.language_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        db_category_text = CategoryText(
            category_id=db_category.id,
            language_id=text_data.language_id,
            name=text_data.name,
            description=text_data.description
        )
        db.add(db_category_text)
    
    # db.commit() is handled by the @db_transaction decorator
    db.flush() # Flush to ensure all related objects are created
    logger.info(f"Category created successfully with ID: {db_category.id}")
    
    # Load the relationships for the return value
    db.refresh(db_category)
    
    return db_category

@db_transaction
def update_category(db: Session, category_id: int, category: CategoryUpdate) -> Optional[Category]:
    """
    Update an existing category and its texts.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        category_id: ID of the category to update
        category: Category update data (Pydantic schema with optional fields)
        
    Returns:
        Updated Category SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If validation fails (e.g., invalid language ID)
        Exception: If there's a database error during update
    """
    logger.debug(f"Updating category with ID {category_id}")
    
    # Get the existing category
    db_category = get_category(db, category_id)
    if not db_category:
        logger.warning(f"Category not found for update: {category_id}")
        return None
    
    # Get non-None fields to update
    update_data = category.model_dump(exclude_unset=True, exclude={"category_texts", "removed_language_ids"})
    
    # Check if code is being updated and if it conflicts
    if "code" in update_data and update_data["code"] != db_category.code:
        # Check if the new code already exists
        existing = get_category_by_code(db, update_data["code"])
        if existing:
            error_msg = f"Cannot update category: code '{update_data['code']}' already exists."
            logger.warning(error_msg)
            raise ValueError(error_msg)
    
    # Apply updates to the model (except category_texts and removed_language_ids)
    for field, value in update_data.items():
        setattr(db_category, field, value)
    
    # Update category texts if provided
    if hasattr(category, "category_texts") and category.category_texts is not None:
        # Process removed language IDs
        if hasattr(category, "removed_language_ids") and category.removed_language_ids:
            for lang_id in category.removed_language_ids:
                db.query(CategoryText).filter(
                    CategoryText.category_id == category_id,
                    CategoryText.language_id == lang_id
                ).delete()
        
        # Process new or updated texts
        for text_data in category.category_texts:
            # Verify language exists
            language = db.query(Language).filter(Language.id == text_data.language_id).first()
            if not language:
                error_msg = f"Invalid language ID: {text_data.language_id}"
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            # Check if text for this language already exists
            existing_text = db.query(CategoryText).filter(
                CategoryText.category_id == category_id,
                CategoryText.language_id == text_data.language_id
            ).first()
            
            if existing_text:
                # Update existing text
                if text_data.name is not None:
                    existing_text.name = text_data.name
                if text_data.description is not None:
                    existing_text.description = text_data.description
            else:
                # Create new text
                new_text = CategoryText(
                    category_id=category_id,
                    language_id=text_data.language_id,
                    name=text_data.name,
                    description=text_data.description
                )
                db.add(new_text)
    
    # db.commit() is handled by the @db_transaction decorator
    db.flush()
    logger.info(f"Category updated successfully: {category_id}")
    
    # Refresh to get updated relationships
    db.refresh(db_category)
    
    return db_category

@db_transaction
def delete_category(db: Session, category_id: int) -> Optional[Category]:
    """
    Delete a category.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        category_id: ID of the category to delete
        
    Returns:
        The deleted Category SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If the category has associated entities that prevent deletion
        Exception: If there's a database error during deletion
    """
    logger.debug(f"Deleting category with ID {category_id}")
    
    # Get the category
    db_category = get_category(db, category_id)
    if not db_category:
        logger.warning(f"Category not found for deletion: {category_id}")
        return None
    
    # TODO: Check if this category is referenced by other entities that would prevent deletion
    # This would depend on your business rules
    
    # Store relevant info for logging
    deleted_id = db_category.id
    deleted_code = db_category.code
    
    # Delete the category (cascade will handle texts)
    db.delete(db_category)
    
    # db.commit() is handled by the @db_transaction decorator
    logger.info(f"Category deleted successfully: ID={deleted_id}, code={deleted_code}")
    
    return db_category

def get_categories(db: Session, skip: int = 0, limit: int = 100) -> List[Category]:
    """
    Get a simple list of categories without pagination complexities.
    
    Args:
        db: Database session
        skip: Number of items to skip (for offset)
        limit: Maximum number of items to return
        
    Returns:
        List of Category objects with eager-loaded relationships
    """
    logger.debug(f"Getting categories with skip={skip}, limit={limit}")
    try:
        return db.query(Category).options(
            joinedload(Category.category_texts).joinedload(CategoryText.language)
        ).order_by(Category.code).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving categories: {str(e)}", exc_info=True)
        # Return empty list instead of raising to prevent 500 errors
        return []

def get_categories_by_type(db: Session, category_type: str, skip: int = 0, limit: int = 100) -> List[Category]:
    """
    Get categories by type, eagerly loading category_texts and language data.
    
    Args:
        db: Database session
        category_type: Type code to filter by
        skip: Number of records to skip
        limit: Maximum number of records to return
        
    Returns:
        List of category objects with related data loaded
    """
    logger.debug(f"Fetching categories with type {category_type}")
    
    try:
        # Update any NULL type_code values to 'GEN'
        db.query(Category).filter(Category.type_code.is_(None)).update({Category.type_code: 'GEN'}, synchronize_session=False)
        db.commit()
        
        return db.query(Category).options(
            joinedload(Category.category_texts).joinedload(CategoryText.language)
        ).filter(Category.type_code == category_type).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving categories by type: {str(e)}", exc_info=True)
        # Return empty list instead of raising to prevent 500 errors
        return []

def get_categories_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: str = "asc"
) -> Tuple[List[Category], int]:
    """
    Get paginated list of categories with filtering and sorting.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        filters: List of filter specifications
        sort_field: Field to sort by
        sort_order: Sort direction ("asc" or "desc")
        
    Returns:
        Tuple of (list of categories, total count)
    """
    logger.debug(f"Getting paginated categories: page={page}, page_size={page_size}, filters={filters}, sort={sort_field} {sort_order}")
    
    try:
        # Update any NULL type_code values to 'GEN'
        db.query(Category).filter(Category.type_code.is_(None)).update({Category.type_code: 'GEN'}, synchronize_session=False)
        db.commit()
        
        # Start with base query, including eager loading of related data
        base_query = db.query(Category).options(
            joinedload(Category.category_texts).joinedload(CategoryText.language)
        )
        
        # Use the QueryBuilder with the base query
        query_builder = QueryBuilder(
            query_or_model=base_query,
            model=Category,
            db_session=db
        )
        
        # Apply filters if provided
        if filters:
            logger.debug(f"Applying {len(filters)} filters")
            
            # For each filter, determine if we need special handling or can use the QueryBuilder
            for filter_item in filters:
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
                    
                    # Direct field filtering for code and type_code
                    if field in ["code", "type_code"]:
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
                    
                    # Special handling for name and description (need to join with CategoryText)
                    elif field in ["name", "description", "language_id"]:
                        # We need to handle this manually as it's a joined table
                        if field == "name":
                            # Check if this filter has a language_id specified (new feature)
                            language_id = getattr(filter_item, 'language_id', None)
                            
                            # For name filtering
                            if operator == "contains":
                                if language_id:
                                    # Filter by name in a specific language
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.name.ilike(f"%{value}%"),
                                        CategoryText.language_id == language_id
                                    )
                                    logger.debug(f"Applied name filter with language_id {language_id}: {value}")
                                else:
                                    # Filter by name across all languages (original behavior)
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.name.ilike(f"%{value}%")
                                    )
                                    logger.debug(f"Applied name filter across all languages: {value}")
                            elif operator in ["equals", "eq"]:
                                if language_id:
                                    # Exact match by name in a specific language
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.name == value,
                                        CategoryText.language_id == language_id
                                    )
                                    logger.debug(f"Applied exact name filter with language_id {language_id}: {value}")
                                else:
                                    # Exact match by name across all languages (original behavior)
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.name == value
                                    )
                                    logger.debug(f"Applied exact name filter across all languages: {value}")
                        
                        # For description filtering
                        elif field == "description":
                            # Check if this filter has a language_id specified
                            language_id = getattr(filter_item, 'language_id', None)
                            
                            if operator == "contains":
                                if language_id:
                                    # Filter by description in a specific language
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.description.ilike(f"%{value}%"),
                                        CategoryText.language_id == language_id
                                    )
                                else:
                                    # Filter by description across all languages (original behavior)
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.description.ilike(f"%{value}%")
                                    )
                            elif operator in ["equals", "eq"]:
                                if language_id:
                                    # Exact match by description in a specific language
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.description == value,
                                        CategoryText.language_id == language_id
                                    )
                                else:
                                    # Exact match by description across all languages (original behavior)
                                    query_builder.query = query_builder.query.join(CategoryText).filter(
                                        CategoryText.description == value
                                    )
                        
                        # For language_id filtering
                        elif field == "language_id":
                            query_builder.query = query_builder.query.join(CategoryText).filter(
                                CategoryText.language_id == value
                            )
                except Exception as filter_error:
                    logger.error(f"Error processing filter {filter_item}: {str(filter_error)}", exc_info=True)
                    # Continue with other filters instead of failing completely
                    continue
        
        # Important: Ensure distinct results before getting count or applying sorting
        # This is important when joining with CategoryText which could result in duplicates
        query_builder.query = query_builder.query.distinct()
        
        # Get total count (for distinct categories without ORDER BY)
        # We need to select only Category.id to avoid duplicate counting
        # Create a count query without any ordering (to avoid SQL error)
        count_query = query_builder.query.with_entities(Category.id).order_by(None)
        total_count = count_query.distinct().count()
        
        # Now apply sorting for the data retrieval query
        if sort_field:
            # Handle special cases for sorting by joined fields
            if sort_field in ["name", "description"]:
                # We need to join with CategoryText and use the first text for a category
                # This is a simplification - in reality you might want to sort by text in a specific language
                if sort_field == "name":
                    # Use a subquery to get the first name for each category
                    from sqlalchemy import select, func
                    
                    # Join with CategoryText if not already done
                    if "CategoryText" not in str(query_builder.query):
                        query_builder.query = query_builder.query.join(CategoryText)
                    
                    # Apply the sort
                    sort_expr = CategoryText.name
                    if sort_order.lower() == "desc":
                        query_builder.query = query_builder.query.order_by(desc(sort_expr))
                    else:
                        query_builder.query = query_builder.query.order_by(asc(sort_expr))
                
                # Similar approach for description
                elif sort_field == "description":
                    # Join with CategoryText if not already done
                    if "CategoryText" not in str(query_builder.query):
                        query_builder.query = query_builder.query.join(CategoryText)
                    
                    # Apply the sort
                    sort_expr = CategoryText.description
                    if sort_order.lower() == "desc":
                        query_builder.query = query_builder.query.order_by(desc(sort_expr))
                    else:
                        query_builder.query = query_builder.query.order_by(asc(sort_expr))
            else:
                # For direct fields, use the QueryBuilder's sort method
                query_builder.apply_sort(sort_field, sort_order)
        else:
            # Default sort
            query_builder.apply_sort("code", "asc")
        
        # Apply pagination
        offset = (page - 1) * page_size
        paginated_query = query_builder.query.offset(offset).limit(page_size)
        
        # Execute query
        categories = paginated_query.all()
        
        logger.info(f"Retrieved {len(categories)} categories out of {total_count} total")
        return categories, total_count
    except Exception as e:
        logger.exception(f"Error in get_categories_paginated: {str(e)}")
        # Re-raise the exception for the endpoint to handle
        raise

def ensure_project_image_category_exists(db: Session) -> None:
    """
    Ensure that the PROI-* (Project Region of Interest) categories exist.
    This is used for image categorization in projects.
    
    Args:
        db: Database session
    """
    required_categories = [
        {
            "code": "PROI-LOGO",
            "name": "Logo",
            "description": "Logo images for the project"
        },
        {
            "code": "PROI-THUMBNAIL",
            "name": "Thumbnail",
            "description": "Thumbnail images for the project"
        },
        {
            "code": "PROI-GALLERY",
            "name": "Gallery",
            "description": "Gallery images for the project"
        },
        {
            "code": "PROI-DIAGRAM",
            "name": "Diagram",
            "description": "Diagrams and architecture images for the project"
        },
        {
            "code": "PROI-SCREENSHOT",
            "name": "Screenshot",
            "description": "Screenshots of the application or website"
        },
    ]
    
    # Get the default language
    default_language = db.query(Language).filter(Language.is_default == True).first()
    if not default_language:
        default_language = db.query(Language).first()  # Fall back to any language
    
    if not default_language:
        logger.error("Cannot create PROI categories: No languages found in database")
        return
    
    # Create or update each required category
    for cat_info in required_categories:
        # Check if category exists
        existing = db.query(Category).filter(Category.code == cat_info["code"]).first()
        
        if not existing:
            logger.info(f"Creating PROI category: {cat_info['code']}")
            
            # Create the category
            try:
                category = Category(
                    code=cat_info["code"],
                    type_code="PROI"  # Project Region of Interest type
                )
                db.add(category)
                db.flush()  # Get the ID
                
                # Add the default text
                text = CategoryText(
                    category_id=category.id,
                    language_id=default_language.id,
                    name=cat_info["name"],
                    description=cat_info["description"]
                )
                db.add(text)
                db.commit()
                
                logger.info(f"Created PROI category: {cat_info['code']}")
            except Exception as e:
                db.rollback()
                logger.error(f"Error creating PROI category {cat_info['code']}: {str(e)}")
        else:
            logger.debug(f"PROI category already exists: {cat_info['code']}")
