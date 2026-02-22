from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import SessionLocal
from app.api.deps import require_admin

from app.models.escalation_config import EscalationConfig
from app.models.escalation_level import EscalationLevel
from app.models.audit_log import AuditLog
from app.models.user import User  # make sure this import exists

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    # Total escalation configs
    total_escalations = db.query(EscalationConfig).count()

    # Unique counts
    total_units = db.query(func.count(func.distinct(EscalationConfig.unit_id))).scalar()
    total_geographies = db.query(func.count(func.distinct(EscalationConfig.geography_id))).scalar()
    total_applications = db.query(func.count(func.distinct(EscalationConfig.application_id))).scalar()

    # Total levels
    total_levels = db.query(EscalationLevel).count()

    # Audit breakdown
    audit_counts = (
        db.query(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .all()
    )

    breakdown = {"CREATE": 0, "UPDATE": 0, "DELETE": 0}

    for action, count in audit_counts:
        breakdown[action] = count

    # Recent 5 activities
    recent_activity = (
        db.query(
            AuditLog.action,
            User.display_name,
            AuditLog.created_at
        )
        .join(User, AuditLog.user_azure_id == User.azure_id)
        .order_by(AuditLog.created_at.desc())
        .limit(5)
        .all()
    )

    recent = [
        {
            "action": r.action,
            "performed_by": r.display_name,
            "created_at": r.created_at
        }
        for r in recent_activity
    ]

    return {
        "total_escalations": total_escalations,
        "total_units": total_units,
        "total_geographies": total_geographies,
        "total_applications": total_applications,
        "total_levels": total_levels,
        "audit_breakdown": breakdown,
        "recent_activity": recent
    }