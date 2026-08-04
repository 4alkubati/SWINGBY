"""
test_payouts.py — D5. Taking the money out.

Three things are worth testing here and they are not equally important.

1. **The balance math** — the only part that decides how much real money moves.
   Tested exhaustively and without Stripe, because it is pure.
2. **The failure ladder** — what a half-completed cash-out leaves behind. A
   transfer that succeeds followed by a payout that fails is the case that
   silently pays a business twice if the accounting is wrong, so it gets its
   own tests.
3. **The gates** — role, onboarding state, and Stripe-says-no.

What is deliberately NOT asserted: that Stripe accepts any of these calls.
Connect is not enabled on the SwingBy Stripe account (verified 2026-08-03:
``Account.create(type=express)`` returns *"You can only create new accounts if
you've signed up for Connect"*), so nothing in CI or on this box can exercise
the real API. These tests pin OUR logic and the shape of what we send; the
Stripe round-trip is listed as unverified in the PR rather than faked green.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import payouts as payouts_service
from app.services import stripe_connect

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

OWNER = {
    "id": "user-owner-1",
    "role": "business_owner",
    "email": "owner@example.com",
    "first_name": "Kira",
}

BUSINESS = {
    "id": "biz-1",
    "owner_id": OWNER["id"],
    "business_name": "Bow River Plumbing",
    "stripe_connect_account_id": "acct_test_1",
    "payouts_enabled": True,
    "connect_details_submitted": True,
}


def captured_payment(cents: int, **over):
    """A payments row with real money behind it."""
    row = {
        "id": f"pay-{cents}",
        "booking_id": "bk-1",
        "status": "fully_released",
        "method": "card",
        "stripe_payment_intent_id": "pi_real_1",
        "released_to_business_cents": cents,
        "released_to_business": cents / 100,
    }
    row.update(over)
    return row


def phantom_payment(cents: int):
    """FINDING C: says released, no PaymentIntent, nobody ever paid."""
    return {
        "id": f"phantom-{cents}",
        "booking_id": "bk-2",
        "status": "fully_released",
        "method": "card",
        "stripe_payment_intent_id": None,
        "released_to_business_cents": cents,
        "released_to_business": cents / 100,
    }


@pytest.fixture
def as_owner():
    """Authenticate every request as the business owner."""
    from app.deps import get_current_user

    app.dependency_overrides[get_current_user] = lambda: OWNER
    yield
    app.dependency_overrides.pop(get_current_user, None)


class _Table:
    """Minimal supabase table stub that records writes per table name."""

    def __init__(self, parent, name):
        self.parent = parent
        self.name = name
        self._mode = "select"

    def __getattr__(self, attr):
        def _call(*args, **kwargs):
            if attr in ("insert", "update", "upsert", "delete"):
                self._mode = attr
                if args:
                    self.parent.writes.append((self.name, attr, args[0]))
            return self

        return _call

    def execute(self):
        from types import SimpleNamespace

        if self._mode in ("insert", "update"):
            return SimpleNamespace(data=[{}], count=None)
        data = self.parent.data.get(self.name, [])
        return SimpleNamespace(
            data=data, count=len(data) if isinstance(data, list) else None
        )


class FakeSupabase:
    def __init__(self, data):
        # `businesses` is read with .single(), which returns a dict not a list.
        self.data = data
        self.writes = []

    def table(self, name):
        return _Table(self, name)


def fake_db(*, payments=None, payouts=None, business=None, bookings=None):
    return FakeSupabase(
        {
            "businesses": business if business is not None else BUSINESS,
            "bookings": bookings if bookings is not None else [{"id": "bk-1"}],
            "payments": payments or [],
            "payouts": payouts or [],
        }
    )


# ===========================================================================
# 1. The balance math — pure, no Stripe, no DB
# ===========================================================================


class TestBalanceMath:
    def test_available_is_earned_minus_paid_out(self):
        payments = [captured_payment(18000), captured_payment(9000)]
        payouts = [{"amount_cents": 10000, "stripe_transfer_id": "tr_1"}]
        assert payouts_service.available_cents(payments, payouts) == 17000

    def test_phantom_releases_are_worth_nothing(self):
        """FINDING C — $4,675.50 of production rows say released and were never paid.

        Summing `released_to_business` naively would offer a business money no
        client's card ever funded, and paying it would move real platform cash
        against a phantom row. This is the single most important assertion in
        the file.
        """
        payments = [captured_payment(5000), phantom_payment(400000)]
        assert payouts_service.earned_cents(payments) == 5000
        assert payouts_service.available_cents(payments, []) == 5000

    def test_off_platform_payments_are_capture_backed(self):
        """Cash / e-transfer jobs really were paid — just not through us.

        `escrow.is_capture_backed` counts them, so the balance must too. What
        stops them inflating a payout is that off-platform bookings release
        nothing to `released_to_business` in the first place.
        """
        row = captured_payment(0, method="cash", stripe_payment_intent_id=None)
        assert payouts_service.earned_cents([row]) == 0

    def test_a_payout_that_never_transferred_does_not_consume_balance(self):
        """Failed before step 2 — no money left the platform, so nothing is spent."""
        payouts = [
            {"amount_cents": 9000, "status": "failed", "stripe_transfer_id": None},
        ]
        assert payouts_service.paid_out_cents(payouts) == 0
        assert (
            payouts_service.available_cents([captured_payment(9000)], payouts) == 9000
        )

    def test_a_payout_that_failed_AFTER_transferring_does_consume_balance(self):
        """The expensive one.

        Transfer succeeded, payout failed: the funds are on the business's
        connected account. They are the business's money. Counting this row as
        "not paid out" because its status says `failed` would hand out the same
        $90 a second time.
        """
        payouts = [
            {"amount_cents": 9000, "status": "failed", "stripe_transfer_id": "tr_x"},
        ]
        assert payouts_service.paid_out_cents(payouts) == 9000
        assert payouts_service.available_cents([captured_payment(9000)], payouts) == 0

    def test_balance_never_goes_negative(self):
        payouts = [{"amount_cents": 50000, "stripe_transfer_id": "tr_1"}]
        assert payouts_service.available_cents([captured_payment(1000)], payouts) == 0

    def test_summary_shows_both_halves_so_a_disputed_number_is_auditable(self):
        summary = payouts_service.summarize(
            [captured_payment(20000)],
            [{"amount_cents": 5000, "stripe_transfer_id": "tr_1"}],
        )
        assert summary == {
            "available_cents": 15000,
            "lifetime_earned_cents": 20000,
            "paid_out_cents": 5000,
            "currency": "cad",
        }

    def test_cents_column_wins_over_the_legacy_dollar_column(self):
        """Migration 20260723120000 made *_cents authoritative. Honour it."""
        row = captured_payment(0)
        row["released_to_business_cents"] = 12345
        row["released_to_business"] = 999.99
        assert payouts_service.earned_cents([row]) == 12345

    def test_pre_migration_rows_fall_back_to_dollars(self):
        row = captured_payment(0)
        row.pop("released_to_business_cents")
        row["released_to_business"] = 42.5
        assert payouts_service.earned_cents([row]) == 4250


class TestStatusMapping:
    @pytest.mark.parametrize(
        "value", ["pending", "in_transit", "paid", "failed", "canceled"]
    )
    def test_stripe_statuses_pass_through(self, value):
        assert payouts_service.map_stripe_payout_status(value) == value

    def test_an_unknown_status_degrades_to_pending_not_paid(self):
        """Wrongly calling money 'paid' is expensive; 'still moving' is cheap."""
        assert payouts_service.map_stripe_payout_status("quantum") == "pending"
        assert payouts_service.map_stripe_payout_status(None) == "pending"

    def test_public_payout_hides_plumbing_ids_but_keeps_the_support_reference(self):
        shaped = payouts_service.public_payout(
            {
                "id": "po-1",
                "amount_cents": 5000,
                "status": "paid",
                "method": "instant",
                "stripe_payout_id": "po_stripe_1",
                "stripe_transfer_id": "tr_secret",
                "stripe_account_id": "acct_secret",
            }
        )
        assert shaped["stripe_payout_id"] == "po_stripe_1"
        assert "stripe_transfer_id" not in shaped
        assert "stripe_account_id" not in shaped


# ===========================================================================
# 2. Account status normalisation — pure
# ===========================================================================


class TestAccountStatus:
    def test_past_due_and_currently_due_are_merged_without_duplicates(self):
        """Showing only `currently_due` produces the 'I finished but payouts are
        off' dead end. Both lists are things the person must supply."""
        status = stripe_connect.account_status(
            {
                "id": "acct_1",
                "payouts_enabled": False,
                "requirements": {
                    "currently_due": ["individual.id_number", "external_account"],
                    "past_due": ["external_account", "individual.dob.day"],
                },
            }
        )
        assert status["requirements_due"] == [
            "individual.id_number",
            "external_account",
            "individual.dob.day",
        ]

    def test_missing_requirements_block_is_not_a_crash(self):
        status = stripe_connect.account_status({"id": "acct_1"})
        assert status["requirements_due"] == []
        assert status["payouts_enabled"] is False
        assert status["disabled_reason"] is None


# ===========================================================================
# 3. Endpoints
# ===========================================================================


class TestAuthorisation:
    def test_an_employee_cannot_touch_the_company_money(self, as_owner):
        """Employees run jobs; moving the company's money out is not delegated.

        Enforced server-side because hiding the button is not a permission.
        """
        from app.deps import get_current_user

        app.dependency_overrides[get_current_user] = lambda: {
            "id": "u-emp",
            "role": "employee",
        }
        for method, path in [
            ("get", "/businesses/me/payouts"),
            ("post", "/businesses/me/payouts"),
            ("get", "/businesses/me/payout-account"),
            ("post", "/businesses/me/payout-account"),
        ]:
            res = getattr(client, method)(path)
            assert res.status_code == 403, f"{method} {path} -> {res.status_code}"

    def test_a_client_cannot_either(self):
        from app.deps import get_current_user

        app.dependency_overrides[get_current_user] = lambda: {
            "id": "u-c",
            "role": "client",
        }
        try:
            assert client.get("/businesses/me/payouts").status_code == 403
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    def test_unauthenticated_is_401(self):
        assert client.get("/businesses/me/payouts").status_code == 401


class TestWallet:
    def test_balance_is_served_even_when_stripe_is_down(self, as_owner):
        """A business must always be able to SEE what it earned, even when it
        cannot move it. The balance comes from our own ledger, so a Stripe
        outage has no business blanking it."""
        db = fake_db(payments=[captured_payment(27000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            side_effect=stripe_connect.StripeConnectError("stripe is down"),
        ):
            res = client.get("/businesses/me/payouts")

        assert res.status_code == 200
        body = res.json()
        assert body["available_cents"] == 27000
        assert body["account"]["state"] == "none"

    def test_the_wallet_reports_ready_and_instant_when_stripe_says_so(self, as_owner):
        db = fake_db(payments=[captured_payment(15000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": True,
                "charges_enabled": True,
                "details_submitted": True,
                "requirements": {},
            },
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ):
            res = client.get("/businesses/me/payouts")

        body = res.json()
        assert body["account"]["state"] == "ready"
        assert body["account"]["instant_available"] is True
        assert body["account"]["instant_source_last4"] == "4242"
        assert body["available_cents"] == 15000

    def test_submitted_but_not_enabled_is_pending_not_incomplete(self, as_owner):
        """'Pending' means wait; 'incomplete' means go do the form again. Telling
        someone to redo a form they already finished is how they give up."""
        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": False,
                "details_submitted": True,
                "requirements": {},
            },
        ):
            res = client.get("/businesses/me/payout-account")
        assert res.json()["state"] == "pending"

    def test_a_disabled_account_reports_restricted_with_stripes_reason(self, as_owner):
        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": False,
                "details_submitted": True,
                "requirements": {"disabled_reason": "requirements.past_due"},
            },
        ):
            body = client.get("/businesses/me/payout-account").json()
        assert body["state"] == "restricted"
        assert body["disabled_reason"] == "requirements.past_due"

    def test_no_account_short_circuits_without_calling_stripe(self, as_owner):
        db = fake_db(business={**BUSINESS, "stripe_connect_account_id": None})
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account"
        ) as retrieve:
            body = client.get("/businesses/me/payout-account").json()
        assert body["state"] == "none"
        retrieve.assert_not_called()


class TestOnboarding:
    def test_an_existing_account_is_reused_not_duplicated(self, as_owner):
        """Tapping 'Set up payouts' twice must not strand a second connected
        account — the first one may already hold transferred funds."""
        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.create_express_account"
        ) as create, patch(
            "app.api.payouts.stripe_connect.create_account_link",
            return_value="https://connect.stripe.com/setup/x",
        ):
            res = client.post("/businesses/me/payout-account")

        assert res.status_code == 200
        create.assert_not_called()
        assert res.json()["account_id"] == "acct_test_1"

    def test_a_new_account_is_persisted_before_the_link_is_returned(self, as_owner):
        db = fake_db(business={**BUSINESS, "stripe_connect_account_id": None})
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.create_express_account",
            return_value="acct_new_1",
        ), patch(
            "app.api.payouts.stripe_connect.create_account_link",
            return_value="https://connect.stripe.com/setup/y",
        ):
            res = client.post("/businesses/me/payout-account")

        assert res.status_code == 200
        saved = [w for w in db.writes if w[0] == "businesses" and w[1] == "update"]
        assert any(w[2].get("stripe_connect_account_id") == "acct_new_1" for w in saved)

    def test_a_fresh_link_is_minted_every_time(self, as_owner):
        """Account links are single-use and expire in minutes. Caching one
        guarantees a dead page."""
        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.create_account_link",
            return_value="https://connect.stripe.com/setup/z",
        ) as link:
            client.post("/businesses/me/payout-account")
            client.post("/businesses/me/payout-account")
        assert link.call_count == 2

    def test_missing_stripe_key_is_503_not_500(self, as_owner):
        from app.services.stripe_service import StripeNotConfigured

        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.create_account_link",
            side_effect=StripeNotConfigured("Stripe is not configured"),
        ):
            res = client.post("/businesses/me/payout-account")
        assert res.status_code == 503

    def test_stripe_refusing_is_502_with_stripes_own_message(self, as_owner):
        db = fake_db()
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.create_account_link",
            side_effect=stripe_connect.StripeConnectError(
                "You can only create new accounts if you've signed up for Connect"
            ),
        ):
            res = client.post("/businesses/me/payout-account")
        assert res.status_code == 502
        assert "Connect" in res.json()["detail"]

    def test_the_express_dashboard_link_needs_an_account_first(self, as_owner):
        db = fake_db(business={**BUSINESS, "stripe_connect_account_id": None})
        with patch("app.api.payouts.supabase", db):
            res = client.post("/businesses/me/payout-account/login")
        assert res.status_code == 409


class TestCashOut:
    """The endpoint that actually moves money."""

    @staticmethod
    def _ready_account():
        return {
            "id": "acct_test_1",
            "payouts_enabled": True,
            "charges_enabled": True,
            "details_submitted": True,
            "requirements": {},
        }

    def test_instant_when_the_card_supports_it(self, as_owner):
        db = fake_db(payments=[captured_payment(45000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_1"
        ) as transfer, patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=45000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            return_value={
                "id": "po_1",
                "status": "paid",
                "method": "instant",
                "amount_cents": 45000,
                "arrival_date": 1785000000,
            },
        ) as payout:
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 200
        body = res.json()
        assert body["method"] == "instant"
        assert body["amount_cents"] == 45000
        assert transfer.call_args.kwargs["amount_cents"] == 45000
        assert payout.call_args.kwargs["method"] == "instant"

    def test_standard_when_there_is_no_instant_capable_card(self, as_owner):
        """No 'instant' copy may appear on a path that is a standard payout."""
        db = fake_db(payments=[captured_payment(30000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_2"
        ), patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=30000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            return_value={
                "id": "po_2",
                "status": "in_transit",
                "method": "standard",
                "amount_cents": 30000,
                "arrival_date": None,
            },
        ) as payout:
            body = client.post("/businesses/me/payouts").json()

        assert payout.call_args.kwargs["method"] == "standard"
        assert body["method"] == "standard"
        assert body["status"] == "in_transit"

    def test_stripe_downgrading_the_rail_is_reported_as_standard(self, as_owner):
        """We asked for instant; Stripe answered standard. The user is told what
        they GOT, never what we requested."""
        db = fake_db(payments=[captured_payment(10000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_3"
        ), patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=10000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            return_value={
                "id": "po_3",
                "status": "in_transit",
                "method": "standard",  # Stripe overrode us
                "amount_cents": 10000,
                "arrival_date": None,
            },
        ):
            body = client.post("/businesses/me/payouts").json()
        assert body["method"] == "standard"

    def test_instant_refused_at_send_time_falls_back_to_standard(self, as_owner):
        """A card can advertise instant and still be refused (Stripe limits). A
        standard payout of the same money beats an error."""
        db = fake_db(payments=[captured_payment(20000)])
        calls = []

        def _payout(**kwargs):
            calls.append(kwargs["method"])
            if kwargs["method"] == "instant":
                raise stripe_connect.StripeConnectError("Instant payouts unavailable")
            return {
                "id": "po_4",
                "status": "in_transit",
                "method": "standard",
                "amount_cents": 20000,
                "arrival_date": None,
            }

        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_4"
        ), patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=20000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout", side_effect=_payout
        ):
            body = client.post("/businesses/me/payouts").json()

        assert calls == ["instant", "standard"]
        assert body["method"] == "standard"

    def test_the_transfer_is_idempotency_keyed_on_the_row_id(self, as_owner):
        """Without a key, a retried transfer sends the money twice."""
        db = fake_db(payments=[captured_payment(5000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_5"
        ) as transfer, patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=5000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            return_value={
                "id": "po_5",
                "status": "paid",
                "method": "standard",
                "amount_cents": 5000,
                "arrival_date": None,
            },
        ):
            body = client.post("/businesses/me/payouts").json()

        key = transfer.call_args.kwargs["idempotency_key"]
        assert key == f"sb_payout_tr_{body['id']}"

    def test_a_failed_transfer_leaves_no_transfer_id_so_the_money_is_still_available(
        self, as_owner
    ):
        db = fake_db(payments=[captured_payment(8000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer",
            side_effect=stripe_connect.StripeConnectError("Insufficient funds"),
        ):
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 502
        failures = [
            w[2]
            for w in db.writes
            if w[0] == "payouts" and w[1] == "update" and w[2].get("status") == "failed"
        ]
        assert failures, "the payout row must be marked failed"
        # Critically: no transfer id was written, so the balance is untouched.
        assert all("stripe_transfer_id" not in f for f in failures)

    def test_a_failed_payout_AFTER_transfer_keeps_the_transfer_id(self, as_owner):
        """The money is on the business's connected account. It is theirs. The
        row must record that, or the next cash-out pays it out a second time."""
        db = fake_db(payments=[captured_payment(12000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_6"
        ), patch(
            "app.api.payouts.stripe_connect.available_balance_cents", return_value=12000
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            side_effect=stripe_connect.StripeConnectError("payout rejected"),
        ):
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 502
        failed = [
            w[2]
            for w in db.writes
            if w[0] == "payouts" and w[1] == "update" and w[2].get("status") == "failed"
        ]
        assert failed and failed[-1].get("stripe_transfer_id") == "tr_6"

    def test_stranded_funds_are_swept_by_the_next_attempt(self, as_owner):
        """The payout amount is read BACK off Stripe, not reused from the
        transfer, so money left behind by an earlier failure goes out now."""
        db = fake_db(payments=[captured_payment(10000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer", return_value="tr_7"
        ), patch(
            # 100 from this transfer + 70 stranded from a previous failure
            "app.api.payouts.stripe_connect.available_balance_cents",
            return_value=17000,
        ), patch(
            "app.api.payouts.stripe_connect.create_payout",
            return_value={
                "id": "po_7",
                "status": "paid",
                "method": "standard",
                "amount_cents": 17000,
                "arrival_date": None,
            },
        ) as payout:
            body = client.post("/businesses/me/payouts").json()

        assert payout.call_args.kwargs["amount_cents"] == 17000
        assert body["amount_cents"] == 17000

    def test_no_balance_is_409_and_touches_no_stripe_money_call(self, as_owner):
        db = fake_db(payments=[])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer"
        ) as transfer:
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 409
        transfer.assert_not_called()

    def test_a_business_that_never_onboarded_cannot_cash_out(self, as_owner):
        db = fake_db(
            payments=[captured_payment(99000)],
            business={**BUSINESS, "stripe_connect_account_id": None},
        )
        with patch("app.api.payouts.supabase", db):
            res = client.post("/businesses/me/payouts")
        assert res.status_code == 409

    def test_payouts_disabled_at_stripe_blocks_the_cash_out(self, as_owner):
        """Gated on Stripe's live answer, not the cached `payouts_enabled`
        column — paying out against a stale cache sends money to an account
        Stripe disabled an hour ago."""
        db = fake_db(payments=[captured_payment(99000)])
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": False,
                "details_submitted": True,
                "requirements": {"disabled_reason": "under_review"},
            },
        ), patch("app.api.payouts.stripe_connect.create_transfer") as transfer:
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 409
        assert "under_review" in res.json()["detail"]
        transfer.assert_not_called()

    def test_a_second_cash_out_cannot_spend_the_same_money(self, as_owner):
        """Regression guard for the double-spend: earned 200, already
        transferred 200, available is 0."""
        db = fake_db(
            payments=[captured_payment(20000)],
            payouts=[
                {
                    "id": "po-old",
                    "amount_cents": 20000,
                    "status": "paid",
                    "stripe_transfer_id": "tr_old",
                    "stripe_payout_id": "po_old",
                }
            ],
        )
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value=self._ready_account(),
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": True, "standard": True, "instant_source": "4242"},
        ), patch(
            "app.api.payouts.stripe_connect.create_transfer"
        ) as transfer:
            res = client.post("/businesses/me/payouts")

        assert res.status_code == 409
        transfer.assert_not_called()


class TestSettleOnRead:
    """There is no scheduler (STATUS.md §2), so a standard payout's multi-day
    in_transit -> paid transition has to be observed on a read or nowhere."""

    def test_an_in_transit_payout_is_refreshed_when_the_wallet_opens(self, as_owner):
        db = fake_db(
            payments=[captured_payment(10000)],
            payouts=[
                {
                    "id": "po-1",
                    "amount_cents": 10000,
                    "status": "in_transit",
                    "stripe_transfer_id": "tr_1",
                    "stripe_payout_id": "po_stripe_1",
                }
            ],
        )
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": True,
                "details_submitted": True,
                "requirements": {},
            },
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.retrieve_payout",
            return_value={
                "id": "po_stripe_1",
                "status": "paid",
                "method": "standard",
                "amount_cents": 10000,
                "arrival_date": None,
                "failure_message": None,
            },
        ):
            body = client.get("/businesses/me/payouts").json()

        assert body["payouts"][0]["status"] == "paid"
        writes = [w[2] for w in db.writes if w[0] == "payouts" and w[1] == "update"]
        assert any(w.get("status") == "paid" for w in writes)

    def test_terminal_rows_are_not_re_fetched(self, as_owner):
        db = fake_db(
            payouts=[
                {
                    "id": "po-1",
                    "amount_cents": 10000,
                    "status": "paid",
                    "stripe_transfer_id": "tr_1",
                    "stripe_payout_id": "po_stripe_1",
                }
            ]
        )
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": True,
                "details_submitted": True,
                "requirements": {},
            },
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.retrieve_payout"
        ) as retrieve:
            client.get("/businesses/me/payouts")
        retrieve.assert_not_called()

    def test_one_unreadable_payout_does_not_blank_the_wallet(self, as_owner):
        db = fake_db(
            payments=[captured_payment(10000)],
            payouts=[
                {
                    "id": "po-1",
                    "amount_cents": 5000,
                    "status": "in_transit",
                    "stripe_transfer_id": "tr_1",
                    "stripe_payout_id": "po_stripe_1",
                }
            ],
        )
        with patch("app.api.payouts.supabase", db), patch(
            "app.api.payouts.stripe_connect.retrieve_account",
            return_value={
                "id": "acct_test_1",
                "payouts_enabled": True,
                "details_submitted": True,
                "requirements": {},
            },
        ), patch(
            "app.api.payouts.stripe_connect.payout_capability",
            return_value={"instant": False, "standard": True, "instant_source": None},
        ), patch(
            "app.api.payouts.stripe_connect.retrieve_payout",
            side_effect=stripe_connect.StripeConnectError("not found"),
        ):
            res = client.get("/businesses/me/payouts")

        assert res.status_code == 200
        assert res.json()["payouts"][0]["status"] == "in_transit"
        # 100 earned, 50 already transferred out.
        assert res.json()["available_cents"] == 5000


class TestStripeCallShapes:
    """What we ASK Stripe for. These cannot prove Stripe accepts it (Connect is
    not enabled on the account — see the module docstring), but they pin the
    parameters so a silent edit cannot change them."""

    def test_express_accounts_request_transfers_only_and_manual_payouts(self):
        stripe = MagicMock()
        stripe.Account.create.return_value = {"id": "acct_x"}
        with patch("app.services.stripe_connect._stripe", return_value=stripe):
            stripe_connect.create_express_account(
                business_id="biz-1", business_name="Bow River", email="a@b.ca"
            )

        kwargs = stripe.Account.create.call_args.kwargs
        assert kwargs["type"] == "express"
        assert kwargs["country"] == "CA"
        # card_payments is deliberately NOT requested: SwingBy charges the
        # client on its own account, so the business never needs acquiring.
        assert kwargs["capabilities"] == {"transfers": {"requested": True}}
        # Manual: Kira's ruling is that the business takes money out when it
        # wants. An automatic schedule would drain the balance behind them.
        assert kwargs["settings"]["payouts"]["schedule"]["interval"] == "manual"
        assert kwargs["metadata"]["swingby_business_id"] == "biz-1"

    def test_a_transfer_refuses_a_non_positive_amount_before_reaching_stripe(self):
        with pytest.raises(stripe_connect.StripeConnectError):
            stripe_connect.create_transfer(
                account_id="acct_x", amount_cents=0, idempotency_key="k"
            )

    def test_capability_reads_instant_off_the_external_account(self):
        stripe = MagicMock()
        stripe.Account.list_external_accounts.return_value = {
            "data": [
                {"available_payout_methods": ["standard"], "last4": "6789"},
                {"available_payout_methods": ["standard", "instant"], "last4": "4242"},
            ]
        }
        with patch("app.services.stripe_connect._stripe", return_value=stripe):
            capability = stripe_connect.payout_capability("acct_x")

        assert capability == {
            "instant": True,
            "standard": True,
            "instant_source": "4242",
        }

    def test_a_bank_only_account_is_standard_with_no_instant_source(self):
        stripe = MagicMock()
        stripe.Account.list_external_accounts.return_value = {
            "data": [{"available_payout_methods": ["standard"], "last4": "0001"}]
        }
        with patch("app.services.stripe_connect._stripe", return_value=stripe):
            capability = stripe_connect.payout_capability("acct_x")

        assert capability["instant"] is False
        assert capability["instant_source"] is None

    def test_balance_reads_available_only_and_filters_by_currency(self):
        """Pending balance cannot be paid out; Stripe refuses it."""
        stripe = MagicMock()
        stripe.Balance.retrieve.return_value = {
            "available": [
                {"currency": "cad", "amount": 4500},
                {"currency": "usd", "amount": 99999},
            ],
            "pending": [{"currency": "cad", "amount": 100000}],
        }
        with patch("app.services.stripe_connect._stripe", return_value=stripe):
            assert stripe_connect.available_balance_cents("acct_x") == 4500

    def test_the_payout_reports_the_method_stripe_returned(self):
        stripe = MagicMock()
        stripe.Payout.create.return_value = {
            "id": "po_1",
            "status": "in_transit",
            "method": "standard",
            "amount": 1000,
            "arrival_date": None,
        }
        with patch("app.services.stripe_connect._stripe", return_value=stripe):
            result = stripe_connect.create_payout(
                account_id="acct_x",
                amount_cents=1000,
                method="instant",
                idempotency_key="k",
            )
        assert result["method"] == "standard"
