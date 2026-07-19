"""
money_ledger.py (API) — CARD-21. Admin-only view of the internal money
ledger: EXPECTED amounts (price, 10% cut, penalty) side by side with the
ACTUAL Stripe objects that moved money for each booking.

This is the reconciliation surface Kira uses to verify the numbers the app
displays are the numbers Stripe actually moved — a mismatch must be visible,
never silently reconciled (see app/services/money_ledger.py's `_mismatch`).

Endpoints
---------
GET /admin/ledger
    List every ledger row (admin only), newest first. Optional
    `?mismatch_only=true` to surface only flagged rows.

GET /admin/ledger/{booking_id}
    Single ledger row for a booking. If `?reconcile=true` and Stripe is
    configured, re-fetches the live PaymentIntent from Stripe and compares
    its `amount_received` to `expected_total` fresh (not just the value
    stored at capture time) — the strongest form of "matches the Stripe
    dashboard to the cent" check available without a browser into the
    dashboard itself.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.admin import require_admin
from app.limiter import limiter
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@limiter.limit("30/minute")
def list_ledger(
    request: Request,
    mismatch_only: bool = False,
    current_user: dict = Depends(require_admin),
):
    try:
        q = supabase.table("payment_ledger").select("*").order("created_at", desc=True)
        if mismatch_only:
            q = q.eq("mismatch", True)
        res = q.execute()
        return {"items": res.data or []}
    except Exception:
        logger.exception("Could not list payment_ledger")
        raise HTTPException(status_code=400, detail="Could not list money ledger")


@router.get("/{booking_id}")
@limiter.limit("30/minute")
def get_ledger_row(
    request: Request,
    booking_id: str,
    reconcile: bool = False,
    current_user: dict = Depends(require_admin),
):
    try:
        res = (
            supabase.table("payment_ledger")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="No ledger row for this booking")

    row = res.data
    if not row:
        raise HTTPException(status_code=404, detail="No ledger row for this booking")

    if not reconcile:
        return {"ledger": row, "live_reconcile": None}

    payment_intent_id = row.get("stripe_payment_intent_id")
    if not payment_intent_id:
        return {
            "ledger": row,
            "live_reconcile": {
                "checked": False,
                "reason": "No stripe_payment_intent_id on this ledger row yet "
                "(Checkout hasn't completed for this booking).",
            },
        }

    from app.services import stripe_service

    live = stripe_service.retrieve_payment_intent(payment_intent_id)
    if live is None:
        return {
            "ledger": row,
            "live_reconcile": {
                "checked": False,
                "reason": "Stripe not configured or the live lookup failed — "
                "see server logs. Set STRIPE_SECRET_KEY to enable live reconcile.",
            },
        }

    actual_received = (
        round(live["amount_received"] / 100, 2) if live.get("amount_received") is not None else None
    )
    expected_total = float(row["expected_total"])
    live_mismatch = actual_received is not None and round(abs(actual_received - expected_total), 2) > 0.01

    return {
        "ledger": row,
        "live_reconcile": {
            "checked": True,
            "stripe_payment_intent_status": live["status"],
            "stripe_amount_received": actual_received,
            "expected_total": expected_total,
            "mismatch": live_mismatch,
        },
    }
