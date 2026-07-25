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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# T17 — Rate limiting (limiter defined in app/limiter.py to avoid circular import)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import engine
from sqlalchemy import text

# T12 — Request-ID middleware
from app.middleware.request_id import RequestIDMiddleware

# T17 — Import the shared limiter instance
from app.limiter import limiter

app = FastAPI(title="SwingBy API", version="1.0.0")

# T17 — Attach limiter to app state before any routers are included
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

from app.api.disputes import router as disputes_router

app.include_router(disputes_router, prefix="/disputes", tags=["disputes"])

from app.api.reviews import router as reviews_router

app.include_router(reviews_router, prefix="/reviews", tags=["reviews"])

from app.api.messages import router as messages_router

app.include_router(messages_router, prefix="/messages", tags=["messages"])

from app.api.push_tokens import router as push_tokens_router

app.include_router(push_tokens_router, prefix="/push-tokens", tags=["push-tokens"])

from app.api.admin import router as admin_router

app.include_router(admin_router, prefix="/admin", tags=["admin"])

from app.api.me import router as me_router

app.include_router(me_router, prefix="/me", tags=["me"])

from app.api.uploads import router as uploads_router

app.include_router(uploads_router, prefix="/uploads", tags=["uploads"])

from app.api.contact import router as contact_router

app.include_router(contact_router, prefix="/contact", tags=["contact"])


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

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        body = {"status": "ok", "database": "connected", "stripe": stripe_state}
    except Exception:
        body = {
            "status": "error",
            "detail": "Database unavailable",
            "stripe": stripe_state,
        }

    if stripe_detail:
        body["stripe_detail"] = stripe_detail
    return body


@app.get("/healthz")
def healthz():
    """Lightweight liveness probe for Render — no database call."""
    return {"status": "ok"}
