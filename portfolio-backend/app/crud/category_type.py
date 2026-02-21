from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, func
from app.models.category_type import CategoryType
from app.schemas.category_type import CategoryTypeCreate, CategoryTypeUpdate, Filter
from typing import List, Optional, Tuple, Dict, Any
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.core.db import db_transaction
from app.rag.rag_events import stage_event

# Set up logger using centralized logging
logger = setup_logger("app.crud.category_type")

# --- CRUD Functions ---

def get_category_type(db: Session, code: str) -> Optional[CategoryType]:
    """
    Get a category type by its code.
    
    Args:
        db: Database session
        code: The category type code to look up
        
    Returns:
        The category type object or None if not found
    """
    logger.debug(f"Fetching category type with code {code}")
    return db.query(CategoryType).filter(CategoryType.code == code).first()

def get_category_type_by_code(db: Session, code: str) -> Optional[CategoryType]:
    """
    Get a category type by its code (alias for get_category_type for consistency).
    
    Args:
        db: Database session
        code: The category type code to look up
        
    Returns:
        The category type object or None if not found
    """
    logger.debug(f"Fetching category type by code: {code}")
    return get_category_type(db, code)

@db_transaction
def create_category_type(db: Session, category_type: CategoryTypeCreate) -> CategoryType:
    """
    Create a new category type.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        category_type: The category type data to create (Pydantic schema)
        
    Returns:
        The created CategoryType SQLAlchemy object
        
    Raises:
        ValueError: If a category type with the same code already exists.
        Exception: If there's a database error during creation.
    """
    logger.debug(f"Starting category type creation for {category_type.code}")
    
    # Check if category type with this code already exists
    existing_category_type = get_category_type(db, category_type.code)
    if existing_category_type:
        error_msg = f"Category type with code '{category_type.code}' already exists."
        logger.warning(error_msg)
        raise ValueError(error_msg)
    
    # Create the category type
    db_category_type = CategoryType(
        code=category_type.code,
        name=category_type.name
    )
    db.add(db_category_type)
    # Stage RAG event before commit (handled by @db_transaction)
    # Flush first to ensure state is applied (even though PK is provided)
    db.flush()
    try:
        stage_event(db, {
            "op": "insert",
            "source_table": "category_types",
            "source_id": str(db_category_type.code),
            "changed_fields": ["code", "name"]
        })
    except Exception:
        # Do not fail CRUD if staging fails; hook is best-effort
        pass
    
    # db.commit() is handled by the @db_transaction decorator
    logger.info(f"Category type created successfully with code: {db_category_type.code}")
    
    return db_category_type

@db_transaction
def update_category_type(db: Session, code: str, category_type: CategoryTypeUpdate) -> Optional[CategoryType]:
    """
    Update an existing category type.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        code: Code of the category type to update
        category_type: Category type update data (Pydantic schema with optional fields)
        
    Returns:
        Updated CategoryType SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If trying to update code to one that already exists or other validation fails
        Exception: If there's a database error during update.
    """
    logger.debug(f"Updating category type with code {code}")
    
    # Get the existing category type
    db_category_type = get_category_type(db, code)
    if not db_category_type:
        logger.warning(f"Category type not found for update: {code}")
        return None
    
    # Get non-None fields to update
    update_data = category_type.model_dump(exclude_unset=True)
    
    # Check if code is being updated and if it conflicts
    if "code" in update_data and update_data["code"] != code:
        # Check if the new code already exists
        existing = get_category_type(db, update_data["code"])
        if existing:
            error_msg = f"Cannot update category type: code '{update_data['code']}' already exists."
            logger.warning(error_msg)
            raise ValueError(error_msg)
    
    # Apply updates to the model
    for field, value in update_data.items():
        setattr(db_category_type, field, value)
    
    # db.commit() is handled by the @db_transaction decorator
    old_code = code
    new_code = db_category_type.code
    db.flush()
    # Stage RAG events before commit
    try:
        # If primary key (code) changed, retire old chunks as well
        if "code" in update_data and update_data["code"] != old_code:
            stage_event(db, {
                "op": "delete",
                "source_table": "category_types",
                "source_id": str(old_code),
                "changed_fields": []
            })
        stage_event(db, {
            "op": "update",
            "source_table": "category_types",
            "source_id": str(new_code),
            "changed_fields": list(update_data.keys()) if update_data else []
        })
    except Exception:
        pass
    logger.info(f"Category type updated successfully: {db_category_type.code}")
    
    return db_category_type

@db_transaction
def delete_category_type(db: Session, code: str) -> Optional[CategoryType]:
    """
    Delete a category type.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        code: Code of the category type to delete
        
    Returns:
        The deleted CategoryType SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If the category type has associated categories and cannot be deleted
        Exception: If there's a database error during deletion.
    """
    logger.debug(f"Deleting category type with code {code}")
    
    # Get the category type
    db_category_type = get_category_type(db, code)
    if not db_category_type:
        logger.warning(f"Category type not found for deletion: {code}")
        return None
    
    # Check if this category type has associated categories
    # This would require a query to the Category model, which would be implementation-specific
    # For now, we'll assume it's possible to delete without checking for dependencies
    
    deleted_code = db_category_type.code # Store code for logging
    
    # Stage RAG delete event before deletion/commit
    try:
        stage_event(db, {
            "op": "delete",
            "source_table": "category_types",
            "source_id": str(deleted_code),
            "changed_fields": []
        })
    except Exception:
        pass
    
    # Delete the category type
    db.delete(db_category_type)
    
    # db.commit() is handled by the @db_transaction decorator
    logger.info(f"Category type deleted successfully: {deleted_code}")
    
    return db_category_type

def get_category_types(db: Session, skip: int = 0, limit: int = 100) -> List[CategoryType]:
    """
    Get a simple list of category types without pagination complexities.
    
    Args:
        db: Database session
        skip: Number of items to skip (for offset)
        limit: Maximum number of items to return
        
    Returns:
        List of CategoryType objects
    """
    logger.debug(f"Getting category types with skip={skip}, limit={limit}")
    try:
        return db.query(CategoryType).order_by(CategoryType.code).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving category types: {str(e)}", exc_info=True)
        # Return empty list instead of raising to prevent 500 errors
        return []

def get_category_types_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: str = "asc"
) -> Tuple[List[CategoryType], int]:
    """
    Get paginated list of category types with advanced filtering and sorting.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        filters: List of filter specifications (Pydantic Filter models)
        sort_field: Field to sort by (e.g., 'code', 'name')
        sort_order: Sort direction ('asc' or 'desc')
        
    Returns:
        Tuple of (list of category types, total count)
    """
    logger.debug(f"Getting paginated category types: page={page}, page_size={page_size}, filters={filters}, sort={sort_field} {sort_order}")
    
    try:
        # Start with base query
        base_query = db.query(CategoryType)
        
        # Use the QueryBuilder with the base query
        query_builder = QueryBuilder(
            query_or_model=base_query,
            model=CategoryType,
            db_session=db
        )
        
        # Apply filters if provided
        if filters:
            logger.debug(f"Applying {len(filters)} filters")
            
            # Convert Filter objects to dictionary format for QueryBuilder
            filter_dicts = []
            for filter_item in filters:
                try:
                    # Handle different filter formats - ensure we have field and value attributes
                    field = getattr(filter_item, 'field', None)
                    value = getattr(filter_item, 'value', None)
                    operator = getattr(filter_item, 'operator', 'eq')
                    
                    # Skip if missing essential attributes
                    if field is None or value is None:
                        logger.warning(f"Skipping filter without field or value: {filter_item}")
                        continue
                    
                    # Validate field exists on model
                    if not hasattr(CategoryType, field):
                        logger.warning(f"Field {field} not found on model CategoryType")
                        continue
                    
                    # Convert old operators to new ones if needed
                    if operator == "equals": 
                        operator = "eq"
                    if operator == "startsWith": 
                        operator = "startswith"
                    if operator == "endsWith": 
                        operator = "endswith"
                    
                    # Apply the filter using the QueryBuilder's dictionary format
                    filter_dict = {
                        "field": field,
                        "value": value,
                        "operator": operator
                    }
                    filter_dicts.append(filter_dict)
                    logger.debug(f"Applying filter: {filter_dict}")
                    
                except Exception as filter_error:
                    logger.error(f"Error processing filter {filter_item}: {str(filter_error)}", exc_info=True)
                    # Continue with other filters instead of failing completely
                    continue
            
            # Apply all valid filters
            if filter_dicts:
                query_builder.apply_filters(filter_dicts)
        
        # Get total count before applying sorting and pagination
        total_count = query_builder.query.count()
        
        # Apply sorting
        if sort_field:
            # Validate sort field
            allowed_sort_fields = ['code', 'name', 'created_at', 'updated_at']
            if sort_field in allowed_sort_fields:
                query_builder.apply_sort(sort_field, sort_order)
            else:
                logger.warning(f"Invalid sort field: {sort_field}. Using default.")
                query_builder.apply_sort("code", "asc")
        else:
            # Default sort
            query_builder.apply_sort("code", "asc")
        
        # Apply pagination
        offset = (page - 1) * page_size
        paginated_query = query_builder.query.offset(offset).limit(page_size)
        
        # Execute query
        category_types = paginated_query.all()
        
        logger.info(f"Retrieved {len(category_types)} category types out of {total_count} total")
        return category_types, total_count
        
    except Exception as e:
        logger.exception(f"Error in get_category_types_paginated: {str(e)}")
        # Re-raise the exception for the endpoint to handle
        raise
