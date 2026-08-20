#!/usr/bin/env python3
"""gen_api_docs.py — write docs/API.md from the app's own route table.

SB-0066: docs/API.md was hand-maintained. It listed 51 endpoints against a
144-endpoint API, and 7 of the 51 did not exist — POST /booking-events when the
real route is POST /bookings/{id}/events, POST /push-tokens when the real one is
POST /push-tokens/register, and so on. CLAUDE.md points sessions at this file as
the endpoint reference, so anyone implementing from it wrote calls that 404 and
the 404 looked like a backend bug.

100 routes were undocumented, including entire feature areas: all 8
/moderation/* routes (the App Store Guideline 1.2 compliance surface), all 6
/disputes/*, the payout routes, /google-reviews/*, proof-of-work, /me/export
and every /auth/social/* route. Any review that used this file as the route
inventory — auth coverage, rate-limit coverage, moderation audit — silently
skipped two thirds of the API.

A hand-kept list of a surface that changes every week cannot stay true, so this
stops being handwritten. Run it after adding or renaming a route:

    python3 tools/gen_api_docs.py

Verify it is current (what CI would run):

    python3 tools/gen_api_docs.py --check     # non-zero if docs/API.md is stale
"""

from __future__ import annotations

import argparse
import os
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
BACKEND = REPO / "backend"
OUT = REPO / "docs" / "API.md"

# Importing the app must not require a real environment or touch a real
# database — these are placeholders, and the app is never served here.
_DUMMY = {
    "SECRET_KEY": "dummy",
    "SUPABASE_URL": "http://127.0.0.1:9",
    "SUPABASE_KEY": "d",
    "SUPABASE_SERVICE_KEY": "d",
    "SUPABASE_SECRET_KEY": "d",
    "DATABASE_URL": "postgresql://u:p@127.0.0.1:9/db",
    "STRIPE_SECRET_KEY": "sk_test_d",
    "STRIPE_WEBHOOK_SECRET": "whsec_d",
}

HEADER = """# SwingBy Backend API

> **Generated — do not hand-edit.** Written by `python3 tools/gen_api_docs.py`
> from the running app's own route table. A hand-kept list drifted to 51 of 144
> endpoints, with 7 routes that did not exist (SB-0066).

Base URL: `http://127.0.0.1:8000` (physical device: `http://10.0.0.168:8000`,
Android emulator: `http://10.0.2.2:8000`).

Most routes require `Authorization: Bearer <token>`. The unauthenticated ones
are listed under **Public / unauthenticated** at the bottom — that list is
derived from the code, not from memory, because it had been wrong before
(SB-0067).

Swagger (`/docs`) is served in development only. It is disabled when
`ENV=production` because it published the complete route inventory to anyone
who asked; set `API_ENABLE_DOCS=1` to re-enable it deliberately.
"""


def load_app():
    for key, value in _DUMMY.items():
        os.environ.setdefault(key, value)
    sys.path.insert(0, str(BACKEND))
    from app.main import app  # noqa: E402  (needs the env + path above)

    return app


def collect(app):
    """(tag, method, path, summary) for every real operation."""
    spec = app.openapi()
    rows = []
    for path, operations in spec.get("paths", {}).items():
        for method, op in operations.items():
            if method.upper() in ("HEAD", "OPTIONS", "PARAMETERS"):
                continue
            tags = op.get("tags") or ["untagged"]
            rows.append(
                (
                    tags[0],
                    method.upper(),
                    path,
                    (op.get("summary") or "").strip(),
                )
            )
    return rows


def render(app) -> str:
    rows = collect(app)
    by_tag: dict[str, list] = {}
    for tag, method, path, summary in rows:
        by_tag.setdefault(tag, []).append((method, path, summary))

    order = ["GET", "POST", "PATCH", "PUT", "DELETE"]
    lines = [HEADER, f"\n**{len(rows)} endpoints across {len(by_tag)} groups.**\n"]

    for tag in sorted(by_tag):
        lines.append(f"\n## {tag}\n")
        lines.append("```")
        entries = sorted(
            by_tag[tag],
            key=lambda e: (e[1], order.index(e[0]) if e[0] in order else 99),
        )
        width = max(len(m) for m, _, _ in entries)
        for method, path, summary in entries:
            line = f"{method:<{width}}  {path}"
            if summary:
                line = f"{line:<58}  # {summary}"
            lines.append(line.rstrip())
        lines.append("```")

    lines.append("\n## Public / unauthenticated\n")
    lines.append(
        "Routes with no auth dependency, read from the code. Every entry here "
        "is deliberate; anything new appearing in this list is a finding.\n"
    )
    lines.append("```")
    for method, path in sorted(public_routes(app)):
        lines.append(f"{method:<6}  {path}")
    lines.append("```")
    return "\n".join(lines) + "\n"


# Every dependency that establishes a caller identity. Verified against
# `grep -rhoE "Depends\((require_[a-z_]+|get_current[a-z_]*)\)" app/api/*.py`
# rather than guessed — an incomplete list here reports authenticated routes as
# public, which is a false alarm that costs a reviewer real time.
# `get_current_user_allow_query_token` is the reason: it authenticates via a
# query-string token so iOS Safari can open a PDF inline, and leaving it out
# made GET /bookings/{id}/invoice.pdf look unauthenticated.
AUTH_DEPENDENCIES = {
    "get_current_user",
    "get_current_user_allow_query_token",
    "require_admin",
}


def _walk_routes(app):
    """Yield (prefix, route) for every real route.

    This FastAPI version defers `include_router`, so `app.routes` holds
    `_IncludedRouter` wrappers rather than the routes themselves — the actual
    APIRoutes live on `.original_router.routes` and the mount prefix on
    `.include_context.prefix`. Walking only `app.routes` finds six built-ins
    and misses the entire API, which is exactly the kind of silent
    under-count this file exists to stop.
    """
    for entry in app.routes:
        inner = getattr(entry, "original_router", None)
        if inner is not None:
            prefix = getattr(getattr(entry, "include_context", None), "prefix", "") or ""
            for route in inner.routes:
                yield prefix, route
        else:
            yield "", entry


def _auth_names(route) -> set:
    names = set()
    dependant = getattr(route, "dependant", None)
    stack = [dependant] if dependant else []
    while stack:
        node = stack.pop()
        call = getattr(node, "call", None)
        if call is not None:
            names.add(getattr(call, "__name__", ""))
        stack.extend(getattr(node, "dependencies", []) or [])
    return names


def public_routes(app):
    """Routes whose dependency tree contains no authentication dependency."""
    out = set()
    for prefix, route in _walk_routes(app):
        if not getattr(route, "methods", None) or getattr(route, "path", None) is None:
            continue
        if _auth_names(route) & AUTH_DEPENDENCIES:
            continue
        for method in route.methods:
            if method in ("HEAD", "OPTIONS"):
                continue
            out.add((method, f"{prefix}{route.path}"))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if docs/API.md is out of date instead of writing it",
    )
    args = parser.parse_args()

    body = render(load_app())
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != body:
            print(
                "docs/API.md is stale — run `python3 tools/gen_api_docs.py`",
                file=sys.stderr,
            )
            return 1
        print("docs/API.md is current")
        return 0

    OUT.write_text(body, encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
