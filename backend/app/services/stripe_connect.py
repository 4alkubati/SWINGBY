"""
stripe_connect.py — Stripe Connect (Express) helpers: onboarding and payouts.

D5. Kira's ruling 2026-08-04: *"a business needs to take the money out, and they
can in an instant."*

WHAT THIS FILE IS AND IS NOT
---------------------------
This is the Stripe-facing half of payouts. It knows how to create an Express
account, mint an onboarding link, read an account's KYC state, move platform
money onto a connected account, and send that money out to the business's card
or bank. It owns **no** money rules: every figure it moves is handed to it.
``app.services.escrow`` remains the only authority on what a business is owed
(10% platform cut, released at completion, gated on client approval or the 24h
auto-release), and ``app.api.payouts`` is the only place that decides how much
to send.

WHY EXPRESS AND NOT STANDARD OR CUSTOM
--------------------------------------
Express puts Stripe's own hosted onboarding — identity, bank/debit card, KYC —
behind one link, and Stripe carries the compliance obligation for collecting it.
Custom would make SwingBy responsible for building and maintaining that form.
Standard gives the business a full Stripe dashboard, which is wrong for a
tradesperson who has never heard of Stripe. Express is also the only tier where
Stripe's instant-payout eligibility is exposed per external account.

THE TWO-STEP MOVE, AND WHY IT IS TWO STEPS
------------------------------------------
Client money is captured into the PLATFORM account (charge-before-service, see
``escrow``). It does not sit on the business's Connect account, so "pay the
business" is two Stripe calls, not one:

    1. ``Transfer``  platform available balance -> connected account
    2. ``Payout``    connected account          -> the business's card/bank

Step 1 is the moment the money stops being SwingBy's. That is why
``payouts.stripe_transfer_id`` — not the row's status — is what decrements a
business's available balance: if step 2 fails, the money is already theirs and
is sitting on their connected account waiting for the next attempt.

INSTANT vs STANDARD
-------------------
Instant is not a setting we turn on; it is a property of the destination.
Stripe reports it per external account as ``available_payout_methods``. A debit
card that supports it lists ``"instant"``; a bank account does not. So
:func:`payout_capability` ASKS rather than assumes, and the caller must tell the
user which rail they actually got. Copy that says "instant" over a standard
bank payout is a lie with a 1–3 business-day tail on it.

TEST MODE
---------
The entire beta runs on ``sk_test_``. Nothing here is live-mode specific and
nothing needs a real incorporated company: Stripe test mode accepts synthetic
identity data (SSN ``000-00-0000``, the ``4000 0566 5566 5556`` debit card,
etc.) and will flip an Express account to ``payouts_enabled`` against it. That
is deliberate — it is what lets this whole path be built and exercised before
the legal entity exists.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.services.stripe_service import StripeNotConfigured, _require_stripe

logger = logging.getLogger(__name__)


class StripeConnectError(RuntimeError):
    """A Connect call failed. Carries Stripe's own message where there is one.

    Deliberately distinct from :class:`StripeNotConfigured`: "there is no Stripe
    key on this box" and "Stripe refused this payout" are different problems
    with different fixes, and the API layer answers them with different status
    codes (503 vs 502/400).
    """

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        self.code = code


# Express accounts are created for Canada — SwingBy is Calgary-first and the
# platform account itself is CA/CAD (verified against the live test account
# 2026-08-03). Passing the wrong country makes Stripe demand a different
# identity document set, so this is not a cosmetic default.
DEFAULT_COUNTRY = "CA"
DEFAULT_CURRENCY = "cad"


def _stripe():
    """The configured stripe SDK, or raise StripeNotConfigured."""
    return _require_stripe()


def _message(exc: Exception) -> str:
    """Stripe's human-readable error, falling back to the exception text."""
    user_message = getattr(exc, "user_message", None)
    if user_message:
        return str(user_message)
    return str(exc) or exc.__class__.__name__


def _code(exc: Exception) -> str | None:
    return getattr(exc, "code", None)


# ---------------------------------------------------------------------------
# Onboarding
# ---------------------------------------------------------------------------


def create_express_account(
    *,
    business_id: str,
    business_name: str | None = None,
    email: str | None = None,
    country: str = DEFAULT_COUNTRY,
) -> str:
    """Create an Express connected account and return its ``acct_…`` id.

    Only the ``transfers`` capability is requested. SwingBy charges the client
    on its OWN account and transfers the net onward, so the connected account
    never needs ``card_payments`` — asking for it would drag the business
    through card-acquiring underwriting it has no use for.

    ``business_id`` is stamped into metadata so an account found in the Stripe
    dashboard can be traced back without a database lookup.
    """
    stripe = _stripe()
    params: dict[str, Any] = {
        "type": "express",
        "country": country,
        "capabilities": {"transfers": {"requested": True}},
        "business_profile": {
            "product_description": "Local services booked via SwingBy"
        },
        "metadata": {"swingby_business_id": business_id},
        # Payouts are ours to trigger, not Stripe's to schedule. Kira's ruling is
        # that the business takes the money out when it wants to; a daily
        # automatic rolling payout would empty the balance behind their back and
        # make the wallet's "available" number wrong between refreshes.
        "settings": {"payouts": {"schedule": {"interval": "manual"}}},
    }
    if business_name:
        params["business_profile"]["name"] = business_name
    if email:
        params["email"] = email

    try:
        account = stripe.Account.create(**params)
    except Exception as exc:  # noqa: BLE001 — re-raised as our own type below
        logger.exception("stripe.Account.create failed for business %s", business_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    return account["id"]


def create_account_link(*, account_id: str, return_url: str, refresh_url: str) -> str:
    """Mint a single-use Express onboarding URL.

    Account links expire (minutes, not hours) and are consumed on use, so this
    is called every time the owner taps into onboarding — never cached, never
    stored. ``refresh_url`` is where Stripe sends someone whose link went stale;
    it has to lead back into a flow that calls this function again, or the
    person is stranded on a dead page.
    """
    stripe = _stripe()
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe.AccountLink.create failed for %s", account_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    return link["url"]


def create_login_link(*, account_id: str) -> str:
    """A link into the Express dashboard, where the owner manages their bank/card.

    Only valid once the account has completed onboarding; Stripe 400s otherwise,
    which is why the caller gates it on ``details_submitted``.
    """
    stripe = _stripe()
    try:
        link = stripe.Account.create_login_link(account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe.Account.create_login_link failed for %s", account_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc
    return link["url"]


def retrieve_account(account_id: str) -> dict[str, Any]:
    """Fetch a connected account. Raises StripeConnectError if Stripe refuses."""
    stripe = _stripe()
    try:
        return stripe.Account.retrieve(account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe.Account.retrieve failed for %s", account_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc


def account_status(account: dict[str, Any]) -> dict[str, Any]:
    """Flatten a Stripe Account into the fields the app and the DB mirror use.

    Pure — takes the object Stripe returned, does no I/O. That keeps the shape
    the wallet renders and the shape written to ``businesses`` provably
    identical, and makes every status permutation unit-testable without Stripe.

    ``requirements_due`` merges ``currently_due`` with ``past_due``: both are
    things the person must supply, and showing only one of them produces the
    "it says I'm done but payouts are off" dead end.
    """
    requirements = account.get("requirements") or {}
    currently_due = list(requirements.get("currently_due") or [])
    past_due = list(requirements.get("past_due") or [])
    merged: list[str] = []
    for field in currently_due + past_due:
        if field not in merged:
            merged.append(field)

    return {
        "account_id": account.get("id"),
        "payouts_enabled": bool(account.get("payouts_enabled")),
        "charges_enabled": bool(account.get("charges_enabled")),
        "details_submitted": bool(account.get("details_submitted")),
        "disabled_reason": requirements.get("disabled_reason"),
        "requirements_due": merged,
    }


# ---------------------------------------------------------------------------
# Payout capability — instant, or standard, or nothing
# ---------------------------------------------------------------------------


def payout_capability(account_id: str) -> dict[str, Any]:
    """Which rails this account can actually be paid out on, right now.

    Returns ``{"instant": bool, "standard": bool, "instant_source": str|None}``.

    Read from the account's external accounts, because instant is a property of
    the DESTINATION and not of the platform: Stripe lists
    ``available_payout_methods`` per external account and only a supporting
    debit card carries ``"instant"``. A bank account gives ``standard`` alone.

    ``instant_source`` is the last4 of the card that would carry an instant
    payout, so the UI can name it instead of making an unattributed promise.
    """
    stripe = _stripe()
    try:
        externals = stripe.Account.list_external_accounts(account_id, limit=100)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe external account list failed for %s", account_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    instant = False
    standard = False
    instant_source: Optional[str] = None

    for ext in externals.get("data") or []:
        methods = ext.get("available_payout_methods") or []
        if "instant" in methods:
            instant = True
            if instant_source is None:
                instant_source = ext.get("last4")
        if "standard" in methods:
            standard = True
        # An external account that reports no methods at all is still a valid
        # standard destination on older API versions — treat its presence as
        # standard capability rather than reporting "no way to pay you" at a
        # business that has just added a bank account.
        if not methods:
            standard = True

    return {"instant": instant, "standard": standard, "instant_source": instant_source}


def available_balance_cents(account_id: str, currency: str = DEFAULT_CURRENCY) -> int:
    """The connected account's AVAILABLE (not pending) balance, in cents.

    Used as the payout amount. Reading it back from Stripe after the transfer —
    rather than paying out the number we just computed — is what makes a failed
    second step self-healing: money stranded on the connected account by an
    earlier failure is included in the next attempt instead of being lost track
    of. Pending balance is excluded because Stripe will refuse to pay it out.
    """
    stripe = _stripe()
    try:
        balance = stripe.Balance.retrieve(stripe_account=account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe.Balance.retrieve failed for %s", account_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    total = 0
    for entry in balance.get("available") or []:
        if (entry.get("currency") or "").lower() == currency.lower():
            total += int(entry.get("amount") or 0)
    return total


# ---------------------------------------------------------------------------
# Moving the money
# ---------------------------------------------------------------------------


def create_transfer(
    *,
    account_id: str,
    amount_cents: int,
    currency: str = DEFAULT_CURRENCY,
    idempotency_key: str,
    metadata: dict[str, str] | None = None,
) -> str:
    """Move ``amount_cents`` of PLATFORM balance onto a connected account.

    ``idempotency_key`` is required, not optional. This is the call that turns
    SwingBy's money into someone else's; a retry without a key sends it twice.
    The caller derives the key from the payout row's primary key, so a retry of
    the same payout is the same key and a genuinely new cash-out is a new one.
    """
    amount_cents = int(amount_cents)
    if amount_cents <= 0:
        raise StripeConnectError("Transfer amount must be greater than zero")

    stripe = _stripe()
    try:
        transfer = stripe.Transfer.create(
            amount=amount_cents,
            currency=currency,
            destination=account_id,
            metadata=metadata or {},
            idempotency_key=idempotency_key,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "stripe.Transfer.create failed: %d cents to %s", amount_cents, account_id
        )
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    return transfer["id"]


def create_payout(
    *,
    account_id: str,
    amount_cents: int,
    currency: str = DEFAULT_CURRENCY,
    method: str = "standard",
    idempotency_key: str,
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Send a connected account's balance to the business's card or bank.

    Returns ``{"id", "status", "method", "amount_cents", "arrival_date"}`` —
    with ``method`` read back off Stripe's response rather than echoed from the
    argument, because that is the only value that is true. If Stripe downgrades
    the rail, the caller must show the downgrade.
    """
    amount_cents = int(amount_cents)
    if amount_cents <= 0:
        raise StripeConnectError("Payout amount must be greater than zero")

    stripe = _stripe()
    try:
        payout = stripe.Payout.create(
            amount=amount_cents,
            currency=currency,
            method=method,
            metadata=metadata or {},
            stripe_account=account_id,
            idempotency_key=idempotency_key,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "stripe.Payout.create failed: %d cents on %s via %s",
            amount_cents,
            account_id,
            method,
        )
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    return {
        "id": payout["id"],
        "status": payout.get("status"),
        # Trust Stripe over our request. See docstring.
        "method": payout.get("method") or method,
        "amount_cents": int(payout.get("amount") or amount_cents),
        "arrival_date": payout.get("arrival_date"),
    }


def retrieve_payout(*, account_id: str, payout_id: str) -> dict[str, Any]:
    """Re-read a payout so a stale row can be settled on read.

    There is no APPLICATION scheduler on this deployment (Roadmap/STATUS.md §2;
    pg_cron exists but runs SQL only, and cannot call this), so a
    standard payout's days-long ``in_transit`` -> ``paid`` transition is picked
    up the next time the owner opens their wallet, not by a cron job.
    """
    stripe = _stripe()
    try:
        payout = stripe.Payout.retrieve(payout_id, stripe_account=account_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("stripe.Payout.retrieve failed for %s", payout_id)
        raise StripeConnectError(_message(exc), code=_code(exc)) from exc

    return {
        "id": payout["id"],
        "status": payout.get("status"),
        "method": payout.get("method"),
        "amount_cents": int(payout.get("amount") or 0),
        "arrival_date": payout.get("arrival_date"),
        "failure_message": payout.get("failure_message"),
    }


__all__ = [
    "StripeConnectError",
    "StripeNotConfigured",
    "DEFAULT_COUNTRY",
    "DEFAULT_CURRENCY",
    "create_express_account",
    "create_account_link",
    "create_login_link",
    "retrieve_account",
    "account_status",
    "payout_capability",
    "available_balance_cents",
    "create_transfer",
    "create_payout",
    "retrieve_payout",
]
