import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, Enum, UniqueConstraint
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
    otp_code = Column(String, nullable=True)
    otp_created_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    diagnoses = relationship("Diagnosis", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("CommunityPost", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("CommunityComment", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="user", cascade="all, delete-orphan")


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


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    category = Column(String(50), default="general")
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User", back_populates="posts")
    comments = relationship("CommunityComment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")


class CommunityComment(Base):
    __tablename__ = "community_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("CommunityPost", back_populates="comments")
    author = relationship("User", back_populates="comments")


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_user_like"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = Column(String, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("CommunityPost", back_populates="likes")
    user = relationship("User", back_populates="likes")
