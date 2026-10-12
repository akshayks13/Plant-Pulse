"""
Diagnosis routes - the end-to-end scan flow.

    POST /diagnosis/predict            image -> CNN -> (optionally) retrieval -> stored diagnosis
    POST /diagnosis/{id}/retrieve      (re)run the retrieval step for a stored diagnosis
    GET  /diagnosis/history            the caller's past scans (light: no retrieval payload)
    GET  /diagnosis/{id}               one scan with the full retrieval payload

The web app calls predict with run_retrieval=false and then /retrieve, so it
can show each pipeline stage honestly. API users (Swagger / curl) get the
whole pipeline in one call by leaving run_retrieval at its default (true).
"""
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Diagnosis, SystemLog, User
from ..services import retrieval_client
from ..services.auth import get_current_user
from ..services.ml_service import CNNPrediction, get_ml_service
from ..services.storage import save_image

router = APIRouter(prefix="/diagnosis", tags=["Diagnosis"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CandidateOut(BaseModel):
    label: str
    confidence: float


class DiagnosisOut(BaseModel):
    id: str
    user_id: str
    created_at: str
    image_url: str | None
    crop_type: str | None

    # CNN step
    disease_name: str                      # top-1 class label
    confidence: float
    severity: str
    is_healthy: bool
    model_source: str | None
    candidates: list[CandidateOut]
    runner_up: CandidateOut | None

    # Retrieval step
    result_type: str | None
    retrieval_status: str
    retrieval_note: str | None
    retrieval_at: str | None
    confirmed_disease_id: str | None
    retrieval: dict[str, Any] | None = None   # full /diagnose payload (omitted in history)


class RetrieveRequest(BaseModel):
    question: Optional[str] = None
    confirmed_disease_id: Optional[str] = None   # from an "unsure" result's candidates


# ── Helpers ──────────────────────────────────────────────────────────────────

def _iso(dt: datetime | None) -> str | None:
    """Stored datetimes are naive UTC; mark them so browsers convert to local time."""
    if dt is None:
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


def _loads(raw: str | None, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except ValueError:
        return default


def _diag_out(d: Diagnosis, include_retrieval: bool = True) -> DiagnosisOut:
    candidates = [CandidateOut(**c) for c in _loads(d.top_predictions, [])]
    runner_up = (
        CandidateOut(label=d.runner_up_label, confidence=d.runner_up_confidence or 0.0)
        if d.runner_up_label else None
    )
    return DiagnosisOut(
        id=d.id,
        user_id=d.user_id,
        created_at=_iso(d.created_at) or "",
        image_url=d.image_url,
        crop_type=d.crop_type,
        disease_name=d.disease_name,
        confidence=d.confidence,
        severity=d.severity,
        is_healthy=d.is_healthy,
        model_source=d.model_source,
        candidates=candidates,
        runner_up=runner_up,
        result_type=d.result_type,
        retrieval_status=d.retrieval_status or "pending",
        retrieval_note=d.retrieval_note,
        retrieval_at=_iso(d.retrieval_at),
        confirmed_disease_id=d.confirmed_disease_id,
        retrieval=_loads(d.retrieval_result, None) if include_retrieval else None,
    )


def _apply_cnn(diag: Diagnosis, pred: CNNPrediction) -> None:
    diag.disease_name = pred.label
    diag.confidence = pred.confidence
    diag.severity = pred.severity
    diag.is_healthy = pred.is_healthy
    diag.model_source = pred.model_source
    diag.top_predictions = json.dumps([{"label": c.label, "confidence": c.confidence} for c in pred.candidates])
    if pred.runner_up:
        diag.runner_up_label = pred.runner_up.label
        diag.runner_up_confidence = pred.runner_up.confidence


async def _run_retrieval(
    diag: Diagnosis,
    db: AsyncSession,
    question: str | None = None,
    confirmed_disease_id: str | None = None,
) -> None:
    """Call the retrieval service for this diagnosis and persist the outcome."""
    class_label = diag.disease_name
    confidence = diag.confidence
    runner_up = (
        {"label": diag.runner_up_label, "confidence": diag.runner_up_confidence}
        if diag.runner_up_label else None
    )

    # The user looked at the leaf and confirmed one of the "unsure" candidates:
    # re-ask with that disease's own label and full confidence, as the
    # retrieval service's user guide prescribes.
    if confirmed_disease_id:
        entry = await retrieval_client.disease_entry(confirmed_disease_id)
        labels = (entry or {}).get("class_labels") or []
        if not labels:
            raise HTTPException(status_code=400, detail=f"Unknown disease id '{confirmed_disease_id}'")
        class_label, confidence, runner_up = labels[0], 1.0, None
        diag.confirmed_disease_id = confirmed_disease_id

    outcome = await retrieval_client.diagnose(
        class_label=class_label,
        confidence=confidence,
        runner_up=runner_up,
        question=question,
    )

    diag.retrieval_status = outcome.status
    diag.retrieval_note = outcome.note
    diag.retrieval_at = datetime.utcnow()
    if outcome.ok and outcome.result is not None:
        diag.retrieval_result = json.dumps(outcome.result)
        diag.result_type = outcome.result.get("result_type")
        # A confirmed healthy/disease answer should drive the healthy flag too.
        if diag.result_type == "healthy":
            diag.is_healthy = True
    else:
        # keep any earlier successful payload so a transient outage doesn't wipe it
        if not diag.retrieval_result:
            diag.result_type = None

    db.add(SystemLog(
        level="INFO" if outcome.ok else "WARNING",
        message=(f"Retrieval {outcome.status} for {class_label}"
                 + (f" -> {diag.result_type}" if outcome.ok else f": {outcome.note}")),
        source="retrieval",
        user_id=diag.user_id,
    ))


async def _get_owned(diagnosis_id: str, current_user: User, db: AsyncSession) -> Diagnosis:
    result = await db.execute(select(Diagnosis).where(Diagnosis.id == diagnosis_id))
    diag = result.scalar_one_or_none()
    if not diag:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if diag.user_id != current_user.id and role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    return diag


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/predict", response_model=DiagnosisOut)
async def predict(
    file: UploadFile = File(...),
    crop_type: str | None = Form(None),
    run_retrieval: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 1 (+2): store the image, run the CNN, optionally fetch the treatment plan."""
    file_path, public_url = await save_image(file)

    # ── CNN classification ────────────────────────────────────────────────
    pred = get_ml_service().predict(file_path)

    diag = Diagnosis(user_id=current_user.id, image_url=public_url, crop_type=crop_type)
    _apply_cnn(diag, pred)
    diag.retrieval_status = "pending"
    db.add(diag)
    db.add(SystemLog(
        level="INFO",
        message=f"CNN ({pred.model_source}): {pred.label} ({pred.confidence:.0%})",
        source="diagnosis",
        user_id=current_user.id,
    ))
    await db.commit()
    await db.refresh(diag)

    # ── Retrieval (treatment plan) ────────────────────────────────────────
    if run_retrieval:
        await _run_retrieval(diag, db)
        await db.commit()
        await db.refresh(diag)

    return _diag_out(diag)


@router.post("/{diagnosis_id}/retrieve", response_model=DiagnosisOut)
async def retrieve(
    diagnosis_id: str,
    body: RetrieveRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 2: (re)run the retrieval service for a stored diagnosis.

    Used by the web app right after /predict, to retry after an outage, and
    to confirm a candidate from an "unsure" result.
    """
    diag = await _get_owned(diagnosis_id, current_user, db)
    body = body or RetrieveRequest()
    await _run_retrieval(diag, db, question=body.question, confirmed_disease_id=body.confirmed_disease_id)
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
    return {
        "items": [_diag_out(d, include_retrieval=False) for d in items],
        "total": total, "page": page, "size": size,
    }


@router.get("/{diagnosis_id}", response_model=DiagnosisOut)
async def get_diagnosis(
    diagnosis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    diag = await _get_owned(diagnosis_id, current_user, db)
    return _diag_out(diag)
