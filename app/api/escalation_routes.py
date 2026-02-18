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

    try:
        # 1️⃣ Duplicate check
        existing = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == data.unit_id,
            EscalationConfig.geography_id == data.geography_id,
            EscalationConfig.infra_app_id == data.infra_app_id,
            EscalationConfig.application_id == data.application_id
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="Escalation config already exists")

        if not data.levels:
            raise HTTPException(status_code=400, detail="At least one level required")

        validate_level_sequence(data.levels)

        # 2️⃣ Validate users and mobile rule
        for level in data.levels:
            user = db.query(User).filter(User.id == level.user_id).first()

            if not user:
                raise HTTPException(status_code=404, detail=f"User {level.user_id} not found")

            if not user.mobile and not level.override_mobile:
                raise HTTPException(
                    status_code=400,
                    detail=f"Mobile required for user {user.display_name}"
                )

        # 3️⃣ Create header
        config = EscalationConfig(
            unit_id=data.unit_id,
            geography_id=data.geography_id,
            infra_app_id=data.infra_app_id,
            application_id=data.application_id
        )

        db.add(config)
        db.flush()  # get config.id without committing

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
            action="CREATE",
            entity="EscalationConfig",
            entity_id=config.id,
            old_data=None,
            new_data={
                "unit_id": data.unit_id,
                "geography_id": data.geography_id,
                "infra_app_id": data.infra_app_id,
                "application_id": data.application_id,
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
    db: Session = Depends(get_db)
):

    results = (
        db.query(
            EscalationLevel.level_number,
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
            EscalationConfig.application_id == application_id
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
            "display_name": row.display_name,
            "mobile": row.mobile,
            "email": row.email
        })

    return {
        "unit_id": unit_id,
        "geography_id": geography_id,
        "infra_app_id": infra_app_id,
        "application_id": application_id,
        "levels": response_levels
    }

@router.put("/")
def update_escalation(
    data: EscalationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    try:
        # 1️⃣ Find existing config
        config = db.query(EscalationConfig).filter(
            EscalationConfig.unit_id == data.unit_id,
            EscalationConfig.geography_id == data.geography_id,
            EscalationConfig.infra_app_id == data.infra_app_id,
            EscalationConfig.application_id == data.application_id
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="Escalation config not found")

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