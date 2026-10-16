# Deploying PlantPulse (free tiers)

| Part | Where | Notes |
|---|---|---|
| Knowledge-base database | Neon (Postgres + pgvector) | loaded once with `deploy/load_kb_to_neon.sh` |
| Retrieval service | Render, free web service | `render.yaml` -> `plantpulse-retrieval` |
| Backend API | Render, free web service | `render.yaml` -> `plantpulse-api` (one CNN in memory: EfficientNet-B0) |
| Web app and Admin app | Vercel | `apps/web` and `apps/admin` |

Code branch: `deploy` (`main` and `local` are untouched).

## 1. Neon (done once)

Create a Neon project, save its connection string in the git-ignored file `deploy/.neon_url`, then run `bash deploy/load_kb_to_neon.sh`. Check with
`psql "$(cat deploy/.neon_url)" -c "select count(*) from kb_chunk;"` (expect 200).

## 2. Render (API and retrieval)

1. Sign up at render.com with GitHub.
2. **New -> Blueprint**, pick the repo `akshayks13/Plant-Pulse` and the branch `deploy`. Render reads `render.yaml` and creates both services.
3. Fill the prompted values:

   | Service | Variable | Value |
   |---|---|---|
   | plantpulse-retrieval | `DATABASE_URL` | contents of `deploy/.neon_url` |
   | plantpulse-retrieval | `ANTHROPIC_API_KEY`, `SERPER_API_KEY` | leave empty (optional) |
   | plantpulse-api | `ADMIN_PASSWORD` | the admin login password you want |
   | plantpulse-api | `RETRIEVAL_URL` | the public URL of plantpulse-retrieval, e.g. `https://plantpulse-retrieval.onrender.com` (copy it from the dashboard) |
   | plantpulse-api | `CORS_ORIGINS` | temporary `https://example.com`, replaced in step 4 |

   `SECRET_KEY` and the shared `RETRIEVAL_API_KEY` are generated automatically.
4. Wait for both builds (10 to 15 minutes). Then open `https://<plantpulse-api URL>/health`: it should show `"device": "cpu"` and the retrieval service as reachable.

## 3. Vercel (web and admin)

Two projects from the same repo, root directories `apps/web` and `apps/admin`, each with the environment variable `NEXT_PUBLIC_API_URL` = the plantpulse-api URL. Note both Vercel URLs.

## 4. Allow the frontends to call the API

In Render, plantpulse-api -> Environment, set `CORS_ORIGINS` to both Vercel URLs, comma separated, no trailing slash. The service redeploys.

## 5. Test

Open the web app, register, scan a leaf, and check that a diagnosis and treatment advice appear. Log into the admin app with `admin@plant-pulse.ai` and your `ADMIN_PASSWORD`.

## Things to know about the free tiers

- **Memory:** measured on CPU, the backend uses about 350 MB and retrieval about 205 MB, against a 512 MB limit. Only the EfficientNet-B0 file is shipped; the scan page greys out the other two models ("Not available right now").
- **Speed:** a free instance has a fraction of a CPU, so a scan can take several seconds, and a cold start (after 15 minutes idle) can take one to two minutes. Open the site a few minutes before a demo.
- **Resets:** the disk is not persistent. Users, scan history and uploaded photos reset when the API restarts. The admin account is re-created on start.
- **Admin mock data:** if the admin app cannot reach the API it shows built-in mock data. Check `/health` to be sure.
- **Local development** is unchanged: with `DEBUG=true` (default) the admin password falls back to `admin123`, all three models load, and no API key is needed.

## Environment variables added for deployment

`SECRET_KEY`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `PRELOAD_MODELS`, `MAX_LOADED_MODELS` (backend), `RETRIEVAL_API_KEY` (both services), `EMBEDDING_BACKEND=fastembed` (retrieval, same bge-small model through ONNX Runtime; vectors match the default backend to six decimals).
