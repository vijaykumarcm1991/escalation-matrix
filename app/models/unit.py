from sqlalchemy import Column, BigInteger, String, Boolean
from app.core.database import Base

class Unit(Base):
    __tablename__ = "units"

    id = Column(BigInteger, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
