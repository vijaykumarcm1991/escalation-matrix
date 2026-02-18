from sqlalchemy import Column, BigInteger, ForeignKey, Boolean, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class EscalationConfig(Base):
    __tablename__ = "escalation_configs"

    id = Column(BigInteger, primary_key=True)

    unit_id = Column(BigInteger, ForeignKey("units.id"), nullable=False)
    geography_id = Column(BigInteger, ForeignKey("geographies.id"), nullable=False)
    infra_app_id = Column(BigInteger, ForeignKey("infra_apps.id"), nullable=False)
    application_id = Column(BigInteger, ForeignKey("applications.id"), nullable=False)

    is_active = Column(Boolean, default=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "unit_id",
            "geography_id",
            "infra_app_id",
            "application_id",
            name="uniq_escalation"
        ),
    )
