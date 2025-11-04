from datetime import datetime
from pydantic import BaseModel, ConfigDict, computed_field
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


class ExperienceImageBase(BaseModel):
    image_path: str
    category: str = "content"
    language_id: Optional[int] = None
    file_name: Optional[str] = None


class ExperienceImageOut(ExperienceImageBase):
    id: int
    experience_id: int
    experience_text_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def image_url(self) -> Optional[str]:
        """Return a URL-safe path for the stored image."""
        if not self.image_path:
            return None
        from app.utils.file_utils import get_file_url
        return get_file_url(self.image_path)

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
    images: List[ExperienceImageOut] = []
    
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
ExperienceImage = ExperienceImageOut
