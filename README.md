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

## Run it on your laptop

This runs the whole system locally: the website, the admin dashboard, the backend
with the three CNN models, and the treatment knowledge base (Postgres in Docker).
The first setup takes about 30 minutes and needs about **4 GB** of disk space,
mostly for PyTorch and the database image. After that, starting everything takes
a minute.

Commands are for **macOS / Linux**. Windows users: read [Windows](#windows) first.

### 1. Install these first

| Tool | Version | Check it with |
|---|---|---|
| Git | any | `git --version` |
| Python | **3.12** (3.11 also works) | `python3 --version` |
| Node.js | **20.9 or newer** | `node --version` |
| Docker Desktop | any recent, and **running** | `docker compose version` |
| make | comes with macOS (`xcode-select --install`) and Linux | `make --version` |

These ports must be free: **3000** (website), **3001** (admin), **8000** (backend),
**8001** (knowledge base API) and **5432** (database).

### 2. Get the code

```bash
git clone https://github.com/akshayks13/Plant-Pulse.git
cd Plant-Pulse
git checkout dev/retreival      # the branch with the CNN + treatment work (or main, once it is merged)
ls apps/model_file              # should list the three .pth model files (about 60 MB)
```

The trained models are part of the repository, so there is nothing extra to download.

### 3. One-time setup

Run each block from the repository root (`Plant-Pulse/`).

**a) Knowledge base: database + treatment service**

```bash
cd apps/retrieval
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # the defaults work; the API keys in it are optional
make up                         # starts the Postgres + pgvector container "plantpulse-db"
make build                      # creates the tables and loads the knowledge base
deactivate
cd ../..
```

`make build` downloads a small embedding model (about 130 MB) the first time. It should end with:

```
0 errors, 0 warnings
loaded
built documents for 41 diseases and 17 healthy classes
ingested 4 external document(s) ...
```

**b) Backend: API + CNN models**

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt  # includes PyTorch, so this one takes a while
cp .env.example .env
deactivate
cd ../..
```

> **Linux without an NVIDIA GPU:** a plain `pip install torch` downloads several GB of CUDA
> files you don't need. In **both** virtual environments, install the CPU build first, then
> run the `pip install -r requirements.txt` line:
> `pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu`

**c) Website and admin dashboard**

```bash
cd apps/web   && npm install && cp .env.example .env.local && cd ../..
cd apps/admin && npm install && cp .env.example .env.local && cd ../..
```

### 4. Start everything (every time)

Make sure **Docker Desktop is running**, then open four terminals at the repository root
and start them in this order.

**Terminal 1: knowledge base API (port 8001)**

```bash
cd apps/retrieval
source .venv/bin/activate
make api
```

Wait for `Application startup complete`. `make api` also starts the database container if it was stopped.

**Terminal 2: backend (port 8000)**

```bash
cd apps/backend
source .venv/bin/activate
python3 run.py
```

Wait for the three `Loaded ...` lines (EfficientNet-B0, MobileNetV3-Large, DenseNet-121)
and `Plant-Pulse API ready`.

**Terminal 3: website (port 3000)**

```bash
cd apps/web
npm run dev
```

**Terminal 4: admin dashboard (port 3001, optional)**

```bash
cd apps/admin
npm run dev -- -p 3001
```

### 5. Check that it works

```bash
curl -s localhost:8001/health   # look for "status":"ok" and "kb_chunks":200
curl -s localhost:8000/health   # look for "available":true on all three models and "reachable":true
```

Then in the browser:

1. Open http://localhost:3000/auth/register and create an account. Use a normal-looking
   email such as `you@example.com`; addresses like `@test.local` are rejected.
2. Go to **Scan**, pick a model, upload a leaf photo and press **Analyse plant**.
3. The results page shows the disease, the action plan, products to buy and home remedies.

**Test photos.** The models know 20 classes: Betel, Guava, Hibiscus, Mint and Papaya, each
healthy or with a disease (the full list is in [CNN models](#cnn-models)). Search Google for
e.g. "papaya ringspot virus leaf" or "guava leaf red rust", and crop the screenshot to one leaf.

**Admin dashboard:** http://localhost:3001/login with the admin login under [Credentials](#credentials).

Everyone's data is local: each laptop has its own accounts, scans and database.

### 6. Stop it

Press `Ctrl+C` in each terminal. The database container keeps running in the background,
which is fine. To stop it, run `make down` in `apps/retrieval` (your data is kept).
`make nuke` deletes the database completely; run `make build` again after that.

### After a `git pull`

| If this changed | Run this (with that app's virtual environment active) |
|---|---|
| anything in `apps/retrieval/data/` or `apps/retrieval/schema.sql` | `make build` in `apps/retrieval` |
| a `requirements.txt` | `pip install -r requirements.txt` in that app |
| a `package.json` | `npm install` in that app |

Each scan stores the treatment plan it got at the time. To update an older scan after a
knowledge base change, open it and press **Refresh treatment plan**.

### Windows

- Use `python` (or `py -3.12`) instead of `python3`, and `copy` instead of `cp`.
- Activate a virtual environment with `.venv\Scripts\activate`. In PowerShell it is
  `.venv\Scripts\Activate.ps1`; if PowerShell blocks it, run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- `make` is not available, so run the commands it stands for. In `apps\retrieval`, with the
  virtual environment active:

```powershell
# make up
docker compose up -d --wait
# make build
python validate_kb.py
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U plantpulse -d plantpulse -f /repo/schema.sql
python load_kb.py
python build_documents.py
python ingest_documents.py
# make api
uvicorn app:app --host 127.0.0.1 --port 8001
# make down
docker compose down
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `make up`: *port is already allocated* (5432) | Another Postgres is running on your laptop. Stop it (macOS: `brew services stop postgresql`) and run `make up` again. |
| `make up`: *container name "plantpulse-db" is already in use* | An old copy of the container exists. Run `docker rm -f plantpulse-db`, then `make up` and `make build`. |
| `connection refused` on port 5432 | Docker Desktop is not running. Start it, then `make up`. |
| `make: python: command not found` | The virtual environment is not active. Run `source .venv/bin/activate` first. |
| Backend `/health` shows `"reachable": false` | The knowledge base API (Terminal 1) is not running. |
| A model shows `"available": false` | A `.pth` file is missing from `apps/model_file`. Run `git pull`, or check `MODEL_DIR` in `apps/backend/.env`. |
| Results say **Treatment plan unavailable** | Start Terminal 1, then press **Retry** on the results page. |
| *Address already in use* on 3000 / 8000 / 8001 | Something else uses the port. Find it with `lsof -i :8000` (Windows: `netstat -ano \| findstr :8000`) and stop it. |
| Register says *value is not a valid email address* | Use an ordinary domain such as `example.com`. |
| The first scan is slow | The models are still loading. Wait for the three `Loaded ...` lines in Terminal 2. |

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
| Scan plant | `/scan` | Pick a model (EfficientNet / MobileNet / DenseNet) → upload image → CNN classification → treatment retrieval, with a live stage-by-stage progress card (auth required) |
| Results | `/results/[id]` | Full pipeline view: overview (what it is, why it happened), action plan grouped into care / sprays / biological steps, products to buy per active ingredient, step-by-step home remedies, prevention, sources; handles *unsure* (confirm a candidate), *incurable* and *healthy* results; **Refresh treatment plan** re-fetches the latest knowledge base |
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
 0. load page     ──GET  /diagnosis/models──▶   list of CNN models for the picker
 1. upload image  ──POST /diagnosis/predict──▶  save image
                    (model, run_retrieval=false) chosen CNN ─▶ label, confidence, top-3 candidates
                  ◀──────── Diagnosis ─────────  (ml_service.py · PyTorch models in apps/model_file)
 2. retrieve      ──POST /diagnosis/{id}/retrieve─▶  POST /diagnose {class_label, confidence, runner_up} ──▶ pgvector KB
                  ◀──────── Diagnosis + retrieval ◀──  result_type · disease · explanation · treatments (source_tier) · diy · products
 3. /results/{id} renders everything; "unsure" results let the user confirm a candidate,
    which re-runs step 2 with the confirmed disease.
```

Every stage's outcome is stored on the `diagnoses` row (`model_source`, `top_predictions`,
`result_type`, `retrieval_status`, `retrieval_result` JSON), so history and admin see it too.

### CNN models

Three trained PyTorch models live in [`apps/model_file`](apps/model_file). The user picks one on
the scan page; the backend runs it locally with [timm](https://github.com/huggingface/pytorch-image-models).

| Picker option | Checkpoint | Architecture (timm) | Val. accuracy* |
|---|---|---|---|
| EfficientNet-B0 (default) | `efficientnet_b0_model.pth` | `efficientnet_b0` | 99.92% |
| MobileNetV3-Large | `mobilenetv3_large_model.pth` | `mobilenetv3_large_100` | 99.58% |
| DenseNet-121 | `densenet121_model.pth` | `densenet121` (Dropout + Linear head) | 99.67% |

\*As saved in each checkpoint by the training run.

All three predict the same **20 classes** across five crops: Betel (`Beetel_*` in the dataset),
Guava, Hibiscus, Mint and Papaya. The class names are read from each checkpoint, and every one is
mapped in the retrieval knowledge base (`apps/retrieval/data/class_labels.csv`).

How a prediction runs ([`ml_service.py`](apps/backend/app/services/ml_service.py)):

1. At start-up every checkpoint is loaded with `torch.load(..., weights_only=True)` into its timm
   architecture with a strict weight match, then kept in memory.
2. The photo is EXIF-rotated, resized to 224×224 RGB and normalised with the ImageNet mean/std.
3. The chosen network runs on the best device available (CUDA → Apple MPS → CPU); softmax gives
   probabilities and the top 3 classes are kept. The second one feeds the look-alike check.

To add or swap a model: drop the `.pth` into `apps/model_file` and add one entry to the `MODELS`
dict in `ml_service.py`. Use `MODEL_DIR` in `apps/backend/.env` to load checkpoints from another folder.

`GET /health` reports the device and which models loaded.

> **Accuracy caveat.** On leaf photos from *other* public datasets and Wikimedia, the models were
> right only about a third of the time, whatever preprocessing was tried. The 99%+ figures are on
> the training dataset's own validation split. Expect lower confidence on real-world photos; the
> retrieval service's confidence gate turns anything under 0.6 into an *unsure* result with
> candidates instead of a treatment.

### Diagnosis endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/diagnosis/models` | The CNN models available for the picker (no auth). |
| `POST` | `/diagnosis/predict` | multipart `file`, `model` (`efficientnet` default, `mobilenet`, `densenet`), optional `crop_type`, `run_retrieval` (default `true`). Runs the chosen CNN, then retrieval unless disabled. |
| `POST` | `/diagnosis/{id}/retrieve` | JSON `{question?, confirmed_disease_id?}`. Re-runs retrieval (retry after outage, or confirm an *unsure* candidate). |
| `GET` | `/diagnosis/history` | Caller's scans (without the retrieval payload). |
| `GET` | `/diagnosis/{id}` | One scan with the full retrieval payload. |

`retrieval_status` is one of `pending`, `ok`, `unsupported_class`, `unavailable`, `error`;
`result_type` (when `ok`) is `normal`, `unsure`, `incurable` or `healthy`.

## Stack

- **Web / Admin**: Next.js (App Router) + TypeScript + CSS modules  
- **Backend**: FastAPI + SQLAlchemy + aiosqlite + JWT  
- **AI (CNN)**: PyTorch + timm; EfficientNet-B0, MobileNetV3-Large and DenseNet-121 trained on 20 leaf classes, selectable per scan (`apps/backend/app/services/ml_service.py`)  
- **KB (client)**: Built-in fallback guidance for classes the retrieval service does not cover  
- **Retrieval service**: FastAPI + Postgres 17 with `pgvector` (Docker) + `sentence-transformers` (`BAAI/bge-small-en-v1.5`); optional Claude API for explanations and Serper for product search  

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
# MODEL_DIR=../model_file                  # optional: folder with the .pth models (default: apps/model_file)
```

Retrieval service (see `apps/retrieval/.env.example`):

```env
DATABASE_URL=postgresql://plantpulse:devonly@127.0.0.1:5432/plantpulse
ANTHROPIC_API_KEY=        # optional: LLM explanations
SERPER_API_KEY=           # optional: live product search
```

## Quick test checklist

1. Start backend on `:8000`  
2. Start the knowledge base API on `:8001` (see [Run it on your laptop](#run-it-on-your-laptop)); scans still work without it  
3. Open web → register → scan a leaf photo with each model → results (action plan, products, home remedies) → history  
4. Community → create a post → like / comment  
5. Profile → edit name  
6. Admin → login with `admin@plant-pulse.ai` / `admin123` → users, diagnoses (Pipeline column), community  
7. Forgot password → copy OTP from backend logs → reset  
8. Stop the knowledge base API and scan again → results page shows *Treatment plan unavailable* with a **Retry** button  

## Notes

- Scan requires a logged-in user.  
- If the API is unreachable the web app shows a clear error (no silent mock). Offline demo mode is opt-in with `NEXT_PUBLIC_USE_MOCK=true`; **admin** may show mock stats.  
- Default admin is seeded on first backend start.  
- The backend calls the retrieval service for every scan. If it is down, the scan still succeeds (`retrieval_status: unavailable`) and the results page offers a **Retry**. All 20 CNN classes are covered by the knowledge base; a class it does not know would get `retrieval_status: unsupported_class`.  
