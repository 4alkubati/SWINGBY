"""
test_client_ip_trust.py — SB-0011 / SB-0017: the client address must come from
hops our own infrastructure appended, never from caller-supplied text.

Two controls used to derive the caller's address for themselves, and both read
`X-Forwarded-For` verbatim:

  * the slowapi limiter keyed every per-IP limit on `get_remote_address`
    (SB-0011) — rotate the header, get a fresh bucket, and 10/min login,
    5/min signup, 3/min forgot-password and 60/min POST /messages/ all stop
    meaning anything;
  * `auth._remote_ip` fed `login_guard`'s per-IP arm (SB-0017) — pin the header
    to a victim's address and 30 forged failures lock every genuine user behind
    it out for 15 minutes.

One header, two opposite abuses, because the FIRST hop of the chain is the one
entirely under the caller's control.

A note on what these tests can and cannot prove. The deployed bypass runs
through uvicorn's `ProxyHeadersMiddleware`, which rewrites `scope["client"]`
from the header before the app ever sees it. TestClient does not run that
middleware, so a "rotate the header against TestClient" test would pass against
the BROKEN code and prove nothing. The discriminating assertions therefore
target the derivation itself, plus the two configuration facts the fix depends
on — which is also what makes them fail today.
"""

import os

import pytest
from starlette.requests import Request

from app.main import app

REPO_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def make_request(xff: str | None = None, peer: str = "10.0.0.7") -> Request:
    """A bare ASGI scope with an optional X-Forwarded-For and a socket peer."""
    headers = []
    if xff is not None:
        headers.append((b"x-forwarded-for", xff.encode()))
    return Request({"type": "http", "headers": headers, "client": (peer, 44321)})


class TestTrustedHopSelection:
    """The derivation must count from the RIGHT — our proxy appends there."""

    def test_ignores_hops_the_caller_prepended(self, monkeypatch):
        """
        The attack in one line: the caller writes whatever it likes at the head
        of the chain. With one trusted proxy, only the last entry was appended
        by us, so that is the only entry worth reading.
        """
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        req = make_request("203.0.113.9, 198.51.100.4, 192.0.2.55")
        assert client_ip.client_ip(req) == "192.0.2.55"

    def test_a_lone_spoofed_header_cannot_impersonate_an_address(self, monkeypatch):
        """
        With no proxy in front (local dev, hops=0) the header is caller-supplied
        text in its entirety and must be ignored outright.
        """
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "0")
        req = make_request("203.0.113.9", peer="10.0.0.7")
        assert client_ip.client_ip(req) == "10.0.0.7"

    def test_short_chain_does_not_fall_back_to_caller_text(self, monkeypatch):
        """
        Fewer entries than trusted hops means the chain was not produced by the
        infrastructure we think is in front of us. Fail closed to the peer
        rather than reading an attacker-written entry.
        """
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
        req = make_request("203.0.113.9", peer="10.0.0.7")
        assert client_ip.client_ip(req) == "10.0.0.7"

    def test_empty_header_falls_back_to_the_peer(self, monkeypatch):
        """
        An empty header is an ABSENT chain, not a malformed one — the socket
        peer is the honest answer, and it is not caller-controlled.
        """
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        assert client_ip.client_ip(make_request("", peer="10.0.0.7")) == "10.0.0.7"

    @pytest.mark.parametrize(
        "garbage",
        ["not-an-ip", "'; drop table login_attempts--", "999.999.999.999", "a" * 300],
    )
    def test_non_addresses_are_rejected(self, monkeypatch, garbage):
        """
        SB-0017's second half: whatever survives here is written to
        `login_attempts.ip`. Only something that parses as an address may.
        """
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        assert client_ip.client_ip(make_request(garbage)) == "unknown"

    def test_ipv6_survives_the_round_trip(self, monkeypatch):
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        req = make_request("2001:db8::1")
        assert client_ip.client_ip(req) == "2001:db8::1"


class TestLoginGuardArm:
    """SB-0017 — the lockout must not be steerable at a victim's address."""

    def test_remote_ip_uses_the_shared_derivation(self, monkeypatch):
        """
        `auth._remote_ip` and the limiter disagreeing is how one header ended up
        with two meanings. They must resolve to the same value for the same
        request.
        """
        from app.api import auth
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        req = make_request("203.0.113.9, 192.0.2.55")
        assert auth._remote_ip(req) == client_ip.client_ip(req) == "192.0.2.55"

    def test_spoofed_chain_cannot_target_a_victim_address(self, monkeypatch):
        """
        The DoS: 30 failed logins carrying `X-Forwarded-For: <victim>` used to
        count against the victim. The value the guard sees must be our proxy's
        view of the caller, never the caller's claim about itself.
        """
        from app.api import auth

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        victim = "198.51.100.200"
        req = make_request(f"{victim}, 203.0.113.77")
        assert auth._remote_ip(req) != victim


class TestBudgetsStayPerClient:
    """
    The fix must not collapse everyone into one bucket — that would pass a naive
    "rotating the header no longer works" check while breaking every real user.
    """

    def test_two_distinct_clients_each_get_their_own_budget(self, monkeypatch):
        from app.services import client_ip

        monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
        a = client_ip.client_ip(make_request("203.0.113.1, 192.0.2.10"))
        b = client_ip.client_ip(make_request("203.0.113.1, 192.0.2.11"))
        assert a != b, "distinct callers must not share a rate-limit key"


class TestConfigurationFacts:
    """
    The derivation is only as good as the deployment around it. Both of these
    are part of the fix and both fail today.
    """

    def test_limiter_no_longer_keys_on_get_remote_address(self):
        """
        Checks for USE, not mention — limiter.py's docstring names
        `get_remote_address` to explain why it is the wrong key, and that
        explanation is worth keeping.
        """
        limiter_src = open(os.path.join(REPO_BACKEND, "app", "limiter.py")).read()
        code = "\n".join(
            line
            for line in limiter_src.splitlines()
            if not line.lstrip().startswith("#")
        )
        # Strip the module docstring before looking for real usage.
        if code.count('"""') >= 2:
            head, _, rest = code.partition('"""')
            _, _, code = rest.partition('"""')
            code = head + code
        assert "get_remote_address" not in code, (
            "slowapi's get_remote_address returns request.client.host, which "
            "uvicorn rewrites from X-Forwarded-For — that is SB-0011"
        )

    def test_limiter_is_wired_to_the_shared_derivation(self):
        assert (
            app.state.limiter._key_func(make_request(None, peer="10.0.0.7"))
            == "10.0.0.7"
        )

    def test_container_pins_an_explicit_trusted_proxy_list(self):
        """
        uvicorn defaults `proxy_headers=True` with `forwarded_allow_ips` of
        127.0.0.1. Leaving that implicit is what let the header reach
        `scope["client"]` in the first place.
        """
        dockerfile = open(os.path.join(REPO_BACKEND, "Dockerfile")).read()
        start_lines = [
            ln for ln in dockerfile.splitlines() if "uvicorn app.main:app" in ln
        ]
        assert start_lines, "expected a uvicorn start command in the Dockerfile"
        for line in start_lines:
            assert (
                "--forwarded-allow-ips" in line
            ), "the container start command must pin an explicit trusted-proxy list"
