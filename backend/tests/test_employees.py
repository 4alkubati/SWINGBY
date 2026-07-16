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
