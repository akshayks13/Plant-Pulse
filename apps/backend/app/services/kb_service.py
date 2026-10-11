"""
Client for the treatment / RAG service in apps/retrieval.

The CNN's top class goes in, the assembled remedy comes out (treatments, DIY
remedies, explanation, products, and a confidence gate that may answer
"unsure" instead). Any failure returns None: a scan must still succeed when
the knowledge base is down, it just has no remedy attached.
"""
from typing import Optional

import httpx
from loguru import logger

from ..config import get_settings

settings = get_settings()


async def get_remedy(
    class_label: str,
    confidence: float,
    runner_up: Optional[dict] = None,
) -> Optional[dict]:
    payload: dict = {"class_label": class_label, "confidence": confidence}
    if runner_up:
        payload["runner_up"] = runner_up

    url = f"{settings.retrieval_api_url.rstrip('/')}/diagnose"
    try:
        async with httpx.AsyncClient(timeout=settings.retrieval_timeout_seconds) as client:
            res = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        logger.warning(f"Retrieval service unreachable ({url}): {e}")
        return None

    if res.status_code == 404:
        logger.info(f"Retrieval service has no KB entry for {class_label!r}")
        return None
    if res.status_code != 200:
        logger.warning(f"Retrieval service returned {res.status_code} for {class_label!r}")
        return None
    return res.json()
