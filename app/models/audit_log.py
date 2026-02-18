from sqlalchemy import Column, BigInteger, String, JSON, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True)
    user_azure_id = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(BigInteger, nullable=False)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
