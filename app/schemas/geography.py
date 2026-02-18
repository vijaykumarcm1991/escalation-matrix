from pydantic import BaseModel

class GeographyCreate(BaseModel):
    name: str

class GeographyResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
