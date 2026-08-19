"""
security_headers.py — response hardening for the API (checklist #7).

WHAT WAS ACTUALLY MISSING, AND WHAT WAS NOT
-------------------------------------------
The web properties were already covered: `web/launch/public/_headers` carries
HSTS, a real CSP, nosniff, DENY and a Permissions-Policy at the Cloudflare Pages
edge. The FastAPI app had none of it, and neither did the pre-launch site (fixed
separately in its own `_headers`).

An API serving JSON is a smaller target than an HTML page — there is no document
for a framing or XSS attack to live in — so the set here is deliberately shorter
than the one on the web side:

* **HSTS** is the one that genuinely matters. The mobile app talks to this
  origin over the network; without it the first request of a session is
  downgradeable. Set only when the request arrived over HTTPS, because sending
  HSTS over plain HTTP is meaningless (browsers ignore it) and would break local
  development on http://10.0.0.168:8000.
* **nosniff** stops a browser from second-guessing our `application/json` — the
  same reasoning that made `image_sniff.py` necessary, applied to responses.
* **DENY / no-referrer** cost nothing and close the "someone opened an API URL
  in a browser tab" case, which is real: `/bookings/{id}/invoice.pdf` is opened
  with `Linking.openURL`.
* **no-store** on everything. Every response this API produces is either
  personal data or a money figure; none of it should sit in an intermediary
  cache. This also covers the `?token=` invoice URL, whose whole problem is
  ending up somewhere it was not meant to persist.

No CSP here: it governs what a *document* may load, and this origin serves no
documents. Adding one would be cargo-culting the web config into a place it does
nothing.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Two years, subdomains included, preload-eligible — matching what
# web/launch/public/_headers already asserts, so the two cannot disagree about
# the same domain.
HSTS_VALUE = "max-age=63072000; includeSubDomains; preload"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        # `x-forwarded-proto` because this runs behind Render's proxy, which
        # terminates TLS — request.url.scheme is http by the time we see it.
        forwarded_proto = request.headers.get("x-forwarded-proto", "")
        is_https = forwarded_proto == "https" or request.url.scheme == "https"
        if is_https:
            response.headers.setdefault("Strict-Transport-Security", HSTS_VALUE)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")

        return response
