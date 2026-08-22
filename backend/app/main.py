import os
import secrets

from dotenv import load_dotenv

load_dotenv()

# T15 — Fail fast on missing required env vars (must come before anything that
# reads those vars, e.g. database.py / supabase_client.py).
from app import config as config_module  # noqa: E402  (for STRIPE_KEY_ERROR)
from app.config import settings  # noqa: E402  (intentional early import)

# T11 — Configure structured logging before the FastAPI app is created so that
# every subsequent import that grabs a logger gets the configured instance.
from app.logging_config import configure_logging  # noqa: E402

_log = configure_logging()

# T9 — Sentry (no-op when SENTRY_DSN is empty)
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    def _sentry_before_send(event, hint):
        # Drop httpx.RemoteProtocolError — client disconnects / HTTP/2 drops
        # are noise, not actionable bugs. See Roadmap 2026-07-11 A3.
        exc_info = hint.get("exc_info") if hint else None
        if exc_info:
            exc_type = exc_info[0]
            if exc_type is not None:
                try:
                    import httpx

                    if issubclass(exc_type, httpx.RemoteProtocolError):
                        return None
                except ImportError:
                    pass
                if exc_type.__name__ == "RemoteProtocolError":
                    return None
        return event

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.10,
        environment=os.getenv("ENV", "development"),
        integrations=[FastApiIntegration()],
        before_send=_sentry_before_send,
        # Privacy: docs/legal/PRIVACY_POLICY.md promises we strip stack-trace
        # local-variable values and do not attach request PII. Enforce both here
        # so the deployed behavior matches the policy rather than contradicting it.
        include_local_variables=False,
        send_default_pii=False,
    )

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# T17 — Rate limiting (limiter defined in app/limiter.py to avoid circular import)
from slowapi.errors import RateLimitExceeded

# Bug 9 (walkthrough) — postgrest's APIError, for the invalid-UUID-cast handler
# registered below, right after the FastAPI app exists.
from postgrest.exceptions import APIError as PostgrestAPIError

# Reported by /health as `direct_sql`, and used for nothing else — see
# app/database.py. `text` went with the old SQL probe.
from app.database import engine

# T12 — Request-ID middleware
from app.middleware.request_id import RequestIDMiddleware

# Checklist #7 / #11 — response hardening and the global body-size ceiling
from app.middleware.body_limit import BodySizeLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

# T17 — Import the shared limiter instance
from app.limiter import limiter

# Checklist #10 — the interactive docs are OFF in production.
#
# `/docs`, `/redoc` and `/openapi.json` were served unauthenticated on the
# deployed API, which published the complete route inventory — every
# `/admin/*` and `/analytics/*` path included — to anyone who asked. That is
# the map an attacker uses to find everything else, handed over on the first
# request with no credential.
#
# Gated on settings.API_ENABLE_DOCS (see config.py): off when ENV=production,
# on everywhere else, and forceable with API_ENABLE_DOCS=1. Passing None to
# these three arguments is what actually removes the routes — FastAPI does not
# register them at all, so they 404 rather than 401, and nothing is left to
# probe.
_docs_enabled = settings.API_ENABLE_DOCS

app = FastAPI(
    title="SwingBy API",
    version="1.0.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

if not _docs_enabled:
    _log.info("api.docs_disabled", env=settings.ENV)

# T17 — Attach limiter to app state before any routers are included
app.state.limiter = limiter


def _rate_limited(request: Request, exc: RateLimitExceeded):
    """SB-0022 — a 429 must look like every other error on this API.

    slowapi's stock handler answers {"error": "Rate limit exceeded: 10 per 1
    minute"}. Every other error here is {"detail": ...}, so a client reading
    `err.response.data.detail` rendered an empty message at exactly the moment
    the user most needs to be told what happened — and the stock body also
    echoes the configured limit back to the caller, which is free reconnaissance
    on how hard they may push before being noticed.
    """
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Try again in a moment."},
    )


app.add_exception_handler(RateLimitExceeded, _rate_limited)


# Bug 9 (walkthrough) — unknown paths under a mounted router were surfacing as
# 500, not 404. `/bookings` alone carries 6 routers, most of them shaped
# `/{booking_id}/...`; a mistyped or garbage path segment still MATCHES that
# pattern (FastAPI has no way to know `booking_id` should be a UUID unless the
# route says so — most of these declare it `str`), so the request reaches the
# handler and only fails once the id hits Postgres as a WHERE clause. Postgres
# rejects it with code 22P02 (invalid_text_representation — "this string is
# not a UUID"), which several handlers (app/api/invoices.py, booking_location.py,
# payments_stripe.py, proof_of_work.py) never wrap in try/except, so it rode
# all the way up as an unhandled 500. That is genuinely "not found," not a
# server failure — a per-route try/except fix would need touching a dozen
# files today and would silently miss the next one, so this is deliberately
# a global handler keyed on the one Postgres code that means "malformed
# identifier," not on APIError broadly.
#
# Anything else that reaches Postgres as an APIError (RLS denial, connection
# drop, a real query bug) is a genuine server failure and must keep behaving
# like one — re-raising here hands it to Starlette's default handler, which
# is the same unhandled-exception 500 path this code did nothing to touch.
@app.exception_handler(PostgrestAPIError)
async def _postgrest_bad_identifier_to_404(request: Request, exc: PostgrestAPIError):
    if exc.code == "22P02":
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    # PGRST116 — `.single()` did not get exactly one row. Added 2026-08-13 after
    # SIX production Sentry issues in one hour, all "Cannot coerce the result to
    # a single JSON object", all unhandled 500s:
    #
    #   /bookings/{id}/events   /bookings/{id}/photos    /bookings/{id}/proof
    #   /bookings/{id}/location /bookings/{id}/invoice.pdf   /messages/{id}
    #
    # The 22P02 rule above only covers a MALFORMED id. A well-formed uuid that
    # simply does not exist takes a different path: PostgREST answers PGRST116
    # and supabase-py raises, so the request 500s where it should 404. Confirmed
    # by reproducing all six locally — `/bookings/{id}` itself already 404s
    # because it checks `.data` explicitly; its five sub-resources never did.
    #
    # KEYED ON `details`, NOT ON THE CODE, and that distinction is the whole
    # point. PGRST116 means "not exactly one row", which covers both:
    #
    #   0 rows   -> details "The result contains 0 rows"     -> genuinely absent
    #   many     -> details "The result contains 267 rows"   -> a DATA BUG
    #
    # Same code, same message; only `details` separates them. Mapping the
    # multi-row case to 404 would silently swallow duplicate rows where the code
    # assumed uniqueness — so that case keeps 500ing, loudly, as it must.
    #
    # The tradeoff, stated rather than hidden: this is a global handler, so a
    # `.single()` on an INSERT that somehow returned nothing would now read as
    # 404 instead of 500. That shape is rare (an insert returns its row), and
    # the alternative is the status quo, where every not-found sub-resource
    # pages someone at 3am.
    if exc.code == "PGRST116" and "0 rows" in (exc.details or ""):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    raise exc


# T12 — Request-ID middleware (register before CORS so every response gets it)
app.add_middleware(RequestIDMiddleware)

# Checklist #7 — HSTS and friends on every API response. See the module
# docstring for why the set here is shorter than the one the web properties get.
app.add_middleware(SecurityHeadersMiddleware)

# Checklist #11 — global request-body ceiling. Registered LAST so it runs
# FIRST: an oversized body must be refused before any other middleware (or the
# route, or Pydantic) has had a chance to buffer it.
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.MAX_REQUEST_BYTES)

# SB-0021 — the two localhost defaults are DEV-ONLY.
#
# They used to be unconditional, combined with allow_credentials=True, which
# granted credentialed cross-origin reads to anything served from localhost on
# a user's machine: any local dev server, Electron app, or locally-installed
# tool. The docs and /health gating a few lines above is guarded on
# IS_PRODUCTION; these never were. Same guard, same reason.
_DEV_ONLY_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]


def build_allowed_origins() -> list[str]:
    """The CORS allowlist, as a function so it is testable and gated."""
    origins = [] if settings.IS_PRODUCTION else list(_DEV_ONLY_ORIGINS)
    extra = [
        o.strip() for o in settings.SWINGBY_ALLOWED_ORIGINS.split(",") if o.strip()
    ]

    # Checklist #8 — a wildcard in SWINGBY_ALLOWED_ORIGINS is dropped, loudly.
    #
    # This list is combined with allow_credentials=True. Starlette treats "*"
    # specially in that combination: it stops sending a literal `*` and starts
    # REFLECTING whatever Origin the caller sent, with credentials allowed —
    # which is every origin on the internet reading authenticated responses.
    # Nothing validated this env var, so one over-broad value in the Render
    # dashboard was all it would have taken. Filtering here rather than trusting
    # the operator is the point; the log line exists so the drop is not silent.
    wildcards = [o for o in extra if "*" in o]
    if wildcards:
        _log.error("cors.wildcard_origin_rejected", origins=wildcards)
    return origins + [o for o in extra if "*" not in o]


_extra_origins = [
    o.strip() for o in settings.SWINGBY_ALLOWED_ORIGINS.split(",") if o.strip()
]

_allowed_origins = build_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    # Narrowed from ["*"]. These are the verbs and headers the mobile and web
    # clients actually send; a wildcard here is not itself an exploit, but it
    # widens what a successful origin bypass would be worth.
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

from app.api.auth import router as auth_router

from app.api.internal import router as internal_router

# POST /internal/tick — 404s unless TICK_TOKEN is set. See app/api/internal.py
# for why this exists (no application scheduler; settlement is lazy).
app.include_router(internal_router, prefix="/internal", tags=["internal"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])

from app.api.businesses import router as businesses_router

app.include_router(businesses_router, prefix="/businesses", tags=["businesses"])

from app.api.waitlist import router as waitlist_router

app.include_router(waitlist_router, prefix="/waitlist", tags=["waitlist"])

from app.api.employees import router as employees_router

app.include_router(employees_router, prefix="/employees", tags=["employees"])

from app.api.service_posts import router as service_posts_router

app.include_router(
    service_posts_router, prefix="/service-posts", tags=["service-posts"]
)

from app.api.interests import router as interests_router

app.include_router(interests_router, prefix="/interests", tags=["interests"])

from app.api.bookings import router as bookings_router

app.include_router(bookings_router, prefix="/bookings", tags=["bookings"])

from app.api.booking_events import router as booking_events_router

app.include_router(booking_events_router, prefix="/bookings", tags=["booking-events"])

from app.api.booking_photos import router as booking_photos_router

app.include_router(booking_photos_router, prefix="/bookings", tags=["booking-photos"])

# WALKTHROUGH M7 — live provider location while en route. Mounted on /bookings
# beside booking_events, which owns the en_route event this feed keys off.
from app.api.booking_location import router as booking_location_router

app.include_router(
    booking_location_router, prefix="/bookings", tags=["booking-location"]
)

# LANE 5 — proof of work (before/after + voice memo → client approve → release).
# Mounted on /bookings alongside booking_photos; the photo UPLOAD path stays in
# booking_photos.py, this router owns the submission/approval lifecycle.
from app.api.proof_of_work import router as proof_of_work_router

app.include_router(proof_of_work_router, prefix="/bookings", tags=["proof-of-work"])

from app.api.payments import router as payments_router

app.include_router(payments_router, prefix="/payments", tags=["payments"])

from app.api.payments_stripe import router as payments_stripe_router

app.include_router(
    payments_stripe_router, prefix="/payments/stripe", tags=["payments-stripe"]
)

from app.api.payments_offplatform import router as payments_offplatform_router

app.include_router(
    payments_offplatform_router, prefix="/bookings", tags=["payments-offplatform"]
)

from app.api.invoices import router as invoices_router

app.include_router(invoices_router, prefix="/bookings", tags=["invoices"])

from app.api.subscriptions import router as subscriptions_router

app.include_router(subscriptions_router, prefix="/businesses", tags=["subscriptions"])

# LANE 5 — auto-bidding rules + dry run. Subscribers only (checked per route).
from app.api.auto_bidding import router as auto_bidding_router

app.include_router(auto_bidding_router, prefix="/businesses", tags=["auto-bidding"])

# D5 — payouts. Stripe Connect Express onboarding + the cash-out itself. Owner
# only, gated per route. Registered unconditionally like every other Stripe
# surface: the routes answer 503 when no key is configured rather than
# disappearing, so a misconfigured deployment reports a cause instead of a 404.
from app.api.payouts import router as payouts_router

app.include_router(payouts_router, prefix="/businesses", tags=["payouts"])

from app.api.disputes import router as disputes_router

app.include_router(disputes_router, prefix="/disputes", tags=["disputes"])

from app.api.reviews import router as reviews_router

app.include_router(reviews_router, prefix="/reviews", tags=["reviews"])

from app.api.google_reviews import router as google_reviews_router

app.include_router(
    google_reviews_router, prefix="/google-reviews", tags=["google-reviews"]
)

from app.api.messages import router as messages_router

app.include_router(messages_router, prefix="/messages", tags=["messages"])

from app.api.push_tokens import router as push_tokens_router

app.include_router(push_tokens_router, prefix="/push-tokens", tags=["push-tokens"])

from app.api.admin import router as admin_router

app.include_router(admin_router, prefix="/admin", tags=["admin"])

from app.api.moderation import router as moderation_router

app.include_router(moderation_router, prefix="/moderation", tags=["moderation"])

from app.api.me import router as me_router

app.include_router(me_router, prefix="/me", tags=["me"])

from app.api.uploads import router as uploads_router

app.include_router(uploads_router, prefix="/uploads", tags=["uploads"])

from app.api.contact import router as contact_router

app.include_router(contact_router, prefix="/contact", tags=["contact"])

from app.api.analytics_export import router as analytics_export_router

app.include_router(
    analytics_export_router, prefix="/analytics", tags=["analytics-export"]
)


@app.get("/health")
def health_check(request: Request):
    # `stripe` reports the SHAPE of the configured key, never the key. It exists
    # so a malformed key is provable from outside the box with one curl:
    # SEN-1 shipped a truncated key to Render and the only evidence was a
    # UnicodeEncodeError four layers down in urllib3, which named neither
    # Stripe nor the env var. Values: "ok" | "not_configured" | "malformed".
    stripe_info = config_module.stripe_key_diagnosis()
    stripe_state = stripe_info.pop("state")
    # Only the failure detail rides along, and only when there IS a failure.
    stripe_detail = stripe_info if stripe_state == "malformed" else None

    # The SECOND key. Reporting only the secret key made this endpoint lie:
    # it said "stripe": "ok" while every in-app payment failed with
    # `native_sheet_unavailable`, because the native Payment Sheet needs the
    # PUBLISHABLE key and nothing here looked at it. Two keys, two answers.
    pub_info = config_module.stripe_publishable_diagnosis()
    pub_state = pub_info.pop("state")
    pub_detail = pub_info if pub_state == "malformed" else None

    # The THIRD key, and the only one whose absence loses money instead of
    # blocking it. With this unreported, /health called Stripe healthy on two of
    # three keys while a missing webhook secret let charges succeed and every
    # confirming webhook be rejected — card debited, capture never recorded,
    # escrow never released. See config.stripe_webhook_diagnosis.
    hook_info = config_module.stripe_webhook_diagnosis()
    hook_state = hook_info.pop("state")
    hook_detail = hook_info if hook_state == "malformed" else None

    # What Sentry stamps on every issue from this process. Render has no ENV
    # var set, so production has been tagging its errors "development" — which
    # makes a prod incident indistinguishable from a laptop. Surfacing it here
    # means the next person can see the mislabelling without reading main.py.
    env_name = os.getenv("ENV", "development")

    # Probe the database the application ACTUALLY uses.
    #
    # This used to be `engine.connect()` over DATABASE_URL — a SQLAlchemy
    # connection with exactly one consumer in the codebase: this line. Every
    # real query goes through PostgREST with the Supabase key, so the probe was
    # answering a question nobody asked: green while PostgREST was down, and red
    # (as on the dev box, whose DATABASE_URL is empty) while the app was
    # perfectly healthy. A launch-day dashboard built on it would lie in both
    # directions.
    #
    # One cheap indexed read through the same client the endpoints use. `limit(1)`
    # on a column that always exists, so it stays O(1) as the table grows.
    try:
        from app.supabase_client import supabase

        supabase.table("users").select("id").limit(1).execute()
        body = {"status": "ok", "database": "connected", "stripe": stripe_state}
    except Exception:
        _log.exception("health: supabase probe failed")
        body = {
            "status": "error",
            "detail": "Database unavailable",
            "stripe": stripe_state,
        }

    # Reported separately because it is NOT what the app runs on. Absent is the
    # normal, healthy state; it is only interesting to whoever is about to run a
    # migration or a raw-SQL script.
    body["direct_sql"] = "configured" if engine is not None else "not_configured"

    body["stripe_publishable"] = pub_state
    # `stripe_webhook` joins `stripe` and `stripe_publishable` as a PUBLIC state
    # (from #159): "ok" / "not_configured" / "malformed" names no internals and
    # is what a monitor polls. Its DETAIL goes behind the gate with the others.

    # Checklist #10 — the DIAGNOSTIC half of this endpoint is no longer public.
    #
    # The states above ("ok" / "not_configured" / "malformed") stay open: they
    # are what a monitor polls and they name no internals. What moves behind a
    # token is the environment name and the key-shape detail — the fields that
    # tell an unauthenticated caller how this deployment is wired and which of
    # its secrets is currently broken.
    #
    # HEALTH_DIAGNOSTICS_TOKEN unset keeps the old behaviour verbatim, so a dev
    # box and every existing runbook are untouched; setting it in production is
    # what closes the leak. Compared with secrets.compare_digest because this is
    # a shared secret in a query string and a naive == is a timing oracle.
    body["stripe_webhook"] = hook_state

    expected = settings.HEALTH_DIAGNOSTICS_TOKEN
    if expected:
        supplied = request.query_params.get("token") or request.headers.get(
            "X-Health-Token", ""
        )
        show_detail = secrets.compare_digest(str(supplied), expected)
    else:
        show_detail = not settings.IS_PRODUCTION

    if show_detail:
        body["environment"] = env_name
        if stripe_detail:
            body["stripe_detail"] = stripe_detail
        if pub_detail:
            body["stripe_publishable_detail"] = pub_detail
        if hook_detail:
            body["stripe_webhook_detail"] = hook_detail
    return body


@app.get("/healthz")
def healthz():
    """Readiness probe for Render's healthCheckPath — SB-0045.

    This used to be `return {"status": "ok"}` with no dependency check at all.
    Render promotes a deploy when this path answers 200, so a release with
    broken Supabase credentials was promoted as healthy and the gate was
    decoration. Pointing Render at /health instead would not have helped:
    that endpoint answers 200 whether the probe succeeded or not, by design,
    because it is a human-readable diagnostic rather than a gate.

    One cheap indexed read through the client the endpoints actually use — the
    same probe /health runs. It answers up or down and NOTHING else: this is
    unauthenticated, so no exception text, host name or key state may ride out
    on it.
    """
    try:
        from app.supabase_client import supabase

        supabase.table("users").select("id").limit(1).execute()
    except Exception:
        _log.exception("healthz: supabase probe failed")
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ok"}
