"""
TASK F - the answer assembler and confidence gate.

Contract:
    diagnose(class_label, confidence, runner_up=None, is_leaf=None, question=None) -> dict
        The full /diagnose JSON. result_type is one of:
        "normal" | "unsure" | "incurable" | "healthy"
    disease_entry(disease_id) -> dict | None
        The full knowledge-base entry (for GET /disease/{id}).

Order of decisions in diagnose():
    1. class_label -> disease_id through the class_label table.
    2. Out-of-distribution guard: is_leaf == False or confidence < OOD_FLOOR.
    3. Unsure gate: confidence < UNSURE_THRESHOLD, or the runner-up class is a
       recorded look-alike of the top class. Shows candidates + a question.
    4. Healthy class -> care guidance, no treatments, no products.
    5. Incurable -> removal/containment, no product lookup (HLB: report it).
    6. Otherwise: treatments (treatment_safe, priority order) + composed
       explanation + DIY remedies + products for the top verified ingredient.

Every treatment object keeps source_tier from treatment_safe - it is never
dropped or flattened, because the API is the last place that can guarantee a
research-tier dose is badged.
"""

import os
import re
from decimal import Decimal

from dotenv import load_dotenv

from compose import compose, sentences
from db import get_conn
from products import find_products
from retrieval import retrieve, route_section

load_dotenv()

UNSURE_THRESHOLD = float(os.environ.get("UNSURE_THRESHOLD", "0.6"))
OOD_FLOOR = float(os.environ.get("OOD_FLOOR", "0.35"))
WEAK_RETRIEVAL = 0.5     # below this cosine score we warn that guidance is limited

DISCLAIMER = (
    "This is an automated suggestion generated from a knowledge base, not a prescription. "
    "It is not a substitute for advice from your local agricultural extension officer or "
    "Krishi Vigyan Kendra. Always follow the product label for dose, timing and pre-harvest "
    "interval, wear gloves, a mask and eye protection when mixing or spraying, and keep "
    "children and pets away from treated plants."
)

HLB_REPORT_PROMPT = (
    "Huanglongbing (citrus greening) is a regulated disease. Please report the suspected "
    "tree to your local agriculture / horticulture department or Krishi Vigyan Kendra "
    "before doing anything else. Do not move plant material off the property."
)


# ------------------------------------------------------------ DB lookups

def clean(row):
    """Decimal -> float so the row is JSON-serialisable."""
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in row.items()}


def normalize_label(label):
    """'Tomato___Late_blight' -> 'tomato_late_blight'.

    Different exports of the same dataset spell labels differently (single vs
    triple underscores, 'Pepper,_bell' vs 'Pepper___bell', Leaf_Mold vs
    Leaf_mold). Normalising both sides lets them still match the class_label table.
    """
    label = label.lower().replace(",", "").replace(" ", "_")
    return re.sub(r"_+", "_", label)


def resolve_label(class_label):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT label, disease_id FROM class_label")
        rows = cur.fetchall()
    for r in rows:                                   # 1. exact match
        if r["label"] == class_label:
            return r["disease_id"]
    wanted = normalize_label(class_label)
    for r in rows:                                   # 2. same label, different spelling
        if normalize_label(r["label"]) == wanted:
            return r["disease_id"]
    for r in rows:                                   # 3. shortened label, e.g. Tomato___Spider_mites
        if normalize_label(r["label"]).startswith(wanted):
            return r["disease_id"]
    return None


def lookup_disease(disease_id):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT d.disease_id, d.common_name, d.curability, d.is_healthy_class,
                   d.symptoms, d.favorable_conditions, d.spread_mechanism, d.look_alikes,
                   c.crop_id, c.common_name AS crop, c.care_notes,
                   p.scientific_name AS pathogen, p.type AS pathogen_type
            FROM disease d
            JOIN crop c ON c.crop_id = d.crop_id
            LEFT JOIN pathogen p ON p.pathogen_id = d.pathogen_id
            WHERE d.disease_id = %s
        """, (disease_id,))
        row = cur.fetchone()
    return dict(row) if row else None


def load_treatments(disease_id):
    """Always from treatment_safe - never from treatment - so 'none' tier doses are null."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM treatment_safe WHERE disease_id = %s ORDER BY priority, treatment_id",
                    (disease_id,))
        rows = [clean(r) for r in cur.fetchall()]
    for r in rows:
        assert "source_tier" in r, "treatment_safe must expose source_tier"
    return rows


def load_diy(disease_id):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""SELECT diy_id, title, ingredients, steps, prep_time_hours, efficacy,
                              feasibility_score, safety_notes, evidence, verified, source_url
                       FROM diy_remedy WHERE disease_id = %s
                       ORDER BY feasibility_score DESC NULLS LAST, diy_id""", (disease_id,))
        rows = [clean(r) for r in cur.fetchall()]
    for r in rows:
        # 2d: a preventive remedy must not read as a cure for an active infection
        if r["efficacy"] == "preventive":
            r["honesty_note"] = "Preventive only - it will not cure an established infection."
        elif r["efficacy"] == "mild_curative":
            r["honesty_note"] = "Mildly curative on early, light infections; not a replacement for a registered product."
        else:
            r["honesty_note"] = "Not recommended."
    return rows


# ------------------------------------------------------------ small helpers

def public_disease(d):
    """The disease block that goes in every response."""
    return {
        "disease_id": d["disease_id"],
        "common_name": d["common_name"],
        "crop": d["crop"],
        "pathogen": d.get("pathogen"),
        "pathogen_type": d.get("pathogen_type"),
        "curability": d["curability"],
        "is_healthy_class": d["is_healthy_class"],
        "symptoms": d.get("symptoms"),
    }


def distinguishing_question(a, b):
    """One question a person can answer by looking at the leaf."""
    sa = sentences(a.get("symptoms") or "")[:1]
    sb = sentences(b.get("symptoms") or "")[:1]
    sa = sa[0] if sa else "the symptoms recorded for it"
    sb = sb[0] if sb else "the symptoms recorded for it"
    return (f"Look closely at the leaf. Do you see: {sa} (that points to {a['common_name']}) "
            f"- or - {sb} (that points to {b['common_name']})?")


def gather_chunks(disease, question):
    """Retrieve a small, section-balanced context for the composer."""
    name = disease["common_name"]
    asks = {
        "identification": f"what is {name} and what does it look like",
        "cause": f"why did {name} happen and how does it spread",
        "treatment": f"how do I treat {name}",
        "prevention": f"how do I stop {name} coming back",
    }
    chunks, seen = [], set()

    def add(items):
        for c in items:
            if c["chunk_id"] not in seen:
                seen.add(c["chunk_id"])
                chunks.append(c)

    for section, ask in asks.items():
        add(retrieve(disease["disease_id"], ask, section, k=2))
    if question:      # the user's own question gets a routed, slightly bigger search
        add(retrieve(disease["disease_id"], question, route_section(question), k=3))
    return chunks


def retrieval_summary(chunks):
    best = max((c["score"] for c in chunks), default=0.0)
    note = None
    if not chunks:
        note = "No passages were retrieved for this disease; the explanation is limited."
    elif best < WEAK_RETRIEVAL:
        note = "Retrieved passages matched weakly; treat the explanation as limited guidance."
    return {
        "chunks_used": [{"chunk_id": c["chunk_id"], "section": c["section"],
                         "score": c["score"], "source_name": c["source_name"]} for c in chunks],
        "best_score": best,
        "note": note,
    }


def pick_product_ingredient(treatments):
    """Only shop for a registered (label-tier, verified) active ingredient."""
    for t in treatments:
        if t["verified"] and t["source_tier"] == "label" and t.get("active_ingredient"):
            kind = "acaricide" if t.get("irac_code") else "fungicide"
            if t.get("active_ingredient", "").lower().startswith("copper"):
                kind = "bactericide fungicide"
            return t["active_ingredient"], kind
    return None, None


# ------------------------------------------------------------------- main

def diagnose(class_label, confidence, runner_up=None, is_leaf=None, question=None):
    disease_id = resolve_label(class_label)
    if disease_id is None:
        return None                      # the API turns this into a 404

    disease = lookup_disease(disease_id)
    base = {
        "result_type": None,
        "class_label": class_label,
        "confidence": confidence,
        "disease": public_disease(disease),
        "candidates": [],
        "explanation": None,
        "treatments": [],
        "diy": [],
        "products": [],
        "disclaimer": DISCLAIMER,
    }

    # 2. out-of-distribution guard
    if is_leaf is False or confidence < OOD_FLOOR:
        base["result_type"] = "unsure"
        base["unsure_reason"] = "out_of_distribution"
        base["message"] = ("The image does not look like a clear photo of a single affected leaf, "
                           "or the model is not confident enough to name a disease. Please retake "
                           "the photo: one leaf, filling the frame, in daylight, on a plain background.")
        return base

    # 3. unsure gate: low confidence, or a look-alike runner-up
    runner_id = resolve_label(runner_up["class_label"]) if runner_up else None
    look_alike_clash = runner_id is not None and runner_id in (disease["look_alikes"] or [])
    if confidence < UNSURE_THRESHOLD or look_alike_clash:
        candidate_ids = [disease_id]
        if runner_id and runner_id != disease_id:
            candidate_ids.append(runner_id)
        for other in disease["look_alikes"] or []:
            if other not in candidate_ids:
                candidate_ids.append(other)
        candidates = []
        for cid in candidate_ids:
            d = lookup_disease(cid)
            if d:
                candidates.append({
                    "disease_id": d["disease_id"], "common_name": d["common_name"],
                    "crop": d["crop"], "symptoms": d["symptoms"],
                    "confidence": confidence if cid == disease_id else
                                  (runner_up["confidence"] if cid == runner_id else None),
                })
        base["result_type"] = "unsure"
        base["unsure_reason"] = "look_alike_runner_up" if look_alike_clash else "low_confidence"
        base["candidates"] = candidates
        base["question"] = (distinguishing_question(candidates[0], candidates[1])
                            if len(candidates) > 1 else
                            "The model is not confident. Please retake the photo of a single leaf in good light.")
        base["message"] = ("The model could not tell these apart reliably, so no treatment is "
                           "given yet. Answer the question, or check the candidate's symptoms with "
                           "GET /disease/{disease_id}, then re-run with the confirmed label.")
        return base

    # 4. healthy class -> care guidance only
    if disease["is_healthy_class"]:
        chunks = retrieve(disease_id, f"how do I care for healthy {disease['crop']}", "healthy", k=1)
        base["result_type"] = "healthy"
        base["care"] = {
            "care_notes": disease.get("care_notes"),
            "watch_for": chunks[0]["content"] if chunks else None,
        }
        base["retrieval"] = retrieval_summary(chunks)
        base["disclaimer"] = "General care guidance only. No disease was detected in this image."
        return base

    # 5 + 6. treatment results (incurable or normal)
    treatments = load_treatments(disease_id)
    chunks = gather_chunks(disease, question)
    base["explanation"] = compose(disease, chunks, treatments, question)
    base["treatments"] = treatments
    base["diy"] = load_diy(disease_id)
    base["retrieval"] = retrieval_summary(chunks)

    if disease["curability"] == "incurable":
        base["result_type"] = "incurable"
        base["message"] = (f"{disease['common_name']} has no cure. Remove and bag the infected "
                           "plant, and protect the healthy plants around it. No product will "
                           "restore it, so no products are suggested.")
        base["product_note"] = "Product lookup skipped: the disease is incurable."
        if disease_id == "D_ORANGE_HLB":
            base["report_prompt"] = HLB_REPORT_PROMPT
        return base

    base["result_type"] = "normal"
    ingredient, kind = pick_product_ingredient(treatments)
    if ingredient:
        shop = find_products(ingredient, kind)
        base["products"] = shop["products"]
        base["product_note"] = shop["note"]
        base["product_ingredient"] = ingredient
        base["products_searched_at"] = shop["searched_at"]
    else:
        base["product_note"] = ("Product lookup skipped: no registered (label-tier) dose is on file "
                                "for this disease, so we do not recommend a product to buy. Show the "
                                "active ingredients to a local dealer or extension officer instead.")
    return base


def disease_entry(disease_id):
    """Everything the KB knows about one disease, for GET /disease/{id}."""
    disease = lookup_disease(disease_id)
    if disease is None:
        return None
    entry = public_disease(disease)
    entry["favorable_conditions"] = disease.get("favorable_conditions")
    entry["spread_mechanism"] = disease.get("spread_mechanism")
    entry["look_alikes"] = disease.get("look_alikes") or []
    entry["care_notes"] = disease.get("care_notes") if disease["is_healthy_class"] else None
    entry["treatments"] = load_treatments(disease_id)
    entry["diy"] = load_diy(disease_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT label FROM class_label WHERE disease_id = %s", (disease_id,))
        entry["class_labels"] = [r["label"] for r in cur.fetchall()]
        cur.execute("""SELECT doc_id, section, title, source_name, source_url
                       FROM kb_document WHERE disease_id = %s ORDER BY doc_id""", (disease_id,))
        entry["documents"] = [dict(r) for r in cur.fetchall()]
    entry["disclaimer"] = DISCLAIMER
    return entry


if __name__ == "__main__":
    import json
    print(json.dumps(diagnose("Tomato_Late_blight", 0.91), indent=2, default=str)[:3000])
