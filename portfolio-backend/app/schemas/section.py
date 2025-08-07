from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any, Union, Literal

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
    
    model_config = ConfigDict(from_attributes=True)

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
