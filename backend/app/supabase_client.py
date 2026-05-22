import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")
_service_key = os.getenv("SUPABASE_SERVICE_KEY")

# ── Hard fail at startup if critical env vars are missing ─────────────────────
# The service_role key MUST be set — it is never exposed to the frontend.
# If it's missing the server should refuse to start rather than silently falling
# back to the anon key (which would break all admin operations and expose data).

if not _url:
    raise RuntimeError(
        "SUPABASE_URL is not set. Add it to backend/.env and restart."
    )

if not _service_key:
    raise RuntimeError(
        "SUPABASE_SERVICE_KEY is not set. "
        "Get it from Supabase Dashboard → Settings → API → service_role key. "
        "Add it to backend/.env and restart. "
        "NEVER put this key in any frontend code or commit it to git."
    )

# This client uses the service_role key → bypasses RLS.
# It is ONLY used server-side inside FastAPI. It never leaves the backend.
supabase = create_client(_url, _service_key)
