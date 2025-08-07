from typing import Generic, List, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    pageSize: int = Field(alias="page_size")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )
