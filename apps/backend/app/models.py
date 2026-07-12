import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, Enum
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    FARMER = "FARMER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.FARMER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    diagnoses = relationship("Diagnosis", back_populates="user", cascade="all, delete-orphan")


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    disease_name = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    severity = Column(String, default="moderate")
    image_url = Column(String)
    is_healthy = Column(Boolean, default=False)
    crop_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="diagnoses")


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    level = Column(String, default="INFO")  # INFO, WARNING, ERROR, CRITICAL
    message = Column(Text, nullable=False)
    source = Column(String, default="system")
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
