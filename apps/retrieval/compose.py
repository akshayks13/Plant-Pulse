"""
TASK D - the LLM answer composer.

Contract:
    compose(disease, chunks, treatments, question=None) -> explanation dict
        {summary, why_it_happened, treatment_steps[], prevention[],
         citations[], generated_by, note}

Where the words come from:
    - The LLM (Claude) may ONLY write from the retrieved chunks and the
      structured treatment rows we hand it. The system prompt says so, and
      after the model answers we check its text again in Python.
    - Numbers never come from the LLM. Doses are rendered by the API from
      treatment_safe (with their source_tier). Any per-litre rate that still
      slips into free text is replaced by a placeholder here.
    - Any sentence naming an active ingredient that is not in this disease's
      treatment rows is removed from the answer.

If no ANTHROPIC_API_KEY is configured (or the call fails), a plain template
composer builds the same JSON shape straight from the chunks and the rows.
The `generated_by` field tells the caller which path produced the text.
"""

import json
import os
import re

from dotenv import load_dotenv

from db import get_conn

load_dotenv()

LLM_MODEL = os.environ.get("LLM_MODEL", "claude-opus-5")

DOSE_PLACEHOLDER = "[dose: see the treatment card]"

# Matches things like "2.5 g/L", "2 g per litre", "2-4 g/L", "1 ml with 1 litre".
DOSE_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?"                               # 2 or 2.5
    r"(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?"              # optional range 2-4
    r"\s*(?:g|gm|grams?|ml|mL|millilitres?|milliliters?)"  # unit
    r"\s*(?:/|per|with|in|to)\s*"                    # joiner
    r"(?:1\s*|one\s*|a\s*)?(?:L|l|litres?|liters?)\b",
    re.IGNORECASE,
)

SYSTEM_PROMPT = """You are PlantPulse, explaining a plant disease to a home gardener.

You are given CONTEXT: numbered passages retrieved from a curated knowledge base
and extension literature, plus structured treatment facts from a database.

Hard rules:
1. Write ONLY from the context. Do not invent any active ingredient, product,
   dose, rate, interval or number that is not present in the context.
2. Never write a dose or per-litre rate in your prose, even if the context
   contains one. The app shows doses from the database with an evidence badge.
   Say "use the dose shown on the treatment card" instead.
3. If the context does not answer something, say the guidance is limited.
   Do not guess.
4. If curability is "incurable", write a removal-and-containment message.
   Never suggest a cure or a product to buy for an incurable disease.
5. Chemistry must match the pathogen type described in the context; do not
   add fungicides for bacteria or viruses, or FRAC fungicides for mites.
6. Cite passages by their id in the citations list.

Respond with JSON only, no code fences, in exactly this shape:
{"summary": "...", "why_it_happened": "...", "treatment_steps": ["..."],
 "prevention": ["..."], "citations": [1, 2]}
"""


# ---------------------------------------------------------------- helpers

def llm_available():
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def scrub_doses(text):
    """Replace any per-litre rate in free text with a placeholder."""
    return DOSE_PATTERN.sub(DOSE_PLACEHOLDER, text or "")


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if s.strip()]


def first_sentences(text, n):
    return " ".join(sentences(text)[:n])


def name_variants(name):
    """'Metalaxyl-M (mefenoxam)' -> {'metalaxyl-m', 'mefenoxam', 'metalaxyl'}"""
    out = set()
    for part in re.split(r"[/()]", name or ""):
        part = part.strip().lower()
        if len(part) > 3:
            out.add(part)
            base = re.split(r"[\s-]", part)[0]      # first word, e.g. 'metalaxyl'
            if len(base) > 3:
                out.add(base)
    return out


def all_ingredient_names():
    """Every active ingredient name variant in the database, lower-cased."""
    names = set()
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM active_ingredient")
        for row in cur.fetchall():
            names |= name_variants(row["name"])
    return names


def allowed_ingredient_names(treatments):
    """Only the ingredients in THIS disease's treatment rows may be named.

    Deliberately stricter than 'anywhere in the context': a retrieved passage
    may mention a chemical in a warning ("do not use azoxystrobin"), and we do
    not want the model to be able to turn that into a recommendation.
    """
    names = set()
    for t in treatments:
        names |= name_variants(t.get("active_ingredient"))
    return names


def drop_unknown_ingredients(items, allowed, known):
    """Remove any text item that names an ingredient not present in the context."""
    kept, dropped = [], []
    for item in items:
        low = item.lower()
        bad = [name for name in known if name in low and name not in allowed]
        if bad:
            dropped.append(bad[0])
        else:
            kept.append(item)
    return kept, dropped


def parse_json(text):
    """Be forgiving: strip code fences, cut to the outer braces, then json.loads."""
    if not text:
        return None
    text = re.sub(r"```(?:json)?", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


def make_citations(chunks):
    seen, out = set(), []
    for c in chunks:
        key = (c.get("source_name"), c.get("source_url"), c["section"])
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "chunk_id": c["chunk_id"],
            "section": c["section"],
            "title": c.get("title"),
            "source_name": c.get("source_name"),
            "source_url": c.get("source_url"),
        })
    return out


# ---------------------------------------------------------------- LLM path

def ask_llm(system, user, max_tokens=4000):
    """One call to Claude. Returns the text, or None on refusal / error."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.beta.messages.create(
        model=LLM_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": "medium"},
        # If the model declines for a safety reason, the API retries on a
        # fallback model inside the same call instead of returning nothing.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        return None
    return "".join(block.text for block in response.content if block.type == "text")


def build_user_prompt(disease, chunks, treatments, question):
    lines = [
        f"DISEASE: {disease['common_name']} on {disease['crop']}",
        f"PATHOGEN: {disease.get('pathogen') or 'none'} ({disease.get('pathogen_type') or 'none'})",
        f"CURABILITY: {disease['curability']}",
        f"USER QUESTION: {question or 'What is this and how do I treat it?'}",
        "",
        "PASSAGES:",
    ]
    for c in chunks:
        lines.append(f"[{c['chunk_id']}] ({c['section']}, {c.get('source_name')}) {c['content']}")
    lines += ["", "STRUCTURED TREATMENTS (priority order; doses are shown by the app, not by you):"]
    for t in treatments:
        ai = f" active ingredient: {t['active_ingredient']}" if t.get("active_ingredient") else ""
        lines.append(f"- [{t['control_class']}] {t['title']}:{ai}. {t['instructions']}")
    return "\n".join(lines)


def compose_with_llm(disease, chunks, treatments, question):
    try:
        raw = ask_llm(SYSTEM_PROMPT, build_user_prompt(disease, chunks, treatments, question))
    except Exception as err:          # network, auth, bad model id, ... -> template
        print("compose: LLM call failed:", err)
        return None
    data = parse_json(raw)
    if not data:
        return None
    return {
        "summary": str(data.get("summary", "")),
        "why_it_happened": str(data.get("why_it_happened", "")),
        "treatment_steps": [str(s) for s in data.get("treatment_steps", [])],
        "prevention": [str(s) for s in data.get("prevention", [])],
        "generated_by": "llm",
        "note": f"Composed by {LLM_MODEL} from the retrieved passages and database rows only.",
    }


# ------------------------------------------------------------ template path

def compose_from_template(disease, chunks, treatments):
    """No LLM: assemble the same shape directly from the chunks and rows."""
    by_section = {}
    for c in chunks:
        by_section.setdefault(c["section"], []).append(c)

    ident = " ".join(c["content"] for c in by_section.get("identification", []))
    cause = " ".join(c["content"] for c in by_section.get("cause", []))
    name, crop = disease["common_name"], disease["crop"]

    if disease["curability"] == "incurable":
        summary = (f"{name} on {crop} cannot be cured. No product will restore an infected "
                   f"plant. The goal is to remove it and protect the healthy plants around it. "
                   + first_sentences(ident, 1))
        steps = [f"{t['title']}: {t['instructions']}" for t in treatments]
    else:
        summary = first_sentences(ident, 2) or f"{name} on {crop}."
        if disease["curability"] == "manageable":
            summary += " Damaged tissue will not recover; treatment protects new growth and slows spread."
        steps = []
        for t in treatments:
            if t["control_class"] in ("chemical", "biological"):
                ai = f" (active ingredient: {t['active_ingredient']})" if t.get("active_ingredient") else ""
                steps.append(f"{t['title']}{ai}: {t['instructions']}")

    if disease["curability"] == "incurable":
        prevention = []          # the removal steps above already cover containment
    else:
        prevention = [f"{t['title']}: {t['instructions']}" for t in treatments
                      if t["control_class"] in ("cultural", "physical")]
    for c in by_section.get("prevention", []):
        if c.get("source_name") != "curated_kb":       # add real extension advice
            prevention.append(f"{c['source_name']}: {first_sentences(c['content'], 3)}")

    return {
        "summary": summary,
        "why_it_happened": first_sentences(cause, 4) or "The knowledge base has no cause text for this disease.",
        "treatment_steps": steps,
        "prevention": prevention,
        "generated_by": "template",
        "note": "Assembled directly from the knowledge base; no LLM was configured (set ANTHROPIC_API_KEY to enable fluent explanations).",
    }


# ----------------------------------------------------------------- entry

def finalize(result, chunks, treatments):
    """Safety pass that both paths go through."""
    known = all_ingredient_names()
    allowed = allowed_ingredient_names(treatments)

    result["summary"] = scrub_doses(result["summary"])
    result["why_it_happened"] = scrub_doses(result["why_it_happened"])
    result["treatment_steps"] = [scrub_doses(s) for s in result["treatment_steps"]]
    result["prevention"] = [scrub_doses(s) for s in result["prevention"]]

    dropped = []
    result["treatment_steps"], d = drop_unknown_ingredients(result["treatment_steps"], allowed, known)
    dropped += d
    result["prevention"], d = drop_unknown_ingredients(result["prevention"], allowed, known)
    dropped += d
    for field in ("summary", "why_it_happened"):
        kept, d = drop_unknown_ingredients(sentences(result[field]), allowed, known)
        result[field] = " ".join(kept)
        dropped += d
    if dropped:
        result["note"] += (" Removed text naming ingredients that are not in this disease's "
                           f"treatment list: {sorted(set(dropped))}.")

    result["citations"] = make_citations(chunks)
    if not chunks:
        result["note"] += " No passages were retrieved, so the explanation is limited."
    return result


def compose(disease, chunks, treatments, question=None):
    """Main entry point. See module docstring for the contract."""
    result = None
    if llm_available():
        result = compose_with_llm(disease, chunks, treatments, question)
    if result is None:
        result = compose_from_template(disease, chunks, treatments)
    return finalize(result, chunks, treatments)


if __name__ == "__main__":
    print(scrub_doses("Mix 2.5 g/L and also 2 g per litre or 1 ml with 1 litre; 75% WP stays."))
