"""
Client for the treatment / RAG service (apps/retrieval, port 8001).

Pipeline position:
    upload  ->  CNN  ->  [ retrieval service (this client) ]  ->  UI

The retrieval service takes the CNN's class label + confidence (not the
image) and returns an assembled answer: disease facts, explanation,
evidence-tiered treatments, DIY remedies, products and a disclaimer.
See apps/retrieval/README_API.md for the response shape.

Every call returns a `RetrievalOutcome` instead of raising, so a down or
partial retrieval service never breaks the scan itself - the diagnosis is
stored with `retrieval_status` set accordingly and can be retried later
via POST /diagnosis/{id}/retrieve.
"""
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from loguru import logger

from ..config import get_settings

settings = get_settings()

STATUS_OK = "ok"
STATUS_UNSUPPORTED = "unsupported_class"   # label not in the 38-class knowledge base
STATUS_UNAVAILABLE = "unavailable"         # service down / timeout
STATUS_ERROR = "error"                     # service answered with an unexpected error


@dataclass
class RetrievalOutcome:
    status: str
    result: Optional[dict[str, Any]] = None
    note: Optional[str] = None

    @property
    def ok(self) -> bool:
        return self.status == STATUS_OK


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.retrieval_url.rstrip("/"),
        timeout=httpx.Timeout(settings.retrieval_timeout_seconds, connect=5.0),
    )


async def diagnose(
    class_label: str,
    confidence: float,
    runner_up: Optional[dict[str, Any]] = None,
    question: Optional[str] = None,
    is_leaf: Optional[bool] = None,
) -> RetrievalOutcome:
    """POST /diagnose on the retrieval service."""
    payload: dict[str, Any] = {
        "class_label": class_label,
        "confidence": max(0.0, min(1.0, float(confidence))),
    }
    if runner_up and runner_up.get("label"):
        payload["runner_up"] = {
            "class_label": runner_up["label"],
            "confidence": max(0.0, min(1.0, float(runner_up.get("confidence", 0.0)))),
        }
    if question:
        payload["question"] = question
    if is_leaf is not None:
        payload["is_leaf"] = is_leaf

    try:
        async with _client() as client:
            res = await client.post("/diagnose", json=payload)
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.warning(f"Retrieval service unreachable at {settings.retrieval_url}: {e}")
        return RetrievalOutcome(
            STATUS_UNAVAILABLE,
            note=(f"Treatment service unreachable at {settings.retrieval_url}. "
                  "Start it with `make api` in apps/retrieval and retry."),
        )
    except httpx.HTTPError as e:
        logger.error(f"Retrieval request failed: {e}")
        return RetrievalOutcome(STATUS_ERROR, note=f"Treatment service request failed: {e}")

    if res.status_code == 404:
        return RetrievalOutcome(
            STATUS_UNSUPPORTED,
            note=(f"'{class_label}' is not in the treatment knowledge base yet; "
                  "showing built-in guidance instead."),
        )
    if res.status_code >= 400:
        detail = _detail(res)
        logger.error(f"Retrieval service returned {res.status_code}: {detail}")
        return RetrievalOutcome(STATUS_ERROR, note=f"Treatment service error ({res.status_code}): {detail}")

    try:
        data = res.json()
    except ValueError:
        return RetrievalOutcome(STATUS_ERROR, note="Treatment service returned a non-JSON response.")
    return RetrievalOutcome(STATUS_OK, result=data)


async def disease_entry(disease_id: str) -> Optional[dict[str, Any]]:
    """GET /disease/{id} - used to turn a confirmed candidate back into a class label."""
    try:
        async with _client() as client:
            res = await client.get(f"/disease/{disease_id}")
    except httpx.HTTPError as e:
        logger.warning(f"Retrieval /disease lookup failed: {e}")
        return None
    if res.status_code != 200:
        return None
    try:
        return res.json()
    except ValueError:
        return None


async def health() -> dict[str, Any]:
    """GET /health - surfaced through the backend's own /health."""
    try:
        async with httpx.AsyncClient(base_url=settings.retrieval_url.rstrip("/"), timeout=3.0) as client:
            res = await client.get("/health")
        data = res.json() if res.status_code == 200 else {}
        return {"url": settings.retrieval_url, "reachable": res.status_code == 200, **data}
    except Exception as e:  # noqa: BLE001 - health must never raise
        return {"url": settings.retrieval_url, "reachable": False, "error": str(e)}


def _detail(res: httpx.Response) -> str:
    try:
        body = res.json()
        return str(body.get("detail", body))
    except ValueError:
        return res.text[:200]
