"""
test_payment_status_mirror.py — Bug 4 (walkthrough device pass).

Reported as: a booking the client had already paid for still showed a
PENDING pill ("pending payment · $195" next to "Accepted · $195 paid").

The report guessed this was interests.py:498's `payment_status = 'held'`
write silently failing inside its try/except. It wasn't — that write is real
and does fire, but ONLY on the Flow A branch ("if post_payment:"), which
exists for the charge-AT-POST flow. That flow is gated off in
api/service_posts.py (see CLAUDE.md — "Nothing is charged when a client
posts a job"), so in the live app `post_payment` is always None and that
line never runs.

The actual capture confirmation — for hosted Checkout, the native Payment
Sheet, and both Stripe webhook event types — funnels through exactly one
function: `_mark_payment_paid` in app/api/payments_stripe.py. Before this
fix, that function updated `payments.status` to 'held' but never touched
`bookings.payment_status`, which is the raw column some client screens read
directly. It sat on 'pending_payment' (the value written at booking
creation, interests.py:380) forever, until `/complete` overwrote it as a
side effect of a wholly different action.

`_attach_payment_state` (api/bookings.py) does NOT read that column — it
derives payment_state fresh from the payments ledger on every request, which
is why "Funds held in escrow" already rendered correctly right next to the
lying PENDING pill. Two readers of the same money, one derived correctly,
one reading a column nothing kept current.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.api import payments_stripe
from app.services import escrow

BOOKING_ID = "bk-mirror-1"


def _captured_payment(**overrides):
    row = {
        "id": "pay-mirror-1",
        "booking_id": BOOKING_ID,
        "total_charged": 195.0,
        "total_charged_cents": 19500,
        "released_to_business": 0.0,
        "released_to_business_cents": 0,
        "status": "pending_payment",
        "stripe_payment_intent_id": None,
    }
    row.update(overrides)
    return row


class _TableStub:
    """Per-table update capture — a table-name-agnostic single `captured`
    dict would let the new bookings.payment_status write clobber the
    payments ledger write (or vice versa), hiding exactly the kind of
    regression this test exists to catch."""

    def __init__(self, captured, payment_row, booking_data, raise_on_bookings=False):
        self._captured = captured
        self._payment_row = payment_row
        self._booking_data = booking_data
        self._raise_on_bookings = raise_on_bookings

    def __call__(self, name):
        return _Query(name, self)

    def record(self, name, payload):
        self._captured.setdefault(name, []).append(payload)


class _Query:
    def __init__(self, name, stub):
        self.name = name
        self.stub = stub
        self._payload = None

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def single(self):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def update(self, payload):
        self._payload = payload
        return self

    def execute(self):
        if self._payload is not None:
            self.stub.record(self.name, self._payload)
            if self.name == "bookings" and self.stub._raise_on_bookings:
                raise RuntimeError("simulated bookings write failure")
            return MagicMock(data=[self.stub._payment_row])
        if self.name == "bookings":
            return MagicMock(data=self.stub._booking_data)
        return MagicMock(data=[self.stub._payment_row])


def _run(payment_row, *, raise_on_bookings=False, amount_total_cents=19500):
    captured: dict = {}
    booking_data = {"total_amount": 195.0, "total_amount_cents": 19500}
    stub = _TableStub(
        captured, payment_row, booking_data, raise_on_bookings=raise_on_bookings
    )

    with patch.object(
        escrow, "load_single_payment", return_value=payment_row
    ), patch.object(
        payments_stripe, "supabase", MagicMock(table=stub)
    ), patch(
        "app.services.credits._existing_redemption_cents", return_value=0
    ), patch(
        "app.services.email.send_payment_receipt"
    ):
        payments_stripe._mark_payment_paid(
            BOOKING_ID,
            "cs_test_mirror",
            amount_total_cents=amount_total_cents,
            payment_intent_id="pi_mirror_1",
        )

    return captured


class TestCaptureMirrorsOntoBooking:
    def test_successful_capture_writes_held_onto_the_booking(self):
        captured = _run(_captured_payment())

        # The ledger itself is still correct (pre-existing behaviour).
        assert captured["payments"][-1]["status"] == "held"

        # Bug 4 — the raw column some screens read directly must advance too.
        assert "bookings" in captured, (
            "no write to bookings.payment_status at all — the PENDING pill "
            "bug is back"
        )
        assert captured["bookings"][-1] == {"payment_status": "held"}

    def test_a_failed_bookings_write_does_not_raise(self):
        """
        Webhooks must always 200 back to Stripe (idempotency requirement
        documented right above the payments-table try/except this mirrors).
        A DB hiccup mirroring the status onto the booking must be logged,
        not raised — raising here would turn a cosmetic staleness bug into a
        Stripe retry storm, which is a worse failure.
        """
        # Must not raise.
        captured = _run(_captured_payment(), raise_on_bookings=True)

        # The ledger write is the one that must not be sacrificed for this —
        # it still happened and still recorded the real capture.
        assert captured["payments"][-1]["status"] == "held"
        # The mirror was attempted (and is what raised, caught internally).
        assert "bookings" in captured

    def test_top_up_capture_also_mirrors_held(self):
        """The above-budget top-up branch (FINDING D) takes a different code
        path through _mark_payment_paid than a first, ordinary capture — both
        must reach the same mirror write."""
        already_captured = _captured_payment(
            status="held",
            stripe_payment_intent_id="pi_already",
            total_charged=150.0,
            total_charged_cents=15000,
        )
        captured = _run(already_captured, amount_total_cents=4500)

        assert captured["payments"][-1]["status"] == "held"
        assert captured["bookings"][-1] == {"payment_status": "held"}


class TestNoMirrorWithoutARealCapture:
    def test_replayed_terminal_payment_never_touches_bookings(self):
        """A payment already fully_released/refunded/paid_off_platform is the
        regression guard's job to skip entirely (pre-existing behaviour) — no
        payments write AND no bookings mirror for a replayed/stale event."""
        captured = _run(_captured_payment(status="fully_released"))

        assert "payments" not in captured
        assert "bookings" not in captured

    def test_amount_mismatch_mirrors_nothing(self):
        """A verification failure must settle neither table — the whole
        point is to leave the row exactly as it was for manual review."""
        captured = _run(_captured_payment(), amount_total_cents=100)  # wrong amount

        assert "payments" not in captured
        assert "bookings" not in captured
