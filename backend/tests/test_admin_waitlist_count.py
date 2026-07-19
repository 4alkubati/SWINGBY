"""
test_admin_waitlist_count.py — CARD-23 GOAL 3 (audit K5 — waitlist-blind).

GET /admin/waitlist-count wires a live count off the Notion database that
both waitlist entry points (POST /waitlist/ and the Cloudflare Worker at
api.swingbyy.com/waitlist) write into — see app/api/admin.py::waitlist_count.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app

ADMIN = {
    "id": "admin-1",
    "role": "admin",
    "first_name": "Ad",
    "last_name": "Min",
    "email": "admin@example.com",
}

OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Handy",
    "last_name": "Owner",
    "email": "handy@example.com",
}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear_override():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_admin():
    _override(ADMIN)
    yield ADMIN
    _clear_override()


@pytest.fixture
def as_owner():
    _override(OWNER)
    yield OWNER
    _clear_override()


class TestWaitlistCountAuth:
    def test_non_admin_blocked(self, test_client, as_owner):
        response = test_client.get(
            "/admin/waitlist-count", headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 403

    def test_unauthenticated_blocked(self, test_client):
        response = test_client.get("/admin/waitlist-count")
        assert response.status_code == 401


class TestWaitlistCountQuery:
    def test_single_page_returns_exact_count(self, test_client, as_admin):
        mock_notion = MagicMock()
        mock_notion.databases.query.return_value = {
            "results": [{"id": f"row-{i}"} for i in range(7)],
            "has_more": False,
            "next_cursor": None,
        }
        with patch("app.api.admin.get_notion", return_value=mock_notion):
            response = test_client.get(
                "/admin/waitlist-count",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["count"] == 7
        assert body["source"] == "notion"
        mock_notion.databases.query.assert_called_once()

    def test_paginates_across_multiple_pages(self, test_client, as_admin):
        mock_notion = MagicMock()
        page_1 = {
            "results": [{"id": f"row-{i}"} for i in range(100)],
            "has_more": True,
            "next_cursor": "cursor-2",
        }
        page_2 = {
            "results": [{"id": f"row-{i}"} for i in range(23)],
            "has_more": False,
            "next_cursor": None,
        }
        mock_notion.databases.query.side_effect = [page_1, page_2]
        with patch("app.api.admin.get_notion", return_value=mock_notion):
            response = test_client.get(
                "/admin/waitlist-count",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 200
        assert response.json()["count"] == 123
        assert mock_notion.databases.query.call_count == 2
        # Second call must carry the cursor from the first page's response.
        second_call_kwargs = mock_notion.databases.query.call_args_list[1].kwargs
        assert second_call_kwargs["start_cursor"] == "cursor-2"

    def test_missing_notion_token_returns_500_not_crash(self, test_client, as_admin):
        with patch(
            "app.api.admin.get_notion",
            side_effect=RuntimeError("NOTION_TOKEN is not set"),
        ):
            response = test_client.get(
                "/admin/waitlist-count",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 500

    def test_notion_query_failure_returns_400_not_crash(self, test_client, as_admin):
        mock_notion = MagicMock()
        mock_notion.databases.query.side_effect = RuntimeError("boom")
        with patch("app.api.admin.get_notion", return_value=mock_notion):
            response = test_client.get(
                "/admin/waitlist-count",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 400
