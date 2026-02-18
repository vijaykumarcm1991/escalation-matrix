from pydantic import BaseModel

class UnitCreate(BaseModel):
    name: str

class UnitResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
