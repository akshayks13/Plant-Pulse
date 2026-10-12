"""
TASK C - ingest real extension text into the retrieval corpus.

    python ingest_documents.py                 # reads data/external_docs.yaml
    python ingest_documents.py my_docs.yaml    # or another file

Contract:
    ingest(path) -> number of documents inserted

Input file: {disease_id: [{section, title, content, source_name, source_url}, ...]}
Each entry becomes one kb_document plus its embedded kb_chunk rows, reusing
chunk() and store() from build_documents.py so chunking and embedding are
identical to the curated text.

Rules enforced here:
  - source_name must not be 'curated_kb' (that is what `make docs` deletes).
  - source_url is required (copyright: we keep short passages and always link).
  - section must be one of the corpus sections.
  - Re-running is safe: a document with the same disease, section and
    source_url is replaced, not duplicated.
"""

import sys
from pathlib import Path

import yaml

from build_documents import store
from db import get_conn
from retrieval import SECTIONS

DEFAULT_FILE = Path(__file__).parent / "data" / "external_docs.yaml"
MAX_CHARS = 2000   # a short passage, not an article


def check_entry(disease_id, entry):
    """Return an error message, or None if the entry is fine."""
    for field in ("section", "title", "content", "source_name", "source_url"):
        if not entry.get(field):
            return f"{disease_id}: missing '{field}'"
    if entry["section"] not in SECTIONS:
        return f"{disease_id}: bad section {entry['section']!r}"
    if entry["source_name"] == "curated_kb":
        return f"{disease_id}: source_name 'curated_kb' is reserved for generated text"
    if len(entry["content"]) > MAX_CHARS:
        return f"{disease_id}: passage longer than {MAX_CHARS} chars - keep it short"
    return None


def ingest(path=DEFAULT_FILE):
    data = yaml.safe_load(Path(path).read_text()) or {}
    inserted = 0

    with get_conn() as conn, conn.cursor() as cur:
        for disease_id, entries in data.items():
            cur.execute("SELECT 1 FROM disease WHERE disease_id = %s", (disease_id,))
            if cur.fetchone() is None:
                print(f"skip: unknown disease_id {disease_id}")
                continue

            for entry in entries or []:
                problem = check_entry(disease_id, entry)
                if problem:
                    print("skip:", problem)
                    continue

                # replace an older copy of the same passage instead of duplicating it
                cur.execute(
                    """DELETE FROM kb_document
                       WHERE disease_id = %s AND section = %s AND source_url = %s
                         AND source_name <> 'curated_kb'""",
                    (disease_id, entry["section"], entry["source_url"]),
                )
                store(cur, disease_id, entry["title"], entry["section"],
                      entry["content"].strip(), entry["source_name"], entry["source_url"])
                inserted += 1

        conn.commit()

    print(f"ingested {inserted} external document(s) from {path}")
    return inserted


if __name__ == "__main__":
    ingest(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FILE)
