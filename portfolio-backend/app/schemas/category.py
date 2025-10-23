from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any, Union, Literal, TypeVar, Generic
from app.schemas.language import LanguageOut
from app.schemas.category_type import CategoryType

# Generic type variable
T = TypeVar('T')

# --- Generic Schemas (consistent with other modules) ---

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic schema for paginated responses"""
    items: List[T]
    total: int
    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(10, ge=1, description="Number of items per page")

class Filter(BaseModel):
    """Generic schema for filtering categories"""
    field: str = Field(..., description="Field name to filter on")
    value: Any = Field(..., description="Value to filter with") # Value can be of any type for filtering flexibility
    operator: Literal["contains", "equals", "startsWith", "endsWith", "eq", "neq", "gt", "gte", "lt", "lte", "in", "notin"] = Field("contains", description="Filter operator to apply")
    language_id: Optional[int] = Field(None, description="Optional language ID for text-based filters (name, description)")

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
    def from_params(cls, field: str, value: Any, operator: str = "contains", language_id: Optional[int] = None) -> "Filter":
        """
        Create a Filter instance from parameters.
        
        Args:
            field: The field to filter on
            value: The value to filter with
            operator: The operator to use (default: "contains")
            language_id: Optional language ID for text-based filters
            
        Returns:
            Filter instance
        """
        return cls(field=field, value=value, operator=operator, language_id=language_id)

# --- CategoryText Schemas ---

class CategoryTextBase(BaseModel):
    """Base schema for category text data"""
    language_id: int = Field(..., ge=1, description="ID of the language for this text")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the category in this language")
    description: str = Field(..., description="Description of the category in this language")

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Category name cannot be empty or whitespace.')
        return v.strip()

class CategoryTextCreate(CategoryTextBase):
    """Schema for creating a new category text"""
    pass

class CategoryTextUpdate(BaseModel):
    """Schema for updating an existing category text. All fields are optional."""
    language_id: Optional[int] = Field(None, ge=1, description="ID of the language for this text")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the category in this language")
    description: Optional[str] = Field(None, description="Description of the category in this language")
    
    # Validator to prevent setting empty strings if provided
    @field_validator('name')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Name cannot be set to an empty string.')
        return v.strip() if v is not None else v

class CategoryTextOut(CategoryTextBase):
    """Schema for representing a category text in API responses"""
    id: int
    language: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Category Schemas ---

class CategoryBase(BaseModel):
    """Base schema for category data"""
    code: str = Field(..., min_length=1, max_length=50, description="Unique code for the category")
    type_code: str = Field("GEN", description="Code of the category type")

    @field_validator('code')
    @classmethod
    def code_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Category code cannot be empty or whitespace.')
        return v.strip()

class CategoryCreate(CategoryBase):
    """Schema for creating a new category"""
    category_texts: List[CategoryTextCreate] = Field(..., min_length=1, description="List of category texts (at least one required)")
    
    @field_validator('category_texts')
    @classmethod
    def validate_category_texts(cls, v: List[CategoryTextCreate]) -> List[CategoryTextCreate]:
        if not v or len(v) == 0:
            raise ValueError('At least one category text must be provided.')
        return v

class CategoryUpdate(BaseModel):
    """Schema for updating an existing category. All fields are optional."""
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="Unique code for the category")
    type_code: Optional[str] = Field(None, description="Code of the category type")
    category_texts: Optional[List[CategoryTextCreate]] = Field(None, description="List of category texts to add or update")
    removed_language_ids: Optional[List[int]] = Field(None, description="List of language IDs to remove texts for")
    
    # Validator to prevent setting empty strings if provided
    @field_validator('code')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Code cannot be set to an empty string.')
        return v.strip() if v is not None else v

class Category(CategoryBase):
    """Schema for a category with ORM mode configuration"""
    id: int
    category_texts: List[CategoryTextOut] = []
    
    model_config = ConfigDict(from_attributes=True)

class CategoryOut(Category):
    """Schema for representing a category in API responses"""
    pass

# Specific Paginated Response for Categories using the generic schema
PaginatedCategoryResponse = PaginatedResponse[CategoryOut]

# --- Export Models ---

class CategoryTextExportPydantic(BaseModel):
    """Model for category text export format"""
    language_id: int
    name: str
    description: str
    
    model_config = ConfigDict(from_attributes=True)

class CategoryExportPydantic(BaseModel):
    """Model for category export format"""
    id: int
    code: str
    type_code: str
    category_texts: List[CategoryTextExportPydantic]
    
    model_config = ConfigDict(from_attributes=True)

class PROICategory(BaseModel):
    """
    Model for Project ROI (Region of Interest) Categories used for image categorization
    """
    id: int
    code: str = Field(..., description="Format: 'PROI-NAME' (e.g., 'PROI-GALLERY', 'PROI-DIAGRAM')")
    display_name: str
    
    model_config = ConfigDict(from_attributes=True)

# Alias for backward compatibility
CategoryText = CategoryTextOut