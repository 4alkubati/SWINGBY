"""Accepting above budget: charge the difference, and record it when it lands.

Kira's ruling (2026-07-28). A Post + Pay client had their whole budget captured
at posting. If the quote they accept comes in ABOVE that budget, the difference
is still owed — `settle_on_accept` computed it as `additional_charge_cents` and,
until now, nothing anywhere read that key. The business was simply under-paid.

Two halves, and neither works alone:

  trigger_on_accept   asks Stripe for the OUTSTANDING balance, not the whole
                      total (which would double-bill) and not nothing.
  _mark_payment_paid  expects that outstanding figure and ADDS it to the row.
                      Without this the amount check rejects the top-up as a
                      mismatch, and the money sits captured at Stripe with
                      nothing recorded against it — FINDING C by another route.

The ordinary path — nothing captured yet — must be untouched by all of this,
which is what TestTheOrdinaryChargeIsUnchanged is for.
"""

from unittest.mock import MagicMock, patch

from app.api import payments_stripe
from app.services import escrow, payment_triggers

BOOKING = {"id": "bk-1", "total_amount_cents": 20000}  # accepted $200
CLIENT = {"id": "c1", "email": "c@x.co"}

FAKE_SESSION = {"id": "cs_1", "url": "https://stripe/checkout/cs_1"}


def _captured_budget(total=15000, refunded=0, **over):
    """The Flow A row: $150 budget captured at posting, bound to the booking."""
    row = {
        "id": "pay-1",
        "booking_id": "bk-1",
        "status": "held",
        "stripe_payment_intent_id": "pi_budget_1",
        "total_charged_cents": total,
        "escrow_held_cents": total - refunded,
        "released_to_business_cents": 0,
        "refunded_cents": refunded,
        "platform_cut_cents": 0,
    }
    row.update(over)
    return row


def _trigger(payment):
    with patch(
        "app.services.stripe_service.create_checkout_session",
        return_value=FAKE_SESSION,
    ) as session, patch.object(
        escrow, "load_single_payment", return_value=payment
    ), patch.object(
        payment_triggers, "supabase", MagicMock()
    ):
        res = payment_triggers.trigger_on_accept(booking=BOOKING, client=CLIENT)
    return res, session


class TestChargingTheDelta:
    def test_only_the_difference_is_charged(self):
        # $200 accepted against a $150 budget already captured -> ask for $50.
        res, session = _trigger(_captured_budget())

        assert res["triggered"] is True
        assert res["amount_cents"] == 5000
        assert res["already_paid_cents"] == 15000
        assert session.call_args.kwargs["amount_cad"] == 50.0

    def test_it_is_labelled_as_a_top_up(self):
        """A second charge for one job must be legible as one after the fact."""
        res, _ = _trigger(_captured_budget())
        assert res["reason"] == "charge_at_accept_delta"

    def test_a_refund_already_issued_counts_against_what_was_paid(self):
        # Budget 150 captured, 20 already refunded -> 130 paid, 70 outstanding.
        res, _ = _trigger(_captured_budget(refunded=2000))
        assert res["amount_cents"] == 7000

    def test_a_quote_at_or_under_budget_is_never_charged_again(self):
        # Budget 150 captured, 150 accepted -> nothing outstanding.
        res, session = _trigger(_captured_budget(total=20000))
        assert res["triggered"] is False
        assert res["reason"] == "already_paid"
        session.assert_not_called()

    def test_a_capture_backed_row_with_no_amount_is_not_charged(self):
        """Under-charge beats double-charge when the shortfall is unknowable."""
        res, session = _trigger({"status": "held", "stripe_payment_intent_id": "pi_1"})
        assert res["triggered"] is False
        assert res["reason"] == "already_paid"
        session.assert_not_called()


class TestTheOrdinaryChargeIsUnchanged:
    def test_an_uncaptured_booking_is_charged_in_full(self):
        res, session = _trigger(None)

        assert res["triggered"] is True
        assert res["reason"] == "charge_at_accept"
        assert res["amount_cents"] == 20000
        assert session.call_args.kwargs["amount_cad"] == 200.0

    def test_a_row_that_merely_says_held_is_not_treated_as_paid(self):
        """No PaymentIntent means no capture, whatever the status column says.

        This is the row the accept-time insert produces before anybody pays.
        Reading it as paid is FINDING C.
        """
        res, _ = _trigger(
            _captured_budget(stripe_payment_intent_id=None, status="pending_payment")
        )
        assert res["triggered"] is True
        assert res["amount_cents"] == 20000
        assert res["already_paid_cents"] == 0


class TestRecordingTheTopUp:
    """_mark_payment_paid, the half that makes the money real."""

    def _run(self, payment, amount_cents, booking_total_cents=20000):
        booking_stub = MagicMock()
        booking_stub.data = {"total_amount_cents": booking_total_cents}

        table = MagicMock()
        captured = {}

        def _table(name):
            t = MagicMock()
            if name == "bookings":
                t.select.return_value.eq.return_value.single.return_value.execute.return_value = (
                    booking_stub
                )
            elif name == "payments":

                def _update(payload):
                    captured["update"] = payload
                    return MagicMock()

                t.update.side_effect = _update
            return t

        table.side_effect = _table

        with patch.object(payments_stripe, "supabase") as sb, patch.object(
            escrow, "load_single_payment", return_value=payment
        ), patch("app.services.credits._existing_redemption_cents", return_value=0):
            sb.table.side_effect = _table
            payments_stripe._mark_payment_paid(
                "bk-1",
                "cs_1",
                amount_total_cents=amount_cents,
                payment_intent_id="pi_2",
            )
        return captured.get("update")

    def test_the_outstanding_balance_is_accepted_not_rejected(self):
        # $50 top-up against a $200 booking with $150 already captured.
        update = self._run(_captured_budget(), 5000)

        assert update is not None, "the top-up was rejected as an amount mismatch"
        # total_charged grows by exactly what Stripe took — it is the only
        # figure that says how much the client handed over in total.
        assert update["total_charged_cents"] == 20000
        assert update["escrow_held_cents"] == 20000
        assert update["status"] == "held"

    def test_a_wrong_top_up_amount_is_still_refused(self):
        """The guard has to survive the generalisation, not be widened away."""
        update = self._run(_captured_budget(), 9999)
        assert update is None

    def test_a_prior_refund_is_not_swallowed_by_the_top_up(self):
        # 150 captured, 20 refunded -> 130 paid, 70 outstanding on a 200 job.
        update = self._run(_captured_budget(refunded=2000), 7000)

        assert update is not None
        assert update["total_charged_cents"] == 22000  # 15000 + 7000
        # Escrow is what is left after the refund: 22000 - 0 released - 2000.
        assert update["escrow_held_cents"] == 20000

    def test_an_ordinary_first_capture_is_unchanged(self):
        """Nothing capture-backed -> subtract 0 -> the old path exactly."""
        unpaid = {
            "id": "pay-1",
            "booking_id": "bk-1",
            "status": "pending_payment",
            "stripe_payment_intent_id": None,
            "total_charged_cents": 20000,
            "escrow_held_cents": 0,
            "released_to_business_cents": 0,
            "refunded_cents": 0,
        }
        update = self._run(unpaid, 20000)

        assert update is not None
        assert update["escrow_held_cents"] == 20000
        # The ordinary path does not rewrite total_charged.
        assert "total_charged_cents" not in update


class TestTheFirstCapturesIntentIdSurvivesTheTopUp:
    """SB-0094 — a top-up must not overwrite the id of the charge before it.

    `payments.stripe_payment_intent_id` is the ONLY Stripe reference column on
    the row. Everything else reads it (escrow.is_capture_backed, payouts,
    invoices, analytics_export) and only `_mark_payment_paid` writes it. When
    that write was unconditional, the delta capture's id replaced the budget
    capture's, and the larger charge became unrecoverable from the database —
    after which bookings.py refunded the FULL amount against an intent that had
    only ever captured the delta, Stripe refused, and the except logged
    "LEDGER SAYS REFUNDED, STRIPE DID NOT" while the client got nothing back.
    """

    _run = TestRecordingTheTopUp._run

    def test_the_budget_captures_id_is_not_replaced_by_the_delta(self):
        update = self._run(_captured_budget(), 5000)

        assert update is not None, "the top-up was rejected as an amount mismatch"
        # The money half must still be right — this is a guard, not a rollback.
        assert update["total_charged_cents"] == 20000
        # ...and the first capture's id must survive it. Either the key is
        # absent (nothing rewritten) or it still names the original charge.
        assert update.get("stripe_payment_intent_id", "pi_budget_1") == "pi_budget_1"

    def test_a_first_capture_still_records_its_id(self):
        """The guard must not stop the id being set the FIRST time."""
        unpaid = {
            "id": "pay-1",
            "booking_id": "bk-1",
            "status": "pending_payment",
            "stripe_payment_intent_id": None,
            "total_charged_cents": 20000,
            "escrow_held_cents": 0,
            "released_to_business_cents": 0,
            "refunded_cents": 0,
        }
        update = self._run(unpaid, 20000)

        assert update is not None
        assert update["stripe_payment_intent_id"] == "pi_2"

    def test_replaying_the_same_capture_is_not_treated_as_a_second_one(self):
        """Stripe retries webhooks. The same id arriving twice is not a top-up
        collision and must not log a reconciliation error."""
        same = _captured_budget()
        same["stripe_payment_intent_id"] = "pi_2"
        update = self._run(same, 5000)

        assert update is not None
        assert update.get("stripe_payment_intent_id", "pi_2") == "pi_2"
