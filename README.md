# Plant-Pulse

**AI-powered plant disease detection** — upload a plant photo, get instant diagnosis with symptoms and treatment plans.

## Apps

| App | Description | URL | Port |
|-----|-------------|-----|------|
| `apps/web` | User-facing Next.js app | http://localhost:3000 | 3000 |
| `apps/admin` | Admin dashboard | http://localhost:3001 | 3001 |
| `apps/backend` | FastAPI API + SQLite | http://localhost:8000 | 8000 |
| `apps/retrieval` | Treatment / RAG API + Postgres (pgvector, Docker) | http://localhost:8001 | 8001 |
| API docs | Swagger UI | http://localhost:8000/docs · http://localhost:8001/docs | — |

Both frontends connect to the same backend via `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Credentials

### Admin (dashboard + API)

| Field | Value |
|-------|--------|
| Email | `admin@plant-pulse.ai` |
| Password | `admin123` |

Use these on the **admin app** login (`http://localhost:3001/login`) and for any admin API calls.

### User (web app)

There is no seeded farmer account. Create one via **Register** on the web app:

1. Open http://localhost:3000/auth/register  
2. Enter name, email, password (min 6 characters)  
3. You are logged in automatically and can scan, use community, history, and profile  

### Password reset (demo)

1. Web → **Forgot password** → enter your email  
2. Check the **backend terminal logs** for a line like:  
   `[OTP] Password reset code for you@example.com: 123456`  
3. Enter the OTP → set a new password  

No real email is sent; OTP is printed to logs only.

## Features

### User app (`apps/web`)

| Feature | Route | Notes |
|---------|-------|--------|
| Landing | `/` | Marketing page, how it works, features |
| Register / Login | `/auth/register`, `/auth/login` | JWT auth against backend |
| Forgot / OTP / Reset password | `/auth/forgot-password`, `/auth/verify-otp`, `/auth/reset-password` | OTP in backend logs |
| Scan plant | `/scan` | Upload image → CNN classification → treatment retrieval, with a live stage-by-stage progress card (auth required) |
| Results | `/results/[id]` | Full pipeline view: model candidates, confidence, explanation, evidence-tiered treatments, home remedies, products, sources; handles *unsure* (confirm a candidate), *incurable* and *healthy* results |
| History | `/history` | Past scans with severity filters |
| Community | `/community` | Create posts, like, comment (optional image) |
| Profile | `/profile` | View/edit name, account info, quick links |

### Admin app (`apps/admin`)

| Feature | Route | Notes |
|---------|-------|--------|
| Login | `/login` | Admin JWT; falls back to mock only if API is down |
| Dashboard | `/dashboard` | Users, diagnoses, top diseases |
| Diagnoses | `/diagnoses` | All scans across users |
| Users | `/users` | List / activate-deactivate users |
| Community | `/community` | Moderate / delete posts |
| System logs | `/system` | Backend activity logs |

### Backend API (`apps/backend`)

- Auth: register, login, me, profile update, forgot / verify OTP / reset password  
- Diagnosis: predict (image upload → CNN → retrieval), retrieve (re-run / confirm candidate), history, get by id  
- Community: posts CRUD (author), likes, comments  
- Admin: stats, diagnoses, users, logs, community moderation  
- Storage: uploaded images under `/uploads`  
- DB: SQLite (`plant_pulse.db`)  

## Scan pipeline (end to end)

```
 web /scan                     backend :8000                              retrieval :8001
 ─────────                     ─────────────                              ───────────────
 1. upload image  ──POST /diagnosis/predict──▶  save image
                    (run_retrieval=false)        CNN  ─▶ label, confidence, top-3 candidates
                  ◀──────── Diagnosis ─────────  (ml_service.py · mock until a model file exists)
 2. retrieve      ──POST /diagnosis/{id}/retrieve─▶  POST /diagnose {class_label, confidence, runner_up} ──▶ pgvector KB
                  ◀──────── Diagnosis + retrieval ◀──  result_type · disease · explanation · treatments (source_tier) · diy · products
 3. /results/{id} renders everything; "unsure" results let the user confirm a candidate,
    which re-runs step 2 with the confirmed disease.
```

Every stage's outcome is stored on the `diagnoses` row (`model_source`, `top_predictions`,
`result_type`, `retrieval_status`, `retrieval_result` JSON), so history and admin see it too.

### Plugging in the real CNN

The only place that touches the model is
[`apps/backend/app/services/ml_service.py`](apps/backend/app/services/ml_service.py):

1. Put your model at `MODEL_PATH` (default `apps/backend/model/plant_disease_model.tflite`; `.keras`/`.h5` also load). It is picked up on the next backend start — no code change needed.
2. Make sure `DISEASE_CLASSES` matches your training label order (index *i* of the output vector ↔ `DISEASE_CLASSES[i]`).
3. Adjust `_preprocess()` if your model expects a different input size or normalisation.
4. For any other runtime (PyTorch, ONNX, a remote inference server) replace `_run_inference()` — it must return one probability per class. Everything downstream (top-k, runner-up, retrieval, UI) stays unchanged.

`GET /health` on the backend reports `cnn.model_source` (`tflite` / `keras` / `mock`) and whether the retrieval service is reachable.

### Diagnosis endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/diagnosis/predict` | multipart `file`, optional `crop_type`, `run_retrieval` (default `true`). Runs CNN, then retrieval unless disabled. |
| `POST` | `/diagnosis/{id}/retrieve` | JSON `{question?, confirmed_disease_id?}`. Re-runs retrieval (retry after outage, or confirm an *unsure* candidate). |
| `GET` | `/diagnosis/history` | Caller's scans (without the retrieval payload). |
| `GET` | `/diagnosis/{id}` | One scan with the full retrieval payload. |

`retrieval_status` is one of `pending`, `ok`, `unsupported_class`, `unavailable`, `error`;
`result_type` (when `ok`) is `normal`, `unsure`, `incurable` or `healthy`.

## Stack

- **Web / Admin**: Next.js (App Router) + TypeScript + CSS modules  
- **Backend**: FastAPI + SQLAlchemy + aiosqlite + JWT  
- **AI (CNN)**: TFLite/Keras when a model file is present; deterministic mock otherwise. Single integration point: `apps/backend/app/services/ml_service.py` → `_run_inference()`  
- **KB (client)**: Built-in fallback guidance for classes the retrieval service does not cover  
- **Retrieval service**: FastAPI + Postgres 17 with `pgvector` (Docker) + `sentence-transformers` (`BAAI/bge-small-en-v1.5`); optional Claude API for explanations and Serper for product search  

## Getting started

### 1. Backend

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python3 -m pip install -r requirements.txt
cp .env.example .env
python3 run.py
# or: uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs  

### 2. Web app

```bash
cd apps/web
cp .env.example .env.local
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

→ http://localhost:3000  

### 3. Admin app

```bash
cd apps/admin
cp .env.example .env.local
# Ensure NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev -- -p 3001
```

→ http://localhost:3001  

### 4. Retrieval (treatment) service

Requires Docker. Runs on port **8001** next to the backend. Full guide:
[apps/retrieval/README.md](apps/retrieval/README.md).

```bash
cd apps/retrieval
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
cp .env.example .env               # defaults work locally; API keys optional
make up                            # start the pgvector Postgres container (plantpulse-db)
make build                         # schema -> seed -> chunks + embeddings -> external docs
make api                           # http://localhost:8001  (docs at /docs)
```

Smoke test:

```bash
curl -s localhost:8001/health
curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Late_blight","confidence":0.91}' | jq
python test_pipeline.py            # end-to-end checks against the live DB
```

What it returns and how to read `source_tier` on a dose:
[apps/retrieval/USER_GUIDE.md](apps/retrieval/USER_GUIDE.md). Endpoint
reference: [apps/retrieval/README_API.md](apps/retrieval/README_API.md).

## Environment

Both frontends:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Backend (see `apps/backend/.env.example`):

```env
SECRET_KEY=your-super-secret-key-change-this-in-production
DATABASE_URL=sqlite+aiosqlite:///./plant_pulse.db
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
RETRIEVAL_URL=http://localhost:8001        # treatment / RAG service
RETRIEVAL_TIMEOUT_SECONDS=45
```

Retrieval service (see `apps/retrieval/.env.example`):

```env
DATABASE_URL=postgresql://plantpulse:devonly@127.0.0.1:5432/plantpulse
ANTHROPIC_API_KEY=        # optional: LLM explanations
SERPER_API_KEY=           # optional: live product search
```

## Quick test checklist

1. Start backend on `:8000`  
2. Start retrieval on `:8001` (`make up && make api` in `apps/retrieval`) — optional, scans still work without it  
3. Open web → register → login → scan a leaf photo → watch the CNN → retrieval stages → results (treatments with dose badges) → history  
4. Community → create a post → like / comment  
5. Profile → edit name  
6. Admin → login with `admin@plant-pulse.ai` / `admin123` → users, diagnoses (Pipeline column), community  
7. Forgot password → copy OTP from backend logs → reset  
8. Stop the retrieval service and scan again → results page shows *Treatment service unavailable* with a **Retry** button  

## Notes

- Scan requires a logged-in user.  
- If the API is unreachable the web app shows a clear error (no silent mock). Offline demo mode is opt-in with `NEXT_PUBLIC_USE_MOCK=true`; **admin** may show mock stats.  
- Default admin is seeded on first backend start.  
- The backend calls the retrieval service for every scan. If it is down, the scan still succeeds (`retrieval_status: unavailable`) and the results page offers a **Retry**. Classes outside the 38-class knowledge base (Aloe Vera, Money Plant, Snake Plant, Rose, Tomato Leaf Miner) get built-in guidance instead (`retrieval_status: unsupported_class`).  
