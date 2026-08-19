"""
client_ip.py — one trusted-proxy-aware derivation of the caller's address.

Why this module exists (SB-0011, SB-0017)
-----------------------------------------
Two separate controls used to work out "who is calling" for themselves, and
both read `X-Forwarded-For` verbatim:

  * `limiter.py` keyed every per-IP rate limit on slowapi's
    `get_remote_address`, which returns `request.client.host` — a value uvicorn
    rewrites from the header. Rotating the header bought a fresh bucket, so
    10/min login, 5/min signup, 3/min forgot-password, 60/min POST /messages/
    and 5/min contact were all decorative.
  * `auth._remote_ip` returned the FIRST entry of the chain and fed it to
    `login_guard`'s per-IP arm. Pinning the header to someone else's address
    and failing 30 logins locked every genuine user behind that address out for
    15 minutes — a targeted denial of service delivered through the control
    that exists to prevent one.

One header, two opposite abuses, and the same root cause: the left-hand end of
the chain is written by the caller.

The rule
--------
Trust only the hops our own infrastructure appended. A proxy appends the
address it saw to the RIGHT of the chain, so with `TRUSTED_PROXY_HOPS = n` the
caller is the nth entry counted from the right. Everything to the left of that
is caller-supplied text and is ignored.

  X-Forwarded-For: <caller writes anything here>, <real client>
                                                  ^ hops=1 reads this

`TRUSTED_PROXY_HOPS` defaults to 1 in production (Render terminates TLS and
appends exactly one hop) and 0 everywhere else, where there is no proxy in
front and the socket peer is already the truth. Put another CDN in front of
Render and this becomes 2 — set it explicitly rather than guessing, because
counting too FEW hops reads attacker text, and counting too MANY collapses
every caller onto one shared bucket.

Two deliberate fail-safes:

  * a chain shorter than the configured hop count means the request did not
    come through the infrastructure we think is in front of us, so we fall back
    to the socket peer rather than reading an attacker-written entry;
  * anything that does not parse as an IP address becomes "unknown". That value
    is written to `login_attempts.ip` and `login_guard` deliberately skips its
    per-IP arm for "unknown", so garbage degrades the control instead of
    steering it.
"""

import ipaddress
import os
from typing import Optional

from starlette.requests import Request

from app.config import settings

UNKNOWN = "unknown"


def trusted_proxy_hops() -> int:
    """
    How many right-hand entries of X-Forwarded-For our own infrastructure wrote.

    Read per call rather than cached at import so a deployment can change it
    without a rebuild, and so tests can exercise both sides of it.
    """
    raw = os.getenv("TRUSTED_PROXY_HOPS", "").strip()
    if raw:
        try:
            return max(0, int(raw))
        except ValueError:
            # A typo must not silently turn the header back on.
            return 0
    return 1 if settings.IS_PRODUCTION else 0


def _as_address(value: Optional[str]) -> str:
    """Normalise to a canonical IP string, or UNKNOWN if it is not one."""
    if not value:
        return UNKNOWN
    candidate = value.strip()
    # Some proxies bracket IPv6 and append a port: "[2001:db8::1]:443".
    if candidate.startswith("[") and "]" in candidate:
        candidate = candidate[1 : candidate.index("]")]
    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return UNKNOWN


def client_ip(request: Request) -> str:
    """
    The caller's address, taken only from hops we control.

    Used as the slowapi key function and by `auth._remote_ip`, so the rate
    limiter and the brute-force guard can never disagree about who is calling —
    that disagreement is what let one header carry two meanings.
    """
    hops = trusted_proxy_hops()
    if hops:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            chain = [part.strip() for part in forwarded.split(",") if part.strip()]
            if len(chain) >= hops:
                return _as_address(chain[-hops])
            # Chain shorter than expected — fall through to the socket peer.
    return _as_address(request.client.host if request.client else None)
