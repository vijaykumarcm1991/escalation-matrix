from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.api.deps import require_admin
from app.schemas.bulk_import import BulkImportRequest
from app.models.unit import Unit
from app.models.geography import Geography
from app.models.infra_app import InfraApp
from app.models.application import Application
from app.models.user import User
from app.models.escalation_config import EscalationConfig
from app.models.escalation_level import EscalationLevel
from app.models.audit_log import AuditLog
from typing import Dict

router = APIRouter(prefix="/admin/bulk-import")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
def bulk_import(
    request: BulkImportRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    if request.mode not in ["plan", "apply"]:
        raise HTTPException(status_code=400, detail="mode must be 'plan' or 'apply'")

    # Step 1: Preload master data
    units = {u.name.lower(): u.id for u in db.query(Unit).all()}
    geos = {g.name.lower(): g.id for g in db.query(Geography).all()}
    infras = {i.name.lower(): i.id for i in db.query(InfraApp).all()}
    apps = {a.name.lower(): a.id for a in db.query(Application).all()}
    users = {u.display_name.lower(): u.id for u in db.query(User).all()}

    existing_configs = db.query(EscalationConfig).all()

    summary = {
        "create": 0,
        "update": 0,
        "reactivate": 0,
        "no_change": 0,
        "errors": []
    }

    plan_results = []

    for index, item in enumerate(request.data, start=1):

        # Normalize
        unit_key = item.unit.strip().lower()
        geo_key = item.geography.strip().lower()
        infra_key = item.infra_app.strip().lower()
        app_key = item.application.strip().lower()
        ci_value = item.affected_ci.strip() if item.affected_ci else None
        if ci_value == "":
            ci_value = None
        location_value = item.location.strip() if item.location else None
        if location_value == "":
            location_value = None

        # Validate master references
        if unit_key not in units:
            summary["errors"].append({"row": index, "error": f"Unit '{item.unit}' not found"})
            continue

        if geo_key not in geos:
            summary["errors"].append({"row": index, "error": f"Geography '{item.geography}' not found"})
            continue

        if infra_key not in infras:
            summary["errors"].append({"row": index, "error": f"Infra '{item.infra_app}' not found"})
            continue

        if app_key not in apps:
            summary["errors"].append({"row": index, "error": f"Application '{item.application}' not found"})
            continue

        if not item.levels:
            summary["errors"].append({"row": index, "error": "At least one level required"})
            continue

        # Validate level ordering
        level_numbers = sorted([lvl.level for lvl in item.levels])
        if level_numbers != list(range(1, len(level_numbers) + 1)):
            summary["errors"].append({"row": index, "error": "Levels must be sequential starting from 1"})
            continue

        # Validate users
        for lvl in item.levels:
            if lvl.user.strip().lower() not in users:
                summary["errors"].append({"row": index, "error": f"User '{lvl.user}' not found"})
                continue

        # Compute plan
        unit_id = units[unit_key]
        geo_id = geos[geo_key]
        infra_id = infras[infra_key]
        app_id = apps[app_key]

        config = next(
            (c for c in existing_configs
             if c.unit_id == unit_id
             and c.geography_id == geo_id
             and c.infra_app_id == infra_id
             and c.application_id == app_id
             and c.affected_ci == ci_value
             and c.location == location_value),
            None
        )

        if not config:
            summary["create"] += 1
            action = "CREATE"

        elif not config.is_active:
            summary["reactivate"] += 1
            action = "REACTIVATE"

        else:
            # Fetch existing levels from DB
            existing_levels = db.query(EscalationLevel).filter(
                EscalationLevel.escalation_config_id == config.id
            ).order_by(EscalationLevel.level_number).all()

            # Incoming levels (sorted by level number)
            incoming_user_ids = [
                users[lvl.user.strip().lower()]
                for lvl in sorted(item.levels, key=lambda x: x.level)
            ]

            existing_user_ids = [lvl.user_id for lvl in existing_levels]

            if incoming_user_ids == existing_user_ids:
                summary["no_change"] += 1
                action = "NO_CHANGE"
            else:
                summary["update"] += 1
                action = "UPDATE"

        plan_results.append({
            "row": index,
            "action": action,
            "unit": item.unit,
            "application": item.application
        })

    if request.mode == "plan":
        return {
            "summary": summary,
            "plan": plan_results
        }

    # APPLY mode
    if summary["errors"]:
        raise HTTPException(status_code=400, detail={"errors": summary["errors"]})

    try:
        for item in request.data:

            unit_key = item.unit.strip().lower()
            geo_key = item.geography.strip().lower()
            infra_key = item.infra_app.strip().lower()
            app_key = item.application.strip().lower()

            ci_value = item.affected_ci.strip() if item.affected_ci else None
            if ci_value == "":
                ci_value = None

            location_value = item.location.strip() if item.location else None
            if location_value == "":
                location_value = None

            unit_id = units[unit_key]
            geo_id = geos[geo_key]
            infra_id = infras[infra_key]
            app_id = apps[app_key]

            config = db.query(EscalationConfig).filter(
                EscalationConfig.unit_id == unit_id,
                EscalationConfig.geography_id == geo_id,
                EscalationConfig.infra_app_id == infra_id,
                EscalationConfig.application_id == app_id,
                EscalationConfig.affected_ci == ci_value,
                EscalationConfig.location == location_value
            ).first()

            # Prepare incoming user_ids
            incoming_levels = sorted(item.levels, key=lambda x: x.level)
            incoming_user_ids = [
                users[lvl.user.strip().lower()]
                for lvl in incoming_levels
            ]

            # ---- SKIP IF NO CHANGE ----
            if config and config.is_active:

                existing_levels = db.query(EscalationLevel).filter(
                    EscalationLevel.escalation_config_id == config.id
                ).order_by(EscalationLevel.level_number).all()

                existing_user_ids = [lvl.user_id for lvl in existing_levels]

                if incoming_user_ids == existing_user_ids:
                    # Nothing changed → skip this item
                    continue
            # ---- END SKIP BLOCK ----

            if not config:
                # CREATE
                config = EscalationConfig(
                    unit_id=unit_id,
                    geography_id=geo_id,
                    infra_app_id=infra_id,
                    application_id=app_id,
                    affected_ci=ci_value,
                    location=location_value,
                    is_active=True
                )
                db.add(config)
                db.flush()

                action_type = "CREATE"
                old_data = None

            else:
                if not config.is_active:
                    config.is_active = True
                    action_type = "UPDATE"
                else:
                    action_type = "UPDATE"

                # Capture old levels for audit
                old_levels = db.query(EscalationLevel).filter(
                    EscalationLevel.escalation_config_id == config.id
                ).all()

                old_data = [
                    {
                        "level_number": lvl.level_number,
                        "user_id": lvl.user_id
                    }
                    for lvl in old_levels
                ]

                # Delete old levels
                db.query(EscalationLevel).filter(
                    EscalationLevel.escalation_config_id == config.id
                ).delete()

                db.flush()

            # Insert new levels
            for lvl in incoming_levels:
                new_level = EscalationLevel(
                    escalation_config_id=config.id,
                    level_number=lvl.level,
                    user_id=users[lvl.user.strip().lower()],
                    override_mobile=None,
                    override_email=None
                )
                db.add(new_level)

            # Audit
            audit = AuditLog(
                user_azure_id=current_user["sub"],
                action=action_type,
                entity="EscalationConfig",
                entity_id=config.id,
                old_data=old_data,
                new_data={
                    "levels": [
                        {"level_number": lvl.level, "user": lvl.user}
                        for lvl in incoming_levels
                    ]
                }
            )

            db.add(audit)

        db.commit()

        return {"message": "Bulk import applied successfully"}

    except Exception as e:
        db.rollback()
        raise e