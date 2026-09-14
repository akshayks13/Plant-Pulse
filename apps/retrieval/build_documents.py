"""
Turn structured KB rows into retrievable documents, chunk them, embed them.

    pip install psycopg[binary] sentence-transformers
    python build_documents.py

Only documents with source_name = 'curated_kb' are rebuilt here. Externally
ingested extension text (see ingest_documents.py) is left untouched, so it
survives `make docs`.

Design note: the structured tables stay the source of truth for anything
numeric. These documents exist only so the LLM can write a fluent explanation
about symptoms, cause and prevention. Doses are deliberately excluded from the
generated text - if a dose never enters the retrieval context, the model cannot
hallucinate a variation of it.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import psycopg
import psycopg.rows
import yaml
from embedding import embed_texts

DATA = Path(__file__).parent / "data"

DSN = os.environ.get("DATABASE_URL", "postgresql:///plantpulse")
MAX_CHARS = 1200                    # roughly 300 tokens
OVERLAP = 150


def fetch(cur):
    cur.execute("""
        SELECT d.disease_id, d.common_name, d.curability, d.symptoms,
               d.favorable_conditions, d.spread_mechanism,
               c.common_name AS crop, p.scientific_name AS pathogen, p.type AS ptype,
               p.vector_organism, p.survival, p.notes
        FROM disease d
        JOIN crop c ON c.crop_id = d.crop_id
        LEFT JOIN pathogen p ON p.pathogen_id = d.pathogen_id
        WHERE d.is_healthy_class = false
        ORDER BY d.disease_id
    """)
    return cur.fetchall()


def fetch_healthy(cur):
    cur.execute("""
        SELECT d.disease_id, d.common_name, c.common_name AS crop,
               c.crop_id, c.care_notes
        FROM disease d
        JOIN crop c ON c.crop_id = d.crop_id
        WHERE d.is_healthy_class = true
        ORDER BY d.disease_id
    """)
    return cur.fetchall()


def sections(row: dict, controls: list[dict], diy: list[dict]) -> list[tuple[str, str]]:
    """Build one document per section. Section is a retrieval filter."""
    out = []

    out.append(("identification", (
        f"{row['common_name']} on {row['crop']} is caused by {row['pathogen']}, "
        f"a {row['ptype'].replace('_', ' ')} agent. Symptoms: {row['symptoms']}"
    )))

    cause = (
        f"{row['common_name']} on {row['crop']} develops under these conditions: "
        f"{row['favorable_conditions']} It spreads as follows: {row['spread_mechanism']}"
    )
    if row.get("survival"):
        cause += f" The pathogen survives between seasons in: {row['survival']}."
    if row.get("vector_organism"):
        cause += f" It is transmitted by {row['vector_organism']}."
    if row.get("notes"):
        cause += f" {row['notes']}"
    out.append(("cause", cause))

    curability_text = {
        "curable": "This condition can be brought under control and the plant can recover.",
        "manageable": "This cannot be reversed on already damaged tissue. Treatment protects "
                      "healthy new growth and slows further spread.",
        "incurable": "There is no cure. No product will restore an infected plant. "
                     "Management consists of removal and preventing spread to healthy plants.",
    }[row["curability"]]

    for label, classes in (("treatment", ("chemical", "biological")),
                           ("prevention", ("cultural", "physical"))):
        items = [t for t in controls if t["control_class"] in classes]
        if not items:
            continue
        body = " ".join(
            f"{t['title']}"
            + (f" (active ingredient: {t['active_ingredient']}"
               + (f", FRAC group {t['frac_code']}" if t.get("frac_code") else "")
               + (f", IRAC group {t['irac_code']}" if t.get("irac_code") else "")
               + ")" if t.get("active_ingredient") else "")
            + f": {t['instructions']}"
            for t in items
        )
        out.append((label, f"{curability_text} {body}"))

    if diy:
        body = " ".join(
            f"{r['title']} is a home preparation rated {r['efficacy'].replace('_', ' ')}. "
            f"Method: {r['steps']} Safety: {r['safety_notes'] or 'none recorded'}"
            for r in diy
        )
        out.append(("diy", (
            "Home preparations are supplementary. They do not replace a registered "
            "product on an established infection. " + body
        )))

    return out


def chunk(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= MAX_CHARS:
        return [text]
    parts, start = [], 0
    while start < len(text):
        end = start + MAX_CHARS
        if end < len(text):
            cut = text.rfind(". ", start, end)
            if cut > start:
                end = cut + 1
        parts.append(text[start:end].strip())
        start = max(end - OVERLAP, end)
    return [p for p in parts if p]


def store(cur, disease_id, title, section, body,
          source_name="curated_kb", source_url=None) -> int:
    """Insert one document and its embedded chunks. Returns the new doc_id.

    Shared with ingest_documents.py - external docs pass their own
    source_name / source_url so they can be told apart from curated text.
    """
    cur.execute(
        """INSERT INTO kb_document (disease_id, section, title, content, source_name, source_url)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING doc_id""",
        (disease_id, section, title, body, source_name, source_url),
    )
    doc_id = cur.fetchone()["doc_id"]
    pieces = chunk(body)
    vectors = embed_texts(pieces)
    for piece, vec in zip(pieces, vectors):
        cur.execute(
            """INSERT INTO kb_chunk
               (doc_id, disease_id, section, content, token_count, embedding)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            (doc_id, disease_id, section, piece, len(piece.split()), vec),
        )
    return doc_id


def healthy_section(row: dict, watch: dict) -> str:
    """One care document per healthy class, with an early-warning pointer."""
    body = (
        f"This {row['crop']} foliage looks healthy - no disease was detected. "
        f"To keep it that way: {row['care_notes'] or 'follow general good practice for this crop.'}"
    )
    note = (watch or {}).get("watch_note")
    if note:
        body += f" What to watch for next: {note}"
    return body


def main() -> None:
    care_raw = yaml.safe_load((DATA / "healthy_care.yaml").read_text())
    watch_by_crop = {c["crop_id"]: c for c in care_raw["healthy_care"]}

    with psycopg.connect(DSN) as conn:
        with conn.cursor(row_factory=psycopg.rows.dict_row) as cur:
            diseases = fetch(cur)
            healthy = fetch_healthy(cur)

            # Only wipe what this script generates. Externally ingested documents
            # (any other source_name) survive the rebuild. Cascades to kb_chunk.
            cur.execute("DELETE FROM kb_document WHERE source_name = 'curated_kb'")

            for row in diseases:
                cur.execute(
                    "SELECT * FROM treatment_safe WHERE disease_id = %s ORDER BY priority",
                    (row["disease_id"],))
                controls = cur.fetchall()
                cur.execute(
                    "SELECT * FROM diy_remedy WHERE disease_id = %s", (row["disease_id"],))
                diy = cur.fetchall()
                for section, body in sections(row, controls, diy):
                    title = f"{row['common_name']} - {section}"
                    store(cur, row["disease_id"], title, section, body)

            for row in healthy:
                body = healthy_section(row, watch_by_crop.get(row["crop_id"]))
                title = f"{row['common_name']} - healthy"
                store(cur, row["disease_id"], title, "healthy", body)

            conn.commit()

    print(f"built documents for {len(diseases)} diseases and {len(healthy)} healthy classes")


if __name__ == "__main__":
    main()
