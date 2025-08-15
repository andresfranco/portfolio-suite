from sqlalchemy.orm import Session, joinedload, contains_eager, selectinload
from sqlalchemy import asc, desc, or_, and_, cast, String, func, select
from app.models.permission import Permission
from app.models.role import Role # Import Role for relationship counting
from app.schemas.permission import PermissionCreate, PermissionUpdate, Filter as PermissionFilter
from typing import List, Tuple, Optional, Dict, Any
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.core.db import db_transaction # Import db_transaction

# Set up logger
logger = setup_logger("app.crud.permission")

# --- CRUD Operations ---

def get_permission_by_id(db: Session, permission_id: int, include_roles_count: bool = True) -> Optional[Permission]:
    """Get a permission by ID, optionally including the count of associated roles.
    
    Args:
        db: Database session
        permission_id: The permission ID to look up
        include_roles_count: Whether to include the count of roles associated with the permission.
        
    Returns:
        The permission object (potentially with roles_count) or None if not found
    """
    logger.debug(f"Getting permission with ID {permission_id}, include_roles_count={include_roles_count}")
    
    query = db.query(Permission).options(selectinload(Permission.roles))
    if include_roles_count:
        # Join with roles and count them
        query = query.outerjoin(Permission.roles).group_by(Permission.id)
        # Add the count to the select clause
        query = query.add_columns(func.count(Role.id).label('roles_count'))

    result = query.filter(Permission.id == permission_id).first()
    
    if result and include_roles_count:
        # The result is a tuple (Permission, roles_count)
        permission, count = result
        permission.roles_count = count # Add the count to the model instance dynamically
        return permission
    elif result: 
        # Result is just the Permission object if count wasn't included
        return result 
    else:
        return None


def get_permission_by_name(db: Session, name: str) -> Optional[Permission]:
    """Get a permission by name.
    
    Args:
        db: Database session
        name: The permission name to look up
        
    Returns:
        The permission object or None if not found
    """
    logger.debug(f"Getting permission by name: {name}")
    return db.query(Permission).options(selectinload(Permission.roles)).filter(Permission.name == name).first()


def get_permissions_by_names(db: Session, names: List[str]) -> List[Permission]:
    """Get permissions by their names.
    
    Args:
        db: Database session
        names: List of permission names to look up
        
    Returns:
        List of matching permission objects
    """
    logger.debug(f"Getting permissions by names: {names}")
    return db.query(Permission).options(selectinload(Permission.roles)).filter(Permission.name.in_(names)).all()

@db_transaction
def create_permission(db: Session, permission_in: PermissionCreate) -> Permission:
    """Create a new permission.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        permission_in: The permission data to create (Pydantic schema)
        
    Returns:
        The created Permission SQLAlchemy object
        
    Raises:
        ValueError: If a permission with the same name already exists.
        Exception: If there's a database error during creation.
    """
    logger.debug(f"Attempting to create permission: {permission_in.name}")
    existing_permission = get_permission_by_name(db, permission_in.name)
    if existing_permission:
        logger.warning(f"Permission with name '{permission_in.name}' already exists.")
        raise ValueError(f"Permission with name '{permission_in.name}' already exists.")
        
    db_permission = Permission(**permission_in.model_dump())
    db.add(db_permission)
    db.flush() # Flush to get the ID before returning
    db.refresh(db_permission)
    logger.info(f"Permission '{db_permission.name}' (ID: {db_permission.id}) created successfully.")
    return db_permission

@db_transaction
def update_permission(db: Session, permission_id: int, permission_in: PermissionUpdate) -> Optional[Permission]:
    """Update an existing permission.
    
    Args:
        db: Database session (passed by db_transaction decorator)
        permission_id: ID of the permission to update
        permission_in: Permission update data (Pydantic schema with optional fields)
        
    Returns:
        Updated Permission SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If trying to update name to one that already exists.
        Exception: If there's a database error during update.
    """
    logger.debug(f"Attempting to update permission ID {permission_id} with data: {permission_in.model_dump(exclude_unset=True)}")
    db_permission = get_permission_by_id(db, permission_id, include_roles_count=False) # Don't need count here
    if not db_permission:
        logger.warning(f"Permission not found for update: {permission_id}")
        return None

    update_data = permission_in.model_dump(exclude_unset=True)

    # Check if name is being updated and if it conflicts
    if "name" in update_data and update_data["name"] != db_permission.name:
        existing_permission = get_permission_by_name(db, update_data["name"])
        if existing_permission and existing_permission.id != permission_id:
            logger.warning(f"Cannot update permission ID {permission_id}: name '{update_data['name']}' already exists.")
            raise ValueError(f"Permission name '{update_data['name']}' already exists.")

    # Update fields
    for field, value in update_data.items():
        setattr(db_permission, field, value)
        
    db.add(db_permission) # Add to session to mark as dirty
    db.flush()
    db.refresh(db_permission)
    logger.info(f"Permission '{db_permission.name}' (ID: {permission_id}) updated successfully.")
    return db_permission

@db_transaction
def delete_permission(db: Session, permission_id: int) -> Optional[Permission]:
    """Delete a permission.
    
    Note: This relies on database cascade or relationship settings to handle 
          associations (e.g., removing permission from roles).

    Args:
        db: Database session (passed by db_transaction decorator)
        permission_id: ID of the permission to delete
        
    Returns:
        The deleted Permission SQLAlchemy object or None if not found
        
    Raises:
        ValueError: If the permission is associated with any roles
        Exception: If there's a database error during deletion.
    """
    logger.debug(f"Attempting to delete permission with ID {permission_id}")
    db_permission = get_permission_by_id(db, permission_id, include_roles_count=True) # Get with roles count
    if not db_permission:
        logger.warning(f"Permission not found for deletion: {permission_id}")
        return None
    
    # Enforce validation to prevent deletion of permissions associated with roles
    if hasattr(db_permission, 'roles_count') and db_permission.roles_count > 0:
        logger.warning(f"Cannot delete permission ID {permission_id}: it is associated with {db_permission.roles_count} roles.")
        raise ValueError(f"Permission '{db_permission.name}' is currently associated with {db_permission.roles_count} roles and cannot be deleted. Remove this permission from all roles first.")

    # Alternatively, check the roles relationship directly for extra certainty
    if db_permission.roles and len(db_permission.roles) > 0:
        logger.warning(f"Cannot delete permission ID {permission_id}: it is associated with {len(db_permission.roles)} roles.")
        raise ValueError(f"Permission '{db_permission.name}' is currently associated with roles and cannot be deleted. Remove this permission from all roles first.")

    deleted_name = db_permission.name # Store name for logging before deletion
    db.delete(db_permission)
    db.flush()
    logger.info(f"Permission '{deleted_name}' (ID: {permission_id}) deleted successfully.")
    # Return the object as it was before deletion for potential use in response
    # The object state might be unpredictable after commit, but contains the ID/data.
    return db_permission

def get_permissions_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[PermissionFilter]] = None,
    sort_field: Optional[str] = None,
    sort_order: str = "asc",
    custom_filter = None
) -> Tuple[List[Permission], int]:
    """Get paginated permissions with filtering, sorting, and roles count.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of items per page
        filters: List of filter specifications (Pydantic PermissionFilter models)
        sort_field: Field to sort by (e.g., 'name', 'description', 'id', 'roles_count')
        sort_order: Sort direction ('asc' or 'desc')
        custom_filter: Optional function that takes a query and returns a filtered query
        
    Returns:
        Tuple of (list of Permission objects with roles_count, total_count)
    """
    logger.debug(f"Getting paginated permissions: page={page}, page_size={page_size}, filters={filters}, sort={sort_field} {sort_order}")
    
    try:
        # Base query with roles count calculation and eager loading of roles
        base_query = db.query(
            Permission,
            func.count(Role.id).label('roles_count')
        ).options(
            selectinload(Permission.roles)  # Eagerly load the roles relationship
        ).outerjoin(Permission.roles).group_by(Permission.id)
        
        logger.debug(f"Base query created with roles_count and eager loading")
        
        # Use the QueryBuilder with the new flexible constructor
        query_builder = QueryBuilder(
            query_or_model=base_query,
            model=Permission,
            db_session=db
        )
        logger.debug(f"QueryBuilder initialized with base query")
        
        # Apply custom filter if provided
        if custom_filter:
            query_builder.query = custom_filter(query_builder.query)
            logger.debug(f"Applied custom filter to query")
            
        # Convert Pydantic Filter models to dictionaries for QueryBuilder
        filter_dicts = []
        if filters:
            for f in filters:
                if hasattr(f, 'dict'):
                    filter_dicts.append(f.dict())
                elif isinstance(f, dict):
                    filter_dicts.append(f)
                else:
                    logger.warning(f"Skipping invalid filter: {f}")
        
        if filter_dicts:
            logger.debug(f"Applying filters: {filter_dicts}")
            query_builder.apply_filters(filter_dicts)
        
        # Apply sorting - allow sorting by roles_count
        allowed_sort_fields = ['id', 'name', 'description', 'roles_count']
        if sort_field:
            if sort_field in allowed_sort_fields:
                logger.debug(f"Applying sort: {sort_field} {sort_order}")
                query_builder.apply_sort(sort_field, sort_order)
            else:
                logger.warning(f"Invalid sort field: {sort_field}. Using default 'name'")
                query_builder.apply_sort('name', 'asc')
        else:
            # Default sort
            query_builder.apply_sort('name', 'asc')
        
        # Get the final query
        final_query = query_builder.get_query()
        
        # Calculate total count using a subquery approach instead of with_only_columns
        count_subquery = db.query(func.count(func.distinct(Permission.id)))
        count_subquery = count_subquery.select_from(Permission)
        count_subquery = count_subquery.outerjoin(Permission.roles)
        
        # Apply the same filters to the count query
        if filter_dicts:
            count_builder = QueryBuilder(
                query_or_model=count_subquery,
                model=Permission,
                db_session=db
            )
            count_builder.apply_filters(filter_dicts)
            count_subquery = count_builder.get_query()
        
        total_count = count_subquery.scalar() or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        results = final_query.offset(offset).limit(page_size).all()
        
        # Process results: Each item in 'results' is a tuple (Permission, roles_count)
        permissions_with_count = []
        for permission, count in results:
            permission.roles_count = count  # Add the count to the instance
            permissions_with_count.append(permission)
            
        logger.debug(f"Processed {len(permissions_with_count)} permission results with roles_count")
        logger.info(f"Returning {len(permissions_with_count)} permissions (total: {total_count}) for page {page}")
        return permissions_with_count, total_count
    except Exception as e:
        logger.exception(f"Error in get_permissions_paginated: {str(e)}")
        # Re-raise the exception for the endpoint to handle
        raise

# --- Deprecated/Utility --- 

def get_permissions(db: Session, skip: int = 0, limit: int = 100) -> List[Permission]:
    """Get a simple list of permissions without pagination complexities.
    
    Args:
        db: Database session
        skip: Number of items to skip (for offset)
        limit: Maximum number of items to return
        
    Returns:
        List of Permission objects
    """
    try:
        logger.debug(f"Getting permissions with skip={skip}, limit={limit}")
        return db.query(Permission).options(
            selectinload(Permission.roles)
        ).order_by(Permission.name.asc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error retrieving permissions: {str(e)}", exc_info=True)
        # Return empty list instead of raising to prevent 500 errors
        # This is used by the get_all_permission_names endpoint which should be robust
        return []


# --- Initialization (Consider moving to migrations/startup) ---
COMPREHENSIVE_PERMISSIONS = [
    # System Administration
    {"name": "SYSTEM_ADMIN", "description": "Full system administrative access"},
    {"name": "VIEW_DASHBOARD", "description": "View system dashboard"},
    
    # User Management Module
    {"name": "VIEW_USERS", "description": "View user list and user details"},
    {"name": "CREATE_USER", "description": "Create new users"},
    {"name": "EDIT_USER", "description": "Edit existing user details"},
    {"name": "DELETE_USER", "description": "Delete users"},
    {"name": "ASSIGN_USER_ROLES", "description": "Assign roles to users"},
    {"name": "RESET_USER_PASSWORD", "description": "Reset user passwords"},
    {"name": "ACTIVATE_DEACTIVATE_USER", "description": "Activate or deactivate user accounts"},
    
    # Role Management Module
    {"name": "VIEW_ROLES", "description": "View role list and role details"},
    {"name": "CREATE_ROLE", "description": "Create new roles"},
    {"name": "EDIT_ROLE", "description": "Edit existing role details"},
    {"name": "DELETE_ROLE", "description": "Delete roles"},
    {"name": "MANAGE_ROLES", "description": "Full management of roles (create, edit, delete, view)"},
    {"name": "ASSIGN_ROLE_PERMISSIONS", "description": "Assign permissions to roles"},
    
    # Permission Management Module
    {"name": "VIEW_PERMISSIONS", "description": "View permission list and permission details"},
    {"name": "CREATE_PERMISSION", "description": "Create new permissions"},
    {"name": "EDIT_PERMISSION", "description": "Edit existing permission details"},
    {"name": "DELETE_PERMISSION", "description": "Delete permissions"},
    {"name": "MANAGE_PERMISSIONS", "description": "Full permission management access (grants all permission operations)"},
    
    # Category Management Module
    {"name": "VIEW_CATEGORIES", "description": "View category list and category details"},
    {"name": "CREATE_CATEGORY", "description": "Create new categories"},
    {"name": "EDIT_CATEGORY", "description": "Edit existing category details"},
    {"name": "DELETE_CATEGORY", "description": "Delete categories"},
    
    # Category Type Management Module
    {"name": "VIEW_CATEGORY_TYPES", "description": "View category type list and details"},
    {"name": "CREATE_CATEGORY_TYPE", "description": "Create new category types"},
    {"name": "EDIT_CATEGORY_TYPE", "description": "Edit existing category type details"},
    {"name": "DELETE_CATEGORY_TYPE", "description": "Delete category types"},
    
    # Portfolio Management Module
    {"name": "VIEW_PORTFOLIOS", "description": "View portfolio list and portfolio details"},
    {"name": "CREATE_PORTFOLIO", "description": "Create new portfolios"},
    {"name": "EDIT_PORTFOLIO", "description": "Edit existing portfolio details"},
    {"name": "DELETE_PORTFOLIO", "description": "Delete portfolios"},
    {"name": "PUBLISH_PORTFOLIO", "description": "Publish and unpublish portfolios"},
    # Portfolio Images Sub-module
    {"name": "VIEW_PORTFOLIO_IMAGES", "description": "View portfolio images"},
    {"name": "UPLOAD_PORTFOLIO_IMAGES", "description": "Upload new portfolio images"},
    {"name": "EDIT_PORTFOLIO_IMAGES", "description": "Edit portfolio images (rename, update metadata)"},
    {"name": "DELETE_PORTFOLIO_IMAGES", "description": "Delete portfolio images"},
    {"name": "MANAGE_PORTFOLIO_IMAGES", "description": "Full management of portfolio images (upload, edit, delete, organize)"},

    # Portfolio Attachments Sub-module
    {"name": "VIEW_PORTFOLIO_ATTACHMENTS", "description": "View portfolio attachments"},
    {"name": "UPLOAD_PORTFOLIO_ATTACHMENTS", "description": "Upload new portfolio attachments"},
    {"name": "EDIT_PORTFOLIO_ATTACHMENTS", "description": "Edit portfolio attachments (rename, update metadata)"},
    {"name": "DELETE_PORTFOLIO_ATTACHMENTS", "description": "Delete portfolio attachments"},
    {"name": "MANAGE_PORTFOLIO_ATTACHMENTS", "description": "Full management of portfolio attachments (upload, edit, delete, organize)"},
    
    # Project Management Module
    {"name": "VIEW_PROJECTS", "description": "View project list and project details"},
    {"name": "CREATE_PROJECT", "description": "Create new projects"},
    {"name": "EDIT_PROJECT", "description": "Edit existing project details"},
    {"name": "DELETE_PROJECT", "description": "Delete projects"},
    {"name": "MANAGE_PROJECT_ATTACHMENTS", "description": "Upload and manage project attachments"},
    {"name": "ASSIGN_PROJECT_CATEGORIES", "description": "Assign categories to projects"},
    
    # Project Images Sub-module
    {"name": "VIEW_PROJECT_IMAGES", "description": "View project images"},
    {"name": "UPLOAD_PROJECT_IMAGES", "description": "Upload new project images"},
    {"name": "EDIT_PROJECT_IMAGES", "description": "Edit project images (rename, update metadata)"},
    {"name": "DELETE_PROJECT_IMAGES", "description": "Delete project images"},
    {"name": "MANAGE_PROJECT_IMAGES", "description": "Full management of project images (upload, edit, delete, organize)"},
    
    # Project Attachments Sub-module  
    {"name": "VIEW_PROJECT_ATTACHMENTS", "description": "View project attachments"},
    {"name": "UPLOAD_PROJECT_ATTACHMENTS", "description": "Upload new project attachments"},
    {"name": "EDIT_PROJECT_ATTACHMENTS", "description": "Edit project attachments (rename, update metadata)"},
    {"name": "DELETE_PROJECT_ATTACHMENTS", "description": "Delete project attachments"},
    {"name": "MANAGE_PROJECT_ATTACHMENTS", "description": "Full management of project attachments (upload, edit, delete, organize)"},
    
    # Experience Management Module
    {"name": "VIEW_EXPERIENCES", "description": "View experience list and experience details"},
    {"name": "CREATE_EXPERIENCE", "description": "Create new work experiences"},
    {"name": "EDIT_EXPERIENCE", "description": "Edit existing experience details"},
    {"name": "DELETE_EXPERIENCE", "description": "Delete work experiences"},
    
    # Skill Management Module
    {"name": "VIEW_SKILLS", "description": "View skill list and skill details"},
    {"name": "CREATE_SKILL", "description": "Create new skills"},
    {"name": "EDIT_SKILL", "description": "Edit existing skill details"},
    {"name": "DELETE_SKILL", "description": "Delete skills"},
    {"name": "MANAGE_SKILL_CATEGORIES", "description": "Assign skills to categories"},
    
    # Skill Type Management Module
    {"name": "VIEW_SKILL_TYPES", "description": "View skill type list and details"},
    {"name": "CREATE_SKILL_TYPE", "description": "Create new skill types"},
    {"name": "EDIT_SKILL_TYPE", "description": "Edit existing skill type details"},
    {"name": "DELETE_SKILL_TYPE", "description": "Delete skill types"},
    
    # Language Management Module
    {"name": "VIEW_LANGUAGES", "description": "View language list and language details"},
    {"name": "CREATE_LANGUAGE", "description": "Create new languages"},
    {"name": "EDIT_LANGUAGE", "description": "Edit existing language details"},
    {"name": "DELETE_LANGUAGE", "description": "Delete languages"},
    
    # Section Management Module
    {"name": "VIEW_SECTIONS", "description": "View section list and section details"},
    {"name": "CREATE_SECTION", "description": "Create new sections"},
    {"name": "EDIT_SECTION", "description": "Edit existing section details"},
    {"name": "DELETE_SECTION", "description": "Delete sections"},
    
    # Translation Management Module
    {"name": "VIEW_TRANSLATIONS", "description": "View translation list and translation details"},
    {"name": "CREATE_TRANSLATION", "description": "Create new translations"},
    {"name": "EDIT_TRANSLATION", "description": "Edit existing translation details"},
    {"name": "DELETE_TRANSLATION", "description": "Delete translations"}
]

# Legacy permissions for backward compatibility
CORE_PERMISSIONS = COMPREHENSIVE_PERMISSIONS

@db_transaction
def initialize_core_permissions(db: Session):
    """Initialize core permissions if they don't exist.
    
    Args:
        db: Database session (passed by db_transaction)
    """
    logger.info("Initializing/Verifying core permissions...")
    count = 0
    for perm_data in CORE_PERMISSIONS:
        if not get_permission_by_name(db, perm_data["name"]):
            logger.debug(f"Creating core permission: {perm_data['name']}")
            db_permission = Permission(**perm_data)
            db.add(db_permission)
            count += 1
    if count > 0:
        db.flush() # Flush only if changes were made
        logger.info(f"Created {count} new core permissions.")
    else:
        logger.info("All core permissions already exist.")
    logger.info("Core permissions initialization complete.")