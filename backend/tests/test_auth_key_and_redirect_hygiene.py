"""
test_auth_key_and_redirect_hygiene.py — SB-0024 / SB-0020 / SB-0071.

SB-0024 — `supabase_client` built its "anon" auth client as
`os.getenv("SUPABASE_KEY") or _service_key`. When SUPABASE_KEY is unset, the
RLS-bypassing service-role key was sent as the apikey/Authorization header on
every signup, login, token refresh and OAuth exchange — silently, with no
startup error. That is the most privileged key in the system, on the most-hit
and least-authenticated endpoints. It also undermines the anti-enumeration
design auth.py documents, which depends on GoTrue's NON-admin signup behaviour.

`backend/.env` on this box has `SUPABASE_KEY=` empty. Nothing failed, because
config.py aliases SUPABASE_PUBLISHABLE_KEY onto it — but only if config is
imported first, and `tools/backfill_geocode.py` imports supabase_client without
importing config at all. On Render both names are hand-set `sync: false` vars,
so one missed variable during a redeploy flips this on with no signal.

SB-0020 — the social-redirect allowlist matches a scheme PREFIX. The committed
defaults are safe (`swingby://` is a custom scheme the OS routes to the
installed app; `https://swingbyy.com/` has a trailing slash). The gap is
`SOCIAL_AUTH_REDIRECT_PREFIXES`: set it to a bare `exp://` and M-01's
auth-code harvesting is reachable again through an attacker-chosen Expo host.

SB-0071 — `login_guard.prune_attempts()` has no caller anywhere, while the
migration's own COMMENT promises a 7-day retention sweep.
"""

import inspect

import pytest


class TestAnonKeyNeverFallsBackToServiceRole:
    def test_resolver_refuses_to_substitute_the_service_key(self):
        from app import supabase_client

        assert hasattr(
            supabase_client, "resolve_anon_key"
        ), "expected a resolve_anon_key() so the fallback is testable (SB-0024)"
        with pytest.raises(RuntimeError):
            supabase_client.resolve_anon_key(anon=None, publishable=None)
        with pytest.raises(RuntimeError):
            supabase_client.resolve_anon_key(anon="", publishable="   ")

    def test_publishable_name_is_accepted(self):
        """
        Newer Supabase projects issue SUPABASE_PUBLISHABLE_KEY. Resolving it
        HERE rather than relying on config.py's alias matters: scripts import
        supabase_client without importing config.
        """
        from app import supabase_client

        assert (
            supabase_client.resolve_anon_key(anon=None, publishable="pub-1") == "pub-1"
        )
        assert (
            supabase_client.resolve_anon_key(anon="anon-1", publishable="pub-1")
            == "anon-1"
        )

    def test_no_silent_or_service_key_fallback_remains(self):
        from app import supabase_client

        src = inspect.getsource(supabase_client)
        assert (
            'os.getenv("SUPABASE_KEY") or _service_key' not in src
        ), "the anon client still falls back to the service-role key (SB-0024)"


class TestRedirectPrefixesMustBeMoreThanAScheme:
    # `swingby://` is deliberately absent: it is a committed DEFAULT and is
    # safe scheme-only, because a custom scheme has no meaningful host — the OS
    # routes it to the installed app. The gap was only ever in what an operator
    # could ADD through the env var.
    @pytest.mark.parametrize("bare", ["exp://", "https://", "myapp://"])
    def test_scheme_only_prefixes_are_refused(self, bare, monkeypatch):
        """
        A scheme-only prefix matches every host under that scheme, which is
        what makes M-01 reachable again. Configuring one must not silently
        widen the allowlist IN PRODUCTION — on a dev box a bare `exp://` is the
        only thing a developer can usefully set, since Expo Go's host and port
        vary per machine, and test_pentest_mediums pins that.
        """
        from app.api import auth

        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("SOCIAL_AUTH_REDIRECT_PREFIXES", bare)
        assert bare not in auth._allowed_redirect_prefixes(), (
            f"a scheme-only prefix ({bare}) was accepted into the redirect "
            f"allowlist (SB-0020)"
        )

    def test_a_full_prefix_is_still_accepted(self, monkeypatch):
        """Expo Go against a deployed API is a real need — keep it expressible."""
        from app.api import auth

        full = "exp://10.0.0.168:8081/--/"
        monkeypatch.setenv("ENV", "production")
        monkeypatch.setenv("SOCIAL_AUTH_REDIRECT_PREFIXES", full)
        assert full in auth._allowed_redirect_prefixes()

    def test_the_committed_defaults_survive(self, monkeypatch):
        from app.api import auth

        monkeypatch.delenv("SOCIAL_AUTH_REDIRECT_PREFIXES", raising=False)
        prefixes = auth._allowed_redirect_prefixes()
        assert any(p.startswith("swingby://") for p in prefixes)


class TestRetentionSweepHasACaller:
    def test_prune_attempts_is_reachable(self):
        """
        The migration COMMENT promises a 7-day retention sweep on
        login_attempts. A function nobody calls does not implement a promise —
        the table grows forever and the claim in the schema is false.
        """
        from app.api import admin

        src = inspect.getsource(admin)
        assert (
            "prune_attempts" in src
        ), "login_guard.prune_attempts() still has no caller (SB-0071)"
