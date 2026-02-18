from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from datetime import datetime
from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.api.deps import require_admin

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/", response_model=List[AuditLogResponse])
def get_audit_logs(
    entity: Optional[str] = None,
    user_azure_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    query = db.query(AuditLog)

    if entity:
        query = query.filter(AuditLog.entity == entity)

    if user_azure_id:
        query = query.filter(AuditLog.user_azure_id == user_azure_id)

    if start_date and end_date:
        query = query.filter(
            and_(
                AuditLog.created_at >= start_date,
                AuditLog.created_at <= end_date
            )
        )

    return query.order_by(AuditLog.created_at.desc()).all()
