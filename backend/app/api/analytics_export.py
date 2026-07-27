"""
analytics_export.py — CSV/JSON export of a business's own revenue ledger.

GET /analytics/export?format=csv|json&from=&to=
    Auth: business_owner only. There is deliberately NO business_id query
    param — the business is always resolved from
    ``businesses.owner_id == current_user["id"]``, so there is no id a
    caller could substitute to reach another business's rows. This is the
    same "resolve by owner, never by client-supplied id" shape as
    GET /businesses/me and GET /businesses/me/analytics.

Money is read verbatim off ``payments`` — the authoritative integer-cents
columns ``escrow.py`` and ``invoices.py`` already use — never recomputed.
Per migration ``20260727000000_charge_at_post.sql`` the ledger invariant is
now DB-enforced:

    escrow_held + released_to_business + platform_cut + refunded == total_charged

so ``refunded_cents`` is exported on every row and folded out of the
headline revenue figure, which mirrors ``GET /businesses/me/analytics``
exactly: ``total_revenue`` = sum of ``released_to_business`` across rows that
are BOTH ``status == 'fully_released'`` AND capture-backed
(``escrow.is_capture_backed``) — the same split that screen calls
``total_earnings`` / ``unverified_earnings`` (FINDING C, money audit
2026-07-23). An export that used ``total_charged`` as "revenue" would
overstate it by the refunded and still-escrowed portions; an export that
ignored ``refunded_cents`` entirely would overstate it further whenever a
charge-at-post budget got partially refunded down to the accepted quote.

CSV safety:
  - Built with the stdlib ``csv`` module (excel dialect), which already
    quotes any field containing a comma, quote, or newline.
  - CSV-injection guard: a leading ``=``, ``+``, ``-``, or ``@`` in a
    free-text field (client name, service category — both ultimately
    user-supplied) is prefixed with a single quote so Excel/Sheets renders it
    as text instead of executing it as a formula. Money and status columns
    are never prefixed — they are never attacker-controlled and a legitimate
    negative-looking value must not be mangled.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.deps import get_current_user
from app.limiter import limiter
from app.services import escrow
from app.supabase_client import supabase

logger = structlog.get_logger(__name__)

router = APIRouter()

# CSV-injection guard (Excel/Sheets/Numbers treat a leading one of these as
# the start of a formula).
_INJECTION_PREFIXES = ("=", "+", "-", "@")

# Default window when the caller supplies neither `from` nor `to` — a business
# revenue export with literally no bound would be a full-table scan on an old
# account. Trailing 12 months is the "sensible window" the task calls for;
# an explicit ?from=&to= always overrides it.
_DEFAULT_WINDOW_DAYS = 365

CSV_HEADERS = [
    "booking_id",
    "date",
    "client_name",
    "category",
    "status",
    "total_charged",
    "refunded",
    "platform_cut",
    "released_to_business",
    "escrow_held",
    "verified",
]


def _csv_safe(value: str) -> str:
    """Neutralise CSV/formula injection in a free-text field.

    A value starting with =, +, -, or @ is interpreted by Excel/Sheets as a
    formula, not text — prefixing with a single quote forces text rendering
    without changing what a human reads.
    """
    s = "" if value is None else str(value)
    if s and s[0] in _INJECTION_PREFIXES:
        return "'" + s
    return s


def _parse_date(label: str, raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid '{label}' date: {raw!r} (expected ISO 8601)",
        )
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_window(
    from_raw: Optional[str], to_raw: Optional[str]
) -> tuple[datetime, datetime]:
    to_dt = _parse_date("to", to_raw) or datetime.now(timezone.utc)
    from_dt = _parse_date("from", from_raw) or (
        to_dt - timedelta(days=_DEFAULT_WINDOW_DAYS)
    )
    if from_dt > to_dt:
        raise HTTPException(
            status_code=400,
            detail=f"'from' ({from_dt.isoformat()}) is after 'to' ({to_dt.isoformat()})",
        )
    return from_dt, to_dt


def _resolve_caller_business_id(current_user: dict) -> str:
    """The caller's OWN business id — never accepts one from the request.

    This is the entire ownership guard: every downstream query is scoped to
    this id, and this id can only ever be the row where
    ``businesses.owner_id == current_user["id"]``.
    """
    if current_user.get("role") != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can export analytics"
        )
    biz_res = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not biz_res.data:
        raise HTTPException(
            status_code=404, detail="No business found for this account"
        )
    return biz_res.data["id"]


def _load_rows(biz_id: str, date_from: datetime, date_to: datetime) -> list[dict]:
    """Every payments row for this business's bookings, filtered to the window.

    Returns dicts carrying BOTH the display (rounded dollar) figures and the
    raw *_cents figures — the cents are what the summary sums (avoids float
    drift), the dollars are what CSV/JSON rows show.
    """
    bookings_res = (
        supabase.table("bookings")
        .select("id, created_at, service_category, client_id")
        .eq("business_id", biz_id)
        .execute()
    )
    bookings = bookings_res.data or []
    booking_by_id = {b["id"]: b for b in bookings if b.get("id")}
    booking_ids = list(booking_by_id.keys())
    if not booking_ids:
        return []

    payments_res = (
        supabase.table("payments")
        .select(
            "booking_id, created_at, status, method, stripe_payment_intent_id, "
            "total_charged, total_charged_cents, "
            "released_to_business, released_to_business_cents, "
            "platform_cut, platform_cut_cents, "
            "escrow_held, escrow_held_cents, "
            "refunded, refunded_cents"
        )
        .in_("booking_id", booking_ids)
        .execute()
    )
    payments = payments_res.data or []

    client_ids = list({b.get("client_id") for b in bookings if b.get("client_id")})
    client_names: dict = {}
    if client_ids:
        try:
            users_res = (
                supabase.table("users")
                .select("id, first_name, last_name")
                .in_("id", client_ids)
                .execute()
            )
            for u in users_res.data or []:
                name = " ".join(
                    x for x in [u.get("first_name"), u.get("last_name")] if x
                ).strip()
                client_names[u["id"]] = name or "Client"
        except Exception:
            logger.warning("analytics_export_client_name_lookup_failed", exc_info=True)

    rows: list[dict] = []
    for p in payments:
        booking_id = p.get("booking_id")
        booking = booking_by_id.get(booking_id, {})
        created_raw = p.get("created_at") or booking.get("created_at")
        created_dt = None
        if created_raw:
            try:
                created_dt = datetime.fromisoformat(
                    str(created_raw).replace("Z", "+00:00")
                )
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                created_dt = None

        if created_dt is not None and (created_dt < date_from or created_dt > date_to):
            continue

        total_c = escrow.money_cents(p, "total_charged")
        refunded_c = escrow.money_cents(p, "refunded")
        cut_c = escrow.money_cents(p, "platform_cut")
        released_c = escrow.money_cents(p, "released_to_business")
        held_c = escrow.money_cents(p, "escrow_held")
        verified = escrow.is_capture_backed(p)

        rows.append(
            {
                "booking_id": booking_id,
                "date": created_raw,
                "client_name": client_names.get(booking.get("client_id"), ""),
                "category": booking.get("service_category") or "",
                "status": p.get("status") or "",
                "total_charged": round(total_c / 100, 2),
                "refunded": round(refunded_c / 100, 2),
                "platform_cut": round(cut_c / 100, 2),
                "released_to_business": round(released_c / 100, 2),
                "escrow_held": round(held_c / 100, 2),
                "verified": verified,
                # cents kept for the summary, stripped before serialisation
                "_released_c": released_c,
                "_total_c": total_c,
                "_refunded_c": refunded_c,
                "_cut_c": cut_c,
                "_held_c": held_c,
            }
        )

    rows.sort(key=lambda r: r["date"] or "")
    return rows


def _summarize(rows: list[dict]) -> dict:
    total_charged_c = sum(r["_total_c"] for r in rows)
    total_refunded_c = sum(r["_refunded_c"] for r in rows)
    total_cut_c = sum(r["_cut_c"] for r in rows)
    total_held_c = sum(r["_held_c"] for r in rows)
    # Same split as GET /businesses/me/analytics: only capture-backed,
    # fully-released rows count as real revenue (FINDING C).
    total_revenue_c = sum(
        r["_released_c"]
        for r in rows
        if r["status"] == "fully_released" and r["verified"]
    )
    unverified_revenue_c = sum(
        r["_released_c"]
        for r in rows
        if r["status"] == "fully_released" and not r["verified"]
    )
    return {
        "row_count": len(rows),
        "total_charged": round(total_charged_c / 100, 2),
        "total_refunded": round(total_refunded_c / 100, 2),
        "total_platform_cut": round(total_cut_c / 100, 2),
        "total_escrow_held": round(total_held_c / 100, 2),
        "total_revenue": round(total_revenue_c / 100, 2),
        "unverified_revenue": round(unverified_revenue_c / 100, 2),
    }


def _public_row(row: dict) -> dict:
    return {k: v for k, v in row.items() if not k.startswith("_")}


def _csv_response(
    rows: list[dict], date_from: datetime, date_to: datetime
) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_HEADERS)
    for r in rows:
        pub = _public_row(row=r)
        writer.writerow(
            [
                pub["booking_id"],
                pub["date"],
                _csv_safe(pub["client_name"]),
                _csv_safe(pub["category"]),
                pub["status"],
                f'{pub["total_charged"]:.2f}',
                f'{pub["refunded"]:.2f}',
                f'{pub["platform_cut"]:.2f}',
                f'{pub["released_to_business"]:.2f}',
                f'{pub["escrow_held"]:.2f}',
                "true" if pub["verified"] else "false",
            ]
        )
    filename = f"swingby-analytics-{date_from.date().isoformat()}_{date_to.date().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export")
@limiter.limit("10/minute")
def export_analytics(
    request: Request,
    format: str = Query("csv", pattern="^(csv|json)$"),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Export this business's own revenue ledger as CSV or JSON."""
    biz_id = _resolve_caller_business_id(current_user)
    date_from, date_to = _resolve_window(from_, to)

    try:
        rows = _load_rows(biz_id, date_from, date_to)
    except HTTPException:
        raise
    except Exception:
        logger.exception("analytics_export_error", biz_id=biz_id)
        raise HTTPException(status_code=500, detail="Export unavailable")

    if format == "csv":
        return _csv_response(rows, date_from, date_to)

    public_rows = [_public_row(r) for r in rows]
    return JSONResponse(
        content={
            "range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
            "items": public_rows,
            "summary": _summarize(rows),
        }
    )
