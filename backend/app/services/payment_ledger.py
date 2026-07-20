"""
payment_ledger.py — DB-writing helpers for payment ledger transitions
(PAYMENT-MODEL.md §3).

Centralizes the three ledger-mutating writes (capture, first release, second
release) in one place so the CARD-20 auto-confirm path (interests.py) and the
manual handshake / completion path (bookings.py) can't drift into two
different arithmetics for the same transition — which is exactly how the old
code ended up with a ledger that summed to 110% of the charge for the life of
every booking.

Every transition here RE-DERIVES from `total_charged` via
`money.derive_ledger` rather than trusting the previous row's
escrow_held/released_to_business — so a transition is always correct
regardless of what state the row was actually left in, instead of computing
the next number by subtracting from possibly-already-wrong figures.

Each function takes the caller's `supabase` client explicitly (rather than
importing its own module-level reference) so callers in app/api/*.py — which
mock their own `supabase` name via `patch("app.api.X.supabase")` — get a
ledger write that actually goes through the same mock/client, instead of a
second, unpatched import binding silently hitting the network.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.services import money
from app.services import payment_status

logger = logging.getLogger(__name__)

_ZERO = Decimal("0.00")


def capture_payment_row(
    supabase_client: Any,
    *,
    booking_id: str,
    ledger: money.LedgerSplit,
    stripe_payment_intent_id: str,
    method: str = "stripe_card",
) -> dict:
    """Insert the payments row for a just-charged booking.

    State: 'Charge captured' — escrow_held=business_net, released=0,
    platform_cut=cut, status=HELD.
    """
    row = {
        "booking_id": booking_id,
        "total_charged": money.to_db_string(ledger.total_charged),
        "escrow_held": money.to_db_string(ledger.business_net),
        "released_to_business": money.to_db_string(_ZERO),
        "platform_cut": money.to_db_string(ledger.platform_cut),
        "currency": money.CURRENCY,
        "status": payment_status.HELD,
        "method": method,
        "notes": f"stripe_payment_intent={stripe_payment_intent_id}",
    }
    res = supabase_client.table("payments").insert(row).execute()
    return res.data[0]


def release_first_tranche(supabase_client: Any, payment_row: dict) -> dict:
    """'Date confirmed' transition.

    escrow_held = business_net - first_release, released_to_business =
    first_release, status=PARTIAL_RELEASED. Re-derives from total_charged —
    never trusts the row's own prior escrow_held/released_to_business.
    """
    ledger = money.derive_ledger(payment_row["total_charged"])
    update = {
        "escrow_held": money.to_db_string(ledger.business_net - ledger.first_release),
        "released_to_business": money.to_db_string(ledger.first_release),
        "platform_cut": money.to_db_string(ledger.platform_cut),
        "status": payment_status.PARTIAL_RELEASED,
    }
    res = (
        supabase_client.table("payments")
        .update(update)
        .eq("id", payment_row["id"])
        .execute()
    )
    data = res.data[0] if getattr(res, "data", None) else {**payment_row, **update}
    return data


def release_second_tranche(supabase_client: Any, payment_row: dict) -> dict:
    """'Job completed' transition.

    escrow_held = 0, released_to_business = business_net (the exact
    remainder — never a second rounding), status=FULLY_RELEASED.
    """
    ledger = money.derive_ledger(payment_row["total_charged"])
    update = {
        "escrow_held": money.to_db_string(_ZERO),
        "released_to_business": money.to_db_string(ledger.business_net),
        "platform_cut": money.to_db_string(ledger.platform_cut),
        "status": payment_status.FULLY_RELEASED,
        "released_at": datetime.now(timezone.utc).isoformat(),
    }
    res = (
        supabase_client.table("payments")
        .update(update)
        .eq("id", payment_row["id"])
        .execute()
    )
    data = res.data[0] if getattr(res, "data", None) else {**payment_row, **update}
    return data
