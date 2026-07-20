"""
test_accept_interest_capture.py — PAYMENT-MODEL.md §9 items 4 and 5.

4. Charge-before-booking: a failed PaymentIntent creates no booking, leaves
   the post open (and the interest pending).
5. Idempotency: the idempotency key handed to Stripe is derived purely from
   interest_id — deterministic, not time/random — so a retried or
   double-tapped accept collapses into the SAME PaymentIntent on Stripe's
   side instead of charging twice.

Also covers the card-on-file precondition (no booking is created, and Stripe
is never even called, if the client has no saved payment method) since it's
the other way accept can 402 before any state changes.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.deps import get_current_user
from app.main import app
from app.services import stripe_service
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Jane",
    "last_name": "Client",
    "email": "client@example.com",
}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _post_row(**overrides):
    row = {
        "id": "post-1",
        "client_id": "client-1",
        "budget": 150.0,
        "category": "Cleaning",
        "status": "open",
    }
    row.update(overrides)
    return row


def _interest_row(**overrides):
    row = {
        "id": "interest-1",
        "post_id": "post-1",
        "business_id": "biz-1",
        "status": "pending",
        "quoted_price": 150.0,
    }
    row.update(overrides)
    return row


def _stubs(card_on_file=True, post_overrides=None, interest_overrides=None):
    users_select = (
        {"stripe_customer_id": "cus_1", "default_payment_method_id": "pm_1"}
        if card_on_file
        else {"stripe_customer_id": None, "default_payment_method_id": None}
    )
    return {
        "interests": SupabaseTableStub(
            select_data=_interest_row(**(interest_overrides or {})),
            update_data=[{"id": "interest-1", "status": "accepted"}],
        ),
        "service_posts": SupabaseTableStub(
            select_data=_post_row(**(post_overrides or {})),
            update_data=[{"id": "post-1", "status": "matched"}],
        ),
        "businesses": SupabaseTableStub(select_data=None),
        "bookings": SupabaseTableStub(
            insert_data=[{"id": "booking-1", "confirmed_date": None}]
        ),
        "messages": SupabaseTableStub(update_data=[]),
        "payments": SupabaseTableStub(
            insert_data=[{"id": "pay-1", "total_charged": "150.00", "status": "held"}]
        ),
        "booking_events": SupabaseTableStub(insert_data=[{"id": "evt-1"}]),
        "users": SupabaseTableStub(select_data=users_select),
    }


def _patch_supabase(stubs):
    patcher = patch("app.api.interests.supabase")
    mock_supabase = patcher.start()
    mock_supabase.table.side_effect = lambda name: stubs[name]
    return patcher


class TestCardOnFileRequired:
    def test_no_card_on_file_blocks_before_any_charge_attempt(
        self, test_client, as_client
    ):
        stubs = _stubs(card_on_file=False)
        p = _patch_supabase(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"), patch(
                "app.api.interests.stripe_service.charge_off_session"
            ) as mock_charge:
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 402
        assert "card" in response.json()["detail"].lower()
        mock_charge.assert_not_called()

        insert_calls = [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert insert_calls == []
        # Interest was never even flagged as accepted/rejected.
        interest_update_calls = [
            c for c in stubs["interests"].calls if c[0] == "update"
        ]
        assert interest_update_calls == []


class TestChargeBeforeBooking:
    """PAYMENT-MODEL.md §5 / §9.4 — a failed PaymentIntent creates no
    booking, leaves the interest pending and the post open."""

    def test_declined_card_creates_no_booking_and_leaves_post_open(
        self, test_client, as_client
    ):
        stubs = _stubs(card_on_file=True)
        p = _patch_supabase(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"), patch(
                "app.api.interests.stripe_service.charge_off_session",
                side_effect=stripe_service.CardChargeError(
                    "Your card was declined — try another card."
                ),
            ) as mock_charge:
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        # A specific, renderable error — not a generic 400/500.
        assert response.status_code == 402
        assert response.json()["detail"] == "Your card was declined — try another card."
        mock_charge.assert_called_once()

        # No booking was created.
        insert_calls = [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert insert_calls == []

        # No payment row was created.
        payment_insert_calls = [c for c in stubs["payments"].calls if c[0] == "insert"]
        assert payment_insert_calls == []

        # The interest was never flipped to accepted, and the sibling
        # interests were never rejected, and the post was never closed —
        # all three writes live AFTER the charge in accept_interest, so a
        # failed charge must produce none of them.
        assert [c for c in stubs["interests"].calls if c[0] == "update"] == []
        assert [c for c in stubs["service_posts"].calls if c[0] == "update"] == []

    def test_successful_charge_creates_booking_and_resolves_interest(
        self, test_client, as_client
    ):
        """The mirror-image success case, so the failure test above is known
        to be exercising the same code path as a real accept."""
        stubs = _stubs(card_on_file=True)
        p = _patch_supabase(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"), patch(
                "app.api.interests.stripe_service.charge_off_session",
                return_value={"id": "pi_test_1", "status": "succeeded"},
            ):
                response = test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert response.status_code == 200, response.text
        assert [c for c in stubs["bookings"].calls if c[0] == "insert"]
        assert [c for c in stubs["payments"].calls if c[0] == "insert"]
        interest_update_calls = [
            c for c in stubs["interests"].calls if c[0] == "update"
        ]
        assert interest_update_calls, "expected the interest to be flipped to accepted"


class TestIdempotencyKey:
    """
    PAYMENT-MODEL.md §5 / §9.5 — the idempotency key handed to Stripe must be
    derived purely from interest_id (deterministic), so replaying an
    acceptance (double-tap, client retry after a timeout) reuses the exact
    same key. Stripe's own API then guarantees a repeated call with the same
    idempotency_key returns the ORIGINAL PaymentIntent instead of creating a
    second charge — that guarantee only holds if our key never varies across
    calls for the same interest.
    """

    def test_idempotency_key_is_derived_only_from_interest_id(
        self, test_client, as_client
    ):
        stubs = _stubs(card_on_file=True)
        p = _patch_supabase(stubs)
        try:
            with patch("app.api.interests.send_push_to_user"), patch(
                "app.api.interests.stripe_service.charge_off_session",
                return_value={"id": "pi_test_1", "status": "succeeded"},
            ) as mock_charge:
                test_client.patch(
                    "/interests/interest-1/accept",
                    headers={"Authorization": "Bearer test-token"},
                )
        finally:
            p.stop()

        assert mock_charge.call_count == 1
        _, kwargs = mock_charge.call_args
        assert kwargs["idempotency_key"] == "interest-accept-interest-1"

    def test_replaying_the_same_interest_id_reuses_the_same_key(
        self, test_client, as_client
    ):
        """
        Simulates a double-tapped accept: two separate requests for the same
        interest_id. Real Stripe would collapse these into one PaymentIntent
        because the idempotency_key is identical both times — this test
        pins down that OUR code sends the identical key on both calls (the
        property Stripe's dedupe relies on), rather than asserting on
        Stripe's own backend behavior (out of reach for a unit test).
        """
        keys_used = []

        def _fake_charge(
            *, customer_id, payment_method_id, amount, idempotency_key, description=""
        ):
            keys_used.append(idempotency_key)
            return {"id": "pi_shared_1", "status": "succeeded"}

        for _ in range(2):
            stubs = _stubs(card_on_file=True)
            p = _patch_supabase(stubs)
            try:
                with patch("app.api.interests.send_push_to_user"), patch(
                    "app.api.interests.stripe_service.charge_off_session",
                    side_effect=_fake_charge,
                ):
                    test_client.patch(
                        "/interests/interest-1/accept",
                        headers={"Authorization": "Bearer test-token"},
                    )
            finally:
                p.stop()

        assert len(keys_used) == 2
        assert keys_used[0] == keys_used[1] == "interest-accept-interest-1"

    def test_different_interests_get_different_keys(self, test_client, as_client):
        stubs_a = _stubs(card_on_file=True, interest_overrides={"id": "interest-A"})
        stubs_b = _stubs(card_on_file=True, interest_overrides={"id": "interest-B"})
        keys_used = []

        def _fake_charge(
            *, customer_id, payment_method_id, amount, idempotency_key, description=""
        ):
            keys_used.append(idempotency_key)
            return {"id": "pi_x", "status": "succeeded"}

        for interest_id, stubs in (("interest-A", stubs_a), ("interest-B", stubs_b)):
            p = _patch_supabase(stubs)
            try:
                with patch("app.api.interests.send_push_to_user"), patch(
                    "app.api.interests.stripe_service.charge_off_session",
                    side_effect=_fake_charge,
                ):
                    test_client.patch(
                        f"/interests/{interest_id}/accept",
                        headers={"Authorization": "Bearer test-token"},
                    )
            finally:
                p.stop()

        assert keys_used == [
            "interest-accept-interest-A",
            "interest-accept-interest-B",
        ]
        assert keys_used[0] != keys_used[1]
