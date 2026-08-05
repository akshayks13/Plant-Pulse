# Plant-Pulse

**AI-powered plant disease detection** — upload a plant photo, get instant diagnosis with symptoms and treatment plans.

## Apps

| App | Description | URL | Port |
|-----|-------------|-----|------|
| `apps/web` | User-facing Next.js app | http://localhost:3000 | 3000 |
| `apps/admin` | Admin dashboard | http://localhost:3001 | 3001 |
| `apps/backend` | FastAPI API + SQLite | http://localhost:8000 | 8000 |
| API docs | Swagger UI | http://localhost:8000/docs | — |

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
| Scan plant | `/scan` | Upload image → ML diagnosis (auth required) |
| Results | `/results/[id]` | Disease, confidence, severity, treatments |
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
- Diagnosis: predict (image upload), history, get by id  
- Community: posts CRUD (author), likes, comments  
- Admin: stats, diagnoses, users, logs, community moderation  
- Storage: uploaded images under `/uploads`  
- DB: SQLite (`plant_pulse.db`)  

## Stack

- **Web / Admin**: Next.js (App Router) + TypeScript + CSS modules  
- **Backend**: FastAPI + SQLAlchemy + aiosqlite + JWT  
- **AI**: TFLite/Keras when model present; deterministic mock if model missing  
- **KB**: Client-side disease knowledge base (symptoms + treatments)  

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
```

## Quick test checklist

1. Start backend on `:8000`  
2. Open web → register → login → scan a leaf photo → see result → history  
3. Community → create a post → like / comment  
4. Profile → edit name  
5. Admin → login with `admin@plant-pulse.ai` / `admin123` → users, diagnoses, community  
6. Forgot password → copy OTP from backend logs → reset  

## Notes

- Scan requires a logged-in user.  
- If the API is unreachable, **scan** may fall back to a local mock; **admin** may show mock stats. With the backend running, both use live data.  
- Default admin is seeded on first backend start.  
