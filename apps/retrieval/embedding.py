"""
Embedding helper shared by build_documents.py, ingest_documents.py and retrieval.py.

Contract:
    embed_texts(list_of_str) -> list of 384-float lists
    embed_query(str)         -> one 384-float list

Everything must use the SAME model (BAAI/bge-small-en-v1.5, normalised) or the
vector similarity scores become meaningless. That is why this lives in one file.
"""

from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-small-en-v1.5"   # 384 dims, matches vector(384) in schema.sql

_model = None   # loaded once, on first use (takes a few seconds)


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_texts(texts):
    """Embed a list of strings. Returns a list of plain Python float lists."""
    vectors = get_model().encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def embed_query(text):
    """Embed one query string."""
    return embed_texts([text])[0]


def to_pgvector(vector):
    """Format a float list the way pgvector expects: '[0.1,0.2,...]'."""
    return "[" + ",".join(str(x) for x in vector) + "]"
