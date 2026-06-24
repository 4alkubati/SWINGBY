"""
config.py — Centralised environment-variable validation and typed accessors.

Imported at the top of main.py so the application fails fast at startup when
any REQUIRED variable is missing, rather than surfacing a confusing error at
request time.
"""

import os

# ---------------------------------------------------------------------------
# Required vars — the app cannot function without these
# ---------------------------------------------------------------------------
_REQUIRED = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SECRET_KEY",
]

_missing = [name for name in _REQUIRED if not os.getenv(name)]
if _missing:
    raise RuntimeError(
        "Missing required environment variables: "
        + ", ".join(_missing)
        + ". Add them to backend/.env and restart."
    )

# ---------------------------------------------------------------------------
# Optional vars (may be empty / absent)
# ---------------------------------------------------------------------------
_OPTIONAL = [
    "SUPABASE_KEY",
    "SWINGBY_ALLOWED_ORIGINS",
    "NOTION_TOKEN",
    "NOTION_CRM_DB_ID",
    "SENTRY_DSN",
    "HCAPTCHA_SECRET",
    "HCAPTCHA_SITEKEY",
    "RESEND_API_KEY",       # Resend transactional email — set after domain verified
    "RESEND_FROM_EMAIL",    # e.g. "SwingBy <hello@swingbyy.com>"
    "PASSWORD_RESET_REDIRECT_URL",  # override where Supabase reset emails redirect (defaults to web)
    "STRIPE_SECRET_KEY",        # sk_test_… for beta sandbox, sk_live_… post-beta
    "STRIPE_WEBHOOK_SECRET",    # whsec_… — used to verify Stripe webhook signature
    "STRIPE_SUCCESS_URL",       # browser landing after Checkout success (defaults to web)
    "STRIPE_CANCEL_URL",        # browser landing after Checkout cancel  (defaults to web)
]


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
    def NOTION_CRM_DB_ID(self) -> str:
        return os.getenv("NOTION_CRM_DB_ID", "a0fceda5610e474fac5949ec6ab8d012")

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
        return os.getenv("PASSWORD_RESET_REDIRECT_URL", "https://swingbyy.com/reset-password")

    @property
    def STRIPE_SECRET_KEY(self) -> str:
        return os.getenv("STRIPE_SECRET_KEY", "")

    @property
    def STRIPE_WEBHOOK_SECRET(self) -> str:
        return os.getenv("STRIPE_WEBHOOK_SECRET", "")

    @property
    def STRIPE_SUCCESS_URL(self) -> str:
        return os.getenv("STRIPE_SUCCESS_URL", "https://swingbyy.com/payment-success")

    @property
    def STRIPE_CANCEL_URL(self) -> str:
        return os.getenv("STRIPE_CANCEL_URL", "https://swingbyy.com/payment-cancelled")

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
