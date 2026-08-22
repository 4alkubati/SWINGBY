"""A one-person business gets its jobs assigned to the owner AT CREATION.

`/complete` already back-filled the owner as a last resort, so a solo operator
could finish a job — but only at the very last step. For the whole life of the
booking `employee_id` was NULL, which meant live tracking, the job screens and
the assignee list all described work nobody was doing.

The rule these tests pin: the owner is NOT staff for the purposes of counting a
roster, but IS a legitimate assignee.
"""

from pathlib import Path
from unittest.mock import MagicMock

from app.services import staffing

# Resolved from THIS FILE: CI runs `pytest backend/tests` from the repo root,
# a local run is usually from backend/, and cwd-relative open() passes in one
# and raises FileNotFoundError in the other.
BACKEND = Path(__file__).resolve().parents[1]

OWNER = "owner-1"
BIZ = "biz-1"


class _Table:
    """Minimal supabase double: one canned result per table name."""

    def __init__(self, data):
        self._data = data
        self.inserted = None

    def __getattr__(self, name):
        def _call(*a, **k):
            if name == "insert":
                self.inserted = a[0] if a else None
            return self

        return _call

    def execute(self):
        return MagicMock(data=self._data)


def _client(employees):
    c = MagicMock()
    tables = {"employees": _Table(employees)}
    c.table.side_effect = lambda n: tables[n]
    c._tables = tables
    return c


class TestOtherActiveStaff:
    def test_the_owners_own_row_is_not_staff(self):
        c = _client([{"id": "e-owner", "user_id": OWNER, "is_active": True}])
        assert staffing.other_active_staff(BIZ, OWNER, c) == []
        assert staffing.is_solo(BIZ, OWNER, c) is True

    def test_a_real_employee_is_staff(self):
        c = _client(
            [
                {"id": "e-owner", "user_id": OWNER, "is_active": True},
                {"id": "e-2", "user_id": "someone-else", "is_active": True},
            ]
        )
        assert [e["id"] for e in staffing.other_active_staff(BIZ, OWNER, c)] == ["e-2"]
        assert staffing.is_solo(BIZ, OWNER, c) is False

    def test_an_inactive_employee_does_not_count(self):
        c = _client([{"id": "e-2", "user_id": "gone", "is_active": False}])
        assert staffing.is_solo(BIZ, OWNER, c) is True

    def test_a_read_failure_propagates(self):
        """Money paths must fail closed. An empty list has to mean 'verified
        solo', never 'could not look' — so this must raise, not return []."""
        c = MagicMock()
        c.table.side_effect = RuntimeError("supabase down")
        try:
            staffing.other_active_staff(BIZ, OWNER, c)
        except RuntimeError:
            return
        raise AssertionError("other_active_staff swallowed a read failure")


class TestSoloOwnerAssigneeId:
    def test_a_solo_business_resolves_to_the_owners_employee_row(self):
        c = _client([{"id": "e-owner", "user_id": OWNER, "is_active": True}])
        assert staffing.solo_owner_assignee_id(BIZ, OWNER, c) == "e-owner"

    def test_a_business_with_staff_is_not_auto_assigned(self):
        c = _client(
            [
                {"id": "e-owner", "user_id": OWNER, "is_active": True},
                {"id": "e-2", "user_id": "someone-else", "is_active": True},
            ]
        )
        assert staffing.solo_owner_assignee_id(BIZ, OWNER, c) is None

    def test_a_roster_failure_does_not_guess_solo(self):
        c = MagicMock()
        c.table.side_effect = RuntimeError("supabase down")
        assert staffing.solo_owner_assignee_id(BIZ, OWNER, c) is None

    def test_a_brand_new_solo_business_gets_an_owner_row_created(self):
        """No employees at all yet — the owner row is materialised so the
        booking has something real to point at."""
        created = {"id": "e-new", "user_id": OWNER, "is_active": True}
        calls = {"n": 0}

        class _Emp(_Table):
            def execute(self):
                calls["n"] += 1
                # 1st: roster (empty). 2nd: owner lookup (empty, triggers
                # insert). 3rd: re-read after insert.
                return MagicMock(data=[] if calls["n"] < 3 else [created])

        c = MagicMock()
        emp = _Emp([])
        c.table.side_effect = lambda n: emp
        assert staffing.solo_owner_assignee_id(BIZ, OWNER, c) == "e-new"
        assert emp.inserted["user_id"] == OWNER
        assert emp.inserted["role_title"] == staffing.OWNER_ROLE_TITLE

    def test_missing_ids_are_refused_rather_than_queried(self):
        c = MagicMock()
        assert staffing.solo_owner_assignee_id("", OWNER, c) is None
        assert staffing.solo_owner_assignee_id(BIZ, None, c) is None
        c.table.assert_not_called()


class TestTheBookingInsertCarriesIt:
    def test_accept_interest_sets_employee_id_on_the_new_booking(self):
        """The whole point: assigned at CREATION, not back-filled at complete."""
        src = (BACKEND / "app/api/interests.py").read_text(encoding="utf-8")
        assert "staffing.solo_owner_assignee_id(" in src
        # It must be part of the insert payload, not a later update.
        assert '"employee_id": staffing.solo_owner_assignee_id(' in src
        # owner_id has to be selected or the call above gets None forever.
        assert '"subscription_status, owner_id"' in src
