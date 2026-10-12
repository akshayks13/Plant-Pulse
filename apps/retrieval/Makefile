DC := docker compose
PSQL := $(DC) exec -T db psql -v ON_ERROR_STOP=1 -U plantpulse -d plantpulse

export DATABASE_URL ?= postgresql://plantpulse:$(or $(POSTGRES_PASSWORD),devonly)@127.0.0.1:5432/plantpulse

.PHONY: up down nuke schema validate load docs ingest build api psql logs

up:                     ## start postgres and wait until it accepts connections
	$(DC) up -d --wait

down:                   ## stop, keep data
	$(DC) down

nuke:                   ## stop and delete the volume (fresh database)
	$(DC) down -v

schema: up              ## (re)apply schema.sql - safe to re-run, it drops first
	$(PSQL) -f /repo/schema.sql

validate:               ## check seed files without touching the database
	python validate_kb.py

load: validate schema   ## seed -> postgres
	python load_kb.py

docs: up                ## rebuild curated chunks + embeddings (external docs are kept)
	python build_documents.py

ingest: up              ## add external extension text from data/external_docs.yaml
	python ingest_documents.py

build: load docs ingest ## full pipeline from scratch (schema drops everything first)

api: up                 ## run the FastAPI server on http://127.0.0.1:8001
	uvicorn app:app --host 127.0.0.1 --port 8001

psql: up                ## interactive shell
	$(DC) exec db psql -U plantpulse -d plantpulse

logs:
	$(DC) logs -f db
