from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.geography import Geography
from app.schemas.geography import GeographyCreate, GeographyResponse
from typing import List

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=GeographyResponse)
def create_geography(geo: GeographyCreate, db: Session = Depends(get_db)):
    db_geo = Geography(name=geo.name)
    db.add(db_geo)
    db.commit()
    db.refresh(db_geo)
    return db_geo


@router.get("/", response_model=List[GeographyResponse])
def get_geographies(db: Session = Depends(get_db)):
    return db.query(Geography).all()
