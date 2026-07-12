# Xylem 🌿

**AI-powered plant disease detection platform** — upload a plant photo, get instant disease diagnosis with symptoms and treatment plans.

## Apps

| App | Description | Port |
|-----|-------------|------|
| `apps/web` | User-facing Next.js app | 3000 |
| `apps/admin` | Admin dashboard | 3001 |

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Vanilla CSS
- **Backend**: FastAPI
- **AI Model**: CNN/TFLite plant disease classifier (38+ diseases)
- **Knowledge Base**: Static disease DB with symptoms + treatments

## Getting Started

```bash
# User app
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL
npm run dev

# Admin app
cd apps/admin
cp .env.example .env.local
npm run dev -- -p 3001
```

## Pages

### User App (`apps/web`)
- `/` — Landing page
- `/auth/login` — Login
- `/auth/register` — Register
- `/scan` — Upload plant image for diagnosis
- `/results/[id]` — Disease result with symptoms + treatments
- `/history` — Past scans

### Admin App (`apps/admin`)
- `/login` — Admin login
- `/dashboard` — Stats overview + disease chart
- `/diagnoses` — All diagnoses table
- `/users` — User management
- `/system` — System logs

## Environment

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```
