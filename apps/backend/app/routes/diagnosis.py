from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel

from ..database import get_db
from ..models import Diagnosis, SystemLog
from ..services.auth import get_current_user
from ..services.ml_service import get_ml_service
from ..services.storage import save_image
from ..models import User

router = APIRouter(prefix="/diagnosis", tags=["Diagnosis"])


class DiagnosisOut(BaseModel):
    id: str
    disease_name: str
    confidence: float
    severity: str
    image_url: str | None
    is_healthy: bool
    crop_type: str | None
    created_at: str
    user_id: str

    class Config:
        from_attributes = True


def _diag_out(d: Diagnosis) -> DiagnosisOut:
    return DiagnosisOut(
        id=d.id,
        disease_name=d.disease_name,
        confidence=d.confidence,
        severity=d.severity,
        image_url=d.image_url,
        is_healthy=d.is_healthy,
        crop_type=d.crop_type,
        created_at=str(d.created_at),
        user_id=d.user_id,
    )


@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    crop_type: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_path, public_url = await save_image(file)

    ml = get_ml_service()
    result = ml.predict(file_path)

    diag = Diagnosis(
        user_id=current_user.id,
        disease_name=result["disease_name"],
        confidence=result["confidence"],
        severity=result["severity"],
        is_healthy=result["is_healthy"],
        image_url=public_url,
        crop_type=crop_type,
    )
    db.add(diag)

    # Log the scan
    log = SystemLog(
        level="INFO",
        message=f"New diagnosis: {result['disease_name']} ({result['confidence']:.0%})",
        source="diagnosis",
        user_id=current_user.id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(diag)

    return _diag_out(diag)


@router.get("/history")
async def history(
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * size
    result = await db.execute(
        select(Diagnosis)
        .where(Diagnosis.user_id == current_user.id)
        .order_by(desc(Diagnosis.created_at))
        .offset(offset)
        .limit(size)
    )
    items = result.scalars().all()
    total_result = await db.execute(
        select(func.count()).where(Diagnosis.user_id == current_user.id).select_from(Diagnosis)
    )
    total = total_result.scalar_one()
    return {"items": [_diag_out(d) for d in items], "total": total, "page": page, "size": size}


@router.get("/{diagnosis_id}")
async def get_diagnosis(
    diagnosis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Diagnosis).where(Diagnosis.id == diagnosis_id))
    diag = result.scalar_one_or_none()
    if not diag:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    if diag.user_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    return _diag_out(diag)
