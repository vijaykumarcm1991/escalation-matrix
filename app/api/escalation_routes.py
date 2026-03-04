from app.core import config
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.escalation_config import EscalationConfig
from app.models.escalation_level import EscalationLevel
from app.models.user import User
from app.schemas.escalation import EscalationCreate
from sqlalchemy import func
from app.api.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.unit import Unit
from app.models.geography import Geography
from app.models.infra_app import InfraApp
from app.models.application import Application
from typing import Optional

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def validate_level_sequence(levels):
    level_numbers = [level.level_number for level in levels]

    # Rule 1: Must be positive integers
    if any(level <= 0 for level in level_numbers):
        raise HTTPException(
            status_code=400,
            detail="level_number must be positive integer starting from 1"
        )

    # Rule 2: No duplicate levels
    if len(level_numbers) != len(set(level_numbers)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate level_number not allowed"
        )

    # Rule 3: Must start from 1
    if min(level_numbers) != 1:
        raise HTTPException(
            status_code=400,
            detail="Escalation levels must start from 1"
        )

    # Rule 4: No gaps (sequential check)
    sorted_levels = sorted(level_numbers)
    expected_sequence = list(range(1, len(sorted_levels) + 1))

    if sorted_levels != expected_sequence:
        raise HTTPException(
            status_code=400,
            detail="Levels must be sequential without gaps"
        )
    
@router.post("/")
def create_escalation(
    data: EscalationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    if data.affected_ci == "":
        data.affected_ci = None
    
    if data.location == "":
        data.location = None

    try:
        # 1️⃣ Check ACTIVE duplicate
        active_existing = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == data.unit_id,
            EscalationConfig.geography_id == data.geography_id,
            EscalationConfig.infra_app_id == data.infra_app_id,
            EscalationConfig.application_id == data.application_id,
            EscalationConfig.affected_ci == data.affected_ci,
            EscalationConfig.location == data.location,
            EscalationConfig.is_active == True
        ).first()

        if active_existing:
            raise HTTPException(
                status_code=400,
                detail="Escalation config already exists"
            )

        # 2️⃣ Check INACTIVE duplicate (reactivation case)
        inactive_existing = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == data.unit_id,
            EscalationConfig.geography_id == data.geography_id,
            EscalationConfig.infra_app_id == data.infra_app_id,
            EscalationConfig.application_id == data.application_id,
            EscalationConfig.affected_ci == data.affected_ci,
            EscalationConfig.location == data.location,
            EscalationConfig.is_active == False
        ).first()

        if inactive_existing:
            # ♻ Reactivate existing config
            config = inactive_existing
            config.is_active = True

            # Save old levels for audit
            old_levels = db.query(EscalationLevel).filter(
                EscalationLevel.escalation_config_id == config.id
            ).all()

            old_data = [
                {
                    "level_number": lvl.level_number,
                    "user_id": lvl.user_id,
                    "override_mobile": lvl.override_mobile,
                    "override_email": lvl.override_email
                }
                for lvl in old_levels
            ]

            # Remove old levels
            db.query(EscalationLevel).filter(
                EscalationLevel.escalation_config_id == config.id
            ).delete()

            db.flush()

            action_type = "UPDATE"

        else:
            # ➕ Create new config
            config = EscalationConfig(
                unit_id=data.unit_id,
                geography_id=data.geography_id,
                infra_app_id=data.infra_app_id,
                application_id=data.application_id,
                affected_ci=data.affected_ci,
                location=data.location
            )

            db.add(config)
            db.flush()

            old_data = None
            action_type = "CREATE"

        # 4️⃣ Add levels
        for level in data.levels:
            escalation_level = EscalationLevel(
                escalation_config_id=config.id,
                level_number=level.level_number,
                user_id=level.user_id,
                override_mobile=level.override_mobile,
                override_email=level.override_email
            )
            db.add(escalation_level)

        audit = AuditLog(
            user_azure_id=current_user["sub"],
            action=action_type,
            entity="EscalationConfig",
            entity_id=config.id,
            old_data=old_data,
            new_data={
                "unit_id": data.unit_id,
                "geography_id": data.geography_id,
                "infra_app_id": data.infra_app_id,
                "application_id": data.application_id,
                "affected_ci": data.affected_ci,
                "location": data.location,
                "levels": [level.dict() for level in data.levels]
            }
        )

        db.add(audit)

        # 5️⃣ Commit everything together
        db.commit()

        return {"message": "Escalation created successfully"}

    except Exception as e:
        db.rollback()
        raise e

@router.get("/")
def get_escalation(
    unit_id: int,
    geography_id: int,
    infra_app_id: int,
    application_id: int,
    affected_ci: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db)
):

    if affected_ci == "":
        affected_ci = None

    if location == "":
        location = None

    results = (
        db.query(
            EscalationLevel.level_number,
            EscalationLevel.user_id,
            User.display_name,
            func.coalesce(EscalationLevel.override_mobile, User.mobile).label("mobile"),
            func.coalesce(EscalationLevel.override_email, User.email).label("email"),
            EscalationConfig.unit_id,
            EscalationConfig.geography_id,
            EscalationConfig.infra_app_id,
            EscalationConfig.application_id
        )
        .join(EscalationConfig, EscalationLevel.escalation_config_id == EscalationConfig.id)
        .join(User, EscalationLevel.user_id == User.id)
        .filter(
            EscalationConfig.unit_id == unit_id,
            EscalationConfig.geography_id == geography_id,
            EscalationConfig.infra_app_id == infra_app_id,
            EscalationConfig.application_id == application_id,
            EscalationConfig.affected_ci == affected_ci,
            EscalationConfig.location == location,
            EscalationConfig.is_active == True
        )
        .order_by(EscalationLevel.level_number)
        .all()
    )

    if not results:
        raise HTTPException(status_code=404, detail="Escalation not found")

    response_levels = []

    for row in results:
        response_levels.append({
            "level_number": row.level_number,
            "user_id": row.user_id,
            "display_name": row.display_name,
            "mobile": row.mobile,
            "email": row.email
        })

    return {
        "unit_id": unit_id,
        "geography_id": geography_id,
        "infra_app_id": infra_app_id,
        "application_id": application_id,
        "affected_ci": affected_ci,
        "location": location,
        "levels": response_levels
    }

@router.put("/")
def update_escalation(
    unit_id: int,
    geography_id: int,
    infra_app_id: int,
    application_id: int,
    data: EscalationCreate,
    affected_ci: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    if affected_ci == "":
        affected_ci = None

    if location == "":
        location = None

    if data.location == "":
        data.location = None

    if data.affected_ci == "":
        data.affected_ci = None

    try:
        # 1️⃣ Find existing config
        config = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == unit_id,
            EscalationConfig.geography_id == geography_id,
            EscalationConfig.infra_app_id == infra_app_id,
            EscalationConfig.application_id == application_id,
            EscalationConfig.affected_ci == affected_ci,
            EscalationConfig.location == location,
            EscalationConfig.is_active == True
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="Escalation config not found")

        config.location = data.location
        config.affected_ci = data.affected_ci
        db.flush()

        if not data.levels:
            raise HTTPException(status_code=400, detail="At least one level required")

        validate_level_sequence(data.levels)

        # 2️⃣ Validate users + mobile rule
        for level in data.levels:
            user = db.query(User).filter(User.id == level.user_id).first()

            if not user:
                raise HTTPException(status_code=404, detail=f"User {level.user_id} not found")

            if not user.mobile and not level.override_mobile:
                raise HTTPException(
                    status_code=400,
                    detail=f"Mobile required for user {user.display_name}"
                )

        old_levels = db.query(EscalationLevel).filter(
            EscalationLevel.escalation_config_id == config.id
        ).all()

        old_data = [
            {
                "level_number": lvl.level_number,
                "user_id": lvl.user_id,
                "override_mobile": lvl.override_mobile,
                "override_email": lvl.override_email
            }
            for lvl in old_levels
        ]

        # 3️⃣ Delete existing levels
        db.query(EscalationLevel).filter(
            EscalationLevel.escalation_config_id == config.id
        ).delete()

        db.flush()

        # 4️⃣ Insert new levels
        for level in data.levels:
            new_level = EscalationLevel(
                escalation_config_id=config.id,
                level_number=level.level_number,
                user_id=level.user_id,
                override_mobile=level.override_mobile,
                override_email=level.override_email
            )
            db.add(new_level)

        audit = AuditLog(
            user_azure_id=current_user["sub"],
            action="UPDATE",
            entity="EscalationConfig",
            entity_id=config.id,
            old_data=old_data,
            new_data={
                "affected_ci": config.affected_ci,
                "location": config.location,
                "levels": [level.dict() for level in data.levels]
            }
        )

        db.add(audit)

        # 5️⃣ Commit transaction
        db.commit()

        return {"message": "Escalation updated successfully"}

    except Exception as e:
        db.rollback()
        raise e

@router.get("/list")
def list_escalations(db: Session = Depends(get_db)):

    results = (
        db.query(
            Unit.name.label("unit"),
            Geography.name.label("geography"),
            InfraApp.name.label("infra_app"),
            Application.name.label("application"),
            EscalationConfig.unit_id,
            EscalationConfig.geography_id,
            EscalationConfig.infra_app_id,
            EscalationConfig.application_id,
            EscalationConfig.affected_ci,
            EscalationConfig.location
        )
        .join(Unit, EscalationConfig.unit_id == Unit.id)
        .join(Geography, EscalationConfig.geography_id == Geography.id)
        .join(InfraApp, EscalationConfig.infra_app_id == InfraApp.id)
        .join(Application, EscalationConfig.application_id == Application.id)
        .filter(EscalationConfig.is_active == True)
        .all()
    )

    response = []

    for row in results:
        response.append({
            "unit": row.unit,
            "geography": row.geography,
            "infra_app": row.infra_app,
            "application": row.application,
            "unit_id": row.unit_id,
            "geography_id": row.geography_id,
            "infra_app_id": row.infra_app_id,
            "application_id": row.application_id,
            "affected_ci": row.affected_ci,
            "location": row.location
        })

    return response

@router.delete("/")
def delete_escalation(
    unit_id: int,
    geography_id: int,
    infra_app_id: int,
    application_id: int,
    affected_ci: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    
    if affected_ci == "":
        affected_ci = None

    if location == "":
        location = None

    try:
        config = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == unit_id,
            EscalationConfig.geography_id == geography_id,
            EscalationConfig.infra_app_id == infra_app_id,
            EscalationConfig.application_id == application_id,
            EscalationConfig.affected_ci == affected_ci,
            EscalationConfig.location == location,
            EscalationConfig.is_active == True
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="Escalation config not found")

        # Save old data for audit
        old_levels = db.query(EscalationLevel).filter(
            EscalationLevel.escalation_config_id == config.id
        ).all()

        old_data = [
            {
                "level_number": lvl.level_number,
                "user_id": lvl.user_id,
                "override_mobile": lvl.override_mobile,
                "override_email": lvl.override_email
            }
            for lvl in old_levels
        ]

        # Soft delete instead of hard delete
        config.is_active = False

        audit = AuditLog(
            user_azure_id=current_user["sub"],
            action="DELETE",
            entity="EscalationConfig",
            entity_id=config.id,
            old_data=old_data,
            new_data=None
        )

        db.add(audit)

        db.commit()

        return {"message": "Escalation deleted successfully"}

    except Exception as e:
        db.rollback()
        raise e

@router.get("/export")
def export_escalations(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    results = (
        db.query(
            Unit.name.label("unit"),
            Geography.name.label("geography"),
            InfraApp.name.label("infra_app"),
            Application.name.label("application"),
            EscalationConfig.affected_ci.label("affected_ci"),
            EscalationConfig.location.label("location"),
            EscalationLevel.level_number,
            User.display_name,
            func.coalesce(EscalationLevel.override_mobile, User.mobile).label("mobile"),
            func.coalesce(EscalationLevel.override_email, User.email).label("email")
        )
        .select_from(EscalationConfig)  # 🔥 IMPORTANT
        .join(EscalationLevel,
              EscalationLevel.escalation_config_id == EscalationConfig.id)
        .join(User,
              EscalationLevel.user_id == User.id)
        .join(Unit,
              EscalationConfig.unit_id == Unit.id)
        .join(Geography,
              EscalationConfig.geography_id == Geography.id)
        .join(InfraApp,
              EscalationConfig.infra_app_id == InfraApp.id)
        .join(Application,
              EscalationConfig.application_id == Application.id)
        .filter(EscalationConfig.is_active == True)
        .order_by(
            Unit.name,
            Geography.name,
            InfraApp.name,
            Application.name,
            EscalationConfig.affected_ci,
            EscalationConfig.location,
            EscalationLevel.level_number
        )
        .all()
    )

    return [
        {
            "unit": r.unit,
            "geography": r.geography,
            "infra_app": r.infra_app,
            "application": r.application,
            "affected_ci": r.affected_ci,
            "location": r.location,
            "level_number": r.level_number,
            "display_name": r.display_name,
            "mobile": r.mobile,
            "email": r.email
        }
        for r in results
    ]