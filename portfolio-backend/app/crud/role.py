from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import asc, desc, func
from app.models.role import Role
from app.models.user import User
from app.models.permission import Permission
from app.schemas.role import RoleCreate, RoleUpdate, Filter
from app.crud import permission as permission_crud
from typing import List, Tuple, Optional, Dict, Any, Union
from fastapi import HTTPException
from app.core.logging import setup_logger
from app.api.utils.query_builder import QueryBuilder
from app.core.db import db_transaction

# Set up logger
logger = setup_logger("app.crud.role")

# Core roles definitions
ENHANCED_CORE_ROLES = [
    {
        "name": "System Administrator",
        "description": "Full system access including user management and system configuration",
        "permissions": ["SYSTEM_ADMIN"]  # This single permission grants everything
    },
    {
        "name": "Admin",
        "description": "Full administrative access to all system features and content management",
        "permissions": [
            # System admin access
            "SYSTEM_ADMIN",
            "VIEW_DASHBOARD",
            # User and role management permissions
            "VIEW_USERS", "CREATE_USER", "EDIT_USER", "DELETE_USER",
            "VIEW_ROLES", "VIEW_PERMISSIONS", "MANAGE_PERMISSIONS",
            # All content management permissions
            "VIEW_CATEGORIES", "CREATE_CATEGORY", "EDIT_CATEGORY", "DELETE_CATEGORY",
            "VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "EDIT_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE",
            "VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "EDIT_PORTFOLIO", "DELETE_PORTFOLIO", 
            "PUBLISH_PORTFOLIO", "MANAGE_PORTFOLIO_ATTACHMENTS",
            "VIEW_PROJECTS", "CREATE_PROJECT", "EDIT_PROJECT", "DELETE_PROJECT",
            "MANAGE_PROJECT_ATTACHMENTS", "ASSIGN_PROJECT_CATEGORIES",
            "VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES",
            "VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS",
            "VIEW_EXPERIENCES", "CREATE_EXPERIENCE", "EDIT_EXPERIENCE", "DELETE_EXPERIENCE",
            "VIEW_SKILLS", "CREATE_SKILL", "EDIT_SKILL", "DELETE_SKILL", "MANAGE_SKILL_CATEGORIES",
            "VIEW_SKILL_TYPES", "CREATE_SKILL_TYPE", "EDIT_SKILL_TYPE", "DELETE_SKILL_TYPE",
            "VIEW_LANGUAGES", "CREATE_LANGUAGE", "EDIT_LANGUAGE", "DELETE_LANGUAGE",
            "VIEW_SECTIONS", "CREATE_SECTION", "EDIT_SECTION", "DELETE_SECTION",
            "VIEW_TRANSLATIONS", "CREATE_TRANSLATION", "EDIT_TRANSLATION", "DELETE_TRANSLATION"
        ]
    },
    {
        "name": "Content Manager",
        "description": "Can manage all content but not user accounts or system settings",
        "permissions": [
            "VIEW_DASHBOARD",
            # Content management (create, edit, delete)
            "VIEW_CATEGORIES", "CREATE_CATEGORY", "EDIT_CATEGORY", "DELETE_CATEGORY",
            "VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "EDIT_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE",
            "VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "EDIT_PORTFOLIO", "DELETE_PORTFOLIO", 
            "PUBLISH_PORTFOLIO", "MANAGE_PORTFOLIO_ATTACHMENTS",
            "VIEW_PROJECTS", "CREATE_PROJECT", "EDIT_PROJECT", "DELETE_PROJECT",
            "MANAGE_PROJECT_ATTACHMENTS", "ASSIGN_PROJECT_CATEGORIES",
            "VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES", "MANAGE_PROJECT_IMAGES",
            "VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS", "MANAGE_PROJECT_ATTACHMENTS",
            "VIEW_EXPERIENCES", "CREATE_EXPERIENCE", "EDIT_EXPERIENCE", "DELETE_EXPERIENCE",
            "VIEW_SKILLS", "CREATE_SKILL", "EDIT_SKILL", "DELETE_SKILL", "MANAGE_SKILL_CATEGORIES",
            "VIEW_SKILL_TYPES", "CREATE_SKILL_TYPE", "EDIT_SKILL_TYPE", "DELETE_SKILL_TYPE",
            "VIEW_LANGUAGES", "CREATE_LANGUAGE", "EDIT_LANGUAGE", "DELETE_LANGUAGE",
            "VIEW_SECTIONS", "CREATE_SECTION", "EDIT_SECTION", "DELETE_SECTION",
            "VIEW_TRANSLATIONS", "CREATE_TRANSLATION", "EDIT_TRANSLATION", "DELETE_TRANSLATION"
        ]
    },
    {
        "name": "Editor",
        "description": "Can edit existing content but cannot create or delete content items",
        "permissions": [
            "VIEW_DASHBOARD",
            # Content editing (no create/delete)
            "VIEW_CATEGORIES", "EDIT_CATEGORY",
            "VIEW_CATEGORY_TYPES", "EDIT_CATEGORY_TYPE",
            "VIEW_PORTFOLIOS", "EDIT_PORTFOLIO", "MANAGE_PORTFOLIO_ATTACHMENTS",
            "VIEW_PROJECTS", "EDIT_PROJECT", "MANAGE_PROJECT_ATTACHMENTS", "ASSIGN_PROJECT_CATEGORIES",
            "VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES",
            "VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS",
            "VIEW_EXPERIENCES", "EDIT_EXPERIENCE",
            "VIEW_SKILLS", "EDIT_SKILL", "MANAGE_SKILL_CATEGORIES",
            "VIEW_SKILL_TYPES", "EDIT_SKILL_TYPE",
            "VIEW_LANGUAGES", "EDIT_LANGUAGE",
            "VIEW_SECTIONS", "EDIT_SECTION",
            "VIEW_TRANSLATIONS", "EDIT_TRANSLATION"
        ]
    },
    {
        "name": "Viewer",
        "description": "Read-only access to all content modules",
        "permissions": [
            "VIEW_DASHBOARD",
            # View-only access to all content
            "VIEW_CATEGORIES", "VIEW_CATEGORY_TYPES", "VIEW_PORTFOLIOS", "VIEW_PROJECTS",
            "VIEW_PROJECT_IMAGES", "VIEW_PROJECT_ATTACHMENTS",
            "VIEW_EXPERIENCES", "VIEW_SKILLS", "VIEW_SKILL_TYPES", "VIEW_LANGUAGES",
            "VIEW_SECTIONS", "VIEW_TRANSLATIONS"
        ]
    }
]

# Legacy roles for backward compatibility
CORE_ROLES = ENHANCED_CORE_ROLES

def get_role_by_id(db: Session, role_id: int, include_users_count: bool = True) -> Optional[Role]:
    """Get a role by ID, optionally including the count of associated users.
    
    Args:
        db: Database session
        role_id: The role ID to look up
        include_users_count: Whether to include the count of users associated with the role.
        
    Returns:
        The role object (potentially with users_count) or None if not found
    """
    logger.debug(f"Getting role with ID {role_id}, include_users_count={include_users_count}")
    
    query = db.query(Role)
    
    # Always load permissions
    query = query.options(selectinload(Role.permissions))
    
    if include_users_count:
        # Join with users and count them
        query = query.outerjoin(Role.users).group_by(Role.id)
        # Add the count to the select clause
        query = query.add_columns(func.count(User.id.distinct()).label('users_count'))

    result = query.filter(Role.id == role_id).first()
    
    if result and include_users_count:
        # The result is a tuple (Role, users_count)
        role, count = result
        role.users_count = count # Add the count to the model instance dynamically
        return role
    elif result: 
        # Result is just the Role object if count wasn't included
        return result 
    else:
        return None

def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    """Get a role by name.
    
    Args:
        db: Database session
        name: The role name to look up
        
    Returns:
        The role object or None if not found
    """
    logger.debug(f"Getting role by name: {name}")
    return db.query(Role).filter(Role.name == name).first()

def get_roles_by_names(db: Session, names: List[str]) -> List[Role]:
    """Get roles by their names.
    
    Args:
        db: Database session
        names: List of role names to look up
        
    Returns:
        List of matching Role objects
    """
    logger.debug(f"Getting roles by names: {names}")
    return db.query(Role).filter(Role.name.in_(names)).all()

@db_transaction
def create_role(db: Session, role_in: RoleCreate) -> Role:
    """Create a new role with the provided data.
    
    Args:
        db: Database session
        role_in: Role creation data
        
    Returns:
        The created Role object
        
    Raises:
        ValueError: If a role with the same name already exists
    """
    logger.debug(f"Creating new role: {role_in.name}")
    
    # Check if role with same name exists
    existing_role = get_role_by_name(db, role_in.name)
    if existing_role:
        logger.warning(f"Role with name '{role_in.name}' already exists")
        raise ValueError(f"Role with name '{role_in.name}' already exists")
    
    # Process permissions (convert names to objects)
    permissions = []
    if role_in.permissions:
        for perm_name in role_in.permissions:
            permission = db.query(Permission).filter(Permission.name == perm_name).first()
            if permission:
                permissions.append(permission)
            else:
                logger.warning(f"Permission '{perm_name}' not found when creating role")
    
    # Create role model instance
    db_role = Role(
        name=role_in.name,
        description=role_in.description,
        permissions=permissions
    )
    
    db.add(db_role)
    db.flush()  # Flush to get the ID but don't commit yet (handled by decorator)
    
    logger.info(f"Role '{db_role.name}' created with ID: {db_role.id}")
    return db_role

@db_transaction
def update_role(db: Session, role_id: int, role_in: RoleUpdate) -> Optional[Role]:
    """Update a role with the provided data.
    
    Args:
        db: Database session
        role_id: ID of the role to update
        role_in: Role update data
        
    Returns:
        The updated Role object or None if not found
        
    Raises:
        ValueError: If a role with the same name already exists (for another role)
    """
    logger.debug(f"Updating role with ID {role_id}")
    
    # Get the existing role
    db_role = get_role_by_id(db, role_id)
    if not db_role:
        logger.warning(f"Role with ID {role_id} not found for update")
        return None
    
    # Check for name conflicts if name is being updated
    if role_in.name is not None and role_in.name != db_role.name:
        existing_role = get_role_by_name(db, role_in.name)
        if existing_role and existing_role.id != role_id:
            logger.warning(f"Role with name '{role_in.name}' already exists")
            raise ValueError(f"Role with name '{role_in.name}' already exists")
    
    # Update fields if provided
    update_data = role_in.model_dump(exclude_unset=True)
    
    # Handle permissions separately
    if "permissions" in update_data:
        permission_names = update_data.pop("permissions", [])
        if permission_names is not None:
            # Convert names to Permission objects
            permissions = []
            for perm_name in permission_names:
                permission = db.query(Permission).filter(Permission.name == perm_name).first()
                if permission:
                    permissions.append(permission)
                else:
                    logger.warning(f"Permission '{perm_name}' not found when updating role")
            
            # Update the permissions relationship
            db_role.permissions = permissions
    
    # Update other fields
    for field, value in update_data.items():
        setattr(db_role, field, value)
    
    db.flush()  # Flush to ensure changes are visible but don't commit yet (handled by decorator)
    
    logger.info(f"Role '{db_role.name}' (ID: {db_role.id}) updated successfully")
    return db_role

@db_transaction
def delete_role(db: Session, role_id: int) -> Optional[Role]:
    """Delete a role if it's not associated with any users.
    
    Args:
        db: Database session
        role_id: ID of the role to delete
        
    Returns:
        The deleted Role object or None if not found
        
    Raises:
        ValueError: If the role is associated with any users
    """
    logger.debug(f"Deleting role with ID {role_id}")
    
    # Get the role with user count
    db_role = get_role_by_id(db, role_id, include_users_count=True)
    if not db_role:
        logger.warning(f"Role with ID {role_id} not found for deletion")
        return None
    
    # Check if role is associated with users
    user_count = getattr(db_role, 'users_count', 0)
    if user_count > 0:
        logger.warning(f"Cannot delete role '{db_role.name}': associated with {user_count} users")
        raise ValueError(f"Role '{db_role.name}' is currently assigned to {user_count} users and cannot be deleted")
    
    # Store role details for logging
    role_name = db_role.name
    
    # Delete the role
    db.delete(db_role)
    db.flush()  # Flush but don't commit (handled by decorator)
    
    logger.info(f"Role '{role_name}' (ID: {role_id}) deleted successfully")
    return db_role

@db_transaction
def initialize_core_roles(db: Session):
    """Initialize core roles if they don't exist.
    
    This function creates default roles for the system with appropriate permissions.
    Should be called during application startup.
    
    Args:
        db: Database session
    """
    logger.info("Initializing/Verifying core roles...")
    
    # First ensure all required permissions exist
    from app.crud.permission import initialize_core_permissions
    initialize_core_permissions(db)
    
    # Then create core roles
    count = 0
    for role_data in CORE_ROLES:
        role_name = role_data["name"]
        existing_role = get_role_by_name(db, role_name)
        
        if not existing_role:
            logger.debug(f"Creating core role: {role_name}")
            
            # Find permission objects for this role
            permissions = []
            for perm_name in role_data["permissions"]:
                perm = db.query(Permission).filter(Permission.name == perm_name).first()
                if perm:
                    permissions.append(perm)
                else:
                    logger.warning(f"Permission '{perm_name}' not found when initializing role '{role_name}'")
            
            # Create the role
            db_role = Role(
                name=role_name,
                description=role_data["description"],
                permissions=permissions
            )
            db.add(db_role)
            count += 1
        else:
            logger.debug(f"Core role '{role_name}' already exists")
    
    if count > 0:
        db.flush()
        logger.info(f"Created {count} new core roles")
    else:
        logger.info("All core roles already exist")
    
    logger.info("Core roles initialization complete")

def get_roles_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc"
) -> Tuple[List[Role], int]:
    """Get roles with pagination, filtering, and sorting.
    
    Args:
        db: Database session
        page: Page number (1-indexed)
        page_size: Number of roles per page
        filters: Optional list of filter objects
        sort_field: Optional field to sort by
        sort_order: Optional sort direction ('asc' or 'desc')
        
    Returns:
        Tuple of (list of roles, total count)
    """
    try:
        # Calculate offset from page number (1-indexed)
        offset = (page - 1) * page_size
        logger.debug(f"Getting paginated roles: page={page}, size={page_size}, offset={offset}")

        # Create base query
        query = db.query(Role)
        
        # Always eager load permissions
        query = query.options(selectinload(Role.permissions))
        
        # Join with users to be able to count associated users
        query = query.outerjoin(Role.users)
        query = query.group_by(Role.id)
        query = query.add_columns(func.count(User.id.distinct()).label("users_count"))
        
        logger.debug(f"Base query created with permissions and users_count")
        
        # Initialize QueryBuilder with the new flexible constructor
        builder = QueryBuilder(
            query_or_model=query,
            model=Role,
            db_session=db
        )
        
        # Initialize filter_dicts before checking filters
        filter_dicts = []
        
        # Variables to track special filters
        permissions_filters = []
        
        # Apply filters if provided
        if filters:
            logger.debug(f"Applying {len(filters)} filters")
            
            for filter_item in filters:
                if hasattr(filter_item, 'dict'):
                    filter_dict = filter_item.dict()
                elif isinstance(filter_item, dict):
                    filter_dict = filter_item
                elif hasattr(filter_item, 'field') and hasattr(filter_item, 'value'):
                    filter_dict = {
                        'field': filter_item.field,
                        'value': filter_item.value,
                        'operator': getattr(filter_item, 'operator', 'contains')
                    }
                else:
                    logger.warning(f"Skipping invalid filter: {filter_item}")
                    continue
                
                # Handle special filters
                if filter_dict['field'] == 'permissions':
                    # Save permission filters for special handling
                    permissions_filters.append(filter_dict)
                else:
                    # Add regular filters to the list
                    filter_dicts.append(filter_dict)
            
            # Apply regular filters
            if filter_dicts:
                builder.apply_filters(filter_dicts)
            
            # Special handling for permissions filters
            if permissions_filters:
                # Track whether we've already joined permissions to avoid duplicate joins
                permissions_join_applied = False
                for perm_filter in permissions_filters:
                    perm_values = perm_filter['value']
                    operator = perm_filter.get('operator', 'in')

                    if not isinstance(perm_values, list):
                        perm_values = [perm_values]

                    logger.debug(f"Filtering roles by permissions: {perm_values}, operator: {operator}")

                    if not permissions_join_applied:
                        builder.query = builder.query.join(Role.permissions)
                        permissions_join_applied = True

                    if operator == 'in':
                        builder.query = builder.query.filter(Permission.name.in_(perm_values))
                    elif operator == 'notin':
                        builder.query = builder.query.filter(~Permission.name.in_(perm_values))
                    else:
                        logger.warning(f"Unsupported operator '{operator}' for permissions filter. Using 'in' instead.")
                        builder.query = builder.query.filter(Permission.name.in_(perm_values))

                # Ensure distinct roles when permissions filtering applied
                builder.query = builder.query.distinct()
        
        # Apply sorting
        allowed_sort_fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'users_count']
        if sort_field:
            if sort_field in allowed_sort_fields:
                logger.debug(f"Applying sort: field={sort_field}, order={sort_order}")
                builder.apply_sort(sort_field, sort_order)
            else:
                logger.warning(f"Invalid sort field requested: {sort_field}. Using default sort.")
                # Use default sorting
                builder.apply_sort('name', 'asc')
        else:
            # Default sort by name
            builder.apply_sort('name', 'asc')
        
        # Get the final query
        final_query = builder.get_query()
        
        # Calculate total count using a subquery approach instead of with_only_columns
        count_subquery = db.query(func.count(func.distinct(Role.id)))
        count_subquery = count_subquery.select_from(Role)
        
        # Apply the same filters to the count query if needed
        if filter_dicts:
            count_builder = QueryBuilder(
                query_or_model=count_subquery,
                model=Role,
                db_session=db
            )
            count_builder.apply_filters(filter_dicts)
            count_subquery = count_builder.get_query()

        # Apply permissions filters to count as well (to keep totals accurate)
        if permissions_filters:
            permissions_join_applied = False
            for perm_filter in permissions_filters:
                perm_values = perm_filter['value']
                operator = perm_filter.get('operator', 'in')
                if not isinstance(perm_values, list):
                    perm_values = [perm_values]

                if not permissions_join_applied:
                    count_subquery = count_subquery.join(Role.permissions)
                    permissions_join_applied = True

                if operator == 'in':
                    count_subquery = count_subquery.filter(Permission.name.in_(perm_values))
                elif operator == 'notin':
                    count_subquery = count_subquery.filter(~Permission.name.in_(perm_values))
                else:
                    count_subquery = count_subquery.filter(Permission.name.in_(perm_values))
        
        total = count_subquery.scalar() or 0
        logger.debug(f"Total roles count: {total}")
        
        # Apply pagination
        results = final_query.offset(offset).limit(page_size).all()
        logger.debug(f"Query returned {len(results)} results")
        
        # Process results
        roles = []
        for role_tuple in results:
            role, users_count = role_tuple
            # Add the count directly to the role object
            role.users_count = users_count
            roles.append(role)
        
        logger.info(f"Returning {len(roles)} roles (total: {total}) for page {page}")
        return roles, total
    except Exception as e:
        logger.error(f"Error in get_roles_paginated: {str(e)}", exc_info=True)
        raise

def get_role(db: Session, role_id: int) -> Optional[Role]:
    """Get a role by ID.
    
    Args:
        db: Database session
        role_id: The role ID to look up
        
    Returns:
        The role object or None if not found
    """
    logger.debug(f"Getting role with ID {role_id}")
    return get_role_by_id(db, role_id, include_users_count=True)
