from pydantic import BaseModel, ConfigDict, field_validator, computed_field, model_serializer
from typing import List, Optional, Dict, Any, Union, Literal, TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from app.schemas.category import CategoryOut
    from app.schemas.language import LanguageOut
    from app.schemas.link import PortfolioLinkOut

class PortfolioImageBase(BaseModel):
    image_path: str
    file_name: str
    category: Optional[str] = None
    language_id: Optional[int] = None

class PortfolioImageCreate(PortfolioImageBase):
    pass

class PortfolioImageUpdate(BaseModel):
    image_path: Optional[str] = None
    file_name: Optional[str] = None
    category: Optional[str] = None
    language_id: Optional[int] = None

# Nested language schema for image response (reuse from attachments)
class ImageLanguageNested(BaseModel):
    """Simplified language for image response"""
    id: int
    code: str
    name: str
    image: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioImageOut(PortfolioImageBase):
    id: int
    portfolio_id: int
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    language: Optional[ImageLanguageNested] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioAttachmentBase(BaseModel):
    file_path: str
    file_name: str
    category_id: Optional[int] = None
    is_default: bool = False
    language_id: Optional[int] = None

class PortfolioAttachmentCreate(PortfolioAttachmentBase):
    pass

class PortfolioAttachmentUpdate(BaseModel):
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    category_id: Optional[int] = None
    is_default: Optional[bool] = None
    language_id: Optional[int] = None

# Minimal nested schemas for attachment response
class CategoryTextSimple(BaseModel):
    """Simplified category text"""
    language_id: int
    name: str
    description: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class AttachmentCategoryNested(BaseModel):
    """Simplified category for attachment response"""
    id: int
    code: str
    type_code: Optional[str] = None
    category_texts: List[CategoryTextSimple] = []
    
    model_config = ConfigDict(from_attributes=True)

class AttachmentLanguageNested(BaseModel):
    """Simplified language for attachment response"""
    id: int
    code: str
    name: str
    image: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioAttachmentOut(PortfolioAttachmentBase):
    id: int
    portfolio_id: int
    file_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    category: Optional[AttachmentCategoryNested] = None
    language: Optional[AttachmentLanguageNested] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: Optional[bool] = False

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Portfolio name is required')
        if len(v.strip()) < 2:
            raise ValueError('Portfolio name must be at least 2 characters long')
        return v.strip()

class PortfolioCreate(PortfolioBase):
    categories: Optional[List[int]] = []
    experiences: Optional[List[int]] = []
    projects: Optional[List[int]] = []
    sections: Optional[List[int]] = []
    images: Optional[List[PortfolioImageCreate]] = []
    attachments: Optional[List[PortfolioAttachmentCreate]] = []

class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    categories: Optional[List[int]] = None
    experiences: Optional[List[int]] = None
    projects: Optional[List[int]] = None
    sections: Optional[List[int]] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Portfolio name cannot be empty')
            if len(v.strip()) < 2:
                raise ValueError('Portfolio name must be at least 2 characters long')
            return v.strip()
        return v

class PortfolioOut(PortfolioBase):
    id: int
    is_default: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    categories: List[Dict[str, Any]] = []
    experiences: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []
    sections: List[Dict[str, Any]] = []
    images: List[PortfolioImageOut] = []
    attachments: List[PortfolioAttachmentOut] = []
    links: List[Any] = []  # Using Any to avoid circular import, will be List[PortfolioLinkOut] at runtime

    model_config = ConfigDict(from_attributes=True)

class Filter(BaseModel):
    field: str
    value: str
    operator: Literal["contains", "equals", "startsWith", "endsWith"] = "contains"

    @classmethod
    def from_params(cls, field: str, value: str, operator: str = "contains") -> "Filter":
        return cls(field=field, value=value, operator=operator)

class PaginatedPortfolioResponse(BaseModel):
    items: List[PortfolioOut]
    total: int
    page: int
    page_size: int

# Aliases for backward compatibility
Portfolio = PortfolioOut
PortfolioImage = PortfolioImageOut
PortfolioAttachment = PortfolioAttachmentOut
