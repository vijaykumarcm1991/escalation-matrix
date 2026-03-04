from pydantic import BaseModel
from typing import List, Optional

class BulkLevel(BaseModel):
    level: int
    user: str

class BulkEscalation(BaseModel):
    unit: str
    geography: str
    infra_app: str
    application: str
    affected_ci: Optional[str] = None
    location: Optional[str] = None
    levels: List[BulkLevel]

class BulkImportRequest(BaseModel):
    mode: str  # "plan" or "apply"
    data: List[BulkEscalation]