from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any, Union, Literal
from datetime import datetime, date
from app.core.logging import setup_logger

# Set up logger
logger = setup_logger("app.schemas.project")

class ProjectTextBase(BaseModel):
    language_id: int
    name: str
    description: str

class ProjectTextCreate(ProjectTextBase):
    pass

class ProjectTextUpdate(BaseModel):
    language_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectTextOut(ProjectTextBase):
    id: int
    language: Dict[str, Any]
    
    model_config = ConfigDict(from_attributes=True)

class ProjectImageBase(BaseModel):
    image_path: str
    category: str  # e.g., "diagram", "main", "gallery"
    language_id: Optional[int] = None  # Link to language

class ProjectImageCreate(ProjectImageBase):
    pass

class ProjectImageUpdate(BaseModel):
    image_path: Optional[str] = None
    category: Optional[str] = None
    language_id: Optional[int] = None

class ProjectImageOut(BaseModel):
    id: int
    image_path: str  
    category: str
    language_id: Optional[int] = None
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_db_model(cls, model, include_url=True):
        """Create schema model from database model"""
        image = cls(
            id=model.id,
            image_path=model.image_path,
            category=model.category,
            language_id=model.language_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
            created_by=model.created_by,
            updated_by=model.updated_by
        )
        if include_url:
            from app.utils.file_utils import get_file_url
            image.image_url = get_file_url(model.image_path)
        return image

class ProjectAttachmentBase(BaseModel):
    file_path: str
    file_name: str
    category_id: Optional[int] = None  # Link to category (PDOC, RESU, etc)
    language_id: Optional[int] = None  # Link to language

class ProjectAttachmentCreate(ProjectAttachmentBase):
    pass

class ProjectAttachmentUpdate(BaseModel):
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    category_id: Optional[int] = None
    language_id: Optional[int] = None

class ProjectAttachmentOut(ProjectAttachmentBase):
    id: int
    file_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class ProjectBase(BaseModel):
    repository_url: Optional[str] = None
    website_url: Optional[str] = None
    project_date: Optional[date] = None

class ProjectCreate(ProjectBase):
    project_texts: List[ProjectTextCreate]
    categories: List[int] = []
    skills: List[int] = []

class ProjectUpdate(BaseModel):
    repository_url: Optional[str] = None
    website_url: Optional[str] = None
    project_date: Optional[date] = None
    project_texts: Optional[List[ProjectTextCreate]] = None
    categories: Optional[List[int]] = None
    skills: Optional[List[int]] = None

class ProjectOut(ProjectBase):
    id: int
    project_texts: List[ProjectTextOut] = []
    images: List[ProjectImageOut] = []
    attachments: List[ProjectAttachmentOut] = []
    categories: List[Dict[str, Any]] = []
    skills: List[Dict[str, Any]] = []
    
    model_config = ConfigDict(from_attributes=True)

class Filter(BaseModel):
    """
    Filter model for project queries, supporting various filter operations
    """
    field: str
    value: str
    operator: Literal["contains", "equals", "startsWith", "endsWith"] = "contains"
    name: Optional[str] = None
    repository_url: Optional[str] = None
    website_url: Optional[str] = None
    category_id: Optional[int] = None
    language_id: Optional[int] = None
    skill_id: Optional[int] = None

    @classmethod
    def from_params(cls, field: str, value: str, operator: str = "contains") -> "Filter":
        """
        Create a filter instance from parameters
        
        Args:
            field: Field to filter on
            value: Value to filter for
            operator: Filter operation type (contains, equals, startsWith, endsWith)
            
        Returns:
            Filter instance with appropriate fields set
        """
        # Validate operator
        valid_operators = ["contains", "equals", "startsWith", "endsWith"]
        if operator not in valid_operators:
            operator = "contains"  # Default to contains if invalid
            
        # Create filter object
        filter_obj = cls(field=field, value=value, operator=operator)
        
        # Set specific attribute based on field name if it exists on the model
        if hasattr(filter_obj, field):
            try:
                # Try to set the attribute - may fail if type conversion is needed
                setattr(filter_obj, field, value)
            except (ValueError, TypeError) as e:
                # Log the error but continue with the original string value
                logger.warning(f"Could not set attribute {field}={value} on Filter: {e}")
                
        return filter_obj

class PaginatedProjectResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    pageSize: int  # Changed back to pageSize for consistency with the main schema


# Aliases for backward compatibility
ProjectText = ProjectTextOut
ProjectImage = ProjectImageOut
ProjectAttachment = ProjectAttachmentOut
Project = ProjectOut