"""
url_safety.py — D7.8 (pentest M-04): stop storing URLs that point inside the
network.

THE FINDING
-----------
`PATCH /auth/me` accepted and stored all six of these verbatim, 200 each:

    http://169.254.169.254/latest/meta-data/     (cloud instance metadata)
    http://localhost/
    http://127.0.0.1:22
    file:///etc/passwd
    gopher://127.0.0.1:6379/_INFO                (redis via gopher)
    http://internal.render.com/

No outbound fetch was proven — nothing on the server currently retrieves
`avatar_url`, so this is a stored-URL vector rather than live SSRF. That is
precisely why it is worth fixing now and not later: the day someone adds
avatar thumbnailing, a link preview, an email template that inlines the image,
or a PDF that embeds it, every one of those rows becomes a request the server
makes on an attacker's behalf. The fix belongs at the write, where there is one
place to put it, not at each future read.

WHAT IS ALLOWED
---------------
`https` only, to a public hostname. That covers everything real: Supabase
Storage serves avatars over https, and social sign-in hands back
`https://lh3.googleusercontent.com/...`. No product feature needs `http`, a
bare IP, or any other scheme.
"""

import ipaddress
from typing import Optional
from urllib.parse import urlparse

# Hostnames that resolve inward regardless of what the DNS says.
_BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "ip6-localhost",
        "ip6-loopback",
        # Cloud instance-metadata endpoints, by name as well as by address.
        "metadata",
        "metadata.google.internal",
        "instance-data",
    }
)

# Suffixes that are internal by convention. `.internal` covers the Render
# internal hostnames the engagement used directly.
_BLOCKED_HOST_SUFFIXES = (
    ".local",
    ".internal",
    ".localdomain",
    ".home.arpa",
)


class UnsafeUrl(ValueError):
    """Raised when a URL must not be stored."""


def _is_private_address(host: str) -> bool:
    """True if `host` is a literal IP inside a range we must never fetch.

    Returns False for anything that is not an IP literal — a hostname is
    handled by the name rules instead. We deliberately do NOT resolve DNS here:
    a resolution at write time proves nothing about where the name points at
    read time (that is DNS rebinding), and doing a lookup inside a request
    handler hands an attacker a way to make the API perform DNS on demand.
    """
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local  # 169.254.0.0/16 — the metadata range
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_public_https_url(value: Optional[str]) -> Optional[str]:
    """Return `value` if it is a safe, public https URL; raise `UnsafeUrl` if not.

    None and empty string pass through as None — clearing an avatar is a
    legitimate thing to do and must not be an error.
    """
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None

    try:
        parsed = urlparse(value)
    except ValueError as exc:  # malformed IPv6 literal, etc.
        raise UnsafeUrl("Image URL is not a valid URL") from exc

    if parsed.scheme.lower() != "https":
        # Names the actual rule rather than saying "invalid". The person
        # hitting this in a client is a developer, and "must be https" is
        # something they can act on.
        raise UnsafeUrl("Image URL must start with https://")

    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise UnsafeUrl("Image URL must include a hostname")

    if host in _BLOCKED_HOSTNAMES or host.endswith(_BLOCKED_HOST_SUFFIXES):
        raise UnsafeUrl("Image URL must point at a public address")

    if _is_private_address(host):
        raise UnsafeUrl("Image URL must point at a public address")

    # A host with no dot is a bare machine name on the local network
    # ("intranet", "router"). Public hosts are always dotted, and IPv6 literals
    # were already rejected above if private — a public one is still refused
    # here, which is fine: no real avatar is served from a bare IPv6 address.
    if "." not in host:
        raise UnsafeUrl("Image URL must point at a public address")

    return value


def as_stored_image_url(value: Optional[str]) -> Optional[str]:
    """
    Pydantic-friendly wrapper: same check, but raising `ValueError` so it can be
    dropped straight into a `field_validator`.

    Exists because the D7.8 fix (pentest M-04) was written inline on ONE of the
    three sinks that store an image URL, and the other two — `businesses.logo_url`
    and `employees.avatar_url` — kept their own weaker checks or none at all
    (SB-0015, SB-0016). Every sink calls this now, so adding a fourth means
    calling it too rather than reinventing a scheme test.
    """
    try:
        return validate_public_https_url(value)
    except UnsafeUrl as exc:
        raise ValueError(str(exc)) from exc
