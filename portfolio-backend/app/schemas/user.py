from pydantic import BaseModel, EmailStr, field_validator, ConfigDict, Field
from typing import List, Optional, Dict, Any, Union, Literal, Generic, TypeVar
from datetime import datetime
import re

T = TypeVar('T')

class RoleBase(BaseModel):
    """Base schema for role data"""
    name: str

class RoleOut(RoleBase):
    """Schema for role data in responses"""
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    """Base schema for user data that is common to both creation and updating"""
    username: str
    email: EmailStr
    
    @field_validator('username')
    def username_alphanumeric(cls, v):
        """Validate username is alphanumeric with underscores and hyphens allowed"""
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username must contain only letters, numbers, underscores, and hyphens')
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        return v

class UserCreate(UserBase):
    """Schema for user creation"""
    password: str
    roles: Optional[List[int]] = []
    
    @field_validator('password')
    def password_strength(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[^A-Za-z0-9]', v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserOut(UserBase):
    """Schema for user responses"""
    id: int
    is_active: bool = True
    roles: List[RoleOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    """Schema for user update"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    roles: Optional[List[int]] = None
    is_active: Optional[bool] = None
    
    @field_validator('username')
    def username_alphanumeric(cls, v):
        """Validate username is alphanumeric with underscores and hyphens allowed"""
        if v is None:
            return v
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username must contain only letters, numbers, underscores, and hyphens')
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Username must be between 3 and 50 characters')
        return v
    
    @field_validator('roles')
    def roles_not_empty(cls, v):
        """Validate that at least one role is assigned if roles are provided"""
        if v is not None and len(v) == 0:
            raise ValueError('User must have at least one role')
        return v

class UserPasswordChange(BaseModel):
    """Schema for changing user password"""
    username: str
    password: str
    password_confirmation: str
    
    @field_validator('password')
    def password_strength(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r'[^A-Za-z0-9]', v):
            raise ValueError('Password must contain at least one special character')
        return v
    
    @field_validator('password_confirmation')
    def passwords_match(cls, v, info):
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v

class ForgotPasswordRequest(BaseModel):
    """Schema for password reset request"""
    email: EmailStr

class Filter(BaseModel):
    """Schema for filtering users
    
    This filter structure is used across modules to ensure consistent filtering approach
    and follows the standardized pattern implemented in the application.
    """
    field: str
    value: Any
    operator: Literal["contains", "eq", "equals", "startsWith", "endsWith", "in", "gt", "lt", "gte", "lte"] = "contains"
    
    @classmethod
    def from_params(cls, field: str, value: Any, operator: str = "contains") -> "Filter":
        """Create a Filter instance from parameters
        
        Args:
            field: The field to filter on
            value: The value to filter by
            operator: The operator to use
            
        Returns:
            A Filter instance
        """
        valid_operators = ["contains", "eq", "equals", "startsWith", "endsWith", "in", "gt", "lt", "gte", "lte"]
        if operator not in valid_operators:
            operator = "contains"  # Default to contains if invalid
            
        return cls(field=field, value=value, operator=operator)
    
    @classmethod
    def from_dict(cls, filter_dict: Dict[str, Any]) -> "Filter":
        """Create a Filter instance from a dictionary
        
        Args:
            filter_dict: Dictionary with 'field', 'value', and optionally 'operator' keys
            
        Returns:
            A Filter instance
            
        Raises:
            ValueError: If the dictionary is missing required keys
        """
        if 'field' not in filter_dict or 'value' not in filter_dict:
            raise ValueError("Filter dict must contain 'field' and 'value' keys")
            
        return cls(
            field=filter_dict['field'],
            value=filter_dict['value'],
            operator=filter_dict.get('operator', 'contains')
        )

# PaginatedResponse is a generic class for paginated responses
class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema with type parameter
    
    This schema is used for all paginated responses including users, roles, etc.
    """
    items: List[T]
    total: int
    page: int
    pageSize: int = Field(alias="page_size")  # Support both pageSize and page_size formats
    
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        from_attributes=True,
        populate_by_name=True  # Enable alias support
    )

# Type alias for paginated user responses
PaginatedUserResponse = PaginatedResponse[UserOut]

# For backward compatibility
class User(UserBase):
    """Full user schema with explicit ORM mode configuration
    Note: This is kept for backward compatibility, prefer using UserOut for new code
    """
    id: int
    roles: List[RoleOut] = []
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

# Aliases for backward compatibility
UserSchema = UserOut
Role = RoleOut