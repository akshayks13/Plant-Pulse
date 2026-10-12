"""
TASK A - the retrieval service.

Contract:
    route_section(question) -> section name or None
    retrieve(disease_id, question, section=None, k=6) -> list of chunk dicts
        each: {chunk_id, section, content, score, source_name, source_url, title}

How it works:
    1. FILTER first: we already know the disease from the CNN, so only that
       disease's chunks are considered (and only one section, if given).
    2. RANK second: the remaining chunks are ordered by cosine similarity to the
       question, embedded with the same model the corpus was embedded with.

Score is 1 - cosine distance, so it lies in (0, 1]. Higher is better.

Run directly to try it:
    python retrieval.py
"""

from db import get_conn
from embedding import embed_query, to_pgvector

SECTIONS = ["identification", "cause", "treatment", "prevention", "diy", "healthy"]

# Cheap keyword router. Checked in this order; first match wins.
# No LLM is used for routing on purpose - it is fast, predictable and testable.
ROUTES = [
    ("diy",            ["home-made", "homemade", "home made", "at home", "diy",
                        "kitchen", "natural remedy", "make something", "make my own"]),
    ("prevention",     ["prevent", "coming back", "come back", "stop it", "avoid",
                        "next time", "recur", "again", "future", "protect"]),
    ("treatment",      ["treat", "cure", "spray", "fungicide", "pesticide", "control",
                        "get rid", "fix", "kill", "medicine", "product", "chemical",
                        "dose", "what should i do", "what do i do"]),
    ("cause",          ["why", "cause", "how did", "where did", "spread", "conditions",
                        "reason", "come from"]),
    ("identification", ["what is", "identify", "symptom", "look like", "is it",
                        "signs", "recognise", "recognize", "diagnos"]),
    ("healthy",        ["healthy", "care", "keep it", "looking after"]),
]


def route_section(question):
    """Map a plain-English question to a corpus section. None = search all."""
    q = (question or "").lower()
    for section, keywords in ROUTES:
        for word in keywords:
            if word in q:
                return section
    return None


def retrieve(disease_id, question, section=None, k=6):
    """Filter to the disease (and section), then rank by vector similarity."""
    if section is not None and section not in SECTIONS:
        raise ValueError(f"unknown section {section!r}; expected one of {SECTIONS}")

    query_vec = to_pgvector(embed_query(question))

    sql = """
        SELECT c.chunk_id, c.section, c.content,
               1 - (c.embedding <=> %(q)s::vector) AS score,
               d.title, d.source_name, d.source_url
        FROM kb_chunk c
        JOIN kb_document d ON d.doc_id = c.doc_id
        WHERE c.disease_id = %(disease_id)s
          AND (%(section)s::text IS NULL OR c.section = %(section)s)
        ORDER BY c.embedding <=> %(q)s::vector
        LIMIT %(k)s
    """
    params = {"q": query_vec, "disease_id": disease_id, "section": section, "k": k}

    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    chunks = []
    for r in rows:
        chunks.append({
            "chunk_id": r["chunk_id"],
            "section": r["section"],
            "content": r["content"],
            "score": round(float(r["score"]), 4),
            "title": r["title"],
            "source_name": r["source_name"],
            "source_url": r["source_url"],
        })
    return chunks


def retrieve_for_question(disease_id, question, k=6):
    """Convenience: route the question to a section, then retrieve."""
    return retrieve(disease_id, question, route_section(question), k)


if __name__ == "__main__":
    for chunk in retrieve("D_TOMATO_LATE_BLIGHT", "how do I treat late blight", "treatment"):
        print(f"[{chunk['score']}] ({chunk['section']}, {chunk['source_name']}) "
              f"{chunk['content'][:120]}...")
