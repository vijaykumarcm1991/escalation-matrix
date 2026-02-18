from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/login")
def login(azure_id: str, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.azure_id == azure_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_access_token({
        "sub": user.azure_id,
        "role": user.role
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
