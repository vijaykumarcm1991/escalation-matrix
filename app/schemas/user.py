from pydantic import BaseModel, EmailStr
from typing import Optional

class UserUpsert(BaseModel):
    azure_id: str
    display_name: str
    email: EmailStr
    mobile: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True


class UserResponse(BaseModel):
    id: int
    azure_id: str
    display_name: str
    email: EmailStr
    mobile: Optional[str]
    department: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True
