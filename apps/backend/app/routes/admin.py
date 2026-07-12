from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel

from ..database import get_db
from ..models import User, Diagnosis, SystemLog
from ..services.auth import get_admin_user

router = APIRouter(prefix="/admin", tags=["Admin"])


class UpdateUserRequest(BaseModel):
    is_active: bool | None = None
    role: str | None = None


@router.get("/stats")
async def get_stats(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_diagnoses = (await db.execute(select(func.count()).select_from(Diagnosis))).scalar_one()

    from datetime import datetime, timedelta
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    active_today = (await db.execute(
        select(func.count(func.distinct(Diagnosis.user_id)))
        .where(Diagnosis.created_at >= today_start)
    )).scalar_one()

    diagnoses_today = (await db.execute(
        select(func.count()).select_from(Diagnosis).where(Diagnosis.created_at >= today_start)
    )).scalar_one()

    # Top diseases
    top_result = await db.execute(
        select(Diagnosis.disease_name, func.count().label("cnt"))
        .group_by(Diagnosis.disease_name)
        .order_by(desc("cnt"))
        .limit(10)
    )
    top_diseases = [{"name": row.disease_name, "count": row.cnt} for row in top_result]

    return {
        "total_users": total_users,
        "total_diagnoses": total_diagnoses,
        "active_users_today": active_today,
        "diagnoses_today": diagnoses_today,
        "top_diseases": top_diseases,
        "system_health": "healthy",
    }


@router.get("/diagnoses")
async def list_diagnoses(
    page: int = 1,
    size: int = 20,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    result = await db.execute(
        select(Diagnosis, User.email.label("user_email"))
        .join(User, Diagnosis.user_id == User.id)
        .order_by(desc(Diagnosis.created_at))
        .offset(offset)
        .limit(size)
    )
    rows = result.all()
    total = (await db.execute(select(func.count()).select_from(Diagnosis))).scalar_one()

    items = []
    for row in rows:
        d = row.Diagnosis
        items.append({
            "id": d.id,
            "disease_name": d.disease_name,
            "confidence": d.confidence,
            "severity": d.severity,
            "image_url": d.image_url,
            "is_healthy": d.is_healthy,
            "created_at": str(d.created_at),
            "user_id": d.user_id,
            "user_email": row.user_email,
        })

    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/users")
async def list_users(
    page: int = 1,
    size: int = 50,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    result = await db.execute(
        select(
            User,
            func.count(Diagnosis.id).label("total_diagnoses")
        )
        .outerjoin(Diagnosis, User.id == Diagnosis.user_id)
        .group_by(User.id)
        .order_by(desc(User.created_at))
        .offset(offset)
        .limit(size)
    )
    rows = result.all()
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    items = []
    for row in rows:
        u = row.User
        items.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "is_active": u.is_active,
            "created_at": str(u.created_at),
            "total_diagnoses": row.total_diagnoses,
        })

    return {"items": items, "total": total}


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserRequest,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")

    if body.is_active is not None:
        user.is_active = body.is_active
    if body.role is not None:
        user.role = body.role

    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "is_active": user.is_active, "role": user.role}


@router.get("/logs")
async def get_logs(
    page: int = 1,
    size: int = 100,
    level: str | None = None,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    query = select(SystemLog).order_by(desc(SystemLog.created_at))
    if level:
        query = query.where(SystemLog.level == level.upper())
    result = await db.execute(query.offset(offset).limit(size))
    items = result.scalars().all()
    return {
        "items": [{
            "id": l.id,
            "level": l.level,
            "message": l.message,
            "source": l.source,
            "created_at": str(l.created_at),
        } for l in items]
    }
