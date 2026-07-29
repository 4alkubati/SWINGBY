"""Keeping the client's card, and knowing which card it was.

`ensure_customer` has always built the shelf — a persistent Stripe Customer per
user, reused on every payment, handed to the sheet with an ephemeral key so
saved cards render. Nothing was ever put on it: the PaymentIntent carried no
`setup_future_usage`, so Stripe discarded the card after each charge and the
sheet had nothing to show next time.

Two things make retention real, and both are asserted here:

  setup_future_usage='off_session'  Stripe KEEPS the card on the customer, and
                                    keeps it usable when the client is not
                                    present — which is what charge-at-post
                                    needs. 'on_session' would save the card and
                                    then refuse that exact use.
  default_payment_method_id         SwingBy can NAME the card later instead of
                                    listing the customer's methods and guessing.

Consent note, because it is a real constraint and not paperwork: this saves
without a Stripe checkbox, so the disclosure is ours. It is on the Payments
screen, which previously claimed clients "never have to hold a card on file".
"""

from unittest.mock import MagicMock, patch

from app.services import stripe_payment_sheet

BOOKING_UUID = "11111111-2222-3333-4444-555555555555"


def _fake_stripe():
    s = MagicMock()
    s.api_version = "2025-02-24.acacia"
    s.EphemeralKey.create.return_value = {"secret": "ek_1"}
    s.PaymentIntent.create.return_value = {"id": "pi_1", "client_secret": "pi_1_sec"}
    return s


def _build_sheet(stripe):
    with patch.object(
        stripe_payment_sheet, "_stripe", return_value=stripe
    ), patch.object(
        stripe_payment_sheet, "ensure_customer", return_value="cus_1"
    ), patch.object(
        stripe_payment_sheet, "publishable_key", return_value="pk_test_1"
    ):
        return stripe_payment_sheet.create_payment_sheet(
            booking_id=BOOKING_UUID,
            amount_cents=20000,
            description="SwingBy — Cleaning",
            user_id="client-1",
            email="jane@example.com",
            name="Jane Client",
        )


class TestTheCardIsKept:
    def test_the_intent_asks_stripe_to_keep_the_card(self):
        stripe = _fake_stripe()
        _build_sheet(stripe)

        kwargs = stripe.PaymentIntent.create.call_args.kwargs
        assert kwargs["setup_future_usage"] == "off_session"

    def test_it_is_off_session_not_on_session(self):
        """'on_session' saves the card and then refuses the one use we need.

        Charge-at-post fires while the client is posting a job, not standing at
        a payment sheet. A card saved 'on_session' cannot be charged then.
        """
        stripe = _fake_stripe()
        _build_sheet(stripe)

        assert (
            stripe.PaymentIntent.create.call_args.kwargs["setup_future_usage"]
            != "on_session"
        )

    def test_the_customer_is_still_attached(self):
        """setup_future_usage without a customer has nothing to save the card to."""
        stripe = _fake_stripe()
        _build_sheet(stripe)

        assert stripe.PaymentIntent.create.call_args.kwargs["customer"] == "cus_1"

    def test_the_user_is_still_named_on_the_metadata(self):
        """The webhook needs it to remember the card against the right user."""
        stripe = _fake_stripe()
        _build_sheet(stripe)

        meta = stripe.PaymentIntent.create.call_args.kwargs["metadata"]
        assert meta["swingby_user_id"] == "client-1"
        assert meta["booking_id"] == BOOKING_UUID


class TestRememberingWhichCard:
    def test_the_payment_method_is_written_to_the_user(self):
        with patch.object(stripe_payment_sheet, "supabase") as sb:
            stripe_payment_sheet.remember_payment_method(
                user_id="client-1", payment_method_id="pm_123"
            )

        table = sb.table.return_value
        table.update.assert_called_once_with({"default_payment_method_id": "pm_123"})
        table.update.return_value.eq.assert_called_once_with("id", "client-1")

    def test_nothing_is_written_without_a_card(self):
        with patch.object(stripe_payment_sheet, "supabase") as sb:
            stripe_payment_sheet.remember_payment_method(
                user_id="client-1", payment_method_id=None
            )
        sb.table.assert_not_called()

    def test_nothing_is_written_without_a_user(self):
        with patch.object(stripe_payment_sheet, "supabase") as sb:
            stripe_payment_sheet.remember_payment_method(
                user_id="", payment_method_id="pm_123"
            )
        sb.table.assert_not_called()

    def test_a_failed_write_never_breaks_a_captured_payment(self):
        """Stripe already took the money; bookkeeping must not raise over it."""
        with patch.object(stripe_payment_sheet, "supabase") as sb:
            sb.table.side_effect = RuntimeError("supabase down")
            # Must not raise.
            stripe_payment_sheet.remember_payment_method(
                user_id="client-1", payment_method_id="pm_123"
            )


class TestTheIntentReadbackCarriesTheCard:
    def test_retrieve_exposes_the_payment_method(self):
        """Read back from Stripe, not taken from the device — same rule as
        status and amount_received."""
        stripe = MagicMock()
        stripe.PaymentIntent.retrieve.return_value = {
            "id": "pi_1",
            "status": "succeeded",
            "amount_received": 20000,
            "payment_method": "pm_123",
            "metadata": {"booking_id": BOOKING_UUID},
        }
        with patch.object(stripe_payment_sheet, "_stripe", return_value=stripe):
            out = stripe_payment_sheet.retrieve_payment_intent("pi_1")

        assert out["payment_method"] == "pm_123"
        assert out["booking_id"] == BOOKING_UUID
