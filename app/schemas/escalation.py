from pydantic import BaseModel
from typing import List, Optional


class EscalationLevelCreate(BaseModel):
    level_number: int
    user_id: int
    override_mobile: Optional[str] = None
    override_email: Optional[str] = None

class EscalationCreate(BaseModel):
    unit_id: int
    geography_id: int
    infra_app_id: int
    application_id: int
    levels: List[EscalationLevelCreate]

class EscalationLevelResponse(BaseModel):
    level_number: int
    display_name: str
    mobile: str
    email: str

class EscalationResponse(BaseModel):
    unit_id: int
    geography_id: int
    infra_app_id: int
    application_id: int
    levels: List[EscalationLevelResponse]

