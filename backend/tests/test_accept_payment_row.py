"""One payments row per booking, and it has to be the row holding the money.

`payments.booking_id` is UNIQUE (payments_booking_id_key) and both payments.py
and bookings.py `.single()` on it, so "which row does this booking get" has
exactly one right answer:

    Flow A (Post + Pay)   -> the charge-at-post row, re-pointed at the booking
    Flow B (browse+book)  -> a fresh row saying nothing has been captured yet

The bug these tests pin: accept inserted the Flow B row unconditionally and
only THEN tried to re-point the Flow A row at the same booking. The UNIQUE
constraint rejected that second write, the surrounding `except` swallowed it,
and the client's captured money stayed orphaned on the post while the booking
carried a row claiming nothing had been paid. `trigger_on_accept` then read
that empty row, concluded the booking was unpaid, and charged the client a
SECOND time for a job they had already paid for.

Nothing in production had exercised Flow A yet (0 post-bound payments rows), so
this was latent, not historical — it would have fired on the first real
Post + Pay.
"""

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from app.services import payment_triggers, refunds
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "client@example.com",
}

POST = {
    "id": "post-1",
    "client_id": "client-1",
    "budget": 150.0,
    "category": "Cleaning",
    "status": "open",
    "preferred_date": None,
}


def _post_payment(**over):
    """The row Flow A wrote when the client paid their $150 budget at posting."""
    row = {
        "id": "pay-post-1",
        "post_id": "post-1",
        "booking_id": None,
        "stripe_payment_intent_id": "pi_captured_1",
        "total_charged_cents": 15000,
        "escrow_held_cents": 15000,
        "released_to_business_cents": 0,
        "platform_cut_cents": 0,
        "refunded_cents": 0,
        "status": "held",
    }
    row.update(over)
    return row


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _stubs(quoted_price=100.0):
    booking_row = {
        "id": "booking-1",
        "client_id": "client-1",
        "business_id": "biz-1",
        "status": "confirmed",
        "payment_status": "pending_payment",
        "total_amount_cents": int(quoted_price * 100),
    }
    return {
        "interests": SupabaseTableStub(
            select_data={
                "id": "interest-1",
                "post_id": "post-1",
                "business_id": "biz-1",
                "status": "pending",
                "quoted_price": quoted_price,
            },
            update_data=[{"id": "interest-1", "status": "accepted"}],
        ),
        "service_posts": SupabaseTableStub(
            select_data=POST, update_data=[{**POST, "status": "matched"}]
        ),
        "businesses": SupabaseTableStub(select_data=None),
        "bookings": SupabaseTableStub(
            insert_data=[booking_row], update_data=[booking_row]
        ),
        "messages": SupabaseTableStub(update_data=[]),
        "payments": SupabaseTableStub(
            insert_data=[{"id": "pay-new-1"}],
            update_data=[
                _post_payment(booking_id="booking-1", platform_cut_cents=1000)
            ],
        ),
        "booking_events": SupabaseTableStub(insert_data=[{"id": "evt-1"}]),
        "users": SupabaseTableStub(select_data=None),
    }


def _method_names(stub):
    return [c[0] for c in stub.calls]


def _payloads(stub, method):
    return [c[1][0] for c in stub.calls if c[0] == method and c[1]]


def _accept(test_client, stubs, *, post_payment, refund_side_effect=None):
    """Run POST /interests/interest-1/accept with Flow A/B decided by
    `post_payment` (None = Flow B), and Stripe never actually called."""
    with patch("app.api.interests.supabase") as sb, patch.object(
        refunds, "load_post_payment", return_value=post_payment
    ), patch.object(
        refunds, "refund_payment_row", side_effect=refund_side_effect
    ) as refund, patch.object(
        payment_triggers, "trigger_on_accept", return_value={}
    ) as trigger:
        sb.table.side_effect = lambda name: stubs[name]
        res = test_client.patch("/interests/interest-1/accept")
    return res, refund, trigger


class TestFlowAReusesTheRowThatHoldsTheMoney:
    def test_no_second_payments_row_is_inserted(self, test_client, as_client):
        stubs = _stubs()
        res, _, _ = _accept(test_client, stubs, post_payment=_post_payment())

        assert res.status_code == 200, res.text
        # The whole bug in one assertion: inserting here is what created the
        # second row the UNIQUE constraint then rejected.
        assert "insert" not in _method_names(stubs["payments"])

    def test_the_captured_row_is_bound_to_the_booking(self, test_client, as_client):
        stubs = _stubs()
        res, _, _ = _accept(test_client, stubs, post_payment=_post_payment())

        assert res.status_code == 200, res.text
        (bind,) = _payloads(stubs["payments"], "update")
        assert bind["booking_id"] == "booking-1"
        # settle_on_accept: 10% of the ACCEPTED 10000c, not of the 15000c budget.
        # settle_at_post deliberately took no cut, so this is where it lands.
        assert bind["platform_cut_cents"] == 1000

    def test_the_ledger_is_not_overwritten_with_money_that_has_not_moved(
        self, test_client, as_client
    ):
        """total_charged / escrow_held describe what was actually captured.

        Writing settle_on_accept's figures straight onto the row would claim
        the accepted amount was collected before any refund had been issued —
        FINDING C. refund_payment_row walks escrow down instead.
        """
        stubs = _stubs()
        res, _, _ = _accept(test_client, stubs, post_payment=_post_payment())

        assert res.status_code == 200, res.text
        (bind,) = _payloads(stubs["payments"], "update")
        assert "total_charged_cents" not in bind
        assert "escrow_held_cents" not in bind
        # A row that already describes real captured money must not be relabelled
        # with the accept-time 'pending_payment' vocabulary.
        assert "status" not in bind

    def test_the_under_budget_difference_is_refunded(self, test_client, as_client):
        stubs = _stubs()
        res, refund, _ = _accept(test_client, stubs, post_payment=_post_payment())

        assert res.status_code == 200, res.text
        assert refund.call_args.kwargs["amount_cents"] == 5000  # 150 - 100
        assert refund.call_args.kwargs["reason"] == refunds.REASON_UNDER_BUDGET
        assert res.json()["refunded_cents"] == 5000

    def test_the_booking_stops_claiming_it_is_unpaid(self, test_client, as_client):
        stubs = _stubs()
        res, _, _ = _accept(test_client, stubs, post_payment=_post_payment())

        assert res.status_code == 200, res.text
        assert {"payment_status": "held"} in _payloads(stubs["bookings"], "update")

    def test_an_uncaptured_post_row_does_not_get_marked_held(
        self, test_client, as_client
    ):
        """A row that merely *says* held with no PaymentIntent is not paid."""
        stubs = _stubs()
        res, _, _ = _accept(
            test_client,
            stubs,
            post_payment=_post_payment(stripe_payment_intent_id=None),
        )

        assert res.status_code == 200, res.text
        assert {"payment_status": "held"} not in _payloads(stubs["bookings"], "update")


class TestABrokenRefundStillLeavesTheBookingPayable:
    def test_binding_survives_a_stripe_failure(self, test_client, as_client):
        """The binding must not ride on the refund succeeding.

        Readers find a payment by booking_id. If a Stripe hiccup could skip the
        bind, an already-paid booking would read as unpaid and /complete would
        refuse to release it — while trigger_on_accept charged the client again.
        """
        stubs = _stubs()
        res, _, _ = _accept(
            test_client,
            stubs,
            post_payment=_post_payment(),
            refund_side_effect=RuntimeError("stripe is down"),
        )

        assert res.status_code == 200, res.text
        (bind,) = _payloads(stubs["payments"], "update")
        assert bind["booking_id"] == "booking-1"
        # Still no second row, and the accept still stands.
        assert "insert" not in _method_names(stubs["payments"])
        # The refund did not happen, so the response must not claim it did.
        assert res.json()["refunded_cents"] == 0


class TestFlowBIsUnchanged:
    def test_a_fresh_unpaid_row_is_created(self, test_client, as_client):
        stubs = _stubs()
        res, refund, _ = _accept(test_client, stubs, post_payment=None)

        assert res.status_code == 200, res.text
        (row,) = _payloads(stubs["payments"], "insert")
        assert row["booking_id"] == "booking-1"
        assert row["total_charged_cents"] == 10000
        # Nothing is captured at accept, so nothing is held yet.
        assert row["escrow_held_cents"] == 0
        assert row["status"] == "pending_payment"
        # Nothing was pre-paid, so there is nothing to give back.
        refund.assert_not_called()
        assert res.json()["refunded_cents"] == 0
