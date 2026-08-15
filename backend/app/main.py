import os

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
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Bug 9 (walkthrough) — postgrest's APIError, for the invalid-UUID-cast handler
# registered below, right after the FastAPI app exists.
from postgrest.exceptions import APIError as PostgrestAPIError

# Reported by /health as `direct_sql`, and used for nothing else — see
# app/database.py. `text` went with the old SQL probe.
from app.database import engine

# T12 — Request-ID middleware
from app.middleware.request_id import RequestIDMiddleware

# T17 — Import the shared limiter instance
from app.limiter import limiter

app = FastAPI(title="SwingBy API", version="1.0.0")

# T17 — Attach limiter to app state before any routers are included
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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

_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_extra_origins = [
    o.strip() for o in settings.SWINGBY_ALLOWED_ORIGINS.split(",") if o.strip()
]
_allowed_origins = _default_origins + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router

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
def health_check():
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
    body["stripe_webhook"] = hook_state
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
    """Lightweight liveness probe for Render — no database call."""
    return {"status": "ok"}
