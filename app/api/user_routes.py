from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.schemas.user import UserUpsert, UserResponse
from typing import List
from app.api.deps import require_service, require_admin
from app.schemas.user_import import UserImportRequest
from app.models.user import User
from sqlalchemy.orm import Session
from fastapi import Depends
from app.models.audit_log import AuditLog

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

@router.post("/import-json")
def import_users_from_json(
    payload: UserImportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    # Handle both formats
    if payload.value:
        users_list = payload.value
    elif payload.body and payload.body.get("value"):
        users_list = payload.body.get("value")
    else:
        return {"error": "Invalid JSON format. 'value' not found."}

    # 1️⃣ Mark all existing users inactive
    db.query(User).update({"is_active": False})
    db.flush()

    inserted = 0
    updated = 0

    for item in users_list:

        azure_id = item.get("Id")
        display_name = item.get("DisplayName")
        email = item.get("Mail")
        mobile = item.get("mobilePhone")
        department = item.get("Department")
        is_active = item.get("AccountEnabled", True)

        user = db.query(User).filter(User.azure_id == azure_id).first()

        if user:
            user.display_name = display_name
            user.email = email
            user.mobile = mobile
            user.department = department
            user.is_active = is_active
            updated += 1
        else:
            new_user = User(
                azure_id=azure_id,
                display_name=display_name,
                email=email,
                mobile=mobile,
                department=department,
                is_active=is_active,
                role="user"
            )
            db.add(new_user)
            inserted += 1

    summary = {
        "total_processed": len(users_list),
        "inserted": inserted,
        "updated": updated
    }

    # Add audit log
    audit = AuditLog(
        user_azure_id=current_user["sub"],
        action="USER_IMPORT",
        entity="User",
        entity_id=0,
        old_data=None,
        new_data=summary
    )

    db.add(audit)
    db.commit()

    return summary
