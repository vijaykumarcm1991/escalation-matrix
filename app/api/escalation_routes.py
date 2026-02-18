from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.escalation_config import EscalationConfig
from app.models.escalation_level import EscalationLevel
from app.models.user import User
from app.schemas.escalation import EscalationCreate

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/")
def create_escalation(data: EscalationCreate, db: Session = Depends(get_db)):

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

    config = db.query(EscalationConfig).filter(
        EscalationConfig.unit_id == unit_id,
        EscalationConfig.geography_id == geography_id,
        EscalationConfig.infra_app_id == infra_app_id,
        EscalationConfig.application_id == application_id
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="Escalation not found")

    levels = db.query(EscalationLevel).filter(
        EscalationLevel.escalation_config_id == config.id
    ).order_by(EscalationLevel.level_number).all()

    response_levels = []

    for level in levels:
        user = db.query(User).filter(User.id == level.user_id).first()

        resolved_mobile = level.override_mobile or user.mobile
        resolved_email = level.override_email or user.email

        response_levels.append({
            "level_number": level.level_number,
            "display_name": user.display_name,
            "mobile": resolved_mobile,
            "email": resolved_email
        })

    return {
        "unit_id": config.unit_id,
        "geography_id": config.geography_id,
        "infra_app_id": config.infra_app_id,
        "application_id": config.application_id,
        "levels": response_levels
    }
