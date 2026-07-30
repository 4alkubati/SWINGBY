"""A cancelled job's refund is a REQUEST, not an automatic payout.

Kira's ruling, 2026-07-30:
  * post expires unquoted -> refund immediately (expiry_sweep.py, unchanged)
  * job cancelled         -> a refund request SwingBy approves or declines after
                             reviewing the before/after photos and the voice memo

The wrinkle that shapes all of this: a cancellation often has NO proof of work.
Cancel the day before and nobody has visited the property, so there are no photos
and no voice note — nothing to review. Holding that money pending a decision
nobody can make is worse than paying it straight back, so the ladder still settles
those instantly. The request path engages only where work actually began.

These tests are the difference between the two paths, and they matter because both
of them move (or deliberately do not move) real money.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.main import app
from app.deps import get_current_user
from tests.conftest import SupabaseTableStub

CLIENT = {"id": "client-1", "role": "client", "email": "c@example.com"}
ADMIN = {"id": "admin-1", "role": "admin", "email": "a@example.com"}


@pytest.fixture
def as_client():
    app.dependency_overrides[get_current_user] = lambda: CLIENT
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_admin():
    app.dependency_overrides[get_current_user] = lambda: ADMIN
    yield ADMIN
    app.dependency_overrides.pop(get_current_user, None)


# Must stay RELATIVE to now. `classify_cancellation_timing` buckets on the
# distance between the confirmed date and the wall clock, so a pinned literal
# silently changes meaning as real time passes it: this was
# "2026-07-30T12:00:00Z", which was 'late' the morning it was written and
# became 'no_show' that same afternoon — flipping the split from 75/25 to
# 50/50 and failing three tests on a file nobody had touched.
# 24h out is inside the 48h window from any clock, so the bucket is 'late'
# whenever the suite runs.
CONFIRMED_DATE = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

BOOKING = {
    "id": "booking-1",
    "client_id": "client-1",
    "business_id": "biz-1",
    "status": "in_progress",
    "total_amount": 200.0,
    # Inside 48h -> 'late' -> client keeps 75%, business keeps 25%.
    "confirmed_date": CONFIRMED_DATE,
}


def _cancel(proof_submitted, *, intent="pi_1"):
    """Run PATCH /bookings/booking-1/cancel and hand back the stubs to assert on."""
    payments = SupabaseTableStub(
        select_data={
            "id": "pay-1",
            "stripe_payment_intent_id": intent,
            "total_charged_cents": 20000,
            "escrow_held_cents": 20000,
            "released_to_business_cents": 0,
            "platform_cut_cents": 0,
            "status": "held",
        },
        update_data=[{"id": "pay-1"}],
    )
    bookings = SupabaseTableStub(select_data=BOOKING, update_data=[BOOKING])
    disputes = SupabaseTableStub(insert_data=[{"id": "dis-1"}])
    proofs = SupabaseTableStub(
        select_data=(
            [{"submitted_at": "2026-07-29T10:00:00Z"}] if proof_submitted else []
        )
    )
    stubs = {
        "bookings": bookings,
        "cancellations": SupabaseTableStub(insert_data=[{"id": "can-1"}]),
        "payments": payments,
        "businesses": SupabaseTableStub(select_data={"owner_id": "owner-1"}),
        "users": SupabaseTableStub(select_data=None),
        "disputes": disputes,
        "booking_proofs": proofs,
        "booking_events": SupabaseTableStub(insert_data=[{"id": "ev-1"}]),
    }

    p1 = patch("app.api.bookings.supabase")
    p2 = patch("app.services.escrow.supabase")
    m1, m2 = p1.start(), p2.start()
    m1.table.side_effect = lambda n: stubs[n]
    m2.table.side_effect = lambda n: stubs[n]
    try:
        with patch("app.api.bookings.send_push_to_user"), patch(
            "app.services.stripe_service.refund_payment_intent"
        ) as stripe_refund:
            resp = app_client().patch(
                "/bookings/booking-1/cancel",
                json={"reason": "had to call it off"},
                headers={"Authorization": "Bearer t"},
            )
    finally:
        p1.stop()
        p2.stop()
    return resp, stubs, stripe_refund


def app_client():
    from fastapi.testclient import TestClient

    return TestClient(app)


def _updates(stub):
    return [c[1][0] for c in stub.calls if c[0] == "update"]


class TestNoProofSettlesImmediately:
    """Nobody visited, so there is nothing to review and nothing to wait for."""

    def test_the_money_goes_straight_back(self, as_client):
        resp, stubs, stripe_refund = _cancel(proof_submitted=False)
        assert resp.status_code == 200, resp.text

        upd = _updates(stubs["payments"])[0]
        assert upd["status"] == "refunded"
        assert upd["escrow_held"] == 0
        # 'late' -> business keeps 25% of $200.
        assert upd["released_to_business"] == 50.00
        # A captured intent exists, so the refund really is sent.
        stripe_refund.assert_called_once()

    def test_no_refund_request_is_opened(self, as_client):
        _, stubs, _ = _cancel(proof_submitted=False)
        assert stubs["disputes"].inserted is None

    def test_the_booking_is_marked_refunded(self, as_client):
        _, stubs, _ = _cancel(proof_submitted=False)
        assert _updates(stubs["bookings"])[0]["payment_status"] == "refunded"


class TestProofOpensARequest:
    """Work began, so where the client's share goes is a judgement call."""

    def test_the_client_share_stays_held_and_stripe_is_not_called(self, as_client):
        resp, stubs, stripe_refund = _cancel(proof_submitted=True)
        assert resp.status_code == 200, resp.text

        upd = _updates(stubs["payments"])[0]
        assert upd["status"] == "held"
        # 75% of $200 held pending review, 25% settled to the business by the ladder.
        assert upd["escrow_held"] == 150.00
        assert upd["released_to_business"] == 50.00
        stripe_refund.assert_not_called()

    def test_the_booking_does_not_claim_to_be_refunded(self, as_client):
        # It said 'refunded' unconditionally before. Nothing has been refunded.
        _, stubs, _ = _cancel(proof_submitted=True)
        assert _updates(stubs["bookings"])[0]["payment_status"] == "held"

    def test_a_request_is_opened_against_the_business(self, as_client):
        _, stubs, _ = _cancel(proof_submitted=True)
        row = stubs["disputes"].inserted
        assert row is not None
        assert row["issue_type"] == "cancellation_refund"
        assert row["against_party"] == "business"
        assert row["status"] == "open"
        assert row["refund_amount"] == 150.00
        assert row["booking_id"] == "booking-1"


class TestAClientCannotManufactureOne:
    def test_post_disputes_rejects_the_system_only_issue_type(self, as_client):
        # The request decides where held escrow goes, so it must only ever be
        # opened by cancel_booking — never from a phone.
        resp = app_client().post(
            "/disputes/",
            json={
                "booking_id": "booking-1",
                "issue_type": "cancellation_refund",
                "description": "please just give me the money back",
            },
            headers={"Authorization": "Bearer t"},
        )
        assert resp.status_code == 400
        assert "issue_type" in resp.text


def _resolve(
    *,
    approve,
    issue_type="cancellation_refund",
    status="open",
    held_cents=15000,
    released_cents=5000,
    amount=None,
    intent="pi_1"
):
    payments = SupabaseTableStub(
        select_data={
            "id": "pay-1",
            "stripe_payment_intent_id": intent,
            "total_charged_cents": 20000,
            "escrow_held_cents": held_cents,
            "released_to_business_cents": released_cents,
            "platform_cut_cents": 0,
            "refunded_cents": 0,
            "status": "held",
        },
        update_data=[{"id": "pay-1"}],
    )
    disputes = SupabaseTableStub(
        select_data={
            "id": "dis-1",
            "booking_id": "booking-1",
            "issue_type": issue_type,
            "status": status,
            "refund_amount": 150.0,
        },
        update_data=[{"id": "dis-1", "booking_id": "booking-1"}],
    )
    stubs = {
        "disputes": disputes,
        "payments": payments,
        "booking_events": SupabaseTableStub(insert_data=[{"id": "ev-1"}]),
    }

    ps = [
        patch("app.api.disputes.supabase"),
        patch("app.services.escrow.supabase"),
        patch("app.services.refunds.supabase"),
    ]
    mocks = [p.start() for p in ps]
    for m in mocks:
        m.table.side_effect = lambda n: stubs[n]
    body = {"resolution": "reviewed the photos and the voice note", "approve": approve}
    if amount is not None:
        body["refund_amount"] = amount
    try:
        with patch("app.services.refunds.stripe_service") as stripe_mod, patch(
            "app.api.disputes.record_audit"
        ):
            resp = app_client().patch(
                "/disputes/dis-1/resolve",
                json=body,
                headers={"Authorization": "Bearer t"},
            )
    finally:
        for p in ps:
            p.stop()
    return resp, stubs, stripe_mod


class TestAdminDecides:
    def test_approving_refunds_the_held_amount(self, as_admin):
        resp, stubs, stripe_mod = _resolve(approve=True)
        assert resp.status_code == 200, resp.text
        stripe_mod.refund_payment_intent.assert_called_once()
        dispute_upd = _updates(stubs["disputes"])[0]
        assert dispute_upd["status"] == "resolved"
        # Records what MOVED, not what was asked for.
        assert dispute_upd["refund_amount"] == 150.00

    def test_declining_hands_the_held_amount_to_the_business(self, as_admin):
        resp, stubs, stripe_mod = _resolve(approve=False)
        assert resp.status_code == 200, resp.text
        # Nothing is reversed at Stripe — the money was captured long ago and is
        # only being allocated.
        stripe_mod.refund_payment_intent.assert_not_called()

        pay_upd = _updates(stubs["payments"])[0]
        assert pay_upd["escrow_held"] == 0
        # $50 the ladder already gave them + the $150 that was held.
        assert pay_upd["released_to_business"] == 200.00
        assert pay_upd["status"] == "fully_released"
        assert _updates(stubs["disputes"])[0]["status"] == "dismissed"

    def test_an_admin_may_refund_less_than_is_held(self, as_admin):
        resp, _, stripe_mod = _resolve(approve=True, amount=40.0)
        assert resp.status_code == 200, resp.text
        kwargs = stripe_mod.refund_payment_intent.call_args.kwargs
        assert kwargs["amount_cad"] == pytest.approx(40.0)

    def test_an_admin_cannot_refund_more_than_is_held(self, as_admin):
        # The extra does not exist. Capped at the held figure rather than trusted.
        resp, _, stripe_mod = _resolve(approve=True, amount=9999.0)
        assert resp.status_code == 200, resp.text
        kwargs = stripe_mod.refund_payment_intent.call_args.kwargs
        assert kwargs["amount_cad"] == pytest.approx(150.0)

    def test_deciding_twice_is_refused(self, as_admin):
        # Without this, a second approve refunds a second time.
        resp, _, stripe_mod = _resolve(approve=True, status="resolved")
        assert resp.status_code == 409
        stripe_mod.refund_payment_intent.assert_not_called()

    def test_an_ordinary_dispute_still_moves_no_money(self, as_admin):
        # Resolving a quality complaint has never paid anyone and must not start.
        resp, stubs, stripe_mod = _resolve(approve=True, issue_type="poor_quality")
        assert resp.status_code == 200, resp.text
        stripe_mod.refund_payment_intent.assert_not_called()
        assert _updates(stubs["payments"]) == []

    def test_a_client_cannot_resolve(self, as_client):
        resp = app_client().patch(
            "/disputes/dis-1/resolve",
            json={"resolution": "I approve my own refund", "approve": True},
            headers={"Authorization": "Bearer t"},
        )
        assert resp.status_code == 403
