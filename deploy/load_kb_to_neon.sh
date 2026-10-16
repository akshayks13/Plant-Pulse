#!/usr/bin/env bash
# One-time load of the disease knowledge base into a hosted Postgres (Neon) that has pgvector.
# Usage:  export DATABASE_URL='postgresql://USER:PASS@HOST/DB?sslmode=require'
#         bash deploy/load_kb_to_neon.sh
set -euo pipefail
cd "$(dirname "$0")/../apps/retrieval"
: "${DATABASE_URL:?export DATABASE_URL first (the Neon connection string)}"

PY=.venv/bin/python
[ -x "$PY" ] || PY=python3

echo "1/5 applying schema (drops and recreates the knowledge-base tables)"
"$PY" - <<'PYEOF'
import os, psycopg
with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
    conn.execute(open("schema.sql").read())
print("   schema applied")
PYEOF

echo "2/5 validating seed files";            "$PY" validate_kb.py
echo "3/5 loading seed data";                "$PY" load_kb.py
echo "4/5 building document chunks and embeddings"; "$PY" build_documents.py
echo "5/5 ingesting external documents";     "$PY" ingest_documents.py
echo "done"
