"""
test_employees.py — Tests for POST /employees/ (create_employee).

Coverage:
- Trigger-row case: a DB trigger on auth.users auto-inserts a bare
  public.users row (role='client', empty names) the instant
  auth.admin.create_user() runs. The old code then did an INSERT into
  users, which collided with that row -> 409 -> the endpoint 400s for
  every business (see docs/qa-audit-2026-07-16-uber-flow.md, P0 #1). The
  fix upserts instead (matches app/api/auth.py's signup fix for the same
  trigger). This test locks in that the endpoint succeeds and the write
  payload carries role='employee' with the submitted names, and that the
  collision-prone .insert() path is never used.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from tests.conftest import SupabaseTableStub

OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Biz",
    "last_name": "Owner",
    "email": "owner@example.com",
}


@pytest.fixture
def as_owner():
    app.dependency_overrides[get_current_user] = lambda: OWNER
    yield OWNER
    app.dependency_overrides.pop(get_current_user, None)


class TestCreateEmployeeTriggerRow:
    def test_trigger_row_already_exists_succeeds_via_upsert(
        self, test_client, as_owner
    ):
        """
        Simulates the prod trigger having already fired: by the time our
        code writes to `users`, a bare row (role='client', blank names)
        already exists for emp_user_id. The endpoint must succeed (no
        unhandled 409/400) and the write must upsert role='employee' +
        the submitted names, not attempt a colliding INSERT.
        """
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        users_stub = SupabaseTableStub()
        employees_stub = SupabaseTableStub(
            insert_data=[
                {
                    "id": "emp-1",
                    "business_id": "biz-1",
                    "user_id": "emp-user-1",
                    "role_title": "Cleaner",
                    "avatar_url": None,
                    "is_active": True,
                }
            ]
        )

        def _table(name):
            return {
                "businesses": biz_stub,
                "users": users_stub,
                "employees": employees_stub,
            }[name]

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            mock_user = MagicMock()
            mock_user.id = "emp-user-1"
            mock_supabase.auth.admin.create_user.return_value = MagicMock(
                user=mock_user
            )

            response = test_client.post(
                "/employees/",
                json={
                    "email": "jane@example.com",
                    "password": "SuperSecret123",
                    "first_name": "Jane",
                    "last_name": "Employee",
                    "phone": "555-1234",
                    "role_title": "Cleaner",
                },
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text

        # Fix must use .upsert(...) on the trigger-created row...
        upsert_calls = [c for c in users_stub.calls if c[0] == "upsert"]
        assert len(upsert_calls) == 1
        payload = upsert_calls[0][1][0]
        assert payload["id"] == "emp-user-1"
        assert payload["role"] == "employee"
        assert payload["first_name"] == "Jane"
        assert payload["last_name"] == "Employee"
        assert payload["phone"] == "555-1234"

        # ...and must NOT fall back to the collision-prone .insert() path.
        insert_calls = [c for c in users_stub.calls if c[0] == "insert"]
        assert insert_calls == []

        body = response.json()
        assert body["employee"]["user_id"] == "emp-user-1"


class TestUpdateEmployee:
    """PATCH /employees/{id} — F103: EmployeeEditModal's Role Title field had
    no endpoint to persist to; the mobile fix now calls this."""

    def test_updates_role_title_for_own_business(self, test_client, as_owner):
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        emp_stub = SupabaseTableStub(
            select_data={"id": "emp-1"},
            update_data=[{"id": "emp-1", "role_title": "Senior Cleaner"}],
        )

        def _table(name):
            return {"businesses": biz_stub, "employees": emp_stub}[name]

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            response = test_client.patch(
                "/employees/emp-1",
                json={"role_title": "Senior Cleaner"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 200, response.text
        assert response.json()["employee"]["role_title"] == "Senior Cleaner"

        update_calls = [c for c in emp_stub.calls if c[0] == "update"]
        assert len(update_calls) == 1
        assert update_calls[0][1][0] == {"role_title": "Senior Cleaner"}

        # Scoped to the owner's own business, not any employee id.
        eq_calls = [c for c in emp_stub.calls if c[0] == "eq"]
        assert ("eq", ("business_id", "biz-1"), {}) in eq_calls

    def test_404s_for_an_employee_outside_the_caller_s_business(
        self, test_client, as_owner
    ):
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        # The ownership-scoped select finds nothing: this employee belongs to
        # a different business.
        emp_stub = SupabaseTableStub(select_data=None)

        def _table(name):
            return {"businesses": biz_stub, "employees": emp_stub}[name]

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            response = test_client.patch(
                "/employees/someone-elses-emp",
                json={"role_title": "Senior Cleaner"},
                headers={"Authorization": "Bearer test-token"},
            )

        assert response.status_code == 404

    def test_non_owner_is_forbidden(self, test_client):
        app.dependency_overrides[get_current_user] = lambda: {
            "id": "u1",
            "role": "client",
        }
        try:
            response = test_client.patch(
                "/employees/emp-1",
                json={"role_title": "Senior Cleaner"},
                headers={"Authorization": "Bearer test-token"},
            )
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        assert response.status_code == 403


class TestPublicRosterHardening:
    """GET /employees/business/{id} — public trust card, hardened 2026-07-21:
    only active employees, and user_id never in the select/payload."""

    def test_filters_inactive_and_omits_user_id(self, test_client, as_owner):
        roster_stub = SupabaseTableStub(
            select_data=[
                {
                    "id": "emp-1",
                    "business_id": "biz-1",
                    "role_title": "Cleaner",
                    "is_active": True,
                    "avatar_url": None,
                    "created_at": "2026-01-01T00:00:00Z",
                    "users": {
                        "first_name": "Jane",
                        "last_name": "Doe",
                        "avatar_url": None,
                    },
                }
            ]
        )
        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = lambda name: roster_stub
            resp = test_client.get(
                "/employees/business/biz-1",
                headers={"Authorization": "Bearer test-token"},
            )
        assert resp.status_code == 200, resp.text

        # (i) an is_active=True equality filter was applied.
        eq_calls = [c for c in roster_stub.calls if c[0] == "eq"]
        assert ("eq", ("is_active", True), {}) in eq_calls

        # (ii) user_id is neither selected nor returned to the caller.
        select_calls = [c for c in roster_stub.calls if c[0] == "select"]
        assert select_calls, "expected a select() call"
        select_arg = select_calls[0][1][0]
        assert "user_id" not in select_arg
        body = resp.json()
        assert body and "user_id" not in body[0]


# ── Founder ruling 2026-07-25 — the owner on the PUBLIC team card ─────────────


def _employee(emp_id: str, role_title: str = "Cleaner") -> dict:
    return {
        "id": emp_id,
        "business_id": "biz-1",
        "role_title": role_title,
        "is_active": True,
        "avatar_url": None,
        "created_at": "2026-01-01T00:00:00Z",
        "users": {"first_name": "Team", "last_name": emp_id, "avatar_url": None},
    }


def _roster_call(monkeypatched_rows, owner_employee_id="emp-owner"):
    """Run GET /employees/business/biz-1 against a fixed active roster.

    The business lookup and the owner's-employee-row lookup are routed to their
    own stubs so the test controls exactly who the owner is, independent of the
    roster payload.
    """
    roster_stub = SupabaseTableStub(select_data=monkeypatched_rows)
    business_stub = SupabaseTableStub(select_data={"owner_id": "owner-user-1"})
    owner_emp_stub = SupabaseTableStub(select_data=[{"id": owner_employee_id}])

    state = {"employees_calls": 0}

    def _table(name):
        if name == "businesses":
            return business_stub
        # employees is queried twice: first the roster, then (only for a big
        # team) the owner's own row.
        state["employees_calls"] += 1
        return roster_stub if state["employees_calls"] == 1 else owner_emp_stub

    return roster_stub, business_stub, _table


class TestOwnerOnPublicTeamCard:
    """The owner is ALWAYS internally assignable; on the PUBLIC card they are
    listed only while the business is small.

    "Small" is employees.SMALL_BUSINESS_MAX_TEAM_SIZE active members, counting
    the owner. These tests read the constant rather than hardcoding it, so
    retuning the number retunes the tests with it.
    """

    def test_small_business_keeps_the_owner_on_the_card(self, test_client, as_owner):
        from app.api import employees as employees_api

        size = employees_api.SMALL_BUSINESS_MAX_TEAM_SIZE
        rows = [_employee("emp-owner", "Owner")] + [
            _employee(f"emp-{i}") for i in range(size - 1)
        ]
        _, _, _table = _roster_call(rows)

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            resp = test_client.get(
                "/employees/business/biz-1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        ids = [r["id"] for r in resp.json()]
        assert "emp-owner" in ids
        assert len(ids) == size

    def test_solo_operator_is_their_own_team_card(self, test_client, as_owner):
        """The whole point of the ruling: a one-person business is not empty."""
        _, _, _table = _roster_call([_employee("emp-owner", "Owner")])

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            resp = test_client.get(
                "/employees/business/biz-1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        assert [r["id"] for r in resp.json()] == ["emp-owner"]

    def test_large_business_drops_the_owner_from_the_card(self, test_client, as_owner):
        from app.api import employees as employees_api

        size = employees_api.SMALL_BUSINESS_MAX_TEAM_SIZE
        # One over the line — the boundary case that must flip.
        rows = [_employee("emp-owner", "Owner")] + [
            _employee(f"emp-{i}") for i in range(size)
        ]
        _, _, _table = _roster_call(rows)

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            resp = test_client.get(
                "/employees/business/biz-1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        ids = [r["id"] for r in resp.json()]
        assert "emp-owner" not in ids
        assert len(ids) == size
        # ...and it dropped the OWNER, not just "the first row".
        assert all(i.startswith("emp-") and i != "emp-owner" for i in ids)

    def test_boundary_is_exactly_at_the_threshold(self, test_client, as_owner):
        """AT the threshold the owner stays; one PAST it they go. Both sides of
        the same line, so an off-by-one cannot pass."""
        from app.api import employees as employees_api

        size = employees_api.SMALL_BUSINESS_MAX_TEAM_SIZE
        results = {}
        for total in (size, size + 1):
            rows = [_employee("emp-owner", "Owner")] + [
                _employee(f"emp-{i}") for i in range(total - 1)
            ]
            _, _, _table = _roster_call(rows)
            with patch("app.api.employees.supabase") as mock_supabase:
                mock_supabase.table.side_effect = _table
                resp = test_client.get(
                    "/employees/business/biz-1",
                    headers={"Authorization": "Bearer test-token"},
                )
            results[total] = [r["id"] for r in resp.json()]

        assert "emp-owner" in results[size]
        assert "emp-owner" not in results[size + 1]

    def test_unknown_owner_never_blanks_a_team_member(self, test_client, as_owner):
        """If we cannot tell WHO the owner is, show everyone.

        Guessing would hide a real, named employee from a trust card — strictly
        worse than showing an owner who should have been filtered.
        """
        from app.api import employees as employees_api

        size = employees_api.SMALL_BUSINESS_MAX_TEAM_SIZE
        rows = [_employee(f"emp-{i}") for i in range(size + 1)]

        roster_stub = SupabaseTableStub(select_data=rows)
        # businesses lookup blows up -> owner unknown.
        business_stub = SupabaseTableStub(select_data=None)

        def _table(name):
            return business_stub if name == "businesses" else roster_stub

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            resp = test_client.get(
                "/employees/business/biz-1",
                headers={"Authorization": "Bearer test-token"},
            )

        assert resp.status_code == 200, resp.text
        assert len(resp.json()) == size + 1

    def test_public_card_filter_does_not_touch_the_internal_roster(
        self, test_client, as_owner
    ):
        """GET /employees/ is the ASSIGNABLE roster. The owner must survive it
        at ANY team size — regressing this re-breaks the solo-operator assign
        fix the jobs lane landed.
        """
        from app.api import employees as employees_api

        size = employees_api.SMALL_BUSINESS_MAX_TEAM_SIZE
        rows = [_employee("emp-owner", "Owner")] + [
            _employee(f"emp-{i}") for i in range(size + 3)
        ]
        biz_stub = SupabaseTableStub(select_data={"id": "biz-1"})
        roster_stub = SupabaseTableStub(select_data=rows)

        def _table(name):
            return biz_stub if name == "businesses" else roster_stub

        with patch("app.api.employees.supabase") as mock_supabase:
            mock_supabase.table.side_effect = _table
            resp = test_client.get(
                "/employees/", headers={"Authorization": "Bearer test-token"}
            )

        assert resp.status_code == 200, resp.text
        ids = [r["id"] for r in resp.json()]
        assert "emp-owner" in ids, "the owner must stay assignable at every size"
        assert len(ids) == len(rows)
