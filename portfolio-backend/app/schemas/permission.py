from pydantic import BaseModel, field_validator, ConfigDict, conint, Field
from typing import List, Optional, Literal, Any, ClassVar, TypeVar, Generic

# Generic type variable
T = TypeVar('T')

# --- Generic Schemas ---

class Filter(BaseModel):
    """Generic schema for filtering"""
    field: str
    value: Any # Value can be of any type for filtering flexibility
    operator: Literal['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startswith', 'endswith', 'in', 'notin'] = 'eq'
    
    # Placeholder for validation, specific validation might be needed per module
    @field_validator('operator')
    @classmethod
    def validate_operator_for_value(cls, op, values):
        value = values.data.get('value')
        if op in ('in', 'notin') and not isinstance(value, list):
            raise ValueError(f"Operator '{op}' requires the value to be a list.")
        if op not in ('in', 'notin') and isinstance(value, list):
             raise ValueError(f"Operator '{op}' cannot be used with a list value.")
        # Add more specific type checks if needed (e.g., gt/lt require numbers)
        return op

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic schema for paginated responses"""
    items: List[T]
    total: int
    page: conint(ge=1) = 1
    page_size: conint(ge=1) = 10

# --- Permission Specific Schemas ---

class PermissionBase(BaseModel):
    """Base schema for permission data"""
    name: str = Field(..., min_length=3, max_length=50)
    description: str = Field(..., max_length=255)

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Permission name cannot be empty or whitespace.')
        return v.strip() # Trim whitespace

class PermissionCreate(PermissionBase):
    """Schema for creating a new permission"""
    # Inherits fields and validation from PermissionBase
    pass

class PermissionUpdate(BaseModel):
    """Schema for updating an existing permission. All fields are optional."""
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=255)

    # Optional validator if needed to ensure at least one field is provided
    # @root_validator(skip_on_failure=True)
    # def check_at_least_one_field(cls, values):
    #     if not any(values.values()):
    #         raise ValueError("At least one field must be provided for update")
    #     return values
    
    # Validator to prevent setting empty strings if provided
    @field_validator('name', 'description', mode='before')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Field cannot be set to an empty string.')
        return v.strip() if v else v


class PermissionOut(PermissionBase):
    """Schema for representing a permission in API responses"""
    id: int
    roles_count: int = 0 # Add count of associated roles
    roles: List[str] = Field(default_factory=list, description="List of role names")

    model_config = ConfigDict(from_attributes=True)
    
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        """Customize the validation to use role_names."""
        # If object is already a dictionary, use it directly
        if isinstance(obj, dict):
            return super().model_validate(obj, *args, **kwargs)
            
        # For model objects with role_names property
        if hasattr(obj, 'role_names'):
            # Create a dict with all attributes we need
            obj_dict = {
                'id': getattr(obj, 'id', None),
                'name': getattr(obj, 'name', ''),
                'description': getattr(obj, 'description', ''),
                'roles': obj.role_names,
                'roles_count': getattr(obj, 'roles_count', 0)
            }
            # Validate using the dictionary
            return super().model_validate(obj_dict, *args, **kwargs)
        return super().model_validate(obj, *args, **kwargs)


# Specific Paginated Response for Permissions using the generic schema
PaginatedPermissionResponse = PaginatedResponse[PermissionOut]

# --- Deprecated ---
# The old Filter and PaginatedPermissionResponse are removed.
# The alias Permission = PermissionOut is removed.