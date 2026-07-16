# Running SwingBy Locally

Step-by-step for anyone cloning the repo to get all surfaces running.

**Prerequisites:** Python 3.11+, Node.js 20+, npm 10+, git

---

## 1. Clone and setup

```bash
git clone https://github.com/4alkubati/SWINGBY.git
cd SWINGBY
```

---

## 2. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
```

> **Note (this desktop box):** there is no `backend/.env` here, so the backend won't boot locally (it hard-fails without `SUPABASE_SERVICE_KEY`). To exercise the API from this machine, hit the live Render service `https://swingbyy-api.onrender.com` with the test accounts in `CLAUDE.md` — but the login endpoint is rate-limited to **5 requests/min/IP**, so space out auth calls.

Create `backend/.env` from the template below (ask a teammate for the real values):

```
DATABASE_URL=postgresql://postgres:[password]@db.ulnxapnsenzyddddldjt.supabase.co:5432/postgres
SECRET_KEY=<random 32-char string>
SUPABASE_URL=https://ulnxapnsenzyddddldjt.supabase.co
SUPABASE_KEY=<anon key from Supabase dashboard>
SUPABASE_SERVICE_KEY=<service role key — NEVER commit this>
AWS_BUCKET=
```

Start the server:

```bash
# Windows
"C:/Python314/python.exe" -m uvicorn app.main:app --reload

# Mac/Linux
python -m uvicorn app.main:app --reload
```

API runs at `http://127.0.0.1:8000`. Interactive docs at `http://127.0.0.1:8000/docs`.

Health check: `http://127.0.0.1:8000/health`

---

## 3. Web — Launch site (`web/launch/`)

```bash
cd web/launch
npm install
```

Create `web/launch/.env.local`:

```
VITE_SUPABASE_URL=https://ulnxapnsenzyddddldjt.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SENTRY_DSN=          # leave empty locally
VITE_PLAUSIBLE_DOMAIN=    # leave empty locally
VITE_MAINTENANCE_MODE=false
```

Start dev server:

```bash
npm run dev
```

Runs at `http://localhost:5173`.

---

## 4. Web — Pre-launch site (`web/pre-launch/`)

```bash
cd web/pre-launch
npm install
npm run dev
```

Runs at `http://localhost:5174` (Vite picks the next available port).

---

## 5. Web — Admin panel (`web/admin/`)

```bash
cd web/admin
npm install
npm run dev
```

Runs at `http://localhost:5175`.

Admin login requires an account with `role = 'admin'` in the `users` table. The seed account is `amrbasem37@gmail.com` (see `docs/wave-5-admin-role.sql`).

---

## 6. Mobile (`mobile/`)

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `w` for web preview.

**Note:** Mobile is not feature-complete as of June 2026.

---

## Common issues

| Problem | Fix |
|---|---|
| `RuntimeError: SUPABASE_SERVICE_KEY is not set` | The backend refuses to start without this key. Add it to `backend/.env`. |
| `npm ERR! peer dep` | Run `npm install --legacy-peer-deps` |
| Vite port conflict | Vite auto-increments; check the terminal for the actual URL |
| Backend CORS error | Add your local origin to `SWINGBY_ALLOWED_ORIGINS` in `.env` |
| 401 on all API calls | Check that `VITE_API_BASE_URL` in `.env.local` matches the backend port |
