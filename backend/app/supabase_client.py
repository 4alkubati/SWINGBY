import os
import httpx
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

_url = os.getenv("SUPABASE_URL")

# Either name, and an EMPTY value counts as unset.
#
# Legacy Supabase projects name this SUPABASE_SERVICE_KEY (a service_role JWT);
# newer ones issue SUPABASE_SECRET_KEY. scripts/seed_demo.py has accepted both
# since it was written, and this module accepted only the old one — so with a
# newer project every script that imports this failed at import time while the
# seed scripts worked, which reads as "the key is missing" when it is present
# under the other name.
#
# `or ""` then `.strip()` matters as much as the fallback: this project's .env
# carried the line `SUPABASE_SERVICE_KEY=` with no value, and a bare getenv
# returns "" for that — falsy here, but it would shadow the good key if the
# fallback were written as a plain `os.getenv(a) or os.getenv(b)` over raw
# values that might be whitespace.
_service_key = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip() or (
    os.getenv("SUPABASE_SECRET_KEY") or ""
).strip()

# ── Hard fail at startup if critical env vars are missing ─────────────────────
# The service_role key MUST be set — it is never exposed to the frontend.
# If it's missing the server should refuse to start rather than silently falling
# back to the anon key (which would break all admin operations and expose data).

if not _url:
    raise RuntimeError("SUPABASE_URL is not set. Add it to backend/.env and restart.")

if not _service_key:
    raise RuntimeError(
        "Neither SUPABASE_SERVICE_KEY nor SUPABASE_SECRET_KEY is set "
        "(an empty value counts as unset). "
        "Get it from Supabase Dashboard → Settings → API → service_role key. "
        "Add it to backend/.env and restart. "
        "NEVER put this key in any frontend code or commit it to git."
    )


def _use_http1(client):
    """Force this Supabase client's PostgREST and GoTrue sessions onto HTTP/1.1.

    postgrest 2.31 and supabase_auth 2.31 both hardcode `http2=True` when they
    build their httpx.Client (postgrest/_sync/client.py:104,
    supabase_auth/_sync/gotrue_base_api.py:29). Every route in this app is a
    sync `def`, so FastAPI runs them in a threadpool — and they ALL share this
    one module-level client. That means N threads multiplexing streams over a
    single HTTP/2 connection through one httpx.Client.

    That races. The h2 state machine gets driven from several threads at once,
    emits a frame that violates the protocol, and Supabase kills the whole
    connection with GOAWAY PROTOCOL_ERROR — taking every other in-flight
    request on it down too. It surfaces as `httpx.RemoteProtocolError:
    ConnectionTerminated error_code:1`, which each route then reports in its
    own words: "Could not list bookings", "Could not list threads", "JSON could
    not be generated", a bare 500 on /payments/mine, or a broken pipe.

    The GoTrue half is the nastier one. deps.py calls
    `supabase.auth.get_user(token)` on EVERY authenticated request, so when that
    connection is the one that dies the user gets a spurious 401 "Invalid or
    expired token" on a perfectly good token. The app treats a 401 as an expired
    session and fires /auth/refresh, which rotates the refresh token — and a
    burst of those is what produced "Invalid Refresh Token: Already Used".

    That is why signing in looked like everything was broken at once: the app
    fans out several requests on launch, they land together, and whichever share
    the poisoned connection fail. Sequentially every one of those endpoints
    returns 200, which is exactly why this hid for so long.

    Measured 2026-08-04, 32 workers x 50 rounds, same load both ways:
    before — 14 RemoteProtocolError / 7 ConnectionTerminated, 400s and spurious
    401s; after — 300/300 OK, zero protocol errors. HTTP/1.1 gives each thread
    its own pooled connection, so there is no shared stream state to corrupt.
    The cost is connection count, which is irrelevant at this scale.
    """
    postgrest = client.postgrest  # property: builds the session on first touch
    old_rest = postgrest.session
    postgrest.session = httpx.Client(
        base_url=old_rest.base_url,
        headers=old_rest.headers,
        timeout=old_rest.timeout,
        follow_redirects=True,
        http2=False,
    )
    old_rest.close()

    # GoTrue addresses everything absolutely, so it needs no base_url.
    auth_api = client.auth
    old_auth = auth_api._http_client
    auth_api._http_client = httpx.Client(
        timeout=old_auth.timeout,
        follow_redirects=True,
        http2=False,
    )
    old_auth.close()

    return client


# This client uses the service_role key → bypasses RLS.
# It is ONLY used server-side inside FastAPI. It never leaves the backend.
# CRITICAL: never call session-creating auth methods (sign_up / sign_in /
# refresh_session) on THIS client. supabase-py listens for SIGNED_IN events and
# swaps the PostgREST auth header to the user's JWT — from that moment every
# .table() query in the entire backend runs as that user under RLS instead of
# service_role. Use `supabase_auth` below for those calls.
supabase = _use_http1(create_client(_url, _service_key))

# Session-creating auth operations go through this separate client so the
# service-role client above never adopts a user session. Its own PostgREST
# state is irrelevant — no .table() calls are ever made on it.
# Same HTTP/1.1 treatment: /auth/login and /auth/refresh run on this client and
# are exactly the calls a burst of app launches hits at once.
_anon_key = os.getenv("SUPABASE_KEY") or _service_key
supabase_auth = _use_http1(create_client(_url, _anon_key))
