# Plant-Pulse retrieval service (`apps/retrieval`)

The treatment-and-explanation brain of Plant-Pulse. It takes the disease name
and confidence that the image model produces and returns a grounded answer:
cause, treatments with evidence-tiered doses, an explanation written from
retrieved knowledge-base text, DIY remedies, purchasable products, and a
safety disclaimer. It is a separate FastAPI service backed by Postgres with
the `pgvector` extension, running in Docker.

- What it does and how to read a result: [USER_GUIDE.md](USER_GUIDE.md)
- Endpoints with `curl` examples: [README_API.md](README_API.md)

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop (or Docker Engine + Compose v2) | any recent | runs the `pgvector/pgvector:pg17` database |
| Python | 3.11 or 3.12 | 3.12 is what this was built on |
| `make` | any | comes with Xcode CLT on macOS, `build-essential` on Ubuntu |
| Disk | ~3 GB free | PyTorch + the embedding model download |

## 1. Set up (first time)

All commands run from this directory.

```bash
cd apps/retrieval

# a) Python environment (keep it local to this folder; never install system-wide)
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# b) Config
cp .env.example .env                 # defaults work for local dev; keys are optional

# c) Start the pgvector database container
make up                              # docker compose up -d --wait  (container: plantpulse-db)

# d) Build the knowledge base: schema -> seed -> chunks + embeddings -> external docs
make build
```

`make build` runs, in order: `validate` (checks the YAML seed against the
safety rules), `schema` (applies `schema.sql`, dropping any old tables),
`load` (seed YAML to Postgres), `docs` (renders KB rows into text, chunks and
embeds them with `BAAI/bge-small-en-v1.5`), and `ingest` (adds the cited
extension passages in `data/external_docs.yaml`). The first `docs` run
downloads the embedding model (about 130 MB) from Hugging Face; later runs use
the cache.

Expected end state: 38 disease rows, 82 treatments, about 123 embedded chunks.

## 2. Run the API

```bash
source .venv/bin/activate
make api                             # http://127.0.0.1:8001  (docs at /docs)
```

The existing Plant-Pulse backend owns port 8000, so this service uses **8001**.
Check it is alive:

```bash
curl -s localhost:8001/health
# {"status":"ok","database":true,"kb_chunks":123,"llm_configured":false,"product_search_configured":false}

curl -s -X POST localhost:8001/diagnose -H 'content-type: application/json' \
  -d '{"class_label":"Tomato_Late_blight","confidence":0.91}' | jq
```

Run the verification checks (needs the database up):

```bash
python test_pipeline.py
```

## 3. Everyday commands

| Command | What it does |
|---|---|
| `make up` | start the database container and wait until it accepts connections |
| `make down` | stop the container, keep the data |
| `make nuke` | stop and delete the data volume (fresh database next time) |
| `make build` | full rebuild from the YAML seed (drops tables first) |
| `make docs` | rebuild only the generated (curated) chunks; external docs are kept |
| `make ingest` | add or refresh passages from `data/external_docs.yaml` |
| `make validate` | check the seed files without touching the database |
| `make api` | run the FastAPI server on port 8001 |
| `make psql` | open a `psql` shell inside the container |
| `make logs` | follow the database logs |

## 4. Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://plantpulse:devonly@127.0.0.1:5432/plantpulse` | Postgres connection; the Makefile exports the same value |
| `POSTGRES_PASSWORD` | `devonly` | password the container is created with (change both together) |
| `ANTHROPIC_API_KEY` | empty | optional. Enables the Claude-written explanation and LLM product verification. Without it the explanation is assembled from a template (`generated_by: "template"`) |
| `LLM_MODEL` | `claude-opus-5` | model used by `compose.py` |
| `SERPER_API_KEY` | empty | optional. Enables live product / price search. Without it `products` is an empty list with a note |
| `SHOP_COUNTRY` | `in` | country code for product search |
| `UNSURE_THRESHOLD` | `0.6` | below this confidence the answer is "unsure" |
| `OOD_FLOOR` | `0.35` | below this confidence the photo is treated as out-of-distribution |

Never commit `.env`; it is git-ignored.

## 5. How it connects to the rest of Plant-Pulse

```
apps/web  ->  apps/backend (/diagnosis/predict, port 8000)  ->  image model
                        |
                        |  POST /diagnose {class_label, confidence}
                        v
              apps/retrieval (port 8001)  ->  Postgres + pgvector (docker)
```

The backend's ML service names classes like `Tomato___Late_blight`; the
knowledge base uses PlantVillage spelling like `Tomato_Late_blight`. The
retrieval service normalises both (underscores, commas, case, and shortened
names such as `Tomato___Spider_mites`), so backend labels can be sent as-is.
Classes the knowledge base does not cover (Aloe Vera, Money Plant, Snake
Plant, Rose, Tomato Leaf Miner) return `404 unknown class_label`; the caller
should fall back to its own text for those.

Wiring the backend to call this service is not done yet; the frontend
currently uses a client-side knowledge base. When wiring it, forward the
`source_tier` of every dose to the UI unchanged (see USER_GUIDE.md, "Reading a
dose").

## 6. Files

| File | Role |
|---|---|
| `schema.sql` | tables, constraints, the `treatment_safe` view |
| `docker-compose.yml` | the pgvector Postgres container |
| `data/` | YAML/CSV seed: crops, pathogens, diseases, treatments, DIY, class labels, external passages |
| `validate_kb.py`, `load_kb.py` | seed validation and loading |
| `build_documents.py`, `ingest_documents.py`, `embedding.py` | corpus build and embedding |
| `retrieval.py` | filter-then-rank vector search + keyword section router |
| `compose.py` | explanation composer (Claude or template) with the dose / ingredient safety pass |
| `products.py` | product and price lookup with verification and a 36 h cache |
| `pipeline.py` | confidence gate, curability branching, answer assembly |
| `app.py` | FastAPI endpoints |
| `test_pipeline.py` | end-to-end checks |

## 7. Troubleshooting

- **`make up` fails with "port is already allocated" or "container name plantpulse-db is already in use".**
  Another copy of this database is running (for example from the original
  `NNDL-KB` folder). Either keep using that one (the service only needs
  something on `127.0.0.1:5432` with the same credentials) or stop it with
  `docker stop plantpulse-db && docker rm plantpulse-db`, then `make up` again.
- **`psycopg.OperationalError: connection refused`.** The container is not up.
  Run `make up`; `docker ps` should show `plantpulse-db` as healthy.
- **First request is slow / `make docs` hangs at "Loading weights".** The
  embedding model is being downloaded. Wait for it once.
- **`make` says `python: command not found`.** Activate the venv first
  (`source .venv/bin/activate`); the Makefile calls plain `python`.
- **`/diagnose` returns 404.** The label is not in the knowledge base. Check
  `data/class_labels.csv` for the 38 supported classes.
- **Explanation says `generated_by: "template"`.** No `ANTHROPIC_API_KEY` is
  set. This is expected and safe; set the key in `.env` to enable the LLM.
