from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime

class PortfolioImageBase(BaseModel):
    image_path: str
    file_name: str
    category: Optional[str] = None

class PortfolioImageCreate(PortfolioImageBase):
    pass

class PortfolioImageUpdate(BaseModel):
    image_path: Optional[str] = None
    file_name: Optional[str] = None
    category: Optional[str] = None

class PortfolioImageOut(PortfolioImageBase):
    id: int
    portfolio_id: int
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioAttachmentBase(BaseModel):
    file_path: str
    file_name: str

class PortfolioAttachmentCreate(PortfolioAttachmentBase):
    pass

class PortfolioAttachmentUpdate(BaseModel):
    file_path: Optional[str] = None
    file_name: Optional[str] = None

class PortfolioAttachmentOut(PortfolioAttachmentBase):
    id: int
    portfolio_id: int
    file_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None

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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    categories: List[Dict[str, Any]] = []
    experiences: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []
    sections: List[Dict[str, Any]] = []
    images: List[PortfolioImageOut] = []
    attachments: List[PortfolioAttachmentOut] = []
    
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
