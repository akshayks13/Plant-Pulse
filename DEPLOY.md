# Deploying PlantPulse (free tiers, no credit card)

| Part | Where | What runs there |
|---|---|---|
| Web app | Vercel | `apps/web` |
| Admin app | Vercel | `apps/admin` |
| API | Hugging Face Space (Docker) | `apps/backend` (public) + `apps/retrieval` (private, same container) + the 3 `.pth` models |
| Knowledge-base database | Neon (Postgres + pgvector) | tables used by `apps/retrieval` |

Do the steps in this order: Neon, then the Space, then Vercel, then go back to the Space once to set CORS.

## 0. Code branch

The deployment changes live on the `deploy` branch (`main` and `local` are untouched). The Space builds from `deploy`: change `ARG REPO_REF` in its Dockerfile to use another branch.

```bash
git checkout deploy && git push -u origin deploy
```

## 1. Neon (database)

1. Sign up at neon.com (GitHub login works) and create a project named `plantpulse` (Postgres 17, region closest to you).
2. Open **Connect** and copy the connection string. It looks like `postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
3. From the repo root, load the knowledge base (a few minutes; it computes embeddings on your computer):

   ```bash
   export DATABASE_URL='<the connection string>'
   bash deploy/load_kb_to_neon.sh
   ```

   It uses `apps/retrieval/.venv` if present, otherwise `python3` (install `apps/retrieval/requirements.txt` first).
4. Check: `psql "$DATABASE_URL" -c "select count(*) from kb_chunk;"` should print a number above 0.

## 2. Hugging Face Space (API)

1. Sign up at huggingface.co. **New Space** -> name `plantpulse-api` -> SDK **Docker (Blank)** -> hardware **CPU basic (free)** -> **Public**.
2. In the Space's **Files** tab, upload two files:
   - `deploy/huggingface/Dockerfile` as `Dockerfile`
   - `deploy/huggingface/SPACE_README.md` as `README.md` (replace the generated one)
3. **Settings -> Variables and secrets -> New secret**, add:

   | Name | Value |
   |---|---|
   | `RETRIEVAL_DATABASE_URL` | the Neon connection string |
   | `SECRET_KEY` | any long random string (`openssl rand -hex 32`) |
   | `ADMIN_PASSWORD` | the password you want for the admin login |
   | `ADMIN_EMAIL` (variable, optional) | defaults to `admin@plant-pulse.ai` |
   | `CORS_ORIGINS` | set in step 4 |
   | `ANTHROPIC_API_KEY`, `SERPER_API_KEY` | optional (LLM explanation, live product search) |

4. The Space builds (about 10 minutes). When it shows **Running**, open `https://<your-hf-username>-plantpulse-api.hf.space/health`. It should report the models and `retrieval` status. `/docs` shows the API.

## 3. Vercel (web and admin)

Create two projects from the same GitHub repo (vercel.com -> Add New -> Project -> import `Plant-Pulse`):

| Project | Root Directory | Environment variable |
|---|---|---|
| plantpulse-web | `apps/web` | `NEXT_PUBLIC_API_URL` = `https://<your-hf-username>-plantpulse-api.hf.space` |
| plantpulse-admin | `apps/admin` | `NEXT_PUBLIC_API_URL` = the same URL |

Deploy both and note their URLs (for example `https://plantpulse-web.vercel.app`).

## 4. Allow the frontends to call the API

In the Space, set the `CORS_ORIGINS` secret to both Vercel URLs, comma separated, no trailing slash:

```
https://plantpulse-web.vercel.app,https://plantpulse-admin.vercel.app
```

The Space restarts by itself.

## 5. Test

1. Open the web app, register, scan a leaf photo, and check that a diagnosis and treatment advice appear.
2. Open the admin app and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Things to know about the free tiers

- **Sleep:** an idle Space goes to sleep and wakes on the next visit (about 30 to 60 seconds while the models load). Neon also sleeps after a few minutes idle. Open the site a minute before a demo.
- **Resets:** the Space disk is not persistent. Users, scan history and uploaded photos reset whenever the Space restarts. The admin account is re-created on start.
- **Admin mock data:** if the admin app cannot reach the API, it falls back to built-in mock data, so a populated dashboard does not prove the connection works. Check `/health`.
- **Updating:** after pushing new code to GitHub, use Space **Settings -> Factory rebuild**. Vercel redeploys on every push.
- **Local development** is unchanged. With `DEBUG=true` (the default) the admin password falls back to `admin123`; with `DEBUG=false` the API refuses to start without `SECRET_KEY`.

## Troubleshooting

- *Space build fails at `pip install`:* open the **Logs** tab and send the error.
- *`/health` shows retrieval unavailable:* check the `RETRIEVAL_DATABASE_URL` secret and that step 1 finished.
- *Browser shows a CORS error:* the Vercel URL is missing or mistyped in `CORS_ORIGINS`.
- *Scan photos do not show in the admin app:* confirm `NEXT_PUBLIC_API_URL` is set on the Vercel project and redeploy.
