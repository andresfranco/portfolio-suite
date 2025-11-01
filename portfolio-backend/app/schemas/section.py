from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime

class LanguageBase(BaseModel):
    id: int
    code: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class SectionTextBase(BaseModel):
    language_id: int
    text: str

class SectionTextCreate(SectionTextBase):
    pass

class SectionTextUpdate(BaseModel):
    language_id: Optional[int] = None
    text: Optional[str] = None

class SectionTextOut(SectionTextBase):
    id: int
    language: LanguageBase

    model_config = ConfigDict(from_attributes=True)

# Section Image Schemas
class SectionImageBase(BaseModel):
    image_path: str
    language_id: Optional[int] = None
    display_order: int = 0

class SectionImageCreate(SectionImageBase):
    pass

class SectionImageUpdate(BaseModel):
    language_id: Optional[int] = None
    display_order: Optional[int] = None

class SectionImageOut(SectionImageBase):
    id: int
    section_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# Section Attachment Schemas
class SectionAttachmentBase(BaseModel):
    file_path: str
    file_name: str
    language_id: Optional[int] = None
    display_order: int = 0

class SectionAttachmentCreate(SectionAttachmentBase):
    pass

class SectionAttachmentUpdate(BaseModel):
    language_id: Optional[int] = None
    display_order: Optional[int] = None

class SectionAttachmentOut(SectionAttachmentBase):
    id: int
    section_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SectionBase(BaseModel):
    code: str

class SectionCreate(SectionBase):
    section_texts: List[SectionTextCreate]

class SectionUpdate(BaseModel):
    code: Optional[str] = None
    section_texts: Optional[List[SectionTextCreate]] = None

class Section(SectionBase):
    id: int
    section_texts: List[SectionTextOut] = []
    images: List[SectionImageOut] = []
    attachments: List[SectionAttachmentOut] = []

    model_config = ConfigDict(from_attributes=True)

# Project Section Association
class ProjectSectionAdd(BaseModel):
    section_id: int
    display_order: int = 0

class ProjectSectionCreate(BaseModel):
    code: str
    section_texts: List[SectionTextCreate]
    display_order: int = 0

class Filter(BaseModel):
    field: str
    value: str
    operator: Literal["contains", "equals", "startsWith", "endsWith"] = "contains"

    @classmethod
    def from_params(cls, field: str, value: str, operator: str = "contains") -> "Filter":
        return cls(field=field, value=value, operator=operator)

class PaginatedSectionResponse(BaseModel):
    items: List[Section]
    total: int
    page: int
    pageSize: int

class UniqueCheckResponse(BaseModel):
    exists: bool
    code: str

# Alias for backward compatibility
SectionText = SectionTextOut
