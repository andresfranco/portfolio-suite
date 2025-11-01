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
        """Check if user has specific permission or a manage permission that grants it"""
        print(f"\n{'='*60}")
        print(f"PERMISSION CHECK: {required_permission}")
        print(f"User: {user.username}")
        print(f"Is System Admin Check:")
        print(f"  - Username in system_admin_users: {user.username in self.system_admin_users}")
        
        # System admin bypass
        is_admin = self.is_system_admin(user)
        print(f"  - Has SYSTEM_ADMIN permission: {is_admin}")
        
        if is_admin:
            print(f"✓ SYSTEM ADMIN BYPASS - GRANTED ACCESS")
            print(f"{'='*60}\n")
            logger.debug(f"System admin {user.username} granted access to {required_permission}")
            return True
        
        print(f"User Roles: {[role.name for role in user.roles]}")
        print(f"User Permissions: {[perm.name for role in user.roles for perm in role.permissions]}")
        print(f"{'='*60}\n")
        
        # Define manage permissions that grant multiple permissions
        manage_permissions = {
            "MANAGE_ROLES": ["VIEW_ROLES", "CREATE_ROLE", "EDIT_ROLE", "DELETE_ROLE"],
            "MANAGE_USERS": ["VIEW_USERS", "CREATE_USER", "EDIT_USER", "DELETE_USER"],
            "MANAGE_PERMISSIONS": ["VIEW_PERMISSIONS", "CREATE_PERMISSION", "EDIT_PERMISSION", "DELETE_PERMISSION"],
            "MANAGE_SKILLS": ["VIEW_SKILLS", "CREATE_SKILL", "EDIT_SKILL", "DELETE_SKILL"],
            "MANAGE_SKILL_TYPES": ["VIEW_SKILL_TYPES", "CREATE_SKILL_TYPE", "EDIT_SKILL_TYPE", "DELETE_SKILL_TYPE"],
            "MANAGE_CATEGORIES": ["VIEW_CATEGORIES", "CREATE_CATEGORY", "EDIT_CATEGORY", "DELETE_CATEGORY"],
            "MANAGE_CATEGORY_TYPES": ["VIEW_CATEGORY_TYPES", "CREATE_CATEGORY_TYPE", "EDIT_CATEGORY_TYPE", "DELETE_CATEGORY_TYPE"],
            "MANAGE_PORTFOLIOS": [
                "VIEW_PORTFOLIOS", "CREATE_PORTFOLIO", "EDIT_PORTFOLIO", "DELETE_PORTFOLIO",
                # include portfolio image/attachment granular rights under manage portfolios umbrella
                "VIEW_PORTFOLIO_IMAGES", "UPLOAD_PORTFOLIO_IMAGES", "EDIT_PORTFOLIO_IMAGES", "DELETE_PORTFOLIO_IMAGES",
                "VIEW_PORTFOLIO_ATTACHMENTS", "UPLOAD_PORTFOLIO_ATTACHMENTS", "EDIT_PORTFOLIO_ATTACHMENTS", "DELETE_PORTFOLIO_ATTACHMENTS"
            ],
            "MANAGE_PROJECTS": ["VIEW_PROJECTS", "CREATE_PROJECT", "EDIT_PROJECT", "DELETE_PROJECT", "VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES", "VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS"],
            "MANAGE_PROJECT_IMAGES": ["VIEW_PROJECT_IMAGES", "UPLOAD_PROJECT_IMAGES", "EDIT_PROJECT_IMAGES", "DELETE_PROJECT_IMAGES"],
            "MANAGE_PROJECT_ATTACHMENTS": ["VIEW_PROJECT_ATTACHMENTS", "UPLOAD_PROJECT_ATTACHMENTS", "EDIT_PROJECT_ATTACHMENTS", "DELETE_PROJECT_ATTACHMENTS"],
            "MANAGE_PORTFOLIO_IMAGES": ["VIEW_PORTFOLIO_IMAGES", "UPLOAD_PORTFOLIO_IMAGES", "EDIT_PORTFOLIO_IMAGES", "DELETE_PORTFOLIO_IMAGES"],
            "MANAGE_PORTFOLIO_ATTACHMENTS": ["VIEW_PORTFOLIO_ATTACHMENTS", "UPLOAD_PORTFOLIO_ATTACHMENTS", "EDIT_PORTFOLIO_ATTACHMENTS", "DELETE_PORTFOLIO_ATTACHMENTS"],
            "MANAGE_EXPERIENCES": ["VIEW_EXPERIENCES", "CREATE_EXPERIENCE", "EDIT_EXPERIENCE", "DELETE_EXPERIENCE"],
            "MANAGE_LANGUAGES": ["VIEW_LANGUAGES", "CREATE_LANGUAGE", "EDIT_LANGUAGE", "DELETE_LANGUAGE"],
            "MANAGE_SECTIONS": ["VIEW_SECTIONS", "CREATE_SECTION", "EDIT_SECTION", "DELETE_SECTION"],
            "MANAGE_TRANSLATIONS": ["VIEW_TRANSLATIONS", "CREATE_TRANSLATION", "EDIT_TRANSLATION", "DELETE_TRANSLATION"],
        }
        
        # Get all user permissions
        user_permissions = set()
        for role in user.roles:
            for permission in role.permissions:
                user_permissions.add(permission.name)
        
        # Check if user has the required permission directly
        if required_permission in user_permissions:
            logger.debug(f"User {user.username} has required permission {required_permission}")
            return True
        
        # Check if user has a manage permission that grants the required permission
        for manage_perm, granted_permissions in manage_permissions.items():
            if manage_perm in user_permissions and required_permission in granted_permissions:
                logger.debug(f"User {user.username} has manage permission {manage_perm} which grants {required_permission}")
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