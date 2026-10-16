#!/usr/bin/env bash
# One-time load of the disease knowledge base into a hosted Postgres (Neon) that has pgvector.
# Usage:  save the Neon connection string in deploy/.neon_url (git-ignored), then: bash deploy/load_kb_to_neon.sh
set -euo pipefail
cd "$(dirname "$0")/../apps/retrieval"
# The connection string comes from $DATABASE_URL, or from the git-ignored file deploy/.neon_url
if [ -z "${DATABASE_URL:-}" ] && [ -f ../../deploy/.neon_url ]; then
  DATABASE_URL="$(tr -d '[:space:]' < ../../deploy/.neon_url)"
fi
: "${DATABASE_URL:?Put the Neon connection string in deploy/.neon_url (or export DATABASE_URL)}"
export DATABASE_URL
case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*) echo "Refusing: DATABASE_URL points at a local database; this script drops tables."; exit 1;;
esac
echo "Target database host: $(printf '%s' "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#')"

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
