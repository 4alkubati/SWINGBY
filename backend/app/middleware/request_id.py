"""
request_id.py — Starlette middleware that assigns a unique request ID to every
incoming HTTP request.

Behaviour
---------
1. Reads the X-Request-ID header from the client.  If absent, generates a
   fresh uuid4.
2. Binds the value to the structlog contextvars store so every log line emitted
   during the request automatically includes {"request_id": "..."}.
3. Echoes the value back to the caller via the X-Request-ID response header.
4. Clears the structlog contextvars in the finally block so the context does not
   bleed into the next request on the same worker thread.
"""

import uuid

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        # Bind so all log lines in this request carry the request_id field
        clear_contextvars()
        bind_contextvars(request_id=request_id)

        try:
            response: Response = await call_next(request)
        finally:
            clear_contextvars()

        response.headers["X-Request-ID"] = request_id
        return response
