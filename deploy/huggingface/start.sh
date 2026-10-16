#!/usr/bin/env bash
# Starts the retrieval service (internal) and the backend (public, port 7860).
set -euo pipefail
cd "$(dirname "$0")/../.."          # repo root

: "${RETRIEVAL_DATABASE_URL:?Add the RETRIEVAL_DATABASE_URL secret (Neon connection string)}"
: "${SECRET_KEY:?Add the SECRET_KEY secret}"
: "${ADMIN_PASSWORD:?Add the ADMIN_PASSWORD secret}"

mkdir -p /tmp/uploads

# Retrieval service: Postgres on Neon, reachable only from inside this container
(
  cd apps/retrieval
  DATABASE_URL="$RETRIEVAL_DATABASE_URL" exec uvicorn app:app --host 127.0.0.1 --port 8001
) &

# Backend: SQLite in /tmp (reset on every restart of a free Space)
cd apps/backend
export DATABASE_URL="sqlite+aiosqlite:////tmp/plant_pulse.db"
export UPLOAD_DIR=/tmp/uploads
export RETRIEVAL_URL=http://127.0.0.1:8001
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
