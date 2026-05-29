"""
limiter.py — Shared slowapi Limiter instance.

Defined here (not in main.py) to avoid a circular import: main.py imports
routers, routers import the limiter, and if the limiter lived in main.py that
would create a cycle.  Both main.py and the router modules import from here.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
