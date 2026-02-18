from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.infra_app import InfraApp
from app.schemas.infra_app import InfraAppCreate, InfraAppResponse
from typing import List

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=InfraAppResponse)
def create_infra_app(data: InfraAppCreate, db: Session = Depends(get_db)):
    obj = InfraApp(name=data.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/", response_model=List[InfraAppResponse])
def get_infra_apps(db: Session = Depends(get_db)):
    return db.query(InfraApp).all()
