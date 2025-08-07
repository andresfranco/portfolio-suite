from typing import Optional, List
from pydantic import BaseModel

class UserInfo(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_systemadmin: bool
    roles: List[dict]

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserInfo] = None

class TokenPayload(BaseModel):
    username: Optional[str] = None
