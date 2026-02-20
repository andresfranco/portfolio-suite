from pydantic import BaseModel, ConfigDict, Field, field_validator, HttpUrl, computed_field, AliasChoices
from typing import List, Optional, Dict, Any
from datetime import datetime


# --- LinkCategoryType Schemas ---

class LinkCategoryTypeBase(BaseModel):
    """Base schema for link category type data"""
    code: str = Field(..., min_length=1, max_length=5, description="Unique code for the link category type")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the link category type")

    @field_validator('code')
    @classmethod
    def code_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link category type code cannot be empty or whitespace.')
        return v.strip().upper()

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link category type name cannot be empty or whitespace.')
        return v.strip()


class LinkCategoryTypeCreate(LinkCategoryTypeBase):
    """Schema for creating a new link category type"""
    pass


class LinkCategoryTypeUpdate(BaseModel):
    """Schema for updating an existing link category type. All fields are optional."""
    code: Optional[str] = Field(None, min_length=1, max_length=5, description="Unique code for the link category type")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the link category type")

    @field_validator('code')
    @classmethod
    def check_code_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Code cannot be set to an empty string.')
        return v.strip().upper() if v is not None else v

    @field_validator('name')
    @classmethod
    def check_name_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Name cannot be set to an empty string.')
        return v.strip() if v is not None else v


class LinkCategoryTypeOut(LinkCategoryTypeBase):
    """Schema for representing a link category type in API responses"""
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- LinkCategoryText Schemas ---

class LinkCategoryTextBase(BaseModel):
    """Base schema for link category text data"""
    language_id: int = Field(..., ge=1, description="ID of the language for this text")
    name: str = Field(..., min_length=1, max_length=100, description="Name of the link category in this language")
    description: Optional[str] = Field(None, description="Description of the link category in this language")

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link category name cannot be empty or whitespace.')
        return v.strip()


class LinkCategoryTextCreate(LinkCategoryTextBase):
    """Schema for creating a new link category text"""
    pass


class LinkCategoryTextUpdate(BaseModel):
    """Schema for updating an existing link category text. All fields are optional."""
    language_id: Optional[int] = Field(None, ge=1, description="ID of the language for this text")
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Name of the link category in this language")
    description: Optional[str] = Field(None, description="Description of the link category in this language")

    @field_validator('name')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Name cannot be set to an empty string.')
        return v.strip() if v is not None else v


class LinkCategoryTextOut(LinkCategoryTextBase):
    """Schema for representing a link category text in API responses"""
    id: int
    category_id: int

    model_config = ConfigDict(from_attributes=True)


# --- LinkCategory Schemas ---

class LinkCategoryBase(BaseModel):
    """Base schema for link category data"""
    code: str = Field(..., min_length=1, max_length=50, description="Unique code for the link category")
    type_code: str = Field(..., description="Code of the link category type")
    icon_name: Optional[str] = Field(None, max_length=100, description="Icon name for the link (e.g., 'FaGithub', 'FaLinkedin')")

    @field_validator('code')
    @classmethod
    def code_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link category code cannot be empty or whitespace.')
        return v.strip().upper()


class LinkCategoryCreate(LinkCategoryBase):
    """Schema for creating a new link category"""
    texts: Optional[List[LinkCategoryTextCreate]] = Field(None, description="Multilingual text content for the link category")


class LinkCategoryUpdate(BaseModel):
    """Schema for updating an existing link category. All fields are optional."""
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="Unique code for the link category")
    type_code: Optional[str] = Field(None, description="Code of the link category type")
    icon_name: Optional[str] = Field(None, max_length=100, description="Icon name for the link")

    @field_validator('code')
    @classmethod
    def check_code_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Code cannot be set to an empty string.')
        return v.strip().upper() if v is not None else v


class LinkCategoryOut(LinkCategoryBase):
    """Schema for representing a link category in API responses"""
    id: int
    texts: List[LinkCategoryTextOut] = Field(default_factory=list, description="Multilingual text content")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- PortfolioLinkText Schemas ---

class PortfolioLinkTextBase(BaseModel):
    """Base schema for portfolio link text data"""
    language_id: int = Field(..., ge=1, description="ID of the language for this text")
    name: str = Field(..., min_length=1, max_length=200, description="Display name of the link in this language")
    description: Optional[str] = Field(None, description="Description of the link in this language")

    @field_validator('name')
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link name cannot be empty or whitespace.')
        return v.strip()


class PortfolioLinkTextCreate(PortfolioLinkTextBase):
    """Schema for creating a new portfolio link text"""
    pass


class PortfolioLinkTextUpdate(BaseModel):
    """Schema for updating an existing portfolio link text. All fields are optional."""
    language_id: Optional[int] = Field(None, ge=1, description="ID of the language for this text")
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="Display name of the link in this language")
    description: Optional[str] = Field(None, description="Description of the link in this language")

    @field_validator('name')
    @classmethod
    def check_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError('Name cannot be set to an empty string.')
        return v.strip() if v is not None else v


class PortfolioLinkTextOut(PortfolioLinkTextBase):
    """Schema for representing a portfolio link text in API responses"""
    id: int
    link_id: int

    model_config = ConfigDict(from_attributes=True)


# --- PortfolioLink Schemas ---

class PortfolioLinkBase(BaseModel):
    """Base schema for portfolio link data"""
    category_id: int = Field(..., ge=1, description="ID of the link category")
    url: str = Field(..., min_length=1, max_length=500, description="URL of the link or internal route path")
    is_route: bool = Field(False, description="True if this is an internal route, False if external URL")
    image_path: Optional[str] = Field(None, max_length=500, description="Optional custom image/icon path")
    order: int = Field(0, ge=0, description="Display order of the link")
    is_active: bool = Field(True, description="Whether the link is currently active/visible")

    @field_validator('url')
    @classmethod
    def url_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Link URL cannot be empty or whitespace.')
        # Basic URL validation - could be enhanced
        url = v.strip()
        if not (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
            raise ValueError('URL must start with http://, https://, or /')
        return url


class PortfolioLinkCreate(PortfolioLinkBase):
    """Schema for creating a new portfolio link"""
    portfolio_id: int = Field(..., ge=1, description="ID of the portfolio")
    texts: Optional[List[PortfolioLinkTextCreate]] = Field(None, description="Multilingual text content for the link")


class PortfolioLinkUpdate(BaseModel):
    """Schema for updating an existing portfolio link. All fields are optional."""
    category_id: Optional[int] = Field(None, ge=1, description="ID of the link category")
    url: Optional[str] = Field(None, min_length=1, max_length=500, description="URL of the link or internal route path")
    is_route: Optional[bool] = Field(None, description="True if this is an internal route, False if external URL")
    image_path: Optional[str] = Field(None, max_length=500, description="Optional custom image/icon path")
    order: Optional[int] = Field(None, ge=0, description="Display order of the link")
    is_active: Optional[bool] = Field(None, description="Whether the link is currently active/visible")

    @field_validator('url')
    @classmethod
    def check_url_not_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError('URL cannot be set to an empty string.')
            url = v.strip()
            if not (url.startswith('http://') or url.startswith('https://') or url.startswith('/')):
                raise ValueError('URL must start with http://, https://, or /')
            return url
        return v


class PortfolioLinkOut(PortfolioLinkBase):
    """Schema for representing a portfolio link in API responses"""
    id: int
    portfolio_id: int
    category: Optional[LinkCategoryOut] = None
    texts: List[PortfolioLinkTextOut] = Field(
        default_factory=list,
        description="Multilingual text content",
        validation_alias=AliasChoices("texts", "link_texts"),
        serialization_alias="texts"
    )
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @computed_field
    def image_url(self) -> Optional[str]:
        """Return absolute URL for the stored image path if available."""
        if not self.image_path:
            return None
        try:
            from app.utils.file_utils import get_file_url
            return get_file_url(self.image_path)
        except Exception:
            # Fallback to stored path if conversion fails
            return self.image_path

    @computed_field
    def link_texts(self) -> List[PortfolioLinkTextOut]:
        """
        Maintain backwards compatibility for consumers expecting `link_texts`
        while ensuring the schema serialises `texts`.
        """
        return self.texts


# --- Bulk Operations ---

class PortfolioLinkBulkCreate(BaseModel):
    """Schema for creating multiple portfolio links at once"""
    links: List[PortfolioLinkCreate] = Field(..., min_length=1, description="List of links to create")


class PortfolioLinkBulkUpdate(BaseModel):
    """Schema for updating multiple portfolio links at once"""
    links: List[Dict[str, Any]] = Field(..., min_length=1, description="List of links with ID and fields to update")


class PortfolioLinkOrderUpdate(BaseModel):
    """Schema for updating the order of multiple portfolio links"""
    link_orders: List[Dict[str, int]] = Field(..., min_length=1, description="List of {id, order} pairs")

    @field_validator('link_orders')
    @classmethod
    def validate_link_orders(cls, v: List[Dict[str, int]]) -> List[Dict[str, int]]:
        for item in v:
            if 'id' not in item or 'order' not in item:
                raise ValueError('Each link order item must have id and order fields')
            if not isinstance(item['id'], int) or not isinstance(item['order'], int):
                raise ValueError('Both id and order must be integers')
            if item['id'] <= 0 or item['order'] < 0:
                raise ValueError('ID must be positive and order must be non-negative')
        return v
