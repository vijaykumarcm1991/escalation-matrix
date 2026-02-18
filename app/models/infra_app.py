from sqlalchemy import Column, BigInteger, String, Boolean
from app.core.database import Base

class InfraApp(Base):
    __tablename__ = "infra_apps"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(150), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
