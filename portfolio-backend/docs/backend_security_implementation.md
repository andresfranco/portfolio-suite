# Backend Security Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for securing the backend API with role-based access control (RBAC), ensuring that only authorized users can access specific endpoints and perform CRUD operations. This plan complements the frontend security implementation and provides the foundation for a secure portfolio management system.

## Current Backend Security Analysis

### ✅ Strengths
- **JWT Authentication**: Robust JWT-based authentication with OAuth2 scheme
- **Password Security**: Bcrypt hashing with complexity validation
- **RBAC Database Structure**: Well-designed roles and permissions models
- **Transaction Safety**: Proper database transaction handling
- **Comprehensive Logging**: Extensive logging throughout the application

### ❌ Critical Security Gaps
- **No Authorization Enforcement**: Endpoints only check authentication, not permissions
- **Missing Permission Decorators**: No systematic permission checking
- **Incomplete systemadmin Implementation**: No special privileges for system admin
- **No Rate Limiting**: Vulnerable to brute force attacks
- **Missing Security Audit Trail**: No tracking of authorization failures

## Backend Security Implementation

### 1. Core Authorization Infrastructure

#### 1.1 Create `app/core/security_decorators.py`

```python
import asyncio
from functools import wraps
from typing import List, Callable, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.logging import setup_logger

logger = setup_logger("app.core.security_decorators")

class PermissionChecker:
    """Centralized permission checking logic with systemadmin support"""
    
    def __init__(self):
        self.system_admin_users = ["systemadmin"]
        self.super_admin_permission = "SYSTEM_ADMIN"
    
    def is_system_admin(self, user: User) -> bool:
        """Check if user is systemadmin or has SYSTEM_ADMIN permission"""
        # Direct systemadmin user check
        if user.username in self.system_admin_users:
            return True
        
        # Check for SYSTEM_ADMIN permission
        for role in user.roles:
            for permission in role.permissions:
                if permission.name == self.super_admin_permission:
                    return True
        
        return False
    
    def user_has_permission(self, user: User, required_permission: str) -> bool:
        """Check if user has specific permission"""
        # System admin bypass
        if self.is_system_admin(user):
            logger.debug(f"System admin {user.username} granted access to {required_permission}")
            return True
        
        # Regular permission check
        for role in user.roles:
            for permission in role.permissions:
                if permission.name == required_permission:
                    logger.debug(f"User {user.username} has required permission {required_permission}")
                    return True
        
        logger.debug(f"User {user.username} lacks permission {required_permission}")
        return False
    
    def user_has_any_permission(self, user: User, required_permissions: List[str]) -> bool:
        """Check if user has any of the required permissions"""
        if self.is_system_admin(user):
            return True
        
        return any(self.user_has_permission(user, perm) for perm in required_permissions)
    
    def user_has_all_permissions(self, user: User, required_permissions: List[str]) -> bool:
        """Check if user has all required permissions"""
        if self.is_system_admin(user):
            return True
        
        return all(self.user_has_permission(user, perm) for perm in required_permissions)

# Global permission checker instance
permission_checker = PermissionChecker()

def require_permission(permission: str):
    """Decorator to require specific permission for endpoint access"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from dependency injection
            current_user = None
            
            # Find current_user in kwargs (from Depends injection)
            for key, value in kwargs.items():
                if isinstance(value, User):
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if not permission_checker.user_has_permission(current_user, permission):
                logger.warning(f"User {current_user.username} denied access to {permission}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {permission}"
                )
            
            return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        return wrapper
    return decorator

def require_any_permission(permissions: List[str]):
    """Decorator to require any of the specified permissions"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = None
            for key, value in kwargs.items():
                if isinstance(value, User):
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if not permission_checker.user_has_any_permission(current_user, permissions):
                logger.warning(f"User {current_user.username} denied access. Required any of: {permissions}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required any of: {', '.join(permissions)}"
                )
            
            return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        return wrapper
    return decorator

def require_system_admin():
    """Decorator to require system admin access"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = None
            for key, value in kwargs.items():
                if isinstance(value, User):
                    current_user = value
                    break
            
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            if not permission_checker.is_system_admin(current_user):
                logger.warning(f"User {current_user.username} denied system admin access")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="System administrator access required"
                )
            
            return await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
        return wrapper
    return decorator
```

#### 1.2 Enhanced Permission System

Update `app/crud/permission.py` with comprehensive permissions:

```python
# Enhanced permission set for comprehensive module coverage
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
    {"name": "ASSIGN_ROLE_PERMISSIONS", "description": "Assign permissions to roles"},
    
    # Permission Management Module
    {"name": "VIEW_PERMISSIONS", "description": "View permission list and permission details"},
    {"name": "CREATE_PERMISSION", "description": "Create new permissions"},
    {"name": "EDIT_PERMISSION", "description": "Edit existing permission details"},
    {"name": "DELETE_PERMISSION", "description": "Delete permissions"},
    
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
    {"name": "MANAGE_PORTFOLIO_ATTACHMENTS", "description": "Upload and manage portfolio attachments"},
    
    # Project Management Module
    {"name": "VIEW_PROJECTS", "description": "View project list and project details"},
    {"name": "CREATE_PROJECT", "description": "Create new projects"},
    {"name": "EDIT_PROJECT", "description": "Edit existing project details"},
    {"name": "DELETE_PROJECT", "description": "Delete projects"},
    {"name": "MANAGE_PROJECT_ATTACHMENTS", "description": "Upload and manage project attachments"},
    {"name": "ASSIGN_PROJECT_CATEGORIES", "description": "Assign categories to projects"},
    
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

# Enhanced role definitions with comprehensive permissions
ENHANCED_CORE_ROLES = [
    {
        "name": "System Administrator",
        "description": "Full system access including user management and system configuration",
        "permissions": ["SYSTEM_ADMIN"]  # This single permission grants everything
    },
    {
        "name": "Administrator",
        "description": "Full access to all content management features",
        "permissions": [
            "VIEW_DASHBOARD",
            # All content management permissions
            "VIEW_CATEGORIES", "CREATE_CATEGORY", "EDIT_CATEGORY", "DELETE_CATEGORY",
            "VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "EDIT_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE",
            "VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "EDIT_PORTFOLIO", "DELETE_PORTFOLIO", 
            "PUBLISH_PORTFOLIO", "MANAGE_PORTFOLIO_ATTACHMENTS",
            "VIEW_PROJECTS", "CREATE_PROJECT", "EDIT_PROJECT", "DELETE_PROJECT",
            "MANAGE_PROJECT_ATTACHMENTS", "ASSIGN_PROJECT_CATEGORIES",
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
            "VIEW_EXPERIENCES", "VIEW_SKILLS", "VIEW_SKILL_TYPES", "VIEW_LANGUAGES",
            "VIEW_SECTIONS", "VIEW_TRANSLATIONS"
        ]
    }
]
```

### 2. Apply Authorization to API Endpoints

#### 2.1 User Management Endpoints

Update `app/api/endpoints/users.py`:

```python
from app.core.security_decorators import require_permission, require_any_permission, require_system_admin

@router.get("/", response_model=schemas.PaginatedResponse[schemas.UserOut])
@require_permission("VIEW_USERS")
def read_users(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    filters: str = Query(None)
):
    """Retrieve users with pagination, sorting, and filtering."""
    try:
        # Parse filters
        filter_list = []
        if filters:
            try:
                filter_list = json.loads(filters)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid filter format"
                )
        
        # Get users with pagination
        users_data = crud.user.get_users_paginated(
            db=db,
            page=page,
            page_size=page_size,
            filters=filter_list
        )
        
        return users_data
    
    except Exception as e:
        logger.error(f"Error retrieving users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.post("/", response_model=schemas.UserOut, status_code=201)
@require_permission("CREATE_USER")
def create_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Create a new user."""
    try:
        # Check if username already exists
        if crud.user.get_user_by_username(db, username=user_data.username):
            raise HTTPException(
                status_code=400,
                detail="Username already registered"
            )
        
        # Check if email already exists
        if crud.user.get_user_by_email(db, email=user_data.email):
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        # Create user
        user = crud.user.create_user(db=db, user_data=user_data)
        
        logger.info(f"User {user.username} created by {current_user.username}")
        return user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.put("/{user_id}", response_model=schemas.UserOut)
@require_permission("EDIT_USER")
def update_user(
    user_id: int,
    user_data: schemas.UserUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Update an existing user."""
    try:
        # Get user
        user = crud.user.get_user_by_id(db, user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Prevent systemadmin modification by non-system admins
        if user.username == "systemadmin" and not permission_checker.is_system_admin(current_user):
            raise HTTPException(
                status_code=403,
                detail="Cannot modify system administrator account"
            )
        
        # Update user
        updated_user = crud.user.update_user(db=db, user_id=user_id, user_data=user_data)
        
        logger.info(f"User {user.username} updated by {current_user.username}")
        return updated_user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.delete("/{user_id}", status_code=204)
@require_permission("DELETE_USER")
def delete_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Delete a user."""
    try:
        # Get user
        user = crud.user.get_user_by_id(db, user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Prevent systemadmin deletion
        if user.username == "systemadmin":
            raise HTTPException(
                status_code=403,
                detail="Cannot delete system administrator account"
            )
        
        # Prevent self-deletion
        if user.id == current_user.id:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete your own account"
            )
        
        # Delete user
        crud.user.delete_user(db=db, user_id=user_id)
        
        logger.info(f"User {user.username} deleted by {current_user.username}")
        return Response(status_code=204)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

# Additional endpoint for frontend to get user permissions
@router.get("/me/permissions", response_model=schemas.UserPermissionsOut)
def get_current_user_permissions(
    current_user: models.User = Depends(deps.get_current_user)
):
    """Get current user's permissions and roles."""
    try:
        permissions = []
        roles = []
        
        # Check if user is system admin
        if permission_checker.is_system_admin(current_user):
            # System admin gets all permissions
            permissions = [perm["name"] for perm in COMPREHENSIVE_PERMISSIONS]
        else:
            # Regular user permissions
            for role in current_user.roles:
                roles.append({"id": role.id, "name": role.name})
                for permission in role.permissions:
                    if permission.name not in permissions:
                        permissions.append(permission.name)
        
        return {
            "permissions": permissions,
            "roles": roles
        }
    
    except Exception as e:
        logger.error(f"Error getting user permissions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )

@router.get("/{user_id}/permissions", response_model=schemas.UserPermissionsOut)
@require_permission("VIEW_USERS")
def get_user_permissions(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Get specific user's permissions and roles."""
    try:
        # Get user
        user = crud.user.get_user_by_id(db, user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        permissions = []
        roles = []
        
        # Check if user is system admin
        if permission_checker.is_system_admin(user):
            # System admin gets all permissions
            permissions = [perm["name"] for perm in COMPREHENSIVE_PERMISSIONS]
        else:
            # Regular user permissions
            for role in user.roles:
                roles.append({"id": role.id, "name": role.name})
                for permission in role.permissions:
                    if permission.name not in permissions:
                        permissions.append(permission.name)
        
        return {
            "permissions": permissions,
            "roles": roles
        }
    
    except Exception as e:
        logger.error(f"Error getting user permissions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        )
```

#### 2.2 Category Management Endpoints

Update `app/api/endpoints/categories.py`:

```python
from app.core.security_decorators import require_permission

@router.get("/", response_model=schemas.PaginatedResponse[schemas.CategoryOut])
@require_permission("VIEW_CATEGORIES")
def read_categories(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    filters: str = Query(None)
):
    """Retrieve categories with pagination, sorting, and filtering."""
    # Implementation remains the same

@router.post("/", response_model=schemas.CategoryOut, status_code=201)
@require_permission("CREATE_CATEGORY")
def create_category(
    category_data: schemas.CategoryCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Create a new category."""
    # Implementation remains the same

@router.put("/{category_id}", response_model=schemas.CategoryOut)
@require_permission("EDIT_CATEGORY")
def update_category(
    category_id: int,
    category_data: schemas.CategoryUpdate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Update an existing category."""
    # Implementation remains the same

@router.delete("/{category_id}", status_code=204)
@require_permission("DELETE_CATEGORY")
def delete_category(
    category_id: int,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user)
):
    """Delete a category."""
    # Implementation remains the same
```

### 3. Security Audit and Logging

#### 3.1 Create `app/core/audit_logger.py`

```python
import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.logging import setup_logger
from app.models.user import User

logger = setup_logger("app.core.audit_logger")

class SecurityAuditLogger:
    """Centralized security audit logging"""
    
    def __init__(self):
        self.logger = logger
    
    def log_login_attempt(self, username: str, success: bool, ip_address: str = None, 
                         user_agent: str = None, additional_info: Dict[str, Any] = None):
        """Log login attempt with details"""
        log_data = {
            "event_type": "LOGIN_ATTEMPT",
            "username": username,
            "success": success,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow().isoformat(),
            "additional_info": additional_info or {}
        }
        
        if success:
            self.logger.info(f"Successful login: {username} from {ip_address}")
        else:
            self.logger.warning(f"Failed login attempt: {username} from {ip_address}")
        
        # Log detailed information for audit trail
        self.logger.info(f"LOGIN_AUDIT: {json.dumps(log_data)}")
    
    def log_permission_denied(self, user: User, required_permission: str, 
                            endpoint: str = None, ip_address: str = None):
        """Log permission denied events"""
        log_data = {
            "event_type": "PERMISSION_DENIED",
            "user_id": user.id,
            "username": user.username,
            "required_permission": required_permission,
            "endpoint": endpoint,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.warning(f"Permission denied: {user.username} attempted {required_permission}")
        self.logger.warning(f"PERMISSION_AUDIT: {json.dumps(log_data)}")
    
    def log_admin_action(self, admin_user: User, action: str, target: str = None,
                        details: Dict[str, Any] = None, ip_address: str = None):
        """Log administrative actions"""
        log_data = {
            "event_type": "ADMIN_ACTION",
            "admin_user_id": admin_user.id,
            "admin_username": admin_user.username,
            "action": action,
            "target": target,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.info(f"Admin action: {admin_user.username} performed {action} on {target}")
        self.logger.info(f"ADMIN_AUDIT: {json.dumps(log_data)}")
    
    def log_security_event(self, event_type: str, user: User = None, 
                          details: Dict[str, Any] = None, ip_address: str = None):
        """Log general security events"""
        log_data = {
            "event_type": event_type,
            "user_id": user.id if user else None,
            "username": user.username if user else None,
            "details": details or {},
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.logger.warning(f"Security event: {event_type}")
        self.logger.warning(f"SECURITY_AUDIT: {json.dumps(log_data)}")

# Global audit logger instance
audit_logger = SecurityAuditLogger()
```

#### 3.2 Create `app/core/rate_limiter.py`

```python
import time
from typing import Dict, Optional
from collections import defaultdict, deque
from fastapi import Request
from app.core.logging import setup_logger

logger = setup_logger("app.core.rate_limiter")

class RateLimiter:
    """Rate limiting implementation for API endpoints"""
    
    def __init__(self):
        # Store request timestamps for each client
        self.request_history: Dict[str, deque] = defaultdict(deque)
        self.failed_logins: Dict[str, deque] = defaultdict(deque)
        self.login_attempts: Dict[str, deque] = defaultdict(deque)
        
        # Rate limits (requests per time window)
        self.GENERAL_RATE_LIMIT = 1000  # requests per hour
        self.LOGIN_RATE_LIMIT = 10      # login attempts per 15 minutes
        self.FAILED_LOGIN_LIMIT = 5     # failed logins per 15 minutes
        
        # Time windows in seconds
        self.GENERAL_WINDOW = 3600      # 1 hour
        self.LOGIN_WINDOW = 900         # 15 minutes
        self.FAILED_LOGIN_WINDOW = 900  # 15 minutes
    
    def get_client_identifier(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Use IP address as primary identifier
        client_ip = request.client.host
        
        # Could be enhanced with user ID if authenticated
        return client_ip
    
    def _cleanup_old_requests(self, request_queue: deque, window: int):
        """Remove old requests outside the time window"""
        current_time = time.time()
        while request_queue and current_time - request_queue[0] > window:
            request_queue.popleft()
    
    def check_general_rate_limit(self, client_id: str) -> bool:
        """Check if client has exceeded general rate limit"""
        current_time = time.time()
        request_queue = self.request_history[client_id]
        
        # Clean old requests
        self._cleanup_old_requests(request_queue, self.GENERAL_WINDOW)
        
        # Check if limit exceeded
        if len(request_queue) >= self.GENERAL_RATE_LIMIT:
            logger.warning(f"Rate limit exceeded for client {client_id}")
            return False
        
        # Add current request
        request_queue.append(current_time)
        return True
    
    def check_login_rate_limit(self, client_id: str) -> bool:
        """Check if client has exceeded login rate limit"""
        current_time = time.time()
        login_queue = self.login_attempts[client_id]
        
        # Clean old attempts
        self._cleanup_old_requests(login_queue, self.LOGIN_WINDOW)
        
        # Check if limit exceeded
        if len(login_queue) >= self.LOGIN_RATE_LIMIT:
            logger.warning(f"Login rate limit exceeded for client {client_id}")
            return False
        
        return True
    
    def check_failed_login_limit(self, client_id: str) -> bool:
        """Check if client has exceeded failed login limit"""
        current_time = time.time()
        failed_queue = self.failed_logins[client_id]
        
        # Clean old failures
        self._cleanup_old_requests(failed_queue, self.FAILED_LOGIN_WINDOW)
        
        # Check if limit exceeded
        if len(failed_queue) >= self.FAILED_LOGIN_LIMIT:
            logger.warning(f"Failed login limit exceeded for client {client_id}")
            return False
        
        return True
    
    def record_login_attempt(self, client_id: str):
        """Record a login attempt"""
        current_time = time.time()
        self.login_attempts[client_id].append(current_time)
    
    def record_failed_login(self, client_id: str):
        """Record a failed login attempt"""
        current_time = time.time()
        self.failed_logins[client_id].append(current_time)

# Global rate limiter instance
rate_limiter = RateLimiter()
```

### 4. Enhanced Authentication Endpoint

Update `app/api/endpoints/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from datetime import timedelta
from app.core.security_decorators import permission_checker
from app.core.audit_logger import audit_logger
from app.core.rate_limiter import rate_limiter
from app.auth.jwt import create_access_token, verify_password
from app.core.config import settings
from app.models.user import User
from app.core.logging import setup_logger

logger = setup_logger("app.api.endpoints.auth")

@router.post("/login")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(deps.get_db)
):
    """Enhanced OAuth2 login with security features"""
    
    # Get client information
    client_ip = request.client.host
    user_agent = request.headers.get("user-agent", "unknown")
    client_id = rate_limiter.get_client_identifier(request)
    
    # Apply rate limiting
    if not rate_limiter.check_general_rate_limit(client_id):
        audit_logger.log_security_event(
            "RATE_LIMIT_EXCEEDED",
            details={"limit_type": "general", "client_id": client_id},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
    
    if not rate_limiter.check_login_rate_limit(client_id):
        audit_logger.log_security_event(
            "LOGIN_RATE_LIMIT_EXCEEDED",
            details={"client_id": client_id},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )
    
    if not rate_limiter.check_failed_login_limit(client_id):
        audit_logger.log_security_event(
            "FAILED_LOGIN_LIMIT_EXCEEDED",
            details={"client_id": client_id},
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )
    
    # Record login attempt
    rate_limiter.record_login_attempt(client_id)
    
    try:
        # Find user by username
        user = db.query(User).filter(User.username == form_data.username).first()
        
        # Validate username and password
        if not user or not verify_password(form_data.password, user.hashed_password):
            # Record failed attempt
            rate_limiter.record_failed_login(client_id)
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "invalid_credentials"}
            )
            
            logger.warning(f"Failed login attempt for username: {form_data.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Incorrect username or password"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            audit_logger.log_login_attempt(
                form_data.username, False, client_ip, user_agent,
                {"reason": "account_inactive"}
            )
            logger.warning(f"Inactive user attempted login: {user.username} from IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Account is inactive"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        # Log successful login
        audit_logger.log_login_attempt(
            user.username, True, client_ip, user_agent,
            {"user_id": user.id}
        )
        
        logger.info(f"Successful login: {user.username} from IP: {client_ip}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active
            }
        }
    
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
```

### 5. Database Schema Updates

#### 5.1 Create User Permissions Schema

Add to `app/schemas/user.py`:

```python
from typing import List, Optional
from pydantic import BaseModel

class UserPermissionsOut(BaseModel):
    permissions: List[str] = []
    roles: List[dict] = []
    
    class Config:
        from_attributes = True
```

### 6. Implementation Checklist

#### 6.1 Backend Security Tasks

- [ ] **Create Core Security Infrastructure**
  - [ ] Implement `app/core/security_decorators.py`
  - [ ] Create `app/core/audit_logger.py`
  - [ ] Create `app/core/rate_limiter.py`
  - [ ] Add enhanced permission system

- [ ] **Apply Authorization to API Endpoints**
  - [ ] Update `app/api/endpoints/users.py` with permission decorators
  - [ ] Update `app/api/endpoints/roles.py` with permission decorators
  - [ ] Update `app/api/endpoints/permissions.py` with permission decorators
  - [ ] Update all content module endpoints

- [ ] **Enhance Authentication**
  - [ ] Update `app/api/endpoints/auth.py` with rate limiting
  - [ ] Add permission endpoints for frontend integration
  - [ ] Add security audit logging

- [ ] **Database and Initialization**
  - [ ] Update permission definitions in `app/crud/permission.py`
  - [ ] Update role definitions in `app/crud/role.py`
  - [ ] Ensure systemadmin user gets System Administrator role

#### 6.2 Integration Requirements

- [ ] **Frontend Integration Endpoints**
  - [ ] Add `/auth/me/permissions` endpoint
  - [ ] Add `/users/{id}/permissions` endpoint
  - [ ] Ensure proper 403 Forbidden responses

- [ ] **Security Event Monitoring**
  - [ ] Implement audit logging for all security events
  - [ ] Add rate limiting to prevent abuse
  - [ ] Create security monitoring dashboard

## Success Criteria

The backend security implementation is complete when:

- ✅ **systemadmin user has unrestricted access** to all endpoints
- ✅ **All API endpoints require appropriate permissions** 
- ✅ **Permission decorators are applied** to all endpoint functions
- ✅ **Rate limiting prevents brute force attacks**
- ✅ **Security audit logging captures all events**
- ✅ **Frontend integration endpoints** provide user permissions
- ✅ **Comprehensive testing validates security functionality**

This backend security implementation provides the foundation for the frontend security system, ensuring that authorization is enforced at the API level while providing the necessary endpoints for frontend permission checking. 