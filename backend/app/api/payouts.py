"""
payouts.py — D5. A business takes its money out.

Mounted under ``/businesses`` (same as subscriptions and auto-bidding), so the
routes read:

    POST   /businesses/me/payout-account        start or resume Express onboarding
    GET    /businesses/me/payout-account        onboarding + KYC status, synced from Stripe
    POST   /businesses/me/payout-account/login  link into the Express dashboard
    GET    /businesses/me/payouts               balance + history (settles stale rows on read)
    POST   /businesses/me/payouts               cash out

RULING (Kira, 2026-08-04): *"a business needs to take the money out, and they
can in an instant."* Hence Stripe Connect Express plus an instant payout to a
debit card where the card supports it — not a manual transfer somebody marks
settled.

WHAT MOVES, AND FROM WHERE
--------------------------
Client money is captured into the PLATFORM account (charge-before-service). A
cash-out is therefore two Stripe calls, in this order:

    1. Transfer  platform balance     -> the business's connected account
    2. Payout    connected account    -> their debit card (instant) or bank

Step 1 is where the money stops being SwingBy's, which is why a payout row
counts against the balance from the moment ``stripe_transfer_id`` is set — see
``app.services.payouts``. If step 2 fails the funds sit on the connected
account, and the next cash-out picks them up automatically because the payout
amount is read back off Stripe (:func:`stripe_connect.available_balance_cents`)
rather than being the number we just computed.

MONEY RULES ARE NOT DEFINED HERE
--------------------------------
Nothing in this file decides what a business earns. The 10% platform cut and
the completion/approval release are ``app.services.escrow``'s, already applied
by the time a figure reaches ``payments.released_to_business_cents``. This file
sums what escrow released — capture-backed rows only (FINDING C) — subtracts
what has already been sent, and moves the remainder.

NO SCHEDULER (Roadmap/STATUS.md §2)
-----------------------------------
Nothing polls Stripe. A standard payout is ``in_transit`` for days; that row is
re-read and settled when the owner opens the wallet. Every time-dependent
transition in this file happens on a read.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.deps import get_current_user
from app.services import payouts as payouts_service
from app.services import stripe_connect
from app.services.stripe_service import StripeNotConfigured
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class PayoutAccountStatus(BaseModel):
    """Everything the wallet needs to decide what to show, in one read.

    ``state`` is the single field the UI branches on. It exists so the device
    does not re-derive a status from four booleans and get it subtly different
    from the server (and from the other three screens that would eventually do
    the same thing):

      ``none``        no connected account — onboarding has never been started
      ``incomplete``  account exists, the person has not finished the form
      ``pending``     form submitted, Stripe is still verifying / wants more
      ``restricted``  Stripe has disabled payouts and says why
      ``ready``       payouts_enabled — money can leave
    """

    state: str
    account_id: Optional[str] = None
    payouts_enabled: bool = False
    details_submitted: bool = False
    disabled_reason: Optional[str] = None
    requirements_due: list[str] = []
    # Which rail a cash-out would use TODAY. Predictive, and labelled as such in
    # the UI — the authoritative value is the one on the payout row afterwards.
    instant_available: bool = False
    instant_source_last4: Optional[str] = None
    onboarding_url: Optional[str] = None


class PayoutAccountLink(BaseModel):
    account_id: str
    onboarding_url: str
    state: str


class LoginLink(BaseModel):
    url: str


class WalletResponse(BaseModel):
    available_cents: int
    lifetime_earned_cents: int
    paid_out_cents: int
    currency: str
    account: PayoutAccountStatus
    payouts: list[dict]


class PayoutResult(BaseModel):
    id: str
    amount_cents: int
    currency: str
    status: str
    # The rail that ACTUALLY carried it, read back off Stripe. Never the
    # prediction — copy promising "instant" over a standard payout is a lie
    # with a 1-3 business-day tail.
    method: str
    arrival_date: Optional[Any] = None
    stripe_payout_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _owner_business(current_user: dict) -> dict:
    """The caller's business, or 403/404.

    Payouts are the owner's alone. Employees can run jobs and message clients;
    moving the company's money out is not delegated, and the role check has to
    be here rather than in the UI or an employee could hit the endpoint
    directly.
    """
    if current_user.get("role") != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can manage payouts"
        )

    res = (
        supabase.table("businesses")
        .select("*")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered"
        )
    return res.data


def _stripe_unavailable(exc: Exception) -> HTTPException:
    """503 for a missing key, 502 for a Stripe refusal — never a bare 500.

    The distinction is the whole point: 503 means "this deployment has no
    Stripe key, an operator must set one", 502 means "Stripe said no, here is
    what it said". Collapsing both into 500 is how B14 ("cannot create Stripe
    checkout session") stayed unexplained for a week.
    """
    if isinstance(exc, StripeNotConfigured):
        return HTTPException(status_code=503, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


def _mirror_account_state(business_id: str, status: dict) -> None:
    """Cache Stripe's answer on the business row.

    Best-effort by design: Stripe is authoritative and every gate in this file
    re-reads it, so a failed mirror write must never fail the request the owner
    made. The mirror only exists so the wallet can paint before the network
    round-trip.
    """
    try:
        supabase.table("businesses").update(
            {
                "payouts_enabled": bool(status.get("payouts_enabled")),
                "connect_charges_enabled": bool(status.get("charges_enabled")),
                "connect_details_submitted": bool(status.get("details_submitted")),
                "connect_disabled_reason": status.get("disabled_reason"),
                "connect_requirements_due": status.get("requirements_due") or [],
                "connect_synced_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", business_id).execute()
    except Exception:
        logger.warning(
            "could not mirror Connect state onto business %s",
            business_id,
            exc_info=True,
        )


def _derive_state(status: dict) -> str:
    """Collapse Stripe's booleans into the one word the UI branches on."""
    if not status.get("account_id"):
        return "none"
    if status.get("payouts_enabled"):
        return "ready"
    if status.get("disabled_reason"):
        return "restricted"
    if status.get("details_submitted"):
        # Submitted but not enabled: Stripe is verifying, or wants more. Both
        # are "wait or supply something", not "start over".
        return "pending"
    return "incomplete"


def _read_account_status(business: dict, *, with_capability: bool = True) -> dict:
    """Fetch + normalise the connected account, and refresh the DB mirror.

    Returns the dict :class:`PayoutAccountStatus` is built from. A business with
    no account short-circuits without touching Stripe, so the common
    "never set up payouts" case costs nothing.
    """
    account_id = business.get("stripe_connect_account_id")
    if not account_id:
        return {
            "state": "none",
            "account_id": None,
            "payouts_enabled": False,
            "details_submitted": False,
            "disabled_reason": None,
            "requirements_due": [],
            "instant_available": False,
            "instant_source_last4": None,
        }

    account = stripe_connect.retrieve_account(account_id)
    status = stripe_connect.account_status(account)
    _mirror_account_state(business["id"], status)

    instant_available = False
    instant_last4 = None
    # Only ask about rails once payouts are actually enabled. Before that the
    # answer is always "no external account yet", and it is a wasted API call on
    # the screen a brand-new business opens most.
    if with_capability and status.get("payouts_enabled"):
        try:
            capability = stripe_connect.payout_capability(account_id)
            instant_available = bool(capability.get("instant"))
            instant_last4 = capability.get("instant_source")
        except stripe_connect.StripeConnectError:
            # A capability lookup failing must not blank out an otherwise
            # healthy wallet — it downgrades the PREDICTION to standard, which
            # is the honest fallback.
            logger.warning(
                "instant-payout capability lookup failed for %s",
                account_id,
                exc_info=True,
            )

    return {
        "state": _derive_state(status),
        "account_id": account_id,
        "payouts_enabled": bool(status.get("payouts_enabled")),
        "details_submitted": bool(status.get("details_submitted")),
        "disabled_reason": status.get("disabled_reason"),
        "requirements_due": status.get("requirements_due") or [],
        "instant_available": instant_available,
        "instant_source_last4": instant_last4,
    }


def _business_payment_rows(business_id: str) -> list[dict]:
    """Every payments row behind this business's bookings.

    Same join `GET /payments/mine` uses: `payments` has no `business_id`, so it
    goes through `bookings`. Selects the capture-verification fields explicitly
    (`status`, `method`, `stripe_payment_intent_id`) because
    ``escrow.is_capture_backed`` needs all three, and a partial select that
    dropped one would silently make every row look un-capture-backed and zero
    out the balance.
    """
    bookings = (
        supabase.table("bookings").select("id").eq("business_id", business_id).execute()
    )
    booking_ids = [b["id"] for b in (bookings.data or [])]
    if not booking_ids:
        return []

    res = (
        supabase.table("payments")
        .select(
            "id,booking_id,status,method,stripe_payment_intent_id,"
            "released_to_business,released_to_business_cents"
        )
        .in_("booking_id", booking_ids)
        .execute()
    )
    return res.data or []


def _payout_rows(business_id: str) -> list[dict]:
    res = (
        supabase.table("payouts")
        .select("*")
        .eq("business_id", business_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def _settle_payout_rows(rows: list[dict], account_id: str | None) -> list[dict]:
    """Re-read non-terminal payouts from Stripe and persist any movement.

    This is the "settles lazily on read" pattern STATUS.md §2 requires — there
    is no scheduler on this deployment, so a standard payout's multi-day
    ``in_transit`` -> ``paid`` transition is observed here, when the owner
    opens their wallet, or nowhere.

    Failures are swallowed per row: one unreachable payout must not blank a
    wallet that is otherwise fine. The row simply stays stale and is retried on
    the next read.
    """
    if not account_id:
        return rows

    settled: list[dict] = []
    for row in rows:
        payout_id = row.get("stripe_payout_id")
        if not payout_id or row.get("status") not in payouts_service.UNSETTLED_STATUSES:
            settled.append(row)
            continue

        try:
            fresh = stripe_connect.retrieve_payout(
                account_id=account_id, payout_id=payout_id
            )
        except stripe_connect.StripeConnectError:
            logger.warning("could not re-read payout %s", payout_id, exc_info=True)
            settled.append(row)
            continue
        except StripeNotConfigured:
            settled.append(row)
            continue

        new_status = payouts_service.map_stripe_payout_status(fresh.get("status"))
        if new_status == row.get("status"):
            settled.append(row)
            continue

        update: dict[str, Any] = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if fresh.get("failure_message"):
            update["failure_reason"] = fresh["failure_message"]
        try:
            supabase.table("payouts").update(update).eq("id", row["id"]).execute()
        except Exception:
            logger.warning(
                "could not persist payout %s status", row["id"], exc_info=True
            )
        settled.append({**row, **update})

    return settled


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------


@router.post("/me/payout-account", response_model=PayoutAccountLink)
def start_payout_onboarding(current_user: dict = Depends(get_current_user)):
    """Create the Express account if there isn't one, and return an onboarding link.

    Idempotent on the account: an existing ``stripe_connect_account_id`` is
    reused, so tapping "Set up payouts" twice does not strand a second empty
    connected account. The LINK is always fresh — Stripe account links are
    single-use and expire in minutes, so caching one guarantees a dead page.

    Safe to call after onboarding is finished too: it returns a link into the
    same account, which is how "finish setup" and "fix what Stripe is asking
    for" both work without a second endpoint.
    """
    business = _owner_business(current_user)
    account_id = business.get("stripe_connect_account_id")

    try:
        if not account_id:
            account_id = stripe_connect.create_express_account(
                business_id=business["id"],
                business_name=business.get("business_name"),
                email=current_user.get("email"),
            )
            # Persist BEFORE returning. If this write fails we must not hand
            # back a link to an account nobody recorded — the next call would
            # create a second account and the first would be orphaned, possibly
            # holding transferred funds.
            try:
                supabase.table("businesses").update(
                    {"stripe_connect_account_id": account_id}
                ).eq("id", business["id"]).execute()
            except Exception:
                logger.exception(
                    "created Connect account %s but could not save it on business %s",
                    account_id,
                    business["id"],
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Your payout account was created at Stripe but could not be "
                        "saved. Please try again — support can link "
                        f"{account_id} if this repeats."
                    ),
                )

        url = stripe_connect.create_account_link(
            account_id=account_id,
            return_url=settings.STRIPE_CONNECT_RETURN_URL,
            refresh_url=settings.STRIPE_CONNECT_REFRESH_URL,
        )
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        raise _stripe_unavailable(exc)

    # Report the state as it is right now, so a client that reuses this
    # response does not have to guess whether onboarding is already done.
    state = "incomplete"
    if business.get("payouts_enabled"):
        state = "ready"
    elif business.get("connect_details_submitted"):
        state = "pending"

    return PayoutAccountLink(account_id=account_id, onboarding_url=url, state=state)


@router.get("/me/payout-account", response_model=PayoutAccountStatus)
def get_payout_account(current_user: dict = Depends(get_current_user)):
    """Onboarding + KYC status, read from Stripe and mirrored onto the business.

    Called when the wallet opens and again every time the onboarding browser
    tab closes — that is the app's return/refresh handling. It does not depend
    on Stripe's ``return_url`` page being reachable, which matters because that
    page is on swingbyy.com and swingbyy.com does not currently deploy.
    """
    business = _owner_business(current_user)
    try:
        status = _read_account_status(business)
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        raise _stripe_unavailable(exc)
    return PayoutAccountStatus(**status)


@router.post("/me/payout-account/login", response_model=LoginLink)
def get_express_login_link(current_user: dict = Depends(get_current_user)):
    """A link into the Express dashboard — where the owner adds/changes a card.

    This is the ONLY route by which a business changes its debit card or bank
    account. SwingBy never sees those details, which is the point of Express.
    """
    business = _owner_business(current_user)
    account_id = business.get("stripe_connect_account_id")
    if not account_id:
        raise HTTPException(
            status_code=409, detail="Set up payouts before opening the payout dashboard"
        )
    try:
        url = stripe_connect.create_login_link(account_id=account_id)
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        raise _stripe_unavailable(exc)
    return LoginLink(url=url)


# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------


@router.get("/me/payouts", response_model=WalletResponse)
def get_wallet(current_user: dict = Depends(get_current_user)):
    """Balance, account status and payout history in one read.

    One endpoint rather than three because they are only meaningful together:
    an available balance without the account state cannot tell the owner why
    the cash-out button is disabled, and that ambiguity is exactly what makes a
    money screen feel broken.

    Degrades rather than fails. If Stripe is unreachable or unconfigured the
    balance — which is computed entirely from our own ledger — is still
    returned, with the account reported as ``none``. A business must always be
    able to see what it has earned, even when it cannot move it.
    """
    business = _owner_business(current_user)

    try:
        account = _read_account_status(business)
    except (stripe_connect.StripeConnectError, StripeNotConfigured):
        logger.warning(
            "wallet: Stripe unavailable for business %s; serving ledger only",
            business["id"],
            exc_info=True,
        )
        account = {
            "state": "none",
            "account_id": None,
            "payouts_enabled": False,
            "details_submitted": False,
            "disabled_reason": None,
            "requirements_due": [],
            "instant_available": False,
            "instant_source_last4": None,
        }

    rows = _settle_payout_rows(_payout_rows(business["id"]), account.get("account_id"))
    payment_rows = _business_payment_rows(business["id"])
    summary = payouts_service.summarize(payment_rows, rows)

    return WalletResponse(
        **summary,
        account=PayoutAccountStatus(**account),
        payouts=[payouts_service.public_payout(r) for r in rows],
    )


@router.post("/me/payouts", response_model=PayoutResult)
def create_payout(current_user: dict = Depends(get_current_user)):
    """Move this business's whole available balance out. Instant where eligible.

    No amount is accepted from the client. The balance is derived server-side
    from the ledger, and a client-supplied amount would be a second place the
    figure could be wrong — the same reason ``POST /payments/quote`` re-reads
    the price instead of trusting the request body.

    THE SEQUENCE, AND WHAT EACH FAILURE LEAVES BEHIND

      1. Insert the payout row (``pending``). It exists first so its primary key
         can seed both Stripe idempotency keys — a retried transfer is then the
         SAME key and Stripe returns the original transfer instead of sending
         the money twice.
      2. Transfer platform -> connected account. Failure here marks the row
         ``failed`` with NO transfer id, so it does not consume balance and the
         owner can simply try again.
      3. Read the connected account's available balance. This, not the number
         from step 2, is what gets paid out — so funds stranded by an earlier
         step-4 failure are swept out now instead of being lost track of.
      4. Payout to the card (instant) or bank (standard). Failure here marks the
         row ``failed`` WITH its transfer id: the money is legitimately the
         business's and is sitting on their connected account. Step 3 of the
         next attempt collects it.
    """
    business = _owner_business(current_user)
    business_id = business["id"]

    # ── Gate on Stripe's answer, not the mirror ──────────────────────────────
    # `businesses.payouts_enabled` is a cache. Paying out against a cache is how
    # you send money to an account Stripe disabled an hour ago.
    try:
        account = _read_account_status(business)
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        raise _stripe_unavailable(exc)

    account_id = account.get("account_id")
    if not account_id:
        raise HTTPException(status_code=409, detail="Set up payouts before cashing out")
    if not account.get("payouts_enabled"):
        detail = "Your payout account is not ready yet"
        if account.get("disabled_reason"):
            detail = f"Stripe has paused payouts on your account: {account['disabled_reason']}"
        elif account.get("requirements_due"):
            detail = "Stripe still needs some details before you can be paid out"
        raise HTTPException(status_code=409, detail=detail)

    # ── What is owed ─────────────────────────────────────────────────────────
    existing = _settle_payout_rows(_payout_rows(business_id), account_id)
    payment_rows = _business_payment_rows(business_id)
    amount_cents = payouts_service.available_cents(payment_rows, existing)

    # No floor of our own. Stripe enforces its own minimum and its message is
    # more accurate than any number invented here would be — and a threshold is
    # a money rule, which this file does not get to make up.
    if amount_cents <= 0:
        raise HTTPException(
            status_code=409, detail="You have no money available to cash out"
        )

    # ── 1. The row ───────────────────────────────────────────────────────────
    payout_id = str(uuid.uuid4())
    row = {
        "id": payout_id,
        "business_id": business_id,
        "amount_cents": amount_cents,
        "currency": stripe_connect.DEFAULT_CURRENCY,
        "status": "pending",
        "stripe_account_id": account_id,
    }
    try:
        supabase.table("payouts").insert(row).execute()
    except Exception:
        logger.exception("could not create payout row for business %s", business_id)
        raise HTTPException(
            status_code=500, detail="Could not start the payout. Please try again."
        )

    def _fail(reason: str, **extra: Any) -> None:
        try:
            supabase.table("payouts").update(
                {
                    "status": "failed",
                    "failure_reason": reason[:500],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    **extra,
                }
            ).eq("id", payout_id).execute()
        except Exception:
            logger.exception("could not mark payout %s failed", payout_id)

    # ── 2. Platform -> connected account ─────────────────────────────────────
    try:
        transfer_id = stripe_connect.create_transfer(
            account_id=account_id,
            amount_cents=amount_cents,
            idempotency_key=f"sb_payout_tr_{payout_id}",
            metadata={
                "swingby_business_id": business_id,
                "swingby_payout_id": payout_id,
            },
        )
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        _fail(str(exc))
        raise _stripe_unavailable(exc)

    try:
        supabase.table("payouts").update(
            {
                "stripe_transfer_id": transfer_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", payout_id).execute()
    except Exception:
        # The money HAS moved. Losing this write means the balance will look
        # higher than it is until someone reconciles, so it is logged loudly —
        # but the payout continues, because stopping now would strand the funds
        # on the connected account for no benefit.
        logger.exception(
            "TRANSFER %s SUCCEEDED BUT WAS NOT RECORDED on payout %s (%d cents, business %s) "
            "— the available balance will over-report until this row is repaired",
            transfer_id,
            payout_id,
            amount_cents,
            business_id,
        )

    # ── 3. What can actually be sent, per Stripe ─────────────────────────────
    try:
        sendable = stripe_connect.available_balance_cents(account_id)
    except (stripe_connect.StripeConnectError, StripeNotConfigured):
        logger.warning(
            "could not read connected balance for %s; sending the transferred amount",
            account_id,
            exc_info=True,
        )
        sendable = amount_cents

    if sendable <= 0:
        _fail(
            "Stripe reports no available balance on the payout account yet",
            stripe_transfer_id=transfer_id,
        )
        raise HTTPException(
            status_code=409,
            detail=(
                "Your earnings moved to your payout account but Stripe has not "
                "released them yet. Try cashing out again shortly."
            ),
        )

    # ── 4. Connected account -> card or bank ─────────────────────────────────
    # Ask, do not assume. Instant is a property of the destination card, and
    # promising it on a standard payout is a 1-3 business-day lie.
    method = "standard"
    try:
        capability = stripe_connect.payout_capability(account_id)
        if capability.get("instant"):
            method = "instant"
    except (stripe_connect.StripeConnectError, StripeNotConfigured):
        logger.warning(
            "payout capability lookup failed for %s; using standard",
            account_id,
            exc_info=True,
        )

    try:
        result = stripe_connect.create_payout(
            account_id=account_id,
            amount_cents=sendable,
            method=method,
            idempotency_key=f"sb_payout_po_{payout_id}",
            metadata={
                "swingby_business_id": business_id,
                "swingby_payout_id": payout_id,
            },
        )
    except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc:
        # Instant can be refused at send time even when the card advertises it
        # (Stripe's own limits, a card that has just stopped supporting it). A
        # standard payout of the same money is strictly better than an error, so
        # fall back once and record which rail actually carried it.
        if method == "instant":
            logger.warning(
                "instant payout refused on %s, falling back to standard: %s",
                account_id,
                exc,
            )
            try:
                result = stripe_connect.create_payout(
                    account_id=account_id,
                    amount_cents=sendable,
                    method="standard",
                    idempotency_key=f"sb_payout_po_std_{payout_id}",
                    metadata={
                        "swingby_business_id": business_id,
                        "swingby_payout_id": payout_id,
                    },
                )
            except (stripe_connect.StripeConnectError, StripeNotConfigured) as exc2:
                _fail(str(exc2), stripe_transfer_id=transfer_id)
                raise _stripe_unavailable(exc2)
        else:
            _fail(str(exc), stripe_transfer_id=transfer_id)
            raise _stripe_unavailable(exc)

    status = payouts_service.map_stripe_payout_status(result.get("status"))
    arrival = result.get("arrival_date")
    arrival_iso = None
    if arrival:
        try:
            arrival_iso = datetime.fromtimestamp(
                int(arrival), tz=timezone.utc
            ).isoformat()
        except (TypeError, ValueError, OSError):
            arrival_iso = None

    update = {
        "status": status,
        "method": result.get("method") or method,
        "stripe_payout_id": result.get("id"),
        "stripe_transfer_id": transfer_id,
        "amount_cents": int(result.get("amount_cents") or sendable),
        "arrival_date": arrival_iso,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        supabase.table("payouts").update(update).eq("id", payout_id).execute()
    except Exception:
        logger.exception("payout %s sent but the row could not be updated", payout_id)

    logger.info(
        "payout %s: %d cents to %s via %s (status=%s)",
        payout_id,
        update["amount_cents"],
        account_id,
        update["method"],
        status,
    )

    return PayoutResult(
        id=payout_id,
        amount_cents=update["amount_cents"],
        currency=stripe_connect.DEFAULT_CURRENCY,
        status=status,
        method=update["method"],
        arrival_date=arrival_iso,
        stripe_payout_id=result.get("id"),
    )
