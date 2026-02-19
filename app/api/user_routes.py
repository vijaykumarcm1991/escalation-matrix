from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.schemas.user import UserUpsert, UserResponse
from typing import List
from app.api.deps import require_service

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/upsert")
def upsert_user(
    data: UserUpsert,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_service)
):

    existing_user = db.query(User).filter(User.azure_id == data.azure_id).first()

    if existing_user:
        existing_user.display_name = data.display_name
        existing_user.email = data.email
        existing_user.mobile = data.mobile
        existing_user.department = data.department
        existing_user.is_active = data.is_active
        db.commit()
        db.refresh(existing_user)
        return existing_user

    new_user = User(
        azure_id=data.azure_id,
        display_name=data.display_name,
        email=data.email,
        mobile=data.mobile,
        department=data.department,
        is_active=data.is_active
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.get("/search", response_model=List[UserResponse])
def search_users(q: str, db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.display_name.ilike(f"%{q}%"))
        .all()
    )
