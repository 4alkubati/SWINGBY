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
    "HCAPTCHA_ENFORCE",  # SB-0046: enforcement is a SECOND, deliberate switch
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
    "ENV",  # "production" hides /docs and the /health diagnostics. Anything else = dev.
    "API_ENABLE_DOCS",  # explicit override: "1" re-opens /docs even in production
    "MAX_REQUEST_BYTES",  # global request-body ceiling (default 12 MB)
    "HEALTH_DIAGNOSTICS_TOKEN",  # when set, /health returns detail only to this token
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


def stripe_webhook_diagnosis() -> dict:
    """The THIRD key. Same treatment for STRIPE_WEBHOOK_SECRET.

    `stripe_publishable_diagnosis` above says a health check that reads only one
    of the keys is not a health check. That argument did not stop at two: with
    the secret and publishable keys both green, `/health` still reported a
    fully-healthy Stripe while the webhook secret was missing — and that is the
    one whose absence silently EATS MONEY rather than blocking it.

    The failure is asymmetric and invisible from the client. A missing secret or
    publishable key fails loudly and up front: no charge is created, the payment
    sheet refuses to open, the user sees an error. A missing webhook secret lets
    the charge succeed at Stripe — the client's card is really debited — and
    then makes `stripe_service.verify_webhook_signature` refuse every incoming
    event (`services/stripe_service.py:188-201` raises when the secret is
    unset). So `_mark_payment_paid` never runs, the payments row never records
    the capture, `escrow.is_capture_backed` stays False, and the escrow is never
    released to the business. Real money leaves the client, and the ledger
    believes nothing was ever paid.

    Checks are deliberately conservative. A false "malformed" here would be its
    own bug — an alarm nobody trusts is worse than no alarm — so this flags only
    what cannot be a valid signing secret, and does not impose a strict
    character set on the body: Stripe does not document one, and guessing would
    turn a working deployment red.

    Withholds the value for the same reason as its two siblings.
    """
    raw = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    stripped = raw.strip()
    if not stripped:
        # The money-eating case: charges succeed, every webhook is rejected.
        return {"state": "not_configured"}

    if not stripped.isascii():
        problem = "non_ascii_character"
    elif stripped[:1] in ("'", '"') or stripped[-1:] in ("'", '"'):
        problem = "wrapped_in_quotes"
    elif stripped.startswith("sk_"):
        problem = "secret_key_not_webhook_secret"
    elif stripped.startswith(("pk_test_", "pk_live_")):
        problem = "publishable_key_not_webhook_secret"
    elif not stripped.startswith("whsec_"):
        problem = "wrong_prefix"
    elif len(stripped) <= len("whsec_"):
        problem = "prefix_only_no_body"
    elif any(c.isspace() for c in stripped):
        # An embedded newline from a wrapped copy-paste out of the dashboard.
        problem = "whitespace_in_body"
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

    # ── Deployment posture ────────────────────────────────────────────────
    #
    # ENV is read in several places (Sentry's environment tag, /health) and now
    # decides whether the interactive API docs exist at all. Note the default:
    # "development". Render has historically had no ENV set, which is why
    # /health reports this value back — see the comment there.
    @property
    def ENV(self) -> str:
        return os.getenv("ENV", "development")

    @property
    def IS_PRODUCTION(self) -> bool:
        return self.ENV.strip().lower() in ("production", "prod")

    @property
    def API_ENABLE_DOCS(self) -> bool:
        """Should /docs, /redoc and /openapi.json be served?

        Off in production, on everywhere else, and API_ENABLE_DOCS=1 forces them
        back on for the case where someone genuinely needs the schema against a
        deployed environment. Defaulting to "off in prod" rather than "off
        unless asked" is the whole point: the failure mode we are fixing is that
        nobody thought about it.
        """
        override = os.getenv("API_ENABLE_DOCS", "").strip()
        if override:
            return override not in ("0", "false", "False", "no")
        return not self.IS_PRODUCTION

    @property
    def MAX_REQUEST_BYTES(self) -> int:
        """Global ceiling on a request body, in bytes.

        12 MB, deliberately ABOVE the 10 MB image cap in api/uploads.py so this
        never becomes the thing that rejects a legitimate photo — the endpoint
        keeps its own tighter, better-worded limit. This is the backstop for
        every OTHER route, none of which had one.
        """
        raw = os.getenv("MAX_REQUEST_BYTES", "").strip()
        if raw.isdigit() and int(raw) > 0:
            return int(raw)
        return 12 * 1024 * 1024

    @property
    def HEALTH_DIAGNOSTICS_TOKEN(self) -> str:
        return os.getenv("HEALTH_DIAGNOSTICS_TOKEN", "")

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
    def HCAPTCHA_ENFORCE(self) -> bool:
        """Should a MISSING captcha token refuse the signup? (SB-0046)

        Setting HCAPTCHA_SECRET alone used to flip this on, and it is a one-way
        switch that refuses 100% of signups: no client sends `hcaptcha_token` —
        not the mobile app, not either web app — so the moment the secret
        appears in the Render dashboard every signup 429s. The verification
        code was correct; what was missing was any way to configure the secret
        WITHOUT immediately breaking the product.

        Two steps now. Set the secret to enable verification of tokens that ARE
        sent, then set HCAPTCHA_ENFORCE=1 once a client actually sends them.
        """
        return os.getenv("HCAPTCHA_ENFORCE", "").strip() in ("1", "true", "True", "yes")

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
