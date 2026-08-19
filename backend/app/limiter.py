"""
limiter.py — Shared slowapi Limiter instance.

Defined here (not in main.py) to avoid a circular import: main.py imports
routers, routers import the limiter, and if the limiter lived in main.py that
would create a cycle.  Both main.py and the router modules import from here.

The key function is `client_ip.client_ip`, NOT slowapi's `get_remote_address`
(SB-0011). `get_remote_address` returns `request.client.host`, which uvicorn
rewrites from `X-Forwarded-For` — a header the caller writes. Rotating it
handed out a fresh bucket per request and made every per-IP limit on the API
decorative. `client_ip` reads only the hops our own proxy appended; see that
module for the rule and for why the hop count is counted from the right.

The same function backs `auth._remote_ip`, so the rate limiter and the
brute-force lockout cannot disagree about who is calling.
"""

from slowapi import Limiter

from app.services.client_ip import client_ip

limiter = Limiter(key_func=client_ip, default_limits=["100/minute"])
