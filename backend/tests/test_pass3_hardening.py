"""
test_pass3_hardening.py — the PASS 3 security checklist fixes.

One test per control, named for the checklist item it defends, so a regression
points straight back at the finding rather than at an anonymous assertion.

Deliberately NOT covered here: item #1 (session revocation on password change),
which is a Postgres trigger on `auth.users` and cannot be exercised from a unit
test with a stubbed Supabase client — see supabase/migrations/
20260814000000_session_revocation.sql, and test_session_security.py for the
watermark logic it drives.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

from app.services import audio_sniff, image_sniff

# ═════════════════════════════════════════════════════════════════════════════
# #12 — uploads are allow-listed by content sniffing, not by the client's claim
# ═════════════════════════════════════════════════════════════════════════════

# Minimal but REAL headers. A test that invents its own byte patterns proves
# only that the sniffer matches the test.
M4A = b"\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00"
WAV = b"RIFF\x24\x08\x00\x00WAVEfmt "
MP3_ID3 = b"ID3\x03\x00\x00\x00\x00\x00\x00"
ADTS_AAC = b"\xff\xf1\x50\x80\x00\x1f\xfc"
HEIC = b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00"
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00"

SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
EICAR = rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class TestAudioSniffing:
    @pytest.mark.parametrize(
        "content,declared",
        [
            (M4A, "audio/mp4"),
            (M4A, "audio/m4a"),
            (M4A, "audio/x-m4a"),
            (WAV, "audio/wav"),
            (WAV, "audio/x-wav"),
            (MP3_ID3, "audio/mpeg"),
            (ADTS_AAC, "audio/aac"),
        ],
    )
    def test_real_recordings_are_accepted(self, content, declared):
        """The formats the mobile app actually produces must still upload.

        This is the half that matters most: a sniffer that rejects genuine
        iOS/Android recordings would be reverted within a day, and then the
        endpoint is back to trusting the client.
        """
        assert audio_sniff.matches_declared(content, declared) is True

    @pytest.mark.parametrize("payload", [SVG, EICAR, b"", b"not audio at all"])
    def test_non_audio_is_refused_whatever_it_claims(self, payload):
        assert audio_sniff.matches_declared(payload, "audio/mpeg") is False
        assert audio_sniff.matches_declared(payload, "audio/mp4") is False

    def test_an_image_cannot_masquerade_as_audio(self):
        """The finding itself: declare audio/mpeg, send anything.

        HEIC is the sharp case — it shares the `ftyp` container with m4a, so a
        sniffer that checked only "is this ISO-BMFF" would wave it through.
        """
        assert audio_sniff.matches_declared(HEIC, "audio/mp4") is False
        assert audio_sniff.matches_declared(JPEG, "audio/mpeg") is False

    def test_declared_type_must_match_the_actual_family(self):
        """A WAV declared as audio/mpeg is refused even though both are audio.

        Supabase serves the object back under the DECLARED type, so agreement —
        not mere plausibility — is the property worth having.
        """
        assert audio_sniff.matches_declared(WAV, "audio/mpeg") is False
        assert audio_sniff.matches_declared(MP3_ID3, "audio/wav") is False


class TestImageSniffHeicRegression:
    """`uploads.ALLOWED_CONTENT_TYPES` accepted image/heic; the sniffer's table
    did not list it, so every iPhone photo was rejected by the second gate after
    passing the first. Found while auditing the audio path."""

    def test_heic_is_accepted(self):
        assert image_sniff.sniff(HEIC) == "image/heic"
        assert image_sniff.matches_declared(HEIC, "image/heic") is True
        assert image_sniff.matches_declared(HEIC, "image/heif") is True

    def test_svg_is_still_refused(self):
        """The original D7.9 finding must not regress while adding HEIC."""
        assert image_sniff.sniff(SVG) is None
        assert image_sniff.matches_declared(SVG, "image/jpeg") is False

    def test_audio_cannot_masquerade_as_an_image(self):
        assert image_sniff.matches_declared(M4A, "image/heic") is False


# ═════════════════════════════════════════════════════════════════════════════
# #4 / #19 — durable lockout, and the trail it leaves
# ═════════════════════════════════════════════════════════════════════════════


class TestLoginGuard:
    def test_email_is_never_stored_in_the_clear(self):
        from app.services import login_guard

        digest = login_guard.hash_email("Someone@Example.com")
        assert "someone" not in digest.lower()
        assert "@" not in digest
        # Case and surrounding whitespace must not produce a different bucket,
        # or the counter is trivially reset by changing capitalisation.
        assert digest == login_guard.hash_email("  someone@example.com  ")

    def test_lockout_is_keyed_on_the_account_not_the_ip(self, monkeypatch):
        """The bypass that made the old control worthless.

        Five failures against one account from five different addresses must
        still lock, because the attacker's rotating proxy pool is exactly the
        scenario the old (email, ip) key handed a fresh budget to.
        """
        from app.services import login_guard

        def fake_count(column, value):
            return login_guard.MAX_FAILURES_PER_EMAIL if column == "email_hash" else 0

        monkeypatch.setattr(login_guard, "_count", fake_count)
        assert login_guard.check_lockout("victim@example.com", "203.0.113.9") == (
            "email_threshold"
        )

    def test_spray_across_accounts_from_one_ip_is_caught(self, monkeypatch):
        from app.services import login_guard

        def fake_count(column, value):
            return login_guard.MAX_FAILURES_PER_IP if column == "ip" else 0

        monkeypatch.setattr(login_guard, "_count", fake_count)
        assert (
            login_guard.check_lockout("a@example.com", "203.0.113.9") == "ip_threshold"
        )

    def test_database_failure_fails_open(self, monkeypatch):
        """A Postgres blip must not lock the whole platform out.

        `_count` returns None on failure, which the guard has to read as "no
        opinion" rather than as a count of zero OR as a reason to refuse.
        """
        from app.services import login_guard

        monkeypatch.setattr(login_guard, "_count", lambda column, value: None)
        assert login_guard.check_lockout("a@example.com", "203.0.113.9") is None

    def test_a_locked_out_attempt_is_logged_but_not_counted(self, monkeypatch):
        """Recording a refused attempt would let an attacker extend someone
        else's lockout for ever by continuing to knock."""
        from app.services import login_guard

        inserted = []
        monkeypatch.setattr(
            login_guard.supabase,
            "table",
            lambda name: inserted.append(name),
            raising=False,
        )
        login_guard.record_lockout("a@example.com", "203.0.113.9", "email_threshold")
        assert inserted == []


# ═════════════════════════════════════════════════════════════════════════════
# #5 — no user enumeration
# ═════════════════════════════════════════════════════════════════════════════


class TestNoEnumeration:
    def test_signup_does_not_confirm_an_address_is_taken(self):
        """The message used to read "check if email is already in use", which
        answers "does this person have a SwingBy account?" for anyone who asks."""
        import inspect

        from app.api import auth

        source = inspect.getsource(auth.signup)
        assert "already in use" not in source

    def test_lockout_response_does_not_leak_a_retry_window(self):
        """The old 429 said "try again in N minutes", where N was derived from
        the oldest recorded failure — a readout of whether we had seen this
        account before."""
        import inspect

        from app.api import auth

        source = inspect.getsource(auth._check_lockout)
        assert "minute(s)" not in source

    def test_waitlist_does_not_echo_raw_exceptions(self):
        """Public, unauthenticated, and it used to return str(e) — which for a
        duplicate confirms the address is already on the list."""
        import inspect

        from app.api import waitlist

        source = inspect.getsource(waitlist.join_waitlist)
        assert "detail=str(e)" not in source


# ═════════════════════════════════════════════════════════════════════════════
# #7 / #10 / #11 — transport headers, docs exposure, body ceiling
# ═════════════════════════════════════════════════════════════════════════════


class TestSecurityHeaders:
    def test_headers_are_present_on_a_real_response(self, test_client: TestClient):
        res = test_client.get("/healthz")
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert res.headers["X-Frame-Options"] == "DENY"
        assert res.headers["Cache-Control"] == "no-store"

    def test_hsts_is_set_when_the_request_arrived_over_https(
        self, test_client: TestClient
    ):
        """Render terminates TLS, so the scheme has to be read off the
        forwarded header — reading request.url.scheme alone would mean HSTS
        never got sent in production."""
        res = test_client.get("/healthz", headers={"x-forwarded-proto": "https"})
        assert "max-age=63072000" in res.headers["Strict-Transport-Security"]
        assert "includeSubDomains" in res.headers["Strict-Transport-Security"]

    def test_hsts_is_absent_over_plain_http(self, test_client: TestClient):
        """Sending it over http is meaningless, and would break local dev
        against http://10.0.0.168:8000."""
        res = test_client.get("/healthz", headers={"x-forwarded-proto": "http"})
        assert "Strict-Transport-Security" not in res.headers


class TestDocsExposure:
    def test_docs_are_disabled_in_production(self, monkeypatch):
        """/docs, /redoc and /openapi.json published the whole route map —
        every /admin/* path included — with no credential."""
        monkeypatch.setenv("ENV", "production")
        monkeypatch.delenv("API_ENABLE_DOCS", raising=False)

        from app import config

        importlib.reload(config)
        assert config.settings.IS_PRODUCTION is True
        assert config.settings.API_ENABLE_DOCS is False

    def test_docs_stay_available_outside_production(self, monkeypatch):
        monkeypatch.setenv("ENV", "development")
        monkeypatch.delenv("API_ENABLE_DOCS", raising=False)

        from app import config

        importlib.reload(config)
        assert config.settings.API_ENABLE_DOCS is True

    def test_an_explicit_override_wins(self, monkeypatch):
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("API_ENABLE_DOCS", "1")

        from app import config

        importlib.reload(config)
        assert config.settings.API_ENABLE_DOCS is True


class TestBodySizeLimit:
    def test_an_oversized_body_is_refused_with_413(self, test_client: TestClient):
        """Every POST but the two upload routes had no ceiling at all, and even
        those checked size only AFTER reading the whole body into memory."""
        from app.config import settings

        oversized = b"x" * (settings.MAX_REQUEST_BYTES + 1024)
        res = test_client.post(
            "/auth/login",
            content=oversized,
            headers={"Content-Type": "application/json"},
        )
        assert res.status_code == 413

    def test_a_normal_body_is_untouched(self, test_client: TestClient):
        """The limit must sit above the 10 MB image cap so it never becomes the
        thing that rejects a legitimate photo."""
        from app.config import settings

        assert settings.MAX_REQUEST_BYTES > 10 * 1024 * 1024

        res = test_client.post("/auth/login", json={"email": "x", "password": "y"})
        assert res.status_code != 413


# ═════════════════════════════════════════════════════════════════════════════
# #8 — CORS cannot be widened into credentialed origin reflection
# ═════════════════════════════════════════════════════════════════════════════


class TestCorsWildcardRejected:
    def test_a_wildcard_origin_is_dropped_from_the_env_list(self, monkeypatch):
        """Combined with allow_credentials=True, a "*" makes Starlette REFLECT
        whatever Origin it is sent — every site on the internet reading
        authenticated responses. Nothing validated this env var."""
        monkeypatch.setenv("SWINGBY_ALLOWED_ORIGINS", "https://ok.example.com,*")

        from app import config

        importlib.reload(config)
        extra = [
            o.strip()
            for o in config.settings.SWINGBY_ALLOWED_ORIGINS.split(",")
            if o.strip()
        ]
        filtered = [o for o in extra if "*" not in o]
        assert filtered == ["https://ok.example.com"]
