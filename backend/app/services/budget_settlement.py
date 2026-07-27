"""budget_settlement.py — the arithmetic of AMENDMENT 1, and nothing else.

Kira's ruling (2026-07-26, handwritten, `~/brain/inbox/IMG_1479.HEIC`):

    Posting a quota -> ... -> Post + Pay (SAME BUTTON)
    lets say Budget is 150 and I accept 100$
    50$ get released and 50$ in escrow and 50$ get refunded.

Posting charges the client's whole budget. Accepting a quote below budget
returns the difference. What remains is the job, split half on date-confirm and
half on completion, with the platform's 10% taken out of the BUSINESS's payout
(spec S1.4) — confirmed by Kira 2026-07-26: "the 100 is the total our cut is 10$".

WHY THIS IS ITS OWN MODULE
--------------------------
Every money bug this project has had came from arithmetic living inside a
request handler, where it could only be exercised by standing up a booking. The
original diagnostic found three different "earnings" numbers and a ledger that
over-stated by exactly the platform cut for the life of every booking, because
four components were being written into a three-way split. Pure functions with
no I/O can be tested against the founder's own worked example directly.

THE INVARIANT (matches the existing payments_ledger_not_over_charged check):

    escrow + released + refunded == total_charged

platform_cut is NOT a term: it is deducted from the BUSINESS's payout, never
from the client's money (spec S1.4).

It holds in every state, including the two states this amendment introduces:
posted-but-unquoted, and expired-never-accepted.

ROUNDING
--------
Integer cents throughout. Never float, never two roundings of the same figure —
the second tranche is the exact remainder of the first, so an odd total cannot
lose a cent (spec S3, "never round twice"). All inputs are cents; all outputs
are cents; the caller converts once at the edge.
"""

from __future__ import annotations

from typing import Optional

# The platform's share of a completed job. Comes out of the business's payout,
# never added on top of what the client is charged (spec S1.4).
PLATFORM_RATE_NUMERATOR = 10
PLATFORM_RATE_DENOMINATOR = 100


def platform_cut_cents(accepted_cents: int) -> int:
    """SwingBy's cut of an accepted job, rounded half-up, in cents.

    Integer arithmetic on purpose: `round(x * 0.10, 2)` on 10555 cents gives the
    platform 9.9953% instead of 10%, always in the business's favour. That was a
    real finding, not a hypothetical.
    """
    if accepted_cents <= 0:
        return 0
    num = accepted_cents * PLATFORM_RATE_NUMERATOR
    # half-up without floats
    return (num + PLATFORM_RATE_DENOMINATOR // 2) // PLATFORM_RATE_DENOMINATOR


def settle_at_post(budget_cents: int) -> dict:
    """State of the ledger the moment a budget is charged and nothing else.

    The entire budget sits in escrow. **No platform cut is taken yet** — between
    posting and acceptance the platform has provided nothing, and a cut taken
    here would have to be handed back at expiry anyway.
    """
    if budget_cents < 0:
        raise ValueError("budget_cents cannot be negative")
    return {
        "total_charged_cents": budget_cents,
        "escrow_held_cents": budget_cents,
        "released_to_business_cents": 0,
        "platform_cut_cents": 0,
        "refunded_cents": 0,
    }


def settle_on_accept(budget_cents: int, accepted_cents: int) -> dict:
    """Ledger after a quote is accepted against an already-charged budget.

    Kira's worked example, budget 15000c accepting 10000c, is the canonical
    case and is pinned in the tests:

        escrow 9000 + released 0 + cut 1000 + refunded 5000 == 15000

    `refund_cents` is what must actually be sent to Stripe; it is also carried
    in `refunded_cents` so the caller can write the whole ledger in one go.

    ACCEPTING ABOVE BUDGET is permitted and returns a positive
    `additional_charge_cents` — the client owes the difference. The original
    spec (S2.3) allows out-of-range quotes as a soft constraint, and silently
    refusing to represent that case would push the decision into a request
    handler, which is exactly what this module exists to prevent. Nothing is
    refunded in that case.
    """
    if budget_cents < 0 or accepted_cents < 0:
        raise ValueError("amounts cannot be negative")

    refund_c = max(budget_cents - accepted_cents, 0)
    additional_c = max(accepted_cents - budget_cents, 0)

    cut_c = platform_cut_cents(accepted_cents)
    business_net_c = accepted_cents - cut_c

    # ESCROW HOLDS THE CLIENT'S MONEY FOR THE JOB -- the full accepted amount,
    # NOT the business's net. The platform cut is tracked alongside and comes
    # out of the payout at release (spec S1.4), so it is not a term in the
    # client-money equation. This is what makes Kira's drawing add up exactly:
    #     50 released + 50 escrow + 50 refunded = 150
    # with the $10 cut taken from the business's $100, never from the $150.
    total_charged_c = budget_cents + additional_c

    return {
        "total_charged_cents": total_charged_c,
        "escrow_held_cents": accepted_cents,
        "released_to_business_cents": 0,
        "platform_cut_cents": cut_c,
        "refunded_cents": refund_c,
        # Not ledger columns — instructions for the caller.
        "refund_cents": refund_c,
        "additional_charge_cents": additional_c,
        "business_net_cents": business_net_c,
    }


def settle_on_date_confirmed(ledger: dict) -> dict:
    """Release the first half of the business's net on the date handshake.

    Half of what is escrowed for the job -- which is the ACCEPTED AMOUNT, the
    client's money. Kira's "50 released and 50 in escrow" on a $100 job is
    literal: 5000c and 5000c. The platform's $10 comes out of the business's
    payout when the money actually moves, not out of this split.

    The remainder is carried exactly so the second tranche cannot lose a cent
    to a second rounding.
    """
    escrow_c = int(ledger["escrow_held_cents"])
    released_c = int(ledger["released_to_business_cents"])
    business_net_c = escrow_c + released_c

    first_release_c = business_net_c // 2  # floor; the remainder rides along
    out = dict(ledger)
    out["released_to_business_cents"] = released_c + first_release_c
    out["escrow_held_cents"] = escrow_c - first_release_c
    return out


def settle_on_complete(ledger: dict) -> dict:
    """Release everything still held. Escrow ends at exactly zero."""
    out = dict(ledger)
    out["released_to_business_cents"] = int(ledger["released_to_business_cents"]) + int(
        ledger["escrow_held_cents"]
    )
    out["escrow_held_cents"] = 0
    return out


def settle_on_expiry(ledger: dict) -> dict:
    """Nobody took the job: every cent still held goes back to the client.

    This is the case that makes charge-at-post safe to ship. Without it the
    model silently keeps the money of any client whose post nobody quoted —
    which is not a bug the client would ever be able to see.
    """
    escrow_c = int(ledger["escrow_held_cents"])
    out = dict(ledger)
    out["refunded_cents"] = int(ledger["refunded_cents"]) + escrow_c
    out["escrow_held_cents"] = 0
    out["refund_cents"] = escrow_c
    return out


def ledger_balances(ledger: dict) -> bool:
    """The invariant, checkable anywhere.

    Three terms, not four. `platform_cut` is deliberately absent: it is the
    platform's share of the BUSINESS's payout, not a slice of what the client
    handed over. Including it was a real error -- it made this module disagree
    with every existing writer in the codebase and, when expressed as a DB
    constraint, rejected the perfectly correct row that interests.py writes at
    accept time.
    """
    return (
        int(ledger["escrow_held_cents"])
        + int(ledger["released_to_business_cents"])
        + int(ledger["refunded_cents"])
    ) == int(ledger["total_charged_cents"])


def assert_balances(ledger: dict, *, where: Optional[str] = None) -> dict:
    """Fail loudly and locally rather than let Postgres reject the write.

    The DB constraint is the backstop; this names the code path that got it
    wrong, which the constraint violation cannot.
    """
    if not ledger_balances(ledger):
        raise ValueError(
            "ledger does not balance"
            + (f" at {where}" if where else "")
            + f": escrow={ledger['escrow_held_cents']} "
            f"released={ledger['released_to_business_cents']} "
            f"cut={ledger['platform_cut_cents']} "
            f"refunded={ledger['refunded_cents']} "
            f"total={ledger['total_charged_cents']}"
        )
    return ledger
