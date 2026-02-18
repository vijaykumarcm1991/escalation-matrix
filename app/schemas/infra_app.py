from pydantic import BaseModel

class InfraAppCreate(BaseModel):
    name: str

class InfraAppResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
