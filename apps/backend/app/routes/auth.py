import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from loguru import logger
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import User
from ..services.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_EXPIRE_MINUTES = 10


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "FARMER"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if hasattr(user.role, "value") else user.role,
        is_active=user.is_active,
        created_at=str(user.created_at),
    )


def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _otp_valid(user: User) -> bool:
    if not user.otp_code or not user.otp_created_at:
        return False
    return datetime.utcnow() <= user.otp_created_at + timedelta(minutes=OTP_EXPIRE_MINUTES)


@router.post("/register", response_model=UserResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role="FARMER",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _user_response(user)


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")

    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return _user_response(current_user)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = body.full_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    current_user.full_name = name
    await db.commit()
    await db.refresh(current_user)
    return _user_response(current_user)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    # Always return success to avoid email enumeration
    if not user:
        return {"message": "If that email exists, a reset code has been sent."}

    otp = _generate_otp()
    user.otp_code = otp
    user.otp_created_at = datetime.utcnow()
    await db.commit()

    logger.info(f"[OTP] Password reset code for {user.email}: {otp} (expires in {OTP_EXPIRE_MINUTES}m)")
    return {"message": "If that email exists, a reset code has been sent."}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not _otp_valid(user) or user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return {"message": "OTP verified", "valid": True}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not _otp_valid(user) or user.otp_code != body.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.hashed_password = hash_password(body.new_password)
    user.otp_code = None
    user.otp_created_at = None
    await db.commit()

    logger.info(f"Password reset successful for {user.email}")
    return {"message": "Password updated successfully"}
