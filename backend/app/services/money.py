"""
money.py — the single money type for SwingBy (PAYMENT-MODEL.md §3).

Every monetary value in the booking/payment paths goes through this module.
Rules, straight from the spec:

  - All amounts are `Decimal`, quantized to 2 places, ROUND_HALF_UP, at every
    boundary: DB read, arithmetic, and Stripe conversion. No `float` anywhere
    in this module.
  - `platform_cut` and `first_release` are rounded once. `business_net` and
    `second_release` are the *exact remainder* — never a second rounding.
    Rounding twice loses a cent on odd totals (e.g. $33.33, $105.55).
  - Currency is CAD, explicit, not hardcoded three times.

This module intentionally does no I/O — callers own DB reads/writes and the
Stripe SDK call; this module only owns the arithmetic and the boundary
conversions (`to_decimal` in, `to_cents`/`to_db_string` out).
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import NamedTuple, Union

CURRENCY = "CAD"

_TWO_PLACES = Decimal("0.01")
_CENTS = Decimal("100")

PLATFORM_CUT_RATE = Decimal("0.10")
FIRST_RELEASE_RATE = Decimal("0.50")

Amount = Union[Decimal, str, int, float]


class MoneyError(ValueError):
    """Raised when a monetary input can't be trusted (bad type, >2dp, <=0)."""


def to_decimal(value: Amount) -> Decimal:
    """Coerce any numeric input to a `Decimal`. Does NOT quantize — use
    `quantize()` once you've decided rounding is appropriate (i.e. not for
    validating raw user input, where extra precision should be REJECTED, not
    silently rounded away — see `validate_two_decimal_places`)."""
    if value is None:
        raise MoneyError("amount is required")
    if isinstance(value, Decimal):
        return value
    try:
        # str(float) round-trips exactly what Python printed for the float,
        # which is what a JSON body would have contained — never construct
        # Decimal directly from a float (binary rounding noise).
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise MoneyError(f"not a valid amount: {value!r}") from exc


def quantize(value: Amount) -> Decimal:
    """Coerce to Decimal and round to 2 places, ROUND_HALF_UP. This is the
    standard boundary conversion for a DB read or an intermediate arithmetic
    result."""
    return to_decimal(value).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def validate_two_decimal_places(value: Amount) -> Decimal:
    """Validate that user-supplied input (e.g. a quoted price) carries at
    most 2 decimal places, per PAYMENT-MODEL.md §3 ("quoted_price must be
    validated to 2 decimal places on input"). Rejects extra precision instead
    of silently rounding it away — a $105.555 quote is a client bug, not a
    rounding opportunity.
    """
    d = to_decimal(value)
    exponent = d.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise MoneyError("amount must have at most 2 decimal places")
    if d <= 0:
        raise MoneyError("amount must be greater than zero")
    return d.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


def to_cents(value: Amount) -> int:
    """Stripe conversion boundary: `int((amount * 100).to_integral_value(ROUND_HALF_UP))`,
    per PAYMENT-MODEL.md §5."""
    d = quantize(value)
    return int((d * _CENTS).to_integral_value(rounding=ROUND_HALF_UP))


def to_db_string(value: Decimal) -> str:
    """DB write boundary: render a quantized Decimal as a fixed-point string
    (e.g. "12.34"), never a float, so a numeric column receives exactly the
    digits we computed instead of a binary-float round-trip."""
    if not isinstance(value, Decimal):
        value = quantize(value)
    return f"{value:.2f}"


class LedgerSplit(NamedTuple):
    """The three-way partition of a charge, per PAYMENT-MODEL.md §3.

    Invariant, in every state: escrow_held + released_to_business +
    platform_cut == total_charged. This tuple is the *terminal* split (as if
    the job were already complete); callers derive the escrow_held for
    intermediate states themselves (see derive_ledger docstring).
    """

    total_charged: Decimal
    platform_cut: Decimal
    business_net: Decimal
    first_release: Decimal
    second_release: Decimal


def derive_ledger(total_charged: Amount) -> LedgerSplit:
    """The one true derivation of the money split for a card-paid booking.

    ```
    total_charged  = the accepted quote amount
    platform_cut   = round(total_charged * 0.10, 2)
    business_net   = total_charged - platform_cut          # exact, no 2nd round
    first_release  = round(business_net * 0.50, 2)
    second_release = business_net - first_release          # exact remainder
    ```

    Never round `second_release` as `round(business_net * 0.5, 2)` again —
    that's the bug this spec exists to kill. Use the remainder.

    Callers combine these with the state table (PAYMENT-MODEL.md §3) to get
    the row values for each event:

      Charge captured : escrow_held=business_net,              released=0,              platform_cut=cut
      Date confirmed  : escrow_held=business_net-first_release, released=first_release,  platform_cut=cut
      Job completed   : escrow_held=0,                          released=business_net,   platform_cut=cut
    """
    total = quantize(total_charged)
    if total <= 0:
        raise MoneyError("total_charged must be greater than zero")

    platform_cut = quantize(total * PLATFORM_CUT_RATE)
    business_net = total - platform_cut  # exact — do not re-round
    first_release = quantize(business_net * FIRST_RELEASE_RATE)
    second_release = business_net - first_release  # exact remainder — do not re-round

    return LedgerSplit(
        total_charged=total,
        platform_cut=platform_cut,
        business_net=business_net,
        first_release=first_release,
        second_release=second_release,
    )


def assert_ledger_balances(
    escrow_held: Amount,
    released_to_business: Amount,
    platform_cut: Amount,
    total_charged: Amount,
) -> None:
    """The §3 invariant, as a callable assertion so tests (and, if wanted,
    a defensive check right before a write) share one implementation."""
    lhs = (
        quantize(escrow_held) + quantize(released_to_business) + quantize(platform_cut)
    )
    rhs = quantize(total_charged)
    if lhs != rhs:
        raise MoneyError(
            f"ledger invariant violated: escrow_held({escrow_held}) + "
            f"released_to_business({released_to_business}) + platform_cut({platform_cut}) "
            f"= {lhs} != total_charged({rhs})"
        )
