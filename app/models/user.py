from sqlalchemy import Column, BigInteger, String, Boolean, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, index=True)
    azure_id = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    mobile = Column(String(20), nullable=True)
    department = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    role = Column(String(20), default="user")
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
