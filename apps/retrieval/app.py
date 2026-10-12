"""
TASK G - the PlantPulse API (FastAPI).

    uvicorn app:app --port 8001        (or: make api)

Endpoints:
    POST /diagnose               CNN output in  -> assembled treatment result out
    GET  /disease/{disease_id}   full knowledge-base entry (test without the CNN)
    GET  /retrieve               debug: ranked chunks for ?disease_id=&q=&section=
    GET  /health                 liveness + which optional services are configured

Config comes from the environment (.env is loaded): DATABASE_URL,
ANTHROPIC_API_KEY (optional), SERPER_API_KEY (optional).
See README_API.md for curl examples.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

import pipeline
from db import get_conn
from embedding import get_model
from retrieval import SECTIONS, retrieve, route_section


@asynccontextmanager
async def lifespan(app):
    get_model()          # load the embedding model once, at start-up
    yield


app = FastAPI(
    title="PlantPulse API",
    description="Treatment-and-explanation service for leaf-disease diagnoses.",
    version="0.1.0",
    lifespan=lifespan,
)


class Candidate(BaseModel):
    class_label: str
    confidence: float = Field(ge=0.0, le=1.0)


class DiagnoseRequest(BaseModel):
    class_label: str = Field(examples=["Tomato_Late_blight"])
    confidence: float = Field(ge=0.0, le=1.0, examples=[0.91])
    runner_up: Optional[Candidate] = Field(default=None,
        description="The CNN's second-best class, used for the look-alike check.")
    is_leaf: Optional[bool] = Field(default=None,
        description="Optional 'is this a leaf' check result; false forces an unsure result.")
    question: Optional[str] = Field(default=None,
        description="Optional plain-English question to steer retrieval.")


@app.get("/health")
def health():
    try:
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM kb_chunk")
            chunks = cur.fetchone()["n"]
        db_ok = True
    except Exception:
        chunks, db_ok = 0, False
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "kb_chunks": chunks,
        "llm_configured": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "product_search_configured": bool(os.environ.get("SERPER_API_KEY")),
    }


@app.post("/diagnose")
def diagnose(req: DiagnoseRequest):
    runner_up = req.runner_up.model_dump() if req.runner_up else None
    result = pipeline.diagnose(req.class_label, req.confidence, runner_up,
                               req.is_leaf, req.question)
    if result is None:
        raise HTTPException(404, f"unknown class_label {req.class_label!r}")
    return result


@app.get("/disease/{disease_id}")
def disease(disease_id: str):
    entry = pipeline.disease_entry(disease_id)
    if entry is None:
        raise HTTPException(404, f"unknown disease_id {disease_id!r}")
    return entry


@app.get("/retrieve")
def retrieve_debug(
    disease_id: str,
    q: str,
    section: Optional[str] = Query(default=None,
        description="one of " + ", ".join(SECTIONS) + ", or 'all'. Omit to let the keyword router pick."),
    k: int = Query(default=6, ge=1, le=20),
):
    if section is None:
        section = route_section(q)       # same cheap router the pipeline uses
    elif section == "all":
        section = None
    elif section not in SECTIONS:
        raise HTTPException(400, f"section must be one of {SECTIONS} or 'all'")
    return {
        "disease_id": disease_id,
        "question": q,
        "section_used": section,
        "routed_section": route_section(q),
        "chunks": retrieve(disease_id, q, section, k),
    }
