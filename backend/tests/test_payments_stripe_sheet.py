"""
test_payments_stripe_sheet.py — M9, the NATIVE Stripe Payment Sheet.

M9 (walkthrough audit 2026-07-24): "Uber doesn't bounce you to a hosted page."
The client now pays inside the app via Stripe's Payment Sheet; hosted Checkout
survives only as a fallback.

What is pinned here, in priority order:

1. **The native path cannot be a way around the gates.** The new
   POST /payments/stripe/payment-intent/{booking_id} enforces the SAME
   preconditions hosted Checkout enforces — 404 / 403 / 400-cancelled /
   400-zero-amount — because a second payment entry point with looser checks is
   an authorization hole wearing a feature's clothes.

2. **Amount parity.** Both entry points resolve the charge through
   `_resolve_charge_amount`, so the same booking cannot be quoted two different
   totals depending on which sheet the client saw.

3. **One ledger path.** `payment_intent.succeeded` routes into the identical
   `_mark_payment_paid` used by `checkout.session.completed`. The native sheet
   added no new money math.

4. **No double settlement.** A PaymentIntent created BY hosted Checkout carries
   no booking_id metadata, so it lands as a no-op instead of settling a booking
   the session event already settled.

5. **No double charge.** An already-captured booking is refused (409) by BOTH
   entry points.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

BOOKING_UUID = "33333333-3333-3333-3333-333333333333"

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "jane@example.com",
}

OTHER_CLIENT = {
    "id": "client-2",
    "role": "client",
    "first_name": "Bob",
    "last_name": "Other",
    "email": "bob@example.com",
}

PAYABLE_BOOKING = {
    "id": BOOKING_UUID,
    "client_id": "client-1",
    "total_amount": 200.0,
    "service_category": "Cleaning",
    "status": "confirmed",
}

SHEET_PAYLOAD = {
    "payment_intent_id": "pi_native_1",
    "client_secret": "pi_native_1_secret_abc",
    "ephemeral_key": "ek_test_abc",
    "customer_id": "cus_test_abc",
    "publishable_key": "pk_test_abc",
    "amount_cents": 20000,
    "currency": "cad",
    "merchant_display_name": "SwingByy",
}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_other_client():
    _override(OTHER_CLIENT)
    yield OTHER_CLIENT
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def stripe_sheet_ready():
    """Stripe configured with a publishable key and a stubbed sheet builder."""
    from app.services import stripe_payment_sheet

    with patch.object(
        stripe_payment_sheet, "publishable_key", return_value="pk_test_abc"
    ), patch.object(
        stripe_payment_sheet, "create_payment_sheet", return_value=dict(SHEET_PAYLOAD)
    ) as builder:
        yield builder


def _post_intent(test_client):
    return test_client.post(
        f"/payments/stripe/payment-intent/{BOOKING_UUID}",
        headers={"Authorization": "Bearer test-token"},
    )


# ── 1 · The native path enforces the same gates as hosted Checkout ───────────


class TestPaymentIntentPreconditions:
    def test_missing_booking_404s(self, test_client, as_client, stripe_sheet_ready):
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(select_data=None)
            response = _post_intent(test_client)
        assert response.status_code == 404

    def test_non_owner_client_blocked(
        self, test_client, as_other_client, stripe_sheet_ready
    ):
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = _post_intent(test_client)
        assert response.status_code == 403

    def test_cancelled_booking_blocked(
        self, test_client, as_client, stripe_sheet_ready
    ):
        booking = dict(PAYABLE_BOOKING, status="cancelled")
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(select_data=booking)
            response = _post_intent(test_client)
        assert response.status_code == 400

    def test_zero_amount_blocked(self, test_client, as_client, stripe_sheet_ready):
        booking = dict(PAYABLE_BOOKING, total_amount=0)
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(select_data=booking)
            response = _post_intent(test_client)
        assert response.status_code == 400

    def test_no_publishable_key_is_503_not_a_stranded_intent(
        self, test_client, as_client
    ):
        """Without a publishable key the device cannot confirm the intent.

        Creating one anyway would leave a real PaymentIntent open in Stripe that
        nothing can ever complete. Refuse before calling Stripe at all — the
        mobile client reads 503 as "native unavailable" and falls back.
        """
        from app.services import stripe_payment_sheet

        with patch.object(
            stripe_payment_sheet, "publishable_key", return_value=""
        ), patch.object(stripe_payment_sheet, "create_payment_sheet") as builder, patch(
            "app.api.payments_stripe.supabase"
        ) as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = _post_intent(test_client)
        assert response.status_code == 503
        builder.assert_not_called()


# ── 2 · Happy path + amount parity with hosted Checkout ──────────────────────


class TestPaymentIntentHappyPath:
    def test_returns_the_three_things_the_sheet_needs(
        self, test_client, as_client, stripe_sheet_ready
    ):
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = _post_intent(test_client)

        assert response.status_code == 200
        body = response.json()
        assert body["client_secret"] == "pi_native_1_secret_abc"
        assert body["ephemeral_key"] == "ek_test_abc"
        assert body["customer_id"] == "cus_test_abc"
        assert body["publishable_key"] == "pk_test_abc"
        # Branding: the native sheet must say SwingByy, not "Stripe".
        assert body["merchant_display_name"] == "SwingByy"
        assert body["currency"] == "cad"

    def test_charges_the_booking_total_in_cents(
        self, test_client, as_client, stripe_sheet_ready
    ):
        with patch("app.api.payments_stripe.supabase") as mock_supabase:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            _post_intent(test_client)

        kwargs = stripe_sheet_ready.call_args.kwargs
        assert kwargs["amount_cents"] == 20000  # $200.00, no drift, no floats
        assert kwargs["booking_id"] == BOOKING_UUID
        assert kwargs["user_id"] == "client-1"

    def test_native_and_hosted_resolve_the_same_amount(self, as_client):
        """Amount parity — the guard against "which total is real?".

        Both entry points call `_resolve_charge_amount`. If a future edit gives
        one of them its own arithmetic, this fails.
        """
        from app.api import payments_stripe

        booking = dict(PAYABLE_BOOKING, total_amount=189.99)
        amount = payments_stripe._resolve_charge_amount(booking, BOOKING_UUID, CLIENT)
        assert amount == 189.99


# ── 5 · Neither entry point may start a SECOND charge ────────────────────────


class TestAlreadyPaidIsRefused:
    CAPTURED = {
        "id": "pay-1",
        "booking_id": BOOKING_UUID,
        "status": "held",
        "stripe_payment_intent_id": "pi_already_1",
        "total_charged_cents": 20000,
    }

    def _tables(self, payment):
        booking_stub = SupabaseTableStub(select_data=dict(PAYABLE_BOOKING))
        payment_stub = SupabaseTableStub(select_data=payment)

        def table(name):
            return payment_stub if name == "payments" else booking_stub

        return MagicMock(table=table)

    def test_native_sheet_refuses_an_already_captured_booking(
        self, test_client, as_client, stripe_sheet_ready
    ):
        with patch.object(
            __import__("app.api.payments_stripe", fromlist=["x"]),
            "supabase",
            self._tables(dict(self.CAPTURED)),
        ):
            response = _post_intent(test_client)
        assert response.status_code == 409
        assert "already_paid" in response.json()["detail"]
        stripe_sheet_ready.assert_not_called()

    def test_hosted_checkout_refuses_an_already_captured_booking(
        self, test_client, as_client
    ):
        """The fallback is guarded too.

        This is the path a legacy caller takes right after the native sheet has
        already taken the money. Before this guard it would cheerfully mint a
        second Checkout Session for a booking that was already paid.
        """
        with patch.object(
            __import__("app.api.payments_stripe", fromlist=["x"]),
            "supabase",
            self._tables(dict(self.CAPTURED)),
        ), patch(
            "app.services.stripe_service.create_checkout_session"
        ) as create_session:
            response = test_client.post(
                f"/payments/stripe/checkout/{BOOKING_UUID}",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 409
        create_session.assert_not_called()

    def test_a_pending_unpaid_row_does_not_block_payment(
        self, test_client, as_client, stripe_sheet_ready
    ):
        """The accept-time row says 'held' with NO PaymentIntent behind it.

        That is FINDING C's exact shape: it is NOT capture-backed and must not
        be mistaken for payment, or the client could never pay at all.
        """
        pending = {
            "id": "pay-1",
            "booking_id": BOOKING_UUID,
            "status": "pending_payment",
            "stripe_payment_intent_id": None,
        }
        with patch.object(
            __import__("app.api.payments_stripe", fromlist=["x"]),
            "supabase",
            self._tables(pending),
        ):
            response = _post_intent(test_client)
        assert response.status_code == 200


# ── 3 & 4 · The webhook: one ledger path, no double settlement ───────────────


class TestPaymentIntentWebhook:
    def _fire(self, test_client, event):
        with patch(
            "app.services.stripe_service.verify_webhook", return_value=event
        ), patch("app.api.payments_stripe.supabase") as mock_supabase, patch(
            "app.api.payments_stripe._mark_payment_paid"
        ) as mark_paid:
            mock_supabase.table.return_value = SupabaseTableStub(select_data=[])
            response = test_client.post(
                "/payments/stripe/webhook",
                data=b"{}",
                headers={"stripe-signature": "sig"},
            )
        return response, mark_paid

    def test_succeeded_settles_through_the_shared_ledger_function(self, test_client):
        event = {
            "id": "evt_pi_1",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_native_1",
                    "amount_received": 20000,
                    "metadata": {"booking_id": BOOKING_UUID},
                }
            },
        }
        response, mark_paid = self._fire(test_client, event)

        assert response.status_code == 200
        # Same function hosted Checkout uses — amount and PaymentIntent id are
        # passed through so amount verification and FINDING C traceability both
        # still apply to the native path.
        mark_paid.assert_called_once_with(BOOKING_UUID, None, 20000, "pi_native_1")

    def test_hosted_checkout_intent_is_a_no_op(self, test_client):
        """A PaymentIntent created by a Checkout Session has no booking_id.

        Checkout copies session metadata to the SESSION, not to the intent. So
        the hosted flow settles exactly once — via checkout.session.completed —
        and this event must not settle it a second time.
        """
        event = {
            "id": "evt_pi_2",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_from_checkout",
                    "amount_received": 20000,
                    "metadata": {},
                }
            },
        }
        response, mark_paid = self._fire(test_client, event)

        assert response.status_code == 200
        mark_paid.assert_not_called()

    def test_payment_failed_writes_nothing(self, test_client):
        """A decline must not touch the ledger — there is nothing to undo."""
        event = {
            "id": "evt_pi_3",
            "type": "payment_intent.payment_failed",
            "data": {
                "object": {
                    "id": "pi_declined",
                    "metadata": {"booking_id": BOOKING_UUID},
                }
            },
        }
        response, mark_paid = self._fire(test_client, event)

        assert response.status_code == 200
        mark_paid.assert_not_called()

    def test_malformed_succeeded_event_does_not_500(self, test_client):
        """Stripe retries non-2xx. A 500 here is a retry storm."""
        event = {
            "id": "evt_pi_4",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_weird"}},
        }
        response, mark_paid = self._fire(test_client, event)

        assert response.status_code == 200
        mark_paid.assert_not_called()


# ── The confirm endpoint: closes the webhook race, trusts nothing ────────────


class TestConfirmPaymentIntent:
    """POST /payments/stripe/payment-intent/{booking_id}/confirm

    The webhook is authoritative but not instant. Between the sheet closing and
    `payment_intent.succeeded` arriving, the booking still reads unpaid — and
    anything offering to "pay" in that window would charge twice. This endpoint
    closes the window, WITHOUT becoming a second ledger path and WITHOUT
    trusting a word the device says.
    """

    def _confirm(self, test_client, payment_intent_id="pi_native_1"):
        return test_client.post(
            f"/payments/stripe/payment-intent/{BOOKING_UUID}/confirm",
            json={"payment_intent_id": payment_intent_id},
            headers={"Authorization": "Bearer test-token"},
        )

    def test_succeeded_intent_settles_through_the_shared_ledger_function(
        self, test_client, as_client
    ):
        from app.services import stripe_payment_sheet

        with patch("app.api.payments_stripe.supabase") as mock_supabase, patch.object(
            stripe_payment_sheet,
            "retrieve_payment_intent",
            return_value={
                "id": "pi_native_1",
                "status": "succeeded",
                "amount_received": 20000,
                "booking_id": BOOKING_UUID,
            },
        ), patch("app.api.payments_stripe._mark_payment_paid") as mark_paid:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = self._confirm(test_client)

        assert response.status_code == 200
        assert response.json() == {"status": "succeeded", "settled": True}
        # Same ledger function as the webhook — not a parallel implementation.
        mark_paid.assert_called_once_with(BOOKING_UUID, None, 20000, "pi_native_1")

    def test_intent_belonging_to_another_booking_is_refused(
        self, test_client, as_client
    ):
        """The device does not get to say which booking an intent settles.

        Without this check a client could pay $5 for booking A and then post
        A's succeeded intent id against booking B to mark B paid for free.
        """
        from app.services import stripe_payment_sheet

        with patch("app.api.payments_stripe.supabase") as mock_supabase, patch.object(
            stripe_payment_sheet,
            "retrieve_payment_intent",
            return_value={
                "id": "pi_someone_else",
                "status": "succeeded",
                "amount_received": 500,
                "booking_id": "99999999-9999-9999-9999-999999999999",
            },
        ), patch("app.api.payments_stripe._mark_payment_paid") as mark_paid:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = self._confirm(test_client, "pi_someone_else")

        assert response.status_code == 400
        mark_paid.assert_not_called()

    def test_unsucceeded_intent_settles_nothing(self, test_client, as_client):
        from app.services import stripe_payment_sheet

        with patch("app.api.payments_stripe.supabase") as mock_supabase, patch.object(
            stripe_payment_sheet,
            "retrieve_payment_intent",
            return_value={
                "id": "pi_native_1",
                "status": "requires_payment_method",
                "amount_received": 0,
                "booking_id": BOOKING_UUID,
            },
        ), patch("app.api.payments_stripe._mark_payment_paid") as mark_paid:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = self._confirm(test_client)

        assert response.status_code == 200
        assert response.json()["settled"] is False
        mark_paid.assert_not_called()

    def test_non_owner_cannot_confirm(self, test_client, as_other_client):
        from app.services import stripe_payment_sheet

        with patch("app.api.payments_stripe.supabase") as mock_supabase, patch.object(
            stripe_payment_sheet, "retrieve_payment_intent"
        ) as retrieve, patch("app.api.payments_stripe._mark_payment_paid") as mark_paid:
            mock_supabase.table.return_value = SupabaseTableStub(
                select_data=dict(PAYABLE_BOOKING)
            )
            response = self._confirm(test_client)

        assert response.status_code == 403
        retrieve.assert_not_called()
        mark_paid.assert_not_called()


# ── The sheet builder itself ─────────────────────────────────────────────────


class TestCreatePaymentSheet:
    def test_intent_carries_booking_metadata_and_blocks_redirects(self):
        """Two non-negotiables on the PaymentIntent.

        * `metadata.booking_id` — without it the webhook cannot attribute the
          capture and the money is never recorded against the booking.
        * `allow_redirects: never` — a redirect-based method would bounce the
          client into a browser, which is the exact thing M9 removes.
        """
        from app.services import stripe_payment_sheet

        fake_stripe = MagicMock()
        fake_stripe.api_version = "2025-02-24.acacia"
        fake_stripe.EphemeralKey.create.return_value = {"secret": "ek_1"}
        fake_stripe.PaymentIntent.create.return_value = {
            "id": "pi_1",
            "client_secret": "pi_1_secret",
        }

        with patch.object(
            stripe_payment_sheet, "_stripe", return_value=fake_stripe
        ), patch.object(
            stripe_payment_sheet, "ensure_customer", return_value="cus_1"
        ), patch.object(
            stripe_payment_sheet, "publishable_key", return_value="pk_test_1"
        ):
            out = stripe_payment_sheet.create_payment_sheet(
                booking_id=BOOKING_UUID,
                amount_cents=20000,
                description="SwingBy — Cleaning",
                user_id="client-1",
                email="jane@example.com",
                name="Jane Client",
            )

        kwargs = fake_stripe.PaymentIntent.create.call_args.kwargs
        assert kwargs["amount"] == 20000
        assert kwargs["currency"] == "cad"
        assert kwargs["customer"] == "cus_1"
        assert kwargs["metadata"]["booking_id"] == BOOKING_UUID
        assert kwargs["automatic_payment_methods"]["allow_redirects"] == "never"
        # Default capture method = capture immediately, matching hosted Checkout
        # and charge-before-service. An authorize-only intent would silently
        # break the escrow model.
        assert "capture_method" not in kwargs

        assert out["client_secret"] == "pi_1_secret"
        assert out["ephemeral_key"] == "ek_1"
        assert out["customer_id"] == "cus_1"

    def test_zero_amount_refused_before_touching_stripe(self):
        from fastapi import HTTPException
        from app.services import stripe_payment_sheet

        fake_stripe = MagicMock()
        with patch.object(stripe_payment_sheet, "_stripe", return_value=fake_stripe):
            with pytest.raises(HTTPException) as exc:
                stripe_payment_sheet.create_payment_sheet(
                    booking_id=BOOKING_UUID,
                    amount_cents=0,
                    description="x",
                    user_id="client-1",
                )
        assert exc.value.status_code == 400
        fake_stripe.PaymentIntent.create.assert_not_called()

    def test_existing_customer_is_reused_not_recreated(self):
        """A remembered card is the point of passing a customer at all."""
        from app.services import stripe_payment_sheet

        fake_stripe = MagicMock()
        users_stub = SupabaseTableStub(select_data={"stripe_customer_id": "cus_saved"})

        with patch.object(
            stripe_payment_sheet, "_stripe", return_value=fake_stripe
        ), patch.object(
            stripe_payment_sheet, "supabase", MagicMock(table=lambda n: users_stub)
        ):
            cid = stripe_payment_sheet.ensure_customer(
                user_id="client-1", email="jane@example.com", name="Jane"
            )

        assert cid == "cus_saved"
        fake_stripe.Customer.create.assert_not_called()


class TestTheMerchantNameIsTheRealWordmark:
    """SB-0191, second occurrence — the guard the lint could not be.

    `MERCHANT_DISPLAY_NAME` is sent to the client as `merchant_display_name` and
    is what the NATIVE STRIPE SHEET renders at the top of the screen while a
    person is deciding to pay. It is the highest-trust string in the app.

    It was invisible to every check we had. `claim_lint` did not scan `.py` at
    all, and the ledger recorded SB-0191 as fixed FROM the dead one-y "SwingBy"
    — it landed on the banned lowercase-b "Swingbyy" instead, so the rename was
    marked done while the wrong mark went on rendering at checkout.

    Marking the module public in claim_lint was tried and rejected: those rules
    read whole lines, so they fire on the file's Apple Pay and history comments,
    which are prose about the code rather than copy. This test asserts the one
    value a user actually sees.
    """

    def test_it_is_the_capital_b_two_y_wordmark(self):
        from app.services.stripe_payment_sheet import MERCHANT_DISPLAY_NAME

        assert MERCHANT_DISPLAY_NAME == "SwingByy"

    def test_it_is_neither_retired_spelling(self):
        """Named separately so a failure says WHICH wrong mark came back."""
        from app.services.stripe_payment_sheet import MERCHANT_DISPLAY_NAME

        assert MERCHANT_DISPLAY_NAME != "Swingbyy", "banned lowercase-b is back"
        assert MERCHANT_DISPLAY_NAME != "SwingBy", "the dead one-y name is back"

    def test_the_sheet_and_the_setup_intent_both_send_it(self):
        """Two call sites. A fix that reached only one would be invisible on
        whichever flow the person happened to use."""
        from pathlib import Path

        from app.services import stripe_payment_sheet

        src = Path(stripe_payment_sheet.__file__).read_text(encoding="utf-8")
        assert src.count('"merchant_display_name": MERCHANT_DISPLAY_NAME') == 2
