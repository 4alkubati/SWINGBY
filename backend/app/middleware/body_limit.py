"""
body_limit.py — a global ceiling on request-body size (checklist #11).

THE FINDING
-----------
`api/uploads.py` capped its own payloads at 10 MB (images) and 8 MB (audio),
and every other POST on the API had no limit whatsoever. Worse, the upload caps
are applied AFTER `await file.read()` — by the time the check runs the whole
body is already resident in this process's memory, so the "cap" bounded what we
would STORE, not what we would ACCEPT. An unauthenticated client posting a
multi-gigabyte body to any route was a memory-exhaustion DoS with no
credentials and no exploit.

WHY THIS IS ASGI MIDDLEWARE AND NOT BaseHTTPMiddleware
------------------------------------------------------
Starlette's `BaseHTTPMiddleware` hands you a `Request` whose body you can only
inspect by reading it — which is the very thing we are trying not to do. At the
raw ASGI layer we can intercept `http.request` messages one chunk at a time and
abort the moment the running total crosses the line, so an oversized body is
refused mid-flight instead of after it has all arrived.

TWO CHECKS, AND BOTH ARE NEEDED
-------------------------------
1. `Content-Length`, when present — refuses before a single byte of body is
   read. This is the cheap path and covers well-behaved clients.
2. The running total across streamed chunks — covers `Transfer-Encoding:
   chunked`, where there is no Content-Length to check and a client can simply
   keep sending. A header-only check would be trivially bypassed by omitting
   the header, which is exactly the kind of "control that exists but is
   bypassable" this pass is meant to eliminate.

Anything non-HTTP (lifespan, websocket) passes straight through untouched.
"""

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = structlog.get_logger(__name__)


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def _reject(self, send: Send) -> None:
        """Answer 413 without invoking the app.

        Hand-rolled rather than returned through Starlette's response machinery
        because at this layer there is no `Request` to build a response around —
        we are between the server and the application.
        """
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"connection", b"close"),
                ],
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": b'{"detail":"Request body too large"}',
            }
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # ── Check 1: the declared length, before reading anything ──────────
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    declared = int(value)
                except (TypeError, ValueError):
                    # An unparseable Content-Length is a malformed request; let
                    # the server layer deal with it rather than guessing.
                    break
                if declared > self.max_bytes:
                    logger.warning(
                        "request.body_too_large",
                        path=scope.get("path"),
                        declared=declared,
                        limit=self.max_bytes,
                    )
                    await self._reject(send)
                    return
                break

        # ── Check 2: the actual bytes, as they stream in ───────────────────
        received = 0
        exceeded = False

        async def limited_receive() -> Message:
            nonlocal received, exceeded
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    exceeded = True
                    logger.warning(
                        "request.body_too_large_streamed",
                        path=scope.get("path"),
                        received=received,
                        limit=self.max_bytes,
                    )
                    # Tell the application the body ended here. It will see a
                    # short/invalid body and error, but we answer 413 below
                    # regardless — this only stops us from buffering more.
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        # `send` is wrapped so that once the limit is blown we suppress whatever
        # the app was going to say and answer 413 instead. Without this the
        # client would get the app's confused 422 about a truncated body rather
        # than the truth, which is that we hung up on them for being too big.
        response_started = False

        async def guarded_send(message: Message) -> None:
            nonlocal response_started
            if exceeded and not response_started:
                response_started = True
                await self._reject(send)
                return
            if exceeded:
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        await self.app(scope, limited_receive, guarded_send)
