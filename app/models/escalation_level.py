from sqlalchemy import Column, BigInteger, Integer, ForeignKey, String, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class EscalationLevel(Base):
    __tablename__ = "escalation_levels"

    id = Column(BigInteger, primary_key=True)

    escalation_config_id = Column(
        BigInteger,
        ForeignKey("escalation_configs.id", ondelete="CASCADE"),
        nullable=False
    )

    level_number = Column(Integer, nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)

    override_mobile = Column(String(20), nullable=True)
    override_email = Column(String(255), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
