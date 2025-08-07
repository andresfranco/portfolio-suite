from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any, Union, Literal

class LanguageBase(BaseModel):
    id: int
    code: str
    name: str
    
    model_config = ConfigDict(from_attributes=True)

class ExperienceTextBase(BaseModel):
    language_id: int
    name: str
    description: str

class ExperienceTextCreate(ExperienceTextBase):
    pass

class ExperienceTextUpdate(BaseModel):
    id: Optional[int] = None
    language_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None

class ExperienceTextOut(ExperienceTextBase):
    id: int
    language: LanguageBase
    
    model_config = ConfigDict(from_attributes=True)

class ExperienceBase(BaseModel):
    code: str
    years: int

class ExperienceCreate(ExperienceBase):
    experience_texts: List[ExperienceTextCreate]

class ExperienceUpdate(BaseModel):
    code: Optional[str] = None
    years: Optional[int] = None
    experience_texts: Optional[List[ExperienceTextUpdate]] = None
    removed_language_ids: Optional[List[int]] = None

class Experience(ExperienceBase):
    id: int
    experience_texts: List[ExperienceTextOut] = []
    
    model_config = ConfigDict(from_attributes=True)

class Filter(BaseModel):
    field: str
    value: str
    operator: Literal["contains", "equals", "startsWith", "endsWith"] = "contains"

    @classmethod
    def from_params(cls, field: str, value: str, operator: str = "contains") -> "Filter":
        return cls(field=field, value=value, operator=operator)

class PaginatedExperienceResponse(BaseModel):
    items: List[Experience]
    total: int
    page: int
    pageSize: int

class UniqueCheckResponse(BaseModel):
    exists: bool
    code: str

# Alias for backward compatibility
ExperienceText = ExperienceTextOut
