from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Union
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    user_azure_id: str
    performed_by: Optional[str] = None   # 👈 NEW FIELD
    action: str
    entity: str
    entity_id: int
    old_data: Optional[Union[Dict[str, Any], List[Any]]]
    new_data: Optional[Union[Dict[str, Any], List[Any]]]
    created_at: datetime

    class Config:
        from_attributes = True