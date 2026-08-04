"""
config.py — Centralised environment-variable validation and typed accessors.

Imported at the top of main.py so the application fails fast at startup when
any REQUIRED variable is missing, rather than surfacing a confusing error at
request time.
"""

import logging
import os
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase key names — BOTH generations, on purpose
# ---------------------------------------------------------------------------
#
# Supabase replaced the legacy JWT keys (`anon` / `service_role`, read from
# SUPABASE_KEY / SUPABASE_SERVICE_KEY) with `sb_publishable_…` / `sb_secret_…`,
# published as SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY. This code knew
# only the old names, and `_REQUIRED` below raises at IMPORT time — so the day
# the legacy keys are switched off, the process does not degrade, it refuses to
# boot. Render would restart into the same crash forever.
#
# That was not hypothetical: on 2026-07-31 `backend/.env` on the dev box already
# held the new keys with all four legacy values present but EMPTY, and the
# backend could not start from a fresh clone.
#
# Verified the same day: mapping SUPABASE_SECRET_KEY onto the old name booted
# the app and `POST /auth/login` returned 200 against the live project. The new
# secret key is a drop-in for PostgREST and GoTrue — only the NAME differed. So
# the fix is an alias, not a migration.
#
# Order matters: an explicitly-set legacy value wins, so nothing changes for an
# environment that is already working (Render today).
_KEY_ALIASES = {
    "SUPABASE_SERVICE_KEY": ("SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"),
    "SUPABASE_KEY": ("SUPABASE_KEY", "SUPABASE_PUBLISHABLE_KEY"),
}


def _resolve_key(canonical: str) -> str:
    """First non-empty value among a name and its modern equivalent."""
    for name in _KEY_ALIASES.get(canonical, (canonical,)):
        value = os.getenv(name)
        if value:
            return value
    return ""


# Normalise into the canonical names ONCE, at import, so every later reader —
# including supabase_client.py and anything doing a bare os.getenv — sees a
# populated variable regardless of which generation the operator configured.
for _canonical in _KEY_ALIASES:
    _resolved = _resolve_key(_canonical)
    if _resolved and not os.getenv(_canonical):
        os.environ[_canonical] = _resolved

# ---------------------------------------------------------------------------
# Required vars — the app cannot function without these
# ---------------------------------------------------------------------------
#
# DATABASE_URL is NOT here. Nothing in this application queries Postgres
# directly: every read and write goes through PostgREST with the Supabase key.
# The single consumer of the SQLAlchemy engine is the /health probe, which now
# reports on Supabase instead (see main.py). Requiring a connection string the
# app never opens meant a correctly-configured deployment could refuse to start.
_REQUIRED = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SECRET_KEY",
]

_missing = [name for name in _REQUIRED if not os.getenv(name)]
if _missing:
    _hint = ""
    if "SUPABASE_SERVICE_KEY" in _missing:
        _hint = (
            " (SUPABASE_SECRET_KEY, the current Supabase name for the same key, "
            "is also accepted)"
        )
    raise RuntimeError(
        "Missing required environment variables: "
        + ", ".join(_missing)
        + _hint
        + ". Add them to backend/.env and restart."
    )

# ---------------------------------------------------------------------------
# Optional vars (may be empty / absent)
# ---------------------------------------------------------------------------
_OPTIONAL = [
    "SUPABASE_KEY",
    "SWINGBY_ALLOWED_ORIGINS",
    "NOTION_TOKEN",  # consumed by the waitlist path (app/api/waitlist.py); NOT CRM
    "SENTRY_DSN",
    "HCAPTCHA_SECRET",
    "HCAPTCHA_SITEKEY",
    "RESEND_API_KEY",  # Resend transactional email — set after domain verified
    "RESEND_FROM_EMAIL",  # e.g. "SwingBy <hello@swingbyy.com>"
    "PASSWORD_RESET_REDIRECT_URL",  # override where Supabase reset emails redirect (defaults to web)
    "GOOGLE_MAPS_API_KEY",  # server-side Geocoding API fallback (RO-0). Absent → geocoding no-ops.
    "STRIPE_SECRET_KEY",  # sk_test_… for beta sandbox, sk_live_… post-beta
    "STRIPE_WEBHOOK_SECRET",  # whsec_… — used to verify Stripe webhook signature
    "STRIPE_SUCCESS_URL",  # browser landing after Checkout success (defaults to web)
    "STRIPE_CANCEL_URL",  # browser landing after Checkout cancel  (defaults to web)
    "STRIPE_CONNECT_RETURN_URL",  # D5 — where Express onboarding returns to
    "STRIPE_CONNECT_REFRESH_URL",  # D5 — where an EXPIRED onboarding link lands
]


# ---------------------------------------------------------------------------
# STRIPE_SECRET_KEY shape validation — SEN-1 (walkthrough audit 2026-07-24)
# ---------------------------------------------------------------------------
#
# Sentry: `APIConnectionError` on PATCH /interests/{id}/accept, chained cause
#     UnicodeEncodeError: 'latin-1' codec can't encode character '…'
#     in position 21   — raised inside urllib3's putheader().
#
# Offset 21 of `Authorization: Bearer sk_…` is the key itself. A real Stripe
# key is pure ASCII and cannot raise that. A key COPIED FROM THE STRIPE
# DASHBOARD IN ITS MASKED FORM (`sk_test_51ABC…`) can: the dashboard renders
# the elision as U+2026 HORIZONTAL ELLIPSIS, and latin-1 (what HTTP headers are
# encoded as) has no code point for it. So the failure is not a network fault
# and not a missing key — it is a malformed one, and it also explains B14
# ("cannot create Stripe checkout session").
#
# The old check was `if not settings.STRIPE_SECRET_KEY` — non-empty was the
# only bar, so a truncated key sailed through config, through
# stripe_service._require_stripe(), and died four layers down in the socket
# stack with a message that names neither Stripe nor the env var.
STRIPE_KEY_RE = re.compile(r"^sk_(test|live)_[A-Za-z0-9]+$")


def stripe_secret_key_error(raw: str) -> str:
    """Return an actionable error string for a bad key, or "" if it is fine.

    An EMPTY key is not an error here — Stripe is optional on this deployment
    (local dev, CI, the demo box all run without it) and the endpoints already
    answer 503 when it is absent. This validates SHAPE, for a key that is set.
    """
    if not raw:
        return ""
    if not raw.isascii():
        bad = next((c for c in raw if not c.isascii()), "")
        return (
            "STRIPE_SECRET_KEY contains the non-ASCII character "
            f"{bad!r} (U+{ord(bad):04X}) at position {raw.index(bad)}. That is "
            "the signature of a key copied from the Stripe dashboard while it "
            "was still MASKED (sk_test_51ABC…) — the '…' is a real character in "
            "the value. Re-copy the key with the dashboard's reveal/copy button "
            "and set it again on Render. Left as-is, every Stripe call dies "
            "inside urllib3 with a latin-1 UnicodeEncodeError (Sentry SEN-1)."
        )
    if not STRIPE_KEY_RE.match(raw):
        return (
            "STRIPE_SECRET_KEY does not look like a Stripe secret key: expected "
            "^sk_(test|live)_[A-Za-z0-9]+$ (got a value of length "
            f"{len(raw)} starting {raw[:8]!r}). Check you did not paste a "
            "publishable key (pk_…), a restricted key (rk_…), a webhook secret "
            "(whsec_…), or a value with surrounding quotes/whitespace."
        )
    return ""


# Validate at config load — loudly, and before any request can reach the socket
# layer. Default posture is CRITICAL-log rather than refusing to boot: a
# malformed payment key must not take down signup, browse and messaging, which
# work fine without Stripe. Set STRIPE_KEY_STRICT=1 (recommended for prod) to
# make a malformed key a hard startup failure instead.
STRIPE_KEY_ERROR = stripe_secret_key_error(os.getenv("STRIPE_SECRET_KEY", "").strip())


def stripe_key_diagnosis() -> dict:
    """Non-secret facts about the configured key, safe to expose on /health.

    "It looks correct in the dashboard" is the normal reaction to this failure —
    the ellipsis in a masked copy-paste is one glyph wide, and a stray quote or
    a wrong prefix reads as noise when you are skimming. This reports WHICH
    check failed and how long the value is, so the cause is identified without
    anyone reading logs or pasting a secret into a chat.

    Deliberately excludes the key, any substring of it, and any character of it.
    Length and a failure category are not usable to reconstruct a credential.
    """
    raw = os.getenv("STRIPE_SECRET_KEY", "")
    stripped = raw.strip()
    if not stripped:
        return {"state": "not_configured"}
    if not STRIPE_KEY_ERROR:
        return {"state": "ok", "length": len(stripped)}

    if not stripped.isascii():
        # The masked-copy case: 'sk_test_51ABC…'. One non-ASCII glyph.
        problem = "non_ascii_character"
    elif stripped[:1] in ("'", '"') or stripped[-1:] in ("'", '"'):
        problem = "wrapped_in_quotes"
    elif stripped.startswith("pk_"):
        problem = "publishable_key_not_secret_key"
    elif stripped.startswith("rk_"):
        problem = "restricted_key_not_secret_key"
    elif stripped.startswith("whsec_"):
        problem = "webhook_secret_not_secret_key"
    elif not stripped.startswith(("sk_test_", "sk_live_")):
        problem = "wrong_prefix"
    else:
        # Right prefix, pure ASCII, no quotes — so the body has a character
        # outside [A-Za-z0-9]. A literal "..." from a hand-typed elision does
        # this, and so does an embedded space or newline.
        problem = "illegal_character_in_body"

    return {
        "state": "malformed",
        "problem": problem,
        "length": len(stripped),
        "had_surrounding_whitespace": raw != stripped,
    }


def stripe_publishable_diagnosis() -> dict:
    """Same treatment for STRIPE_PUBLISHABLE_KEY, which /health used to ignore.

    This gap cost a walkthrough. `/health` reported `"stripe": "ok"` off the
    SECRET key alone, so it stayed green while the in-app Payment Sheet was
    dead — Sentry was the only place the truth appeared, as
    `native_sheet_unavailable` on every payment attempt. The secret key powers
    server-side charges; the publishable key powers the native sheet. Either
    one missing breaks payments, so a health check that reads only one of them
    is not a health check.

    Publishable keys are not secret — they ship inside the mobile app — but the
    value is still withheld here so /health never becomes a place anyone reads
    credentials from.
    """
    raw = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    stripped = raw.strip()
    if not stripped:
        # The exact failure behind the Sentry issue: the native sheet cannot run.
        return {"state": "not_configured"}

    if not stripped.isascii():
        problem = "non_ascii_character"
    elif stripped[:1] in ("'", '"') or stripped[-1:] in ("'", '"'):
        problem = "wrapped_in_quotes"
    elif stripped.startswith("sk_"):
        # The dangerous inversion: a SECRET key sitting where the publishable
        # one belongs would be shipped to every phone.
        problem = "secret_key_not_publishable_key"
    elif stripped.startswith("whsec_"):
        problem = "webhook_secret_not_publishable_key"
    elif not stripped.startswith(("pk_test_", "pk_live_")):
        problem = "wrong_prefix"
    elif not stripped[8:].isalnum():
        problem = "illegal_character_in_body"
    else:
        return {"state": "ok", "length": len(stripped)}

    return {
        "state": "malformed",
        "problem": problem,
        "length": len(stripped),
        "had_surrounding_whitespace": raw != stripped,
    }


if STRIPE_KEY_ERROR:
    if os.getenv("STRIPE_KEY_STRICT", "0").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
        "",
    ):
        raise RuntimeError(STRIPE_KEY_ERROR)
    logger.critical(
        "INVALID STRIPE_SECRET_KEY — payments are disabled. %s", STRIPE_KEY_ERROR
    )


class _Settings:
    """Typed read-only accessors for every env var the application uses."""

    # Required
    @property
    def DATABASE_URL(self) -> str:
        return os.environ["DATABASE_URL"]

    @property
    def SUPABASE_URL(self) -> str:
        return os.environ["SUPABASE_URL"]

    @property
    def SUPABASE_SERVICE_KEY(self) -> str:
        return os.environ["SUPABASE_SERVICE_KEY"]

    @property
    def SECRET_KEY(self) -> str:
        return os.environ["SECRET_KEY"]

    # Optional
    @property
    def SUPABASE_KEY(self) -> str:
        return os.getenv("SUPABASE_KEY", "")

    @property
    def SWINGBY_ALLOWED_ORIGINS(self) -> str:
        return os.getenv("SWINGBY_ALLOWED_ORIGINS", "")

    @property
    def NOTION_TOKEN(self) -> str:
        return os.getenv("NOTION_TOKEN", "")

    @property
    def SENTRY_DSN(self) -> str:
        return os.getenv("SENTRY_DSN", "")

    @property
    def HCAPTCHA_SECRET(self) -> str:
        return os.getenv("HCAPTCHA_SECRET", "")

    @property
    def HCAPTCHA_SITEKEY(self) -> str:
        return os.getenv("HCAPTCHA_SITEKEY", "")

    @property
    def RESEND_API_KEY(self) -> str:
        return os.getenv("RESEND_API_KEY", "")

    @property
    def RESEND_FROM_EMAIL(self) -> str:
        return os.getenv("RESEND_FROM_EMAIL", "SwingBy <hello@swingbyy.com>")

    @property
    def PASSWORD_RESET_REDIRECT_URL(self) -> str:
        return os.getenv(
            "PASSWORD_RESET_REDIRECT_URL", "https://swingbyy.com/reset-password"
        )

    @property
    def GOOGLE_MAPS_API_KEY(self) -> str:
        return os.getenv("GOOGLE_MAPS_API_KEY", "")

    @property
    def STRIPE_SECRET_KEY(self) -> str:
        # Stripped: a trailing newline from a copy-paste into the Render
        # dashboard is itself enough to break the Authorization header.
        return os.getenv("STRIPE_SECRET_KEY", "").strip()

    @property
    def STRIPE_WEBHOOK_SECRET(self) -> str:
        return os.getenv("STRIPE_WEBHOOK_SECRET", "")

    @property
    def STRIPE_SUCCESS_URL(self) -> str:
        return os.getenv("STRIPE_SUCCESS_URL", "https://swingbyy.com/payment-success")

    @property
    def STRIPE_CANCEL_URL(self) -> str:
        return os.getenv("STRIPE_CANCEL_URL", "https://swingbyy.com/payment-cancelled")

    # ── Stripe Connect (D5, payouts) ────────────────────────────────────────
    #
    # Where Stripe's hosted Express onboarding sends the person when they
    # finish (RETURN) or when the single-use link has already expired
    # (REFRESH). Stripe requires http/https here and rejects a custom scheme,
    # so `swingby://` is not an option and these must be web URLs.
    #
    # The mobile app does NOT depend on either page working: it opens
    # onboarding in a browser tab and re-reads the account status when the tab
    # is dismissed, whichever way it was dismissed. The URLs still matter for
    # anyone who completes onboarding on a desktop, and the refresh page in
    # particular is where a stale link lands — today both resolve to the
    # swingbyy.com SPA fallback rather than a real page. See the PR body.
    @property
    def STRIPE_CONNECT_RETURN_URL(self) -> str:
        return os.getenv(
            "STRIPE_CONNECT_RETURN_URL", "https://swingbyy.com/payouts/connected"
        )

    @property
    def STRIPE_CONNECT_REFRESH_URL(self) -> str:
        return os.getenv(
            "STRIPE_CONNECT_REFRESH_URL", "https://swingbyy.com/payouts/continue"
        )

    # Convenience typed accessors (mirrors the property names for legacy callers)
    def get_database_url(self) -> str:
        return self.DATABASE_URL

    def get_supabase_url(self) -> str:
        return self.SUPABASE_URL

    def get_supabase_service_key(self) -> str:
        return self.SUPABASE_SERVICE_KEY

    def get_secret_key(self) -> str:
        return self.SECRET_KEY

    def get_sentry_dsn(self) -> str:
        return self.SENTRY_DSN


settings = _Settings()
