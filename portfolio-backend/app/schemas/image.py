from pydantic import BaseModel, ConfigDict
from typing import Optional

class ImageBase(BaseModel):
    category: str
    image_path: str
    
class ImageCreate(ImageBase):
    project_id: int
    original_filename: Optional[str] = None

class ImageUpdate(BaseModel):
    category: Optional[str] = None
    image_path: Optional[str] = None

class Image(ImageBase):
    id: int
    project_id: int
    original_filename: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ImageOut(Image):
    image_url: Optional[str] = None 

# Aliases for backward compatibility
ImageIn = ImageCreate 