"""
test_stripe_key_validation.py — SEN-1 (walkthrough audit 2026-07-24).

LIVE SENTRY ISSUE: `APIConnectionError` on PATCH /interests/{id}/accept,
chained cause

    UnicodeEncodeError: 'latin-1' codec can't encode character '…'
    in position 21          ← raised inside urllib3/connection.py putheader()

Position 21 of `Authorization: Bearer sk_…` is inside the key. A real Stripe
key is pure ASCII and cannot raise that; a key copied out of the Stripe
dashboard while still MASKED (`sk_test_51ABC…`) can, because the elision is a
real U+2026 character in the value.

The old guard was `if not settings.STRIPE_SECRET_KEY` — non-empty was the whole
bar, so the malformed key passed config, passed `_require_stripe()`, and died
four layers down in the socket stack with a message that named neither Stripe
nor the environment variable. These tests pin the new shape check and the
message it produces.
"""

import pytest

from app.config import stripe_secret_key_error
from app.services import stripe_service

THE_SENTRY_KEY = "sk_test_51ABCdefGHIjklMNO…"  # exactly what SEN-1 was carrying


class TestKeyShapeValidator:
    def test_empty_key_is_not_an_error(self):
        """Stripe is optional on this deployment; absent ≠ malformed."""
        assert stripe_secret_key_error("") == ""

    def test_valid_test_key_passes(self):
        assert stripe_secret_key_error("sk_test_51AbCdEf0123456789") == ""

    def test_valid_live_key_passes(self):
        assert stripe_secret_key_error("sk_live_51AbCdEf0123456789") == ""

    def test_masked_dashboard_key_is_rejected_with_an_actionable_message(self):
        err = stripe_secret_key_error(THE_SENTRY_KEY)
        assert err
        assert "STRIPE_SECRET_KEY" in err
        assert "U+2026" in err
        assert "reveal" in err  # tells the operator exactly what to do

    def test_publishable_key_is_rejected(self):
        assert "publishable" in stripe_secret_key_error("pk_test_51AbCdEf0123456789")

    def test_webhook_secret_is_rejected(self):
        assert stripe_secret_key_error("whsec_abc123")

    def test_quoted_or_padded_value_is_rejected(self):
        assert stripe_secret_key_error('"sk_test_51AbCdEf0123456789"')

    def test_restricted_key_is_rejected(self):
        assert stripe_secret_key_error("rk_test_51AbCdEf0123456789")


class TestRequireStripeRefusesBadKeys:
    def test_masked_key_raises_before_any_http_call(self, monkeypatch):
        monkeypatch.setenv("STRIPE_SECRET_KEY", THE_SENTRY_KEY)
        with pytest.raises(stripe_service.StripeNotConfigured) as exc:
            stripe_service._require_stripe()
        assert "U+2026" in str(exc.value)

    def test_absent_key_still_says_not_configured(self, monkeypatch):
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
        with pytest.raises(stripe_service.StripeNotConfigured) as exc:
            stripe_service._require_stripe()
        assert "not configured" in str(exc.value)

    def test_checkout_session_returns_503_not_a_socket_crash(self, monkeypatch):
        """The old path reached urllib3 and surfaced as APIConnectionError."""
        from fastapi import HTTPException

        monkeypatch.setenv("STRIPE_SECRET_KEY", THE_SENTRY_KEY)
        with pytest.raises(HTTPException) as exc:
            stripe_service.create_checkout_session(
                booking_id="booking-1",
                amount_cad=150.0,
                description="test",
            )
        assert exc.value.status_code == 503
        assert "STRIPE_SECRET_KEY" in exc.value.detail

    def test_trailing_newline_is_tolerated(self, monkeypatch):
        """A copy-paste newline breaks the header too — strip it, don't reject."""
        from app.config import settings

        monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_51AbCdEf0123456789\n")
        assert settings.STRIPE_SECRET_KEY == "sk_test_51AbCdEf0123456789"
        assert stripe_secret_key_error(settings.STRIPE_SECRET_KEY) == ""
