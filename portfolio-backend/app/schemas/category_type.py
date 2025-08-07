from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any, Union, Literal, ClassVar, TypeVar, Generic
from app.schemas.language import LanguageOut

# Generic type variable
T = TypeVar('T')

# --- Generic Schemas ---

class Filter(BaseModel):
    """Generic schema for filtering category types"""
    field: str
    value: Any # Value can be of any type for filtering flexibility
    operator: Literal['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startswith', 'endswith', 'in', 'notin'] = 'eq'
    
    @field_validator('operator')
    @classmethod
    def validate_operator_for_value(cls, op, values):
        value = values.data.get('value')
        if op in ('in', 'notin') and not isinstance(value, list):
            raise ValueError(f"Operator '{op}' requires the value to be a list.")
        if op not in ('in', 'notin') and isinstance(value, list):
             raise ValueError(f"Operator '{op}' cannot be used with a list value.")
        return op
        
    @classmethod
    def from_params(cls, field: str, value: Any, operator: str = 'eq'):
        """
        Create a Filter instance from parameters.
        
        Args:
            field: The field to filter on
            value: The value to filter with
            operator: The operator to use (default: 'eq')
            
        Returns:
            Filter instance
        """
        return cls(field=field, value=value, operator=operator)

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic schema for paginated responses"""
    items: List[T]
    total: int
    page: int = Field(1, ge=1)  # Must be at least 1
    pageSize: int = Field(10, ge=1)  # Must be at least 1

# --- CategoryType Specific Schemas ---

class CategoryTypeBase(BaseModel):
    """Base schema for category type data"""
    code: str = Field(..., min_length=1, max_length=5, description="Unique code for the category type (max 5 chars)")
    name: str = Field(..., min_length=1, max_length=100, description="Human-readable name for the category type")

    @field_validator('code')
    @classmethod
    def code_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Category type code cannot be empty or whitespace.')
        return v.strip().upper()  # Trim whitespace and convert to uppercase
        
    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Category type name cannot be empty or whitespace.')
        return v.strip()  # Trim whitespace

class CategoryTypeCreate(CategoryTypeBase):
    """Schema for creating a new category type"""
    # Inherits fields and validation from CategoryTypeBase
    pass

class CategoryTypeUpdate(BaseModel):
    """Schema for updating an existing category type. All fields are optional."""
    code: Optional[str] = Field(None, min_length=1, max_length=5)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    
    # Validator to prevent setting empty strings if provided
    @field_validator('code', 'name')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Field cannot be set to an empty string.')
        return v.strip() if v is not None else v

class CategoryType(CategoryTypeBase):
    """Schema for category type with ORM mode configuration"""
    model_config = ConfigDict(from_attributes=True)

class CategoryTypeOut(CategoryType):
    """Schema for representing a category type in API responses"""
    pass

# Specific Paginated Response for CategoryTypes using the generic schema
PaginatedCategoryTypeResponse = PaginatedResponse[CategoryTypeOut]
