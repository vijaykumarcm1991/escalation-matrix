from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class UserImportRequest(BaseModel):
    value: Optional[List[Dict[str, Any]]] = None
    body: Optional[Dict[str, Any]] = None
