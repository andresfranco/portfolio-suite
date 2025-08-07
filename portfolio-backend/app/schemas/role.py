from pydantic import BaseModel, field_validator, ConfigDict, Field
from typing import List, Optional, Literal, Generic, TypeVar, Any
from datetime import datetime

T = TypeVar('T')

# --- Generic Schemas ---

class Filter(BaseModel):
    """Generic schema for filtering"""
    field: str
    value: Any # Value can be of any type for filtering flexibility
    operator: Literal['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startswith', 'endswith', 'in', 'notin'] = 'eq'
    
    @field_validator('operator')
    @classmethod
    def validate_operator_for_value(cls, op, values):
        """Validate operator is appropriate for the value type"""
        value = values.data.get('value')
        if op in ('in', 'notin') and not isinstance(value, list):
            raise ValueError(f"Operator '{op}' requires the value to be a list.")
        if op not in ('in', 'notin') and isinstance(value, list):
             raise ValueError(f"Operator '{op}' cannot be used with a list value.")
        return op

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic schema for paginated responses"""
    items: List[T]
    total: int
    page: int = 1
    page_size: int = 10

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        from_attributes=True
    )

# --- Role Specific Schemas ---

class RoleBase(BaseModel):
    """Base schema for role data"""
    name: str = Field(..., min_length=3, max_length=50)
    description: str = Field(..., max_length=255)
    permissions: List[str] = Field(default_factory=list, description="List of permission names")

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Role name cannot be empty or whitespace.')
        return v.strip() # Trim whitespace

class RoleCreate(RoleBase):
    """Schema for creating a new role"""
    # Inherits all fields and validation from RoleBase
    pass

class RoleUpdate(BaseModel):
    """Schema for updating an existing role. All fields are optional."""
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    permissions: Optional[List[str]] = None

    # Validator to prevent setting empty strings if provided
    @field_validator('name', 'description', mode='before')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Field cannot be set to an empty string.')
        return v.strip() if v else v

class RoleOut(BaseModel):
    """Schema for representing a role in API responses"""
    id: int
    name: str
    description: str
    permissions: List[str]
    users_count: int = 0 # Add count of users with this role

    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        """Customize the validation to use permission_names."""
        # If object is already a dictionary, use it directly
        if isinstance(obj, dict):
            return super().model_validate(obj, *args, **kwargs)
        
        # For model objects with permission_names property
        if hasattr(obj, 'permission_names'):
            # Create a dict with all attributes we need
            obj_dict = {
                'id': getattr(obj, 'id', None),
                'name': getattr(obj, 'name', ''),
                'description': getattr(obj, 'description', ''),
                'permissions': obj.permission_names,
                'users_count': getattr(obj, 'users_count', 0)
            }
            # Validate using the dictionary
            return super().model_validate(obj_dict, *args, **kwargs)
        return super().model_validate(obj, *args, **kwargs)

# Specific Paginated Response for Roles using the generic schema
PaginatedRoleResponse = PaginatedResponse[RoleOut]

# --- Deprecated ---
# The RoleFilter alias is replaced by the generic Filter
RoleFilter = Filter