"""
payments_stripe.py — Stripe sandbox payment endpoints.

Endpoints
---------
POST /payments/stripe/payment-intent/{booking_id}
    Auth: the client who owns the booking.
    Returns the client_secret / ephemeral key / customer id that Stripe's
    NATIVE Payment Sheet needs, so the client pays INSIDE the app.
    This is the default path (M9, walkthrough audit 2026-07-24).

POST /payments/stripe/checkout/{booking_id}
    Auth: the client who owns the booking.
    Creates a Stripe Checkout Session for the booking's total_amount and
    returns its URL. Mobile opens this with Linking.openURL. FALLBACK ONLY —
    used when the native sheet is unavailable (no publishable key, native
    module missing, Expo Go, older build).

POST /payments/stripe/webhook
    No auth header — Stripe signs the body. We verify with STRIPE_WEBHOOK_SECRET.
    Handles `checkout.session.completed` AND `payment_intent.succeeded`: both
    mark the booking's payment row as captured, through the SAME
    `_mark_payment_paid` function. Other event types ack.

MONEY SEMANTICS
---------------
The native sheet changes WHERE the client types their card, not what the ledger
does. Both entry points resolve the charge amount through the one
`_resolve_charge_amount` helper (booking total, minus any credit redemption) and
neither writes to `payments`. The ledger only ever moves in
`_mark_payment_paid`, off a signature-verified webhook, with the same
amount-verification, replay-dedupe and FINDING D remainder math it has always
had. There is exactly one place money is accounted for, and this file did not
add a second one.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import stripe_service

logger = logging.getLogger(__name__)

router = APIRouter()


class CheckoutResponse(BaseModel):
    session_id: str
    url: str


class PaymentSheetResponse(BaseModel):
    """Everything Stripe's native Payment Sheet needs to open in-app."""

    payment_intent_id: str
    client_secret: str
    ephemeral_key: str
    customer_id: str
    publishable_key: str
    amount_cents: int
    currency: str
    merchant_display_name: str
    # Apple Pay's merchant id, or None while it is unset. It MUST be declared
    # here: response_model drops any field the model does not name, so a value
    # the service returns but the schema omits never reaches the device — the
    # wallet would look wired and be dead.
    apple_merchant_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Shared charge resolution — ONE source of truth for both payment entry points
# ---------------------------------------------------------------------------


def _load_payable_booking(booking_id: str, current_user: dict) -> dict:
    """Load a booking and assert this caller may pay it.

    Raises 404 (missing), 403 (not the booking's client), 400 (cancelled).
    Identical for the native sheet and hosted Checkout — a client who cannot
    start a Checkout Session must not be able to start a PaymentIntent either.
    """
    booking_res = (
        supabase.table("bookings")
        .select("id, client_id, total_amount, service_category, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the booking's client can pay")

    if booking["status"] in ("cancelled",):
        raise HTTPException(status_code=400, detail="Booking is cancelled")

    return booking


def _assert_not_already_paid(booking_id: str) -> None:
    """Refuse to start a SECOND charge against an already-captured booking.

    Before this guard, every "pay" surface would happily mint another Checkout
    Session / PaymentIntent for a booking that was already captured — a real
    double-charge path that only luck (the client not tapping twice) kept shut.
    It also became load-bearing the moment two mechanisms existed: the mobile
    PaySheet pays natively and legacy callers may still hit /checkout right
    after, and this is what makes that second call a refusal rather than a
    second charge.

    Mirrors payment_triggers.trigger_on_accept's `already_paid` reason and uses
    the same `escrow.is_capture_backed` definition of "really paid", so the
    three places that ask the question cannot drift apart.

    The lookup goes through THIS module's `supabase` handle (not escrow's) so it
    is patchable in the endpoint tests alongside the booking lookup.
    """
    from app.services import escrow

    try:
        res = (
            supabase.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .single()
            .execute()
        )
        payment = res.data
    except Exception:
        # No payments row, or the lookup failed. Not proof of payment — let the
        # charge proceed; the escrow capture guard is the backstop on release.
        return

    if payment and escrow.is_capture_backed(payment):
        raise HTTPException(
            status_code=409,
            detail="already_paid: this booking has already been paid.",
        )


def _resolve_charge_amount(booking: dict, booking_id: str, current_user: dict) -> float:
    """The authoritative amount to charge, in dollars.

    Booking total, minus any customer credit redeemed against this booking.
    Extracted verbatim from the original create_checkout body so the native
    sheet and hosted Checkout can never charge different numbers for the same
    booking — that divergence is exactly how a "which total is real?" money bug
    starts.

    `redeem_credit_for_booking` is idempotent (one redemption debit per booking,
    enforced by a partial UNIQUE index), so it is safe for both entry points to
    call it — a client who opens the native sheet, backs out, and falls back to
    hosted Checkout redeems once, not twice.
    """
    amount = float(booking.get("total_amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Booking total_amount must be > 0")

    # Customer-credit redemption — reduce what the client pays by any available
    # credit. GATED: this rides the same not-yet-live-Stripe-verified capture
    # path as the rest of PR #30, so it only runs when
    # CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED is flipped on. When on, the net
    # (reduced) amount is charged AND _mark_payment_paid's amount check subtracts
    # the recorded redemption so capture verification stays consistent.
    from app.services import escrow, credits

    if credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED:
        gross_cents = escrow.to_cents(amount)
        redemption = credits.redeem_credit_for_booking(
            user_id=current_user["id"],
            booking_id=booking_id,
            gross_amount_cents=gross_cents,
        )
        amount = escrow.to_dollars(redemption["net_amount_cents"])
        if amount <= 0:
            # Credit fully covers the booking — nothing left to charge via
            # Stripe. (Not yet reachable while the flag is OFF.)
            raise HTTPException(
                status_code=400,
                detail="Credit covers the full amount; no Stripe charge needed",
            )

    return amount


def _charge_description(booking: dict, booking_id: str) -> str:
    return f"SwingBy — {booking.get('service_category') or 'booking'} #{booking_id[:8]}"


# ---------------------------------------------------------------------------
# Native Payment Sheet — the default path (M9)
# ---------------------------------------------------------------------------


@router.post("/payment-intent/{booking_id}", response_model=PaymentSheetResponse)
def create_payment_intent(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Start an IN-APP payment for a booking.

    M9: hosted Checkout throws the client into a browser. This returns the
    PaymentIntent client_secret plus the customer + ephemeral key that let
    Stripe's native Payment Sheet render inside SwingBy, branded as SwingBy.

    Same auth, same booking preconditions and the same amount as
    /checkout/{booking_id} — the only difference is where the card is typed.
    Capture is immediate (Stripe's default), matching the hosted path, which is
    what charge-before-service requires. The `payments` ledger is untouched here
    and moves only when the `payment_intent.succeeded` webhook arrives.
    """
    from app.services import escrow, stripe_payment_sheet

    booking = _load_payable_booking(booking_id, current_user)
    _assert_not_already_paid(booking_id)
    amount = _resolve_charge_amount(booking, booking_id, current_user)

    if not stripe_payment_sheet.publishable_key():
        # Without a publishable key the device cannot confirm the intent, so
        # creating one would strand a real PaymentIntent in Stripe. Refuse
        # clearly; the mobile client reads this as "native unavailable" and
        # falls back to hosted Checkout.
        # The `native_sheet_unavailable:` prefix is a MACHINE token. The mobile
        # axios interceptor throws away the status code and keeps only the
        # detail string, so this prefix is the only thing the client can match
        # on to decide "fall back to hosted Checkout" rather than "show the
        # client an error". Do not reword it without updating
        # mobile/src/services/nativePay.js.
        raise HTTPException(
            status_code=503,
            detail=(
                "native_sheet_unavailable: STRIPE_PUBLISHABLE_KEY is not set, so "
                "the in-app payment sheet cannot run on this environment."
            ),
        )

    first = current_user.get("first_name") or ""
    last = current_user.get("last_name") or ""
    sheet = stripe_payment_sheet.create_payment_sheet(
        booking_id=booking_id,
        amount_cents=escrow.to_cents(amount),
        description=_charge_description(booking, booking_id),
        user_id=current_user["id"],
        email=current_user.get("email"),
        name=(f"{first} {last}".strip() or None),
    )
    return PaymentSheetResponse(**sheet)


class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str


class ConfirmPaymentResponse(BaseModel):
    status: str
    settled: bool


@router.post(
    "/payment-intent/{booking_id}/confirm", response_model=ConfirmPaymentResponse
)
def confirm_payment_intent(
    booking_id: str,
    body: ConfirmPaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Settle the ledger immediately after the native sheet reports success.

    WHY THIS EXISTS: the webhook is authoritative but not instant. Between the
    Payment Sheet closing and `payment_intent.succeeded` arriving, the payments
    row still reads `pending_payment` with no PaymentIntent — which is
    indistinguishable from "never paid". In that window `_assert_not_already_paid`
    would wave through a SECOND charge for a booking that was just paid. This
    endpoint closes the window deterministically instead of hoping the webhook
    wins the race.

    It is NOT a second ledger path. It re-reads the intent from Stripe and hands
    the verified figures to the very same `_mark_payment_paid` the webhook calls
    — same amount check, same replay guard, same FINDING D remainder math. Both
    running is harmless: whichever lands second is a no-op.

    The device is not trusted. The intent's own `metadata.booking_id` must match
    the booking in the URL, so a client cannot settle one booking by pointing at
    another booking's successful intent.
    """
    from app.services import stripe_payment_sheet

    _load_payable_booking(booking_id, current_user)

    intent = stripe_payment_sheet.retrieve_payment_intent(body.payment_intent_id)

    if intent.get("booking_id") != str(booking_id):
        logger.error(
            "confirm_payment_intent: intent %s claims booking %r but was posted "
            "to booking %r — refusing to settle.",
            body.payment_intent_id,
            intent.get("booking_id"),
            booking_id,
        )
        raise HTTPException(
            status_code=400, detail="That payment does not belong to this booking."
        )

    if intent.get("status") != "succeeded":
        # Not an error the client can fix by retrying this call; the sheet will
        # have shown the real reason. Report honestly and settle nothing.
        return ConfirmPaymentResponse(
            status=intent.get("status") or "unknown", settled=False
        )

    _mark_payment_paid(
        booking_id,
        None,
        intent.get("amount_received"),
        intent.get("id"),
    )
    # The intent carried setup_future_usage='off_session', so Stripe has kept
    # this card on the customer. Record WHICH card, so a later off-session
    # charge can name it instead of guessing among the customer's methods.
    stripe_payment_sheet.remember_payment_method(
        user_id=current_user["id"],
        payment_method_id=intent.get("payment_method"),
    )
    return ConfirmPaymentResponse(status="succeeded", settled=True)


@router.post("/checkout/{booking_id}", response_model=CheckoutResponse)
def create_checkout(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Hosted Stripe Checkout — FALLBACK ONLY.

    Kept for clients that cannot present the native sheet (no publishable key,
    Expo Go, a build predating @stripe/stripe-react-native). Mobile only reaches
    this after `POST /payment-intent/{booking_id}` has failed.
    """
    booking = _load_payable_booking(booking_id, current_user)
    _assert_not_already_paid(booking_id)
    amount = _resolve_charge_amount(booking, booking_id, current_user)

    email: Optional[str] = current_user.get("email")

    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        amount_cad=amount,
        description=_charge_description(booking, booking_id),
        client_email=email,
    )
    return CheckoutResponse(session_id=session["id"], url=session["url"])


def _dispatch_webhook_event(etype, data_object) -> None:
    """Apply the side effects for one verified, freshly-claimed Stripe event.

    Extracted from the webhook body so the caller can wrap it: the event id is
    claimed BEFORE this runs (that is what makes replay handling atomic), which
    means a failure in here would otherwise leave a claim behind for an event
    that was never actually applied, and Stripe's retry would be swallowed as a
    duplicate. The caller releases the claim if this raises.
    """
    if etype == "checkout.session.completed" and data_object is not None:
        metadata = {}
        try:
            metadata = data_object["metadata"] or {}
        except (KeyError, TypeError):
            metadata = getattr(data_object, "metadata", {}) or {}
        booking_id = metadata.get("booking_id") if hasattr(metadata, "get") else None
        business_id = metadata.get("business_id") if hasattr(metadata, "get") else None
        session_id = None
        try:
            session_id = data_object["id"]
        except (KeyError, TypeError):
            session_id = getattr(data_object, "id", None)
        # Amount actually paid (cents) and the PaymentIntent id, for amount
        # verification and refund traceability.
        amount_total = _obj_get(data_object, "amount_total")
        payment_intent = _obj_get(data_object, "payment_intent")
        if booking_id:
            _mark_payment_paid(booking_id, session_id, amount_total, payment_intent)
        elif business_id:
            # D2.4 — subscription checkout completed
            try:
                sub_id = (
                    data_object.get("subscription")
                    if hasattr(data_object, "get")
                    else None
                )
                supabase.table("businesses").update(
                    {
                        "subscription_status": "active",
                        "subscription_id": sub_id,
                        "subscription_started_at": "now()",
                    }
                ).eq("id", business_id).execute()
            except Exception:
                logger.exception(
                    "Could not activate subscription for business %s", business_id
                )
        else:
            logger.warning(
                "checkout.session.completed missing booking_id / business_id metadata"
            )
    elif etype == "payment_intent.succeeded" and data_object is not None:
        # M9 — the NATIVE Payment Sheet's capture event. Deliberately routed
        # into the very same _mark_payment_paid as hosted Checkout: identical
        # amount verification, identical replay guard, identical FINDING D
        # remainder math. The native sheet did not get its own ledger path.
        #
        # Attribution is by metadata.booking_id, which
        # stripe_payment_sheet.create_payment_sheet always sets. A PaymentIntent
        # created BY a hosted Checkout Session does NOT carry it (Checkout
        # copies session metadata to the session, not to the intent), so a
        # hosted payment is still settled exactly once — by
        # checkout.session.completed above — and lands here as a no-op.
        pi_metadata = _obj_get(data_object, "metadata") or {}
        pi_booking_id = (
            pi_metadata.get("booking_id") if hasattr(pi_metadata, "get") else None
        )
        if pi_booking_id:
            _mark_payment_paid(
                pi_booking_id,
                None,
                _obj_get(data_object, "amount_received"),
                _obj_get(data_object, "id"),
            )
            # Remember the card here too, not only in the confirm endpoint: the
            # sheet can succeed and the app be killed before it confirms, and
            # this event still arrives. swingby_user_id is on the metadata that
            # create_payment_sheet always sets, so no booking lookup is needed.
            # Both paths running is harmless — the second write is identical.
            from app.services import stripe_payment_sheet

            stripe_payment_sheet.remember_payment_method(
                user_id=(
                    pi_metadata.get("swingby_user_id")
                    if hasattr(pi_metadata, "get")
                    else None
                ),
                payment_method_id=_obj_get(data_object, "payment_method"),
            )
        else:
            logger.info(
                "payment_intent.succeeded with no booking_id metadata — ignored "
                "(expected for hosted-Checkout intents)."
            )
    elif etype == "payment_intent.payment_failed" and data_object is not None:
        # Nothing to undo: no ledger row is written until a capture succeeds.
        # Logged so a run of declines is visible without digging in Stripe.
        logger.warning(
            "payment_intent.payment_failed for intent %s (booking %s)",
            _obj_get(data_object, "id"),
            (
                (_obj_get(data_object, "metadata") or {}).get("booking_id")
                if hasattr(_obj_get(data_object, "metadata") or {}, "get")
                else None
            ),
        )
    elif (
        etype
        in (
            "customer.subscription.updated",
            "customer.subscription.created",
            "customer.subscription.deleted",
        )
        and data_object is not None
    ):
        _sync_subscription(data_object)
    elif etype == "account.updated" and data_object is not None:
        _sync_connect_account(data_object)
    else:
        logger.info("Stripe webhook event ignored: %s", etype)


def _sync_connect_account(account_obj) -> None:
    """Mirror a Connect account's state when Stripe says it changed (SB-0080).

    DEC-5 recorded that account.updated, payout.* and transfer.* were subscribed
    but unhandled. What saved it is reconcile-on-read: every gate in payouts.py
    re-reads Stripe and calls `_mirror_account_state`, so the cached columns are
    refreshed whenever the owner opens their wallet.

    That is a real mitigation and it is why this is not urgent — but it means
    the mirror is only as fresh as the last time somebody looked. A business
    whose payouts Stripe just disabled keeps showing "payouts enabled" until
    they next open the screen, which is precisely when they would rather have
    been told. Handling this event closes the lag without changing where truth
    lives: Stripe stays authoritative, this only updates the cache sooner.

    payout.* and transfer.* stay unhandled on purpose. They report the movement
    of money that this system has already recorded in `payments`, and writing a
    second, differently-shaped record of the same event is how two ledgers start
    disagreeing. Reconciling them needs a decision about which one wins, which
    is a design question, not a missing handler.
    """
    account_id = _obj_get(account_obj, "id")
    if not account_id:
        logger.warning("account.updated with no account id; ignoring")
        return
    try:
        res = (
            supabase.table("businesses")
            .select("id")
            .eq("stripe_connect_account_id", account_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            # A Connect account we do not know about. Normal in a shared Stripe
            # test account; not an error.
            logger.info("account.updated for unknown Connect account")
            return
        from app.api.payouts import _mirror_account_state

        _mirror_account_state(
            rows[0]["id"],
            {
                "payouts_enabled": _obj_get(account_obj, "payouts_enabled"),
                "charges_enabled": _obj_get(account_obj, "charges_enabled"),
                "details_submitted": _obj_get(account_obj, "details_submitted"),
                "disabled_reason": (
                    _obj_get(
                        _obj_get(account_obj, "requirements") or {}, "disabled_reason"
                    )
                ),
                "requirements_due": (
                    _obj_get(
                        _obj_get(account_obj, "requirements") or {}, "currently_due"
                    )
                    or []
                ),
            },
        )
    except Exception:
        # Never fail the webhook over a cache refresh — reconcile-on-read is
        # still there, and raising here would make Stripe retry an event whose
        # only job was to save someone a round-trip.
        logger.warning("could not sync Connect account state", exc_info=True)


def _release_event_claim(event_id) -> None:
    """Undo the idempotency claim so a Stripe retry is processed, not skipped.

    Called only when dispatch raised. Best-effort: if this delete fails we have
    a claim for an unapplied event, which is the pre-existing failure mode and
    is visible in the logs either way — but we must not mask the ORIGINAL
    exception with a second one, so nothing here is allowed to propagate.
    """
    if not event_id:
        return
    try:
        supabase.table("stripe_events").delete().eq("event_id", event_id).execute()
        logger.warning("stripe_events claim released after failure: %s", event_id)
    except Exception:
        logger.exception("Could not release stripe_events claim %s", event_id)


@router.post("/webhook")
async def webhook(request: Request):
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = stripe_service.verify_webhook(payload_bytes, sig_header)

    # stripe.Webhook.construct_event returns a stripe.Event (StripeObject),
    # which is NOT a dict but DOES support [] subscript and dict-style .get on
    # nested fields. Use try/except so we handle both the real Stripe shape and
    # a plain dict (used by tests). isinstance(event, dict) was False in prod,
    # so the previous version silently dropped every completed event.
    try:
        etype = event["type"]
    except (KeyError, TypeError):
        etype = getattr(event, "type", None)

    try:
        event_id = event["id"]
    except (KeyError, TypeError):
        event_id = getattr(event, "id", None)

    try:
        data_object = event["data"]["object"]
    except (KeyError, TypeError):
        data_object = None

    # fix E: idempotency. A replayed event must not re-run side effects (e.g.
    # regress a fully_released payment back to paid_full).
    #
    # CLAIM-FIRST, and that ordering is the whole control (checklist #15). This
    # was a SELECT here plus an INSERT at the end of the handler, which left two
    # holes:
    #
    #   * A RACE. Stripe retries aggressively and delivers concurrently. Two
    #     copies of one event could both run the SELECT before either reached
    #     the INSERT, both see nothing, and both apply the side effects. The
    #     window was the entire body of this function — every network call to
    #     Stripe and Supabase in it.
    #   * A FAIL-OPEN. An unreachable dedupe table logged a warning and carried
    #     on, so the moment the safety net was most likely to be needed (a
    #     database wobble, which is also when retries pile up) was exactly when
    #     it was not there.
    #
    # Inserting FIRST turns the primary key on `stripe_events.event_id` into the
    # lock: whichever delivery inserts wins, and the loser gets a duplicate-key
    # error and stops. No application-level window exists because the database
    # decides, atomically.
    #
    # Now fail-CLOSED. If the claim cannot be written we return 500, Stripe
    # retries (it does so for up to three days), and we would rather process an
    # event late than twice — this handler moves money.
    if event_id:
        try:
            supabase.table("stripe_events").insert(
                {"event_id": event_id, "event_type": etype}
            ).execute()
        except Exception as exc:
            # 23505 = unique_violation. supabase-py surfaces the PostgREST error
            # rather than a typed exception, so match on the code in the message
            # — narrowly, because every OTHER error here must 500, not ack.
            message = str(exc)
            if "23505" in message or "duplicate key" in message.lower():
                logger.info("Stripe webhook duplicate ignored: %s", event_id)
                return {"received": True, "duplicate": True, "type": etype}
            logger.exception("stripe_events claim failed for %s", event_id)
            raise HTTPException(
                status_code=500, detail="Could not record webhook event"
            )

    # Side effects run only after the claim above succeeded. If any of them
    # raise, the claim is released so Stripe's retry gets a real second attempt
    # rather than being acked as a duplicate.
    try:
        _dispatch_webhook_event(etype, data_object)
    except Exception:
        _release_event_claim(event_id)
        raise

    # The event id was claimed at the TOP of this handler, before any side
    # effect ran — see the comment there. Recording it here as well is what
    # left the race open, so there is deliberately nothing to do at this point.

    return {"received": True, "type": etype}


def _obj_get(obj, key):
    """Read a field from a Stripe object (dict-or-StripeObject), else None."""
    if obj is None:
        return None
    try:
        return obj[key]
    except (KeyError, TypeError):
        return getattr(obj, key, None)


def _sync_subscription(sub_obj) -> None:
    """Reflect Stripe subscription state onto the businesses row."""
    try:
        sub_id = sub_obj["id"] if not hasattr(sub_obj, "get") else sub_obj.get("id")
        status = sub_obj.get("status") if hasattr(sub_obj, "get") else sub_obj["status"]
        customer_id = (
            sub_obj.get("customer") if hasattr(sub_obj, "get") else sub_obj["customer"]
        )
        current_period_end = (
            sub_obj.get("current_period_end") if hasattr(sub_obj, "get") else None
        )
        cancel_at = sub_obj.get("cancel_at") if hasattr(sub_obj, "get") else None
        update = {"subscription_status": status, "subscription_id": sub_id}
        if current_period_end:
            from datetime import datetime, timezone

            update["subscription_current_period_end"] = datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            ).isoformat()
        if cancel_at:
            from datetime import datetime, timezone

            update["subscription_cancel_at"] = datetime.fromtimestamp(
                cancel_at, tz=timezone.utc
            ).isoformat()
        supabase.table("businesses").update(update).eq(
            "stripe_customer_id", customer_id
        ).execute()
    except Exception:
        logger.exception("Could not sync subscription")


def _mark_past_due(invoice_obj) -> None:
    try:
        customer_id = (
            invoice_obj.get("customer")
            if hasattr(invoice_obj, "get")
            else invoice_obj["customer"]
        )
        supabase.table("businesses").update({"subscription_status": "past_due"}).eq(
            "stripe_customer_id", customer_id
        ).execute()
    except Exception:
        logger.exception("Could not mark subscription past_due")


def _mark_payment_paid(
    booking_id: str,
    stripe_session_id: str | None,
    amount_total_cents: int | None = None,
    payment_intent_id: str | None = None,
) -> None:
    """
    On `checkout.session.completed`, confirm the on-platform CAPTURE.

    The /interests accept flow inserted a payments row with
    status='pending_payment' (amount owed, nothing captured, nothing released).
    Stripe having captured the charge, we transition it to 'held': the money is
    now genuinely in escrow, and `stripe_payment_intent_id` records WHICH Stripe
    charge is behind it — that field is what escrow.assert_capture_backed()
    later checks before any money is released to the business (FINDING C).

    fix A: the Stripe id goes into `stripe_payment_intent_id` (a real column),
    never the phantom `notes` column that 400'd this write.
    fix E: (1) verify the paid amount matches the booking total before marking
    paid; (2) never regress a fully_released / refunded / off-platform row.
    FINDING D: escrow_held is the remainder of the charge, not a flat overwrite.
    """
    from app.services import escrow

    booking_res = (
        supabase.table("bookings")
        .select("total_amount, total_amount_cents")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    # Integer cents are authoritative (migration 20260723120000); total_amount is
    # the legacy double precision mirror and is only a fallback.
    expected_cents = None
    if booking_res.data:
        if booking_res.data.get("total_amount_cents") is not None:
            expected_cents = int(booking_res.data["total_amount_cents"])
        else:
            expected_cents = escrow.to_cents(booking_res.data.get("total_amount"))

    # If credit was redeemed at checkout, Stripe captured the REDUCED (net)
    # amount — subtract the recorded redemption so the mismatch check compares
    # against what we actually asked Stripe to charge. No-op (subtract 0) for
    # bookings with no redemption, so this is safe while redemption is gated off.
    if expected_cents is not None:
        from app.services import credits

        redeemed = credits._existing_redemption_cents(booking_id)
        if redeemed:
            expected_cents = max(expected_cents - redeemed, 0)

    payment = escrow.load_single_payment(booking_id)
    if not payment:
        logger.error(
            "Stripe capture for booking %s but no payments row exists", booking_id
        )
        return

    # Regression guard: a replayed event must not knock a released/refunded/
    # off-platform payment back to paid_full.
    if payment.get("status") in ("fully_released", "refunded", "paid_off_platform"):
        logger.info(
            "Stripe capture for booking %s ignored — payment already %s",
            booking_id,
            payment.get("status"),
        )
        return

    # A Post + Pay client had their BUDGET captured at posting, and interests.py
    # bound that row to this booking. When the accepted quote came in above that
    # budget, trigger_on_accept charges only the DELTA — so what Stripe just
    # captured is the outstanding balance, not the whole booking total. The
    # amount check has to expect that, or it would reject a perfectly correct
    # top-up and leave money captured at Stripe with nothing recorded against it.
    #
    # Only CAPTURE-BACKED money is subtracted. The ordinary row states the full
    # amount as *owed* from the moment it is inserted, before anything is
    # captured; treating that as paid would make `expected` zero and reject
    # every first capture. Nothing capture-backed means subtracting 0, which is
    # why the ordinary path below is unchanged.
    already_captured_c = 0
    if escrow.is_capture_backed(payment):
        already_captured_c = max(
            escrow.money_cents(payment, "total_charged")
            - escrow.money_cents(payment, "refunded"),
            0,
        )
    if expected_cents is not None:
        expected_cents = max(expected_cents - already_captured_c, 0)

    # Amount verification — refuse to mark paid if Stripe charged a different
    # amount than is outstanding on the booking. Better to leave it pending for
    # review than to silently accept an under/over-charge.
    if (
        amount_total_cents is not None
        and expected_cents is not None
        and int(amount_total_cents) != expected_cents
    ):
        logger.error(
            "Stripe amount mismatch for booking %s: paid=%s expected=%s cents "
            "(already captured %s) — NOT marking paid. Needs manual review.",
            booking_id,
            amount_total_cents,
            expected_cents,
            already_captured_c,
        )
        return

    # FINDING D (money audit, 2026-07-23) — DOUBLE COUNTING.
    # This used to be a flat `escrow_held = total_charged`, which OVERWRITES the
    # held figure instead of accounting for anything already released. Booking
    # 82b69fc2 took one real $150 charge and the ledger ended up claiming $150
    # held AND $75 released — $225 of accounting against $150 of money, which the
    # business Earnings screen then added together.
    #
    # Escrow now holds the REMAINDER of the charge: max(total - already_released, 0).
    # The invariant escrow_held + released_to_business <= total_charged is also a
    # DB CHECK (payments_ledger_not_over_charged) so it cannot regress silently.
    total_c = escrow.money_cents(payment, "total_charged")
    already_released_c = escrow.money_cents(payment, "released_to_business")

    if already_captured_c and amount_total_cents:
        # TOP-UP. This capture is money that arrived ON TOP of what the row
        # already records, so total_charged grows by exactly what Stripe took —
        # it is the only figure that says how much the client has handed over in
        # total. Writing the booking total flat instead would be correct only by
        # coincidence, and wrong the moment any of it had been refunded.
        refunded_c = escrow.money_cents(payment, "refunded")
        total_c = total_c + int(amount_total_cents)
        update: dict = escrow.ledger_write(
            total_charged=total_c,
            escrow_held=max(total_c - already_released_c - refunded_c, 0),
        )
    else:
        hold = escrow.compute_capture_hold(total_c, already_released_c)
        update = escrow.ledger_write(escrow_held=hold["escrow_held_cents"])
    # 'held' is the current vocabulary for "capture confirmed, money in escrow".
    # (The live payments_status_check accepts the legacy 'paid_full' too; we
    # write only the current name. NOTE: earlier comments here cited a
    # "migration 0001 applied 2026-07-22" as the reason — that migration does
    # not exist in the repo or in the live migration list. The value is correct;
    # the justification was invented.)
    update["status"] = "held"
    if payment_intent_id:
        update["stripe_payment_intent_id"] = payment_intent_id
    elif stripe_session_id:
        # No PaymentIntent on the event — fall back to the session id so the
        # capture is still traceable in a real column (not `notes`).
        update["stripe_payment_intent_id"] = stripe_session_id
    # Record HOW the money arrived. Without this the ledger cannot tell an
    # on-platform card capture from a row that was never paid, which is half of
    # what FINDING C's guard has to reason about.
    if not payment.get("method"):
        update["method"] = "stripe_card"
    payments_row_updated = True
    try:
        supabase.table("payments").update(update).eq("id", payment["id"]).execute()
    except Exception:
        payments_row_updated = False
        logger.exception("Could not mark payment paid for booking %s", booking_id)
        # Don't raise — webhooks must be idempotent + always 200 to Stripe.

    # Bug 4 (walkthrough) — mirror the capture onto bookings.payment_status.
    #
    # This is the ONLY place a real capture gets confirmed: hosted Checkout's
    # webhook, the payment_intent.succeeded webhook, and confirm_payment_intent
    # (the native Payment Sheet's settle call) all funnel here. Before this,
    # none of them touched bookings.payment_status — the sole write to that
    # column for a captured payment lived in interests.py's Flow A branch
    # ("if post_payment:"), which only runs for the charge-AT-POST flow. That
    # flow is gated off in api/service_posts.py (see CLAUDE.md), so on the
    # live charge-AT-ACCEPT path bookings.payment_status never left the
    # 'pending_payment' it was given at booking creation until /complete
    # (services/approvals.py) rewrote it as a side effect of a wholly
    # different action. The client saw a PENDING pill next to money that was
    # already genuinely held.
    #
    # `_attach_payment_state` (api/bookings.py) does NOT depend on this column
    # — it derives the real payment_state fresh from the payments ledger on
    # every read, which is why "Funds held in escrow" was already correct
    # while a raw payment_status pill sitting elsewhere lied. This write is
    # for that second, older reader: the raw column itself.
    #
    # Skipped when the ledger write above failed — mirroring 'held' onto the
    # booking when the ledger never actually recorded the capture would be a
    # lie in the other direction. Never raises (same idempotent-webhook
    # requirement as everything else here), but logged at ERROR with a full
    # traceback rather than a bare warning: unlike a receipt email, a booking
    # that silently keeps the wrong payment_status is actively showing the
    # client false information about their own money, so this failure needs
    # to be loud even though it cannot be allowed to block the response.
    if payments_row_updated:
        try:
            supabase.table("bookings").update({"payment_status": "held"}).eq(
                "id", booking_id
            ).execute()
        except Exception:
            logger.error(
                "could not mirror held payment_status onto booking %s — client "
                "will see a stale pending_payment status until /complete "
                "corrects it as a side effect of a different action",
                booking_id,
                exc_info=True,
            )

    # Email the client a payment receipt — best-effort, never raises
    try:
        from app.services.email import send_payment_receipt

        booking_res = (
            supabase.table("bookings")
            .select("client_id, total_amount")
            .eq("id", booking_id)
            .single()
            .execute()
        )
        if booking_res.data:
            client_id = booking_res.data["client_id"]
            amount = float(booking_res.data.get("total_amount") or 0)
            client_user_res = (
                supabase.table("users")
                .select("email, first_name")
                .eq("id", client_id)
                .single()
                .execute()
            )
            if client_user_res.data and amount > 0:
                send_payment_receipt(
                    client_user_res.data["email"],
                    client_user_res.data["first_name"],
                    booking_id,
                    amount,
                )
    except Exception:
        logger.warning("payment receipt email failed for booking %s", booking_id)


# ── Card on file (M2) ────────────────────────────────────────────────────────


class SetupIntentResponse(BaseModel):
    setup_intent_client_secret: str
    ephemeral_key: str
    customer_id: str
    publishable_key: str
    merchant_display_name: str
    apple_merchant_id: Optional[str] = None


@router.post("/setup-intent", response_model=SetupIntentResponse)
def create_setup_intent(current_user: dict = Depends(get_current_user)):
    """Save a card WITHOUT charging it.

    Before this, a card was kept only as a side effect of paying once: the
    PaymentIntent carried setup_future_usage='off_session'. That produced a
    saved card the client could not see, choose or remove, and no card at all
    until their first successful payment.

    Same `native_sheet_unavailable:` refusal as the payment sheet — without a
    publishable key the device cannot confirm anything, and minting a
    SetupIntent would strand a real Stripe object.
    """
    from app.services import stripe_payment_sheet

    if not stripe_payment_sheet.publishable_key():
        raise HTTPException(
            status_code=503,
            detail=(
                "native_sheet_unavailable: STRIPE_PUBLISHABLE_KEY is not set, so "
                "a card cannot be added on this environment."
            ),
        )

    first = current_user.get("first_name") or ""
    last = current_user.get("last_name") or ""
    try:
        return stripe_payment_sheet.create_setup_intent(
            user_id=current_user["id"],
            email=current_user.get("email"),
            name=(f"{first} {last}".strip() or None),
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("stripe.setup_intent failed", user_id=current_user["id"])
        raise HTTPException(status_code=400, detail="Could not start card setup")


@router.get("/payment-methods")
def list_payment_methods(current_user: dict = Depends(get_current_user)):
    """The caller's saved cards. Brand, last 4, expiry — nothing else exists."""
    from app.services import stripe_payment_sheet

    try:
        return {
            "items": stripe_payment_sheet.list_payment_methods(
                user_id=current_user["id"]
            )
        }
    except Exception:
        # An empty list is the safe answer: the screen renders "no cards yet"
        # rather than an error the user cannot act on, and paying still works
        # through the sheet.
        logger.exception("stripe.list_payment_methods failed")
        return {"items": []}


@router.delete("/payment-methods/{payment_method_id}")
def delete_payment_method(
    payment_method_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Remove a saved card.

    Ownership is verified against STRIPE — the id comes from the client, and
    detach would otherwise happily remove a card belonging to another account.
    """
    from app.services import stripe_payment_sheet

    try:
        stripe_payment_sheet.detach_payment_method(
            user_id=current_user["id"],
            payment_method_id=payment_method_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception:
        logger.exception("stripe.detach_payment_method failed")
        raise HTTPException(status_code=400, detail="Could not remove that card")
    return {"removed": payment_method_id}
