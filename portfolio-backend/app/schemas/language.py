from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime

class Filter(BaseModel):
    """Model for filter parameters in queries"""
    field: str
    value: Any
    operator: str = "eq"
    
    @classmethod
    def from_params(cls, field: str, value: Any, operator: str = "eq") -> "Filter":
        """
        Create a Filter instance from request parameters
        
        Args:
            field: The field to filter on
            value: The value to filter by
            operator: The operator to use (eq, ne, gt, lt, etc.)
            
        Returns:
            Filter instance
        """
        # Validate the operator
        valid_operators = ["eq", "ne", "gt", "lt", "ge", "le", "in", "not_in", "contains", "starts_with", "ends_with"]
        if operator not in valid_operators:
            raise ValueError(f"Invalid operator '{operator}'. Must be one of: {', '.join(valid_operators)}")
        
        # Convert boolean values from strings
        if value in ["true", "false"]:
            value = value.lower() == "true"
            
        # Handle array values for 'in' operator
        if operator == "in" and isinstance(value, str) and "," in value:
            value = [v.strip() for v in value.split(",")]
            
        return cls(field=field, value=value, operator=operator)

class LanguageBase(BaseModel):
    """Base model for language data"""
    code: str = Field(..., min_length=2, max_length=10, description="Language code (e.g., 'en', 'es')")
    name: str = Field(..., min_length=2, max_length=100, description="Language name (e.g., 'English', 'Spanish')")
    image: Optional[str] = None
    is_default: bool = Field(False, description="Whether this language is the default")
    
    @field_validator("code")
    def code_to_lowercase(cls, v):
        """Convert code to lowercase"""
        return v.lower() if v else v

class LanguageCreate(LanguageBase):
    """Model for creating a new language"""
    pass

class LanguageUpdate(BaseModel):
    """Model for updating an existing language"""
    code: Optional[str] = Field(None, min_length=2, max_length=10, description="Language code (e.g., 'en', 'es')")
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Language name (e.g., 'English', 'Spanish')")
    image: Optional[str] = None
    is_default: Optional[bool] = Field(None, description="Whether this language is the default")
    
    @field_validator("code")
    def code_to_lowercase(cls, v):
        """Convert code to lowercase"""
        return v.lower() if v else v
    
    model_config = ConfigDict(extra="forbid")

class LanguageInDBBase(LanguageBase):
    """Base model for language in database, including common properties"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class Language(LanguageInDBBase):
    """Model for returning language data to client"""
    
    @property
    def image_url(self) -> Optional[str]:
        """Convert image path to URL if available"""
        from app.core.config import settings
        
        if not self.image:
            return None
            
        # Check if image already has a full URL
        if self.image.startswith(("http://", "https://")):
            return self.image
            
        # Join the base URL with the image path
        return f"{settings.API_URL}/uploads/{self.image}"

class LanguageInDB(LanguageInDBBase):
    """Model for language data stored in database"""
    pass

class PaginatedLanguageResponse(BaseModel):
    """Model for paginated response of languages"""
    items: List[Language]
    total: int
    page: int
    page_size: int

# Keep alias for backward compatibility
LanguageOut = Language
