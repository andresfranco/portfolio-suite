from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any, Union, Literal, TypeVar, Generic
from app.schemas.language import LanguageOut

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
    """Generic schema for filtering skills"""
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

# --- SkillText Schemas ---

class SkillTextBase(BaseModel):
    """Base schema for skill text data"""
    language_id: int = Field(..., ge=1, description="ID of the language for this text")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the skill in this language")
    description: str = Field(..., description="Description of the skill in this language")

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Skill name cannot be empty or whitespace.')
        return v.strip()

class SkillTextCreate(SkillTextBase):
    """Schema for creating a new skill text"""
    pass

class SkillTextUpdate(BaseModel):
    """Schema for updating an existing skill text. All fields are optional."""
    language_id: Optional[int] = Field(None, ge=1, description="ID of the language for this text")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the skill in this language")
    description: Optional[str] = Field(None, description="Description of the skill in this language")
    
    # Validator to prevent setting empty strings if provided
    @field_validator('name')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
             raise ValueError('Name cannot be set to an empty string.')
        return v.strip() if v is not None else v

class SkillTextOut(SkillTextBase):
    """Schema for representing a skill text in API responses"""
    id: int
    language: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Skill Schemas ---

class SkillBase(BaseModel):
    """Base schema for skill data"""
    type_code: Optional[str] = Field(None, description="Code of the skill type")

class SkillCreate(SkillBase):
    """Schema for creating a new skill"""
    skill_texts: List[SkillTextCreate] = Field(..., min_length=1, description="List of skill texts (at least one required)")
    categories: Optional[List[int]] = Field(default=[], description="List of category IDs associated with this skill")
    
    @field_validator('skill_texts')
    @classmethod
    def validate_skill_texts(cls, v: List[SkillTextCreate]) -> List[SkillTextCreate]:
        if not v or len(v) == 0:
            raise ValueError('At least one skill text must be provided.')
        return v

class SkillUpdate(BaseModel):
    """Schema for updating an existing skill. All fields are optional."""
    type_code: Optional[str] = Field(None, description="Code of the skill type")
    skill_texts: Optional[List[SkillTextCreate]] = Field(None, description="List of skill texts to add or update")
    categories: Optional[List[int]] = Field(None, description="List of category IDs associated with this skill")
    removed_language_ids: Optional[List[int]] = Field(None, description="List of language IDs to remove texts for")

class Skill(SkillBase):
    """Schema for a skill with ORM mode configuration"""
    id: int
    type: Optional[str] = Field(None, description="Legacy field for backward compatibility")
    skill_texts: List[SkillTextOut] = []
    categories: List[Dict[str, Any]] = []
    skill_type: Optional[Dict[str, Any]] = None
    
    model_config = ConfigDict(from_attributes=True)

class SkillOut(Skill):
    """Schema for representing a skill in API responses"""
    pass

# Specific Paginated Response for Skills using the generic schema
PaginatedSkillResponse = PaginatedResponse[SkillOut]

# --- Response Schemas ---

class UniqueCheckResponse(BaseModel):
    """Schema for checking if a skill name is unique"""
    exists: bool
    name: str
    language_id: int

# --- Export Models ---

class SkillTextExportPydantic(BaseModel):
    """Model for skill text export format"""
    language_id: int
    name: str
    description: str
    
    model_config = ConfigDict(from_attributes=True)

class SkillExportPydantic(BaseModel):
    """Model for skill export format"""
    id: int
    type_code: str
    skill_texts: List[SkillTextExportPydantic]
    categories: List[Dict[str, Any]]
    
    model_config = ConfigDict(from_attributes=True)

# Legacy aliases for backward compatibility
SkillText = SkillTextOut