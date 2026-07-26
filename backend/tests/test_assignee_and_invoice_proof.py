"""
test_assignee_and_invoice_proof.py — walkthrough M8 + M4.

M8 "Employee assignment that makes sense"
    The founder's walkthrough dead-ended on the literal string "No active
    employees found." A one-person business has no `employees` rows at all, so
    the assign picker was empty and the job could never be handed to anybody —
    including the owner, who was the person actually going. Covered here:

      - the roster is never empty: the owner is materialised and returned first
      - `employee_id: "owner"` assigns the owner without them being invited staff
      - assignment works BEFORE the date handshake closes ('pending')
      - assignment is still refused on completed/cancelled bookings — the one
        thing the original status guard existed to prevent
      - the derived assignee block: business until assigned, then the person
      - **no fake zeros**: a count that could not be computed is null, while a
        genuine zero stays 0 (they mean different things and must not collapse)

M4 "Invoices off the Past tab: past jobs + invoice + before/after photos"
    The receipt now carries the before/after record, and a photo read that
    fails degrades to empty rather than 500ing the receipt.
"""

from unittest.mock import patch

import pytest

from app.api import bookings as bookings_api
from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

BOOKING_UUID = "44444444-4444-4444-4444-444444444444"

OWNER = {"id": "owner-1", "role": "business_owner"}
CLIENT = {"id": "client-1", "role": "client"}

BUSINESS = {"id": "biz-1", "business_name": "Test Cleaning Co.", "owner_id": "owner-1"}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


@pytest.fixture
def as_owner():
    _override(OWNER)
    yield OWNER
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    app.dependency_overrides.pop(get_current_user, None)


def _multi_table(stubs, default=None):
    def _table(name):
        return stubs.get(name, default)

    return _table


def _booking_row(**overrides):
    row = {
        "id": BOOKING_UUID,
        "client_id": "client-1",
        "business_id": "biz-1",
        "employee_id": None,
        "status": "confirmed",
        "payment_status": "pending_payment",
        "total_amount": 200.0,
        "confirmed_date": None,
        "service_category": "Cleaning",
    }
    row.update(overrides)
    return row


def _employee_row(**overrides):
    row = {
        "id": "emp-owner",
        "business_id": "biz-1",
        "user_id": "owner-1",
        "role_title": "Owner",
        "avatar_url": None,
        "is_active": True,
        "created_at": "2025-07-25T00:00:00+00:00",
        "users": {"first_name": "Ali", "last_name": "Owner", "avatar_url": None},
    }
    row.update(overrides)
    return row


# ── The dead end itself ──────────────────────────────────────────────────────


class TestOwnerIsAlwaysAssignable:
    def test_roster_is_never_empty_for_a_business_with_no_staff(
        self, test_client, as_owner
    ):
        """The exact walkthrough bug: zero invited employees must still yield a
        roster, with the owner in it."""
        booking_stub = SupabaseTableStub(select_data=_booking_row())
        biz_stub = SupabaseTableStub(select_data=dict(BUSINESS))
        # The business starts with no employees at all — the walkthrough's
        # actual state. The first owner lookup misses, _ensure_owner_employee
        # inserts, and the re-read finds the row it just created.
        emp_stub = SupabaseTableStub(select_data=[])
        empty_reads = {"n": 0}

        def _employees_table():
            if empty_reads["n"] == 0:
                empty_reads["n"] += 1
                emp_stub._data["select"] = []
            else:
                emp_stub._data["select"] = [_employee_row()]
            return emp_stub

        with patch("app.api.bookings.supabase") as mock:
            mock.table.side_effect = lambda name: (
                _employees_table()
                if name == "employees"
                else {"bookings": booking_stub, "businesses": biz_stub}.get(name)
            )
            resp = test_client.get(
                f"/bookings/{BOOKING_UUID}/assignees",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["items"], "the roster must never be empty — the owner is in it"
        owner = body["items"][0]
        assert owner["is_owner"] is True
        assert owner["is_you"] is True
        assert owner["name"] == "Ali Owner"

    def test_owner_sentinel_assigns_without_an_invited_employee(
        self, test_client, as_owner
    ):
        """`employee_id: "owner"` must not be looked up as a normal employee id."""
        booking_stub = SupabaseTableStub(
            select_data=_booking_row(),
            update_data=[_booking_row(employee_id="emp-owner")],
        )
        biz_stub = SupabaseTableStub(select_data=dict(BUSINESS))
        emp_stub = SupabaseTableStub(select_data=[_employee_row()])

        with patch("app.api.bookings.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": biz_stub,
                    "employees": emp_stub,
                }
            )
            resp = test_client.patch(
                f"/bookings/{BOOKING_UUID}/assign-employee",
                json={"employee_id": "owner"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        update_calls = [c for c in booking_stub.calls if c[0] == "update"]
        assert update_calls, "the booking was never updated"
        # The sentinel must be resolved to a real employees.id before it is written.
        assert update_calls[0][1][0]["employee_id"] == "emp-owner"

    def test_non_owner_cannot_read_the_roster(self, test_client, as_client):
        resp = test_client.get(
            f"/bookings/{BOOKING_UUID}/assignees",
            headers={"Authorization": "Bearer test-token"},
        )
        assert resp.status_code == 403


# ── The relaxed status guard ─────────────────────────────────────────────────


class TestAssignBeforeApproval:
    """M8: "Owner can assign BEFORE the job is approved."

    The guard was an allow-list of ('confirmed', 'in_progress'); it is now a
    deny-list of ('completed', 'cancelled'). These two tests pin BOTH halves:
    the new capability, and the protection the old guard actually provided.
    """

    def _run(self, test_client, status, employee_id="emp-1"):
        booking_stub = SupabaseTableStub(
            select_data=_booking_row(status=status),
            update_data=[_booking_row(status=status, employee_id="emp-1")],
        )
        biz_stub = SupabaseTableStub(select_data=dict(BUSINESS))
        emp_stub = SupabaseTableStub(
            select_data={"id": "emp-1", "is_active": True},
        )
        with patch("app.api.bookings.supabase") as mock:
            mock.table.side_effect = _multi_table(
                {
                    "bookings": booking_stub,
                    "businesses": biz_stub,
                    "employees": emp_stub,
                }
            )
            return test_client.patch(
                f"/bookings/{BOOKING_UUID}/assign-employee",
                json={"employee_id": employee_id},
                headers={"Authorization": "Bearer test-token"},
            )

    @pytest.mark.parametrize("status", ["pending", "confirmed", "in_progress"])
    def test_assignable_while_the_job_is_still_live(
        self, test_client, as_owner, status
    ):
        assert self._run(test_client, status).status_code == 200

    @pytest.mark.parametrize("status", ["completed", "cancelled"])
    def test_terminal_bookings_still_refuse_reassignment(
        self, test_client, as_owner, status
    ):
        """Re-attributing work after the money has settled stays blocked —
        that is the whole reason the original guard existed."""
        resp = self._run(test_client, status)
        assert resp.status_code == 400
        assert status in resp.json()["detail"]


# ── The derived assignee block ───────────────────────────────────────────────


class TestAssigneeDerivation:
    def test_unassigned_booking_presents_the_business(self):
        out = bookings_api._unassigned_assignee(dict(BUSINESS))
        assert out["type"] == "business"
        assert out["name"] == "Test Cleaning Co."
        assert out["employee_id"] is None
        # Nothing is claimed about a person who does not exist yet.
        assert out["jobs_completed"] is None
        assert out["tenure_days"] is None

    def test_assigned_booking_presents_the_person_with_credentials(self):
        out = bookings_api._assignee_from_employee(_employee_row(), dict(BUSINESS), 12)
        assert out["type"] == "employee"
        assert out["name"] == "Ali Owner"
        assert out["is_owner"] is True
        assert out["jobs_completed"] == 12
        assert out["tenure_label"] == "1 year"
        assert out["business_name"] == "Test Cleaning Co."

    def test_uncomputable_job_count_is_null_never_zero(self):
        """A figure we could not compute and a figure that IS zero are
        different facts. Collapsing them is how a placeholder gets shipped as
        a real credential — Kira has rejected fake $0.00-style values before."""
        unknown = bookings_api._assignee_from_employee(
            _employee_row(), dict(BUSINESS), None
        )
        assert unknown["jobs_completed"] is None

        genuinely_new = bookings_api._assignee_from_employee(
            _employee_row(), dict(BUSINESS), 0
        )
        assert genuinely_new["jobs_completed"] == 0

    def test_completed_counts_return_none_when_the_query_fails(self):
        class Exploding(SupabaseTableStub):
            def execute(self):
                raise RuntimeError("postgrest is down")

        with patch("app.api.bookings.supabase") as mock:
            mock.table.return_value = Exploding()
            assert bookings_api._completed_job_counts(["emp-1"]) is None

    def test_completed_counts_report_a_real_zero(self):
        """An employee with no completed bookings comes back as 0, not missing —
        so the UI can honestly say "new to the team"."""
        with patch("app.api.bookings.supabase") as mock:
            mock.table.return_value = SupabaseTableStub(select_data=[])
            assert bookings_api._completed_job_counts(["emp-1"]) == {"emp-1": 0}

    def test_unknown_tenure_is_not_invented(self):
        assert bookings_api._tenure(None) == (None, None)
        assert bookings_api._tenure("not-a-date") == (None, None)

    def test_attach_assignee_never_raises_when_lookups_fail(self):
        """A booking read must not 500 because the roster could not resolve."""

        class Exploding(SupabaseTableStub):
            def execute(self):
                raise RuntimeError("postgrest is down")

        rows = [_booking_row(employee_id="emp-1")]
        with patch("app.api.bookings.supabase") as mock:
            mock.table.return_value = Exploding()
            bookings_api._attach_assignee(rows)

        assert rows[0]["assignee"]["type"] == "business"
        assert rows[0]["assignee"]["jobs_completed"] is None


# ── M4: proof photos on the receipt ──────────────────────────────────────────


class TestInvoiceProofPhotos:
    def test_photos_split_by_phase_and_source(self):
        from app.api import invoices as invoices_api

        rows = [
            {"id": "1", "url": "b1.jpg", "phase": "before", "source": "business"},
            {"id": "2", "url": "a1.jpg", "phase": "after", "source": "business"},
            {"id": "3", "url": "c1.jpg", "phase": "before", "source": "client"},
            # No url — cannot be rendered, must not become a broken tile.
            {"id": "4", "url": None, "phase": "after", "source": "business"},
        ]
        with patch("app.api.invoices.supabase") as mock:
            mock.table.return_value = SupabaseTableStub(select_data=rows)
            out = invoices_api._proof_photos(BOOKING_UUID)

        assert [p["url"] for p in out["before"]] == ["b1.jpg"]
        assert [p["url"] for p in out["after"]] == ["a1.jpg"]
        # A client's own job-post photo is never presented as the business's
        # record of the work (same rule proof_of_work.py enforces).
        assert [p["url"] for p in out["client_supplied"]] == ["c1.jpg"]

    def test_photo_read_failure_does_not_break_the_receipt(self):
        from app.api import invoices as invoices_api

        class Exploding(SupabaseTableStub):
            def execute(self):
                raise RuntimeError("postgrest is down")

        with patch("app.api.invoices.supabase") as mock:
            mock.table.return_value = Exploding()
            out = invoices_api._proof_photos(BOOKING_UUID)

        assert out == {"before": [], "after": [], "client_supplied": []}

    def test_completion_date_comes_from_booking_events(self):
        """`bookings.completed_at` is named by the schema doc but written by
        nothing in backend/app and defined by no migration. Selecting a column
        that does not exist is what 500'd every invoice once before
        (payments.notes — see test_invoices.py), so the date is read from the
        'completed' booking_events row instead."""
        from app.api import invoices as invoices_api

        with patch("app.api.invoices.supabase") as mock:
            mock.table.return_value = SupabaseTableStub(
                select_data=[{"created_at": "2026-07-24T18:00:00+00:00"}]
            )
            assert (
                invoices_api._completed_at(BOOKING_UUID) == "2026-07-24T18:00:00+00:00"
            )

    def test_invoice_select_does_not_name_completed_at(self):
        """Guard against a future "obvious fix" reintroducing the phantom
        column onto the bookings SELECT."""
        import inspect

        from app.api import invoices as invoices_api

        src = inspect.getsource(invoices_api._load_invoice_data)
        select_arg = src.split(".select(")[1].split(")")[0]
        assert "completed_at" not in select_arg
