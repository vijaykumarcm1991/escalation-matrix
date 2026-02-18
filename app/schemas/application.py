from pydantic import BaseModel

class ApplicationCreate(BaseModel):
    name: str

class ApplicationResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
