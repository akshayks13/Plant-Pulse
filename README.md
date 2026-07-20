# Plant-Pulse 🌿

**AI-powered plant disease detection platform** — upload a plant photo, get instant disease diagnosis with symptoms and treatment plans.

## Apps

| App | Description | Port |
|-----|-------------|------|
| `apps/web` | User-facing Next.js app | 3000 |
| `apps/admin` | Admin dashboard | 3001 |
| `apps/backend` | FastAPI backend | 8000 |

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Vanilla CSS
- **Backend**: FastAPI
- **AI Model**: CNN/TFLite plant disease classifier (38+ diseases)
- **Knowledge Base**: Static disease DB with symptoms + treatments

## Getting Started

### 1. Backend

Navigate to the backend directory, set up a Python virtual environment, install the required packages, and run the server:

```bash
cd apps/backend

# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows (CMD):
# .venv\Scripts\activate
# On Windows (PowerShell):
# .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run the backend
python run.py
```

### 2. Frontend Applications

In separate terminals, configure and run the frontend apps:

```bash
# User app (runs on port 3000)
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to http://localhost:8000
npm run dev

# Admin app (runs on port 3001)
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
