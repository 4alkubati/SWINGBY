"""
approvals.py — who is allowed to release the client's money, and when.

THE RULE (Kira, 2026-07-31)
---------------------------
The client's approval releases the escrow. If the client goes quiet, it
auto-releases to the business **24 hours** after the business marked the work
done.

Before this module existed, `PATCH /bookings/{id}/complete` — an endpoint only a
business owner or employee can call — released the escrow itself. The client was
nowhere in the path, while the pay sheet promised them "released only when you
approve the work". This module is the single place that rule now lives, so the
business-side endpoint, the client-side endpoint and the overdue sweep cannot
drift apart about it.

WHY SETTLEMENT IS LAZY, NOT SCHEDULED
-------------------------------------
There is no scheduler in this deployment. `expiry_sweep.sweep_once` has existed
for weeks and is referenced by nothing but its own tests — no cron service in
render.yaml, no APScheduler, no worker. A 24-hour timer implemented the obvious
way would therefore never fire, and money would sit held forever. That is a
worse failure than the bug being fixed, because it is silent.

So settlement is **self-healing on read**: `settle_if_due` runs whenever a
booking is fetched, and `settle_due` sweeps in bulk for anything that wants to
drive it externally (`POST /admin/sweeps/approval-releases`). The guarantee is
"the moment either party looks at the booking, it is correct", which needs no
infrastructure to be true. The bulk endpoint is an optimisation for nobody
looking, not the mechanism.

Every function here is best-effort about *bookkeeping* and strict about *money*:
a failure to write a booking_event never blocks a release, and a failure to
release never leaves the booking claiming it was released.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.services import escrow
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# How long the client gets to approve before the money goes to the business.
# Kira's ruling, 2026-07-31: "if client goes ghost then it gets sent to the
# business the moment it hits next day, or 24 hours".
APPROVAL_WINDOW = timedelta(hours=24)

# Set on the booking while the work is done but the money is not yet released.
AWAITING = "held"
RELEASED = "fully_released"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _event(booking_id: str, actor_id: str | None, event_type: str, note: str) -> None:
    """Timeline row. Best-effort — bookkeeping must never block a payout."""
    try:
        supabase.table("booking_events").insert(
            {
                "booking_id": booking_id,
                "actor_id": actor_id,
                "event_type": event_type,
                "note": note[:200],
            }
        ).execute()
    except Exception:
        # Never blocks a payout — but never silent either. `payment_released`
        # is the row recording that escrow moved to the business, and it
        # violated the event_type CHECK (unnoticed) until 2026-08-15.
        logger.exception(
            "approval event write failed for %s (event_type=%s)",
            booking_id,
            event_type,
        )


def assert_releasable(booking_id: str) -> None:
    """Raise unless there is real money that could be released later.

    Mirrors the preamble of escrow.release_escrow_on_complete so the business
    can be refused at "mark done" time rather than 24 hours later at settlement,
    when nobody is watching. Telling a business "waiting for the client" about
    money that was never collected would replace one lie with another.

    Raises escrow.CaptureRequiredError / escrow.EscrowError; the caller maps
    those to a status code exactly as it did before.
    """
    payment = escrow.load_single_payment(booking_id)
    if not payment:
        raise escrow.EscrowError(f"No payments row for booking {booking_id}")

    status = payment.get("status")
    # Cash / e-transfer never touched the platform, and an already-released or
    # refunded booking has nothing pending. All are legitimate — there is simply
    # no escrow to gate on, so completion proceeds without opening a window.
    if status in ("paid_off_platform", "fully_released", "refunded"):
        return

    payment.setdefault("booking_id", booking_id)
    escrow.assert_capture_backed(payment, action="release escrow for")


def needs_approval_window(booking_id: str) -> bool:
    """True when there is held escrow that a client approval should gate.

    False for cash jobs and for anything already settled — those complete
    outright, because a 24-hour countdown over money that will never move is
    just a confusing badge on the business's screen.
    """
    try:
        payment = escrow.load_single_payment(booking_id)
    except Exception:
        logger.warning(
            "needs_approval_window lookup failed for %s", booking_id, exc_info=True
        )
        return False
    if not payment:
        return False
    return payment.get("status") not in (
        "paid_off_platform",
        "fully_released",
        "refunded",
    )


def start_approval_window(booking_id: str, actor_id: str | None) -> str | None:
    """The business says the work is done. Money does NOT move.

    Returns the ISO deadline, or None when there was no escrow to gate (a cash
    job, or an already-settled booking) — in that case the booking is simply
    completed, with no countdown and nothing pending.

    `status` becomes 'completed' because the JOB genuinely is done; it is
    `payment_status` that stays 'held', which is the field that was always meant
    to carry this distinction.
    """
    if not needs_approval_window(booking_id):
        supabase.table("bookings").update({"status": "completed"}).eq(
            "id", booking_id
        ).execute()
        _event(booking_id, actor_id, "completed", "Work marked done.")
        return None

    deadline = (_now() + APPROVAL_WINDOW).isoformat()
    supabase.table("bookings").update(
        {
            "status": "completed",
            "payment_status": AWAITING,
            "approval_deadline_at": deadline,
        }
    ).eq("id", booking_id).execute()

    _event(
        booking_id,
        actor_id,
        "completed",
        "Work marked done. Waiting for the client to approve; releases automatically after 24h.",
    )
    return deadline


def release(booking_id: str, *, actor_id: str | None, reason: str) -> dict:
    """Move the held escrow to the business and close the approval window.

    `reason` is 'client_approved' or 'auto_released'. Raises escrow.EscrowError
    (or CaptureRequiredError) if there is nothing to release — the caller decides
    the status code, exactly as before.
    """
    outcome = escrow.release_escrow_on_complete(booking_id)

    # Only after the ledger moved. Clearing the deadline is what takes this
    # booking out of the settle set, so it must not happen if the release threw.
    supabase.table("bookings").update(
        {
            "status": "completed",
            "payment_status": RELEASED,
            "approval_deadline_at": None,
        }
    ).eq("id", booking_id).execute()

    _event(
        booking_id,
        actor_id,
        "payment_released",
        (
            "Client approved the work — payment released."
            if reason == "client_approved"
            else "No response within 24h — payment released automatically."
        ),
    )
    logger.info("escrow released for %s (%s)", booking_id, reason)
    return outcome


def is_due(booking: dict, now: datetime | None = None) -> bool:
    """Is this booking past its approval deadline with money still held?"""
    deadline = booking.get("approval_deadline_at")
    if not deadline:
        return False
    if booking.get("payment_status") != AWAITING:
        return False
    now = now or _now()
    try:
        parsed = datetime.fromisoformat(str(deadline).replace("Z", "+00:00"))
    except ValueError:
        logger.warning(
            "unparseable approval_deadline_at on %s: %r", booking.get("id"), deadline
        )
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed <= now


def settle_if_due(booking: dict, now: datetime | None = None) -> bool:
    """Release this one booking if its window has closed. Returns True if it did.

    Called from booking reads. Best-effort by contract: a read must never 500
    because a settlement failed, so every error is swallowed and the booking is
    simply returned unsettled — the next read, or the bulk sweep, tries again.
    """
    if not is_due(booking, now):
        return False
    booking_id = booking.get("id")
    try:
        release(booking_id, actor_id=None, reason="auto_released")
        booking["payment_status"] = RELEASED
        booking["approval_deadline_at"] = None
        return True
    except escrow.EscrowError as exc:
        # Nothing to release (never captured). Clear the deadline so this does
        # not get retried on every single read forever — the money question is
        # settled, there just was not any.
        logger.info(
            "approval window closed with nothing to release on %s: %s", booking_id, exc
        )
        try:
            supabase.table("bookings").update({"approval_deadline_at": None}).eq(
                "id", booking_id
            ).execute()
            booking["approval_deadline_at"] = None
        except Exception:
            logger.warning("could not clear deadline on %s", booking_id, exc_info=True)
        return False
    except Exception:
        logger.exception("auto-release failed for %s", booking_id)
        return False


def settle_due(limit: int = 200, now: datetime | None = None) -> dict:
    """Bulk-settle every booking whose approval window has closed.

    Backs the cron-able admin endpoint. Returns a summary rather than raising —
    one poisoned booking must not stop the rest from settling.
    """
    now = now or _now()
    try:
        res = (
            supabase.table("bookings")
            .select("id, status, payment_status, approval_deadline_at")
            .eq("payment_status", AWAITING)
            .not_.is_("approval_deadline_at", "null")
            .lte("approval_deadline_at", now.isoformat())
            .limit(limit)
            .execute()
        )
    except Exception:
        logger.exception("settle_due lookup failed")
        return {"checked": 0, "released": 0, "skipped": 0}

    rows = res.data or []
    released = 0
    for row in rows:
        if settle_if_due(row, now):
            released += 1
    return {"checked": len(rows), "released": released, "skipped": len(rows) - released}
