"""Sentinel sweep, 2026-08-01 — the backend half.

Three findings, each one a number or a control that disagreed with reality.
"""

import importlib
import inspect
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.main import app


class TestUnreadCountMatchesTheInbox:
    """The tab-bar badge and the inbox disagreed, permanently.

    `GET /messages/threads` drops any booking that is not confirmed /
    in_progress / completed, so a cancelled booking's thread vanishes. But
    `GET /messages/unread-count` counted every booking the user could access,
    with no status filter — and `cancel_booking` never clears `read_at`. So an
    unread message on a booking that later got cancelled counted toward the tab
    badge FOREVER, with no thread left anywhere in the app to open and clear it,
    while the Dashboard's own pill (built from the filtered thread list) showed a
    different, lower number for the same account at the same moment.
    """

    def test_one_constant_defines_which_bookings_have_threads(self):
        import app.api.messages as messages

        assert messages.THREADED_BOOKING_STATUSES == (
            "confirmed",
            "in_progress",
            "completed",
        )

    def test_unread_count_applies_that_filter(self):
        import app.api.messages as messages

        source = inspect.getsource(messages.unread_count)
        code = "\n".join(
            line for line in source.splitlines() if not line.strip().startswith("#")
        )
        assert "_thread_visible" in code, (
            "unread-count must exclude bookings whose thread is unreachable, or "
            "the badge counts messages nobody can ever open"
        )

    def test_thread_visible_agrees_with_the_inbox(self):
        import app.api.messages as messages

        for status in ("confirmed", "in_progress", "completed"):
            assert messages._thread_visible({"status": status}) is True
        for status in ("cancelled", "pending", "expired", None):
            assert messages._thread_visible({"status": status}) is False
        assert messages._thread_visible({}) is False

    def test_both_readers_use_the_helper_not_a_retyped_tuple(self):
        import app.api.messages as messages

        for fn in (messages.list_threads, messages.send_message):
            code = "\n".join(
                line
                for line in inspect.getsource(fn).splitlines()
                if not line.strip().startswith("#")
            )
            assert '"confirmed", "in_progress", "completed"' not in code, (
                f"{fn.__name__} retypes the status tuple — that is how these "
                "three readers drifted apart in the first place"
            )


class TestAdminEndpointsTheWebAppAlwaysCalled:
    """web/admin called three routes that did not exist.

    The Businesses page (the ONLY UI for the manual licence verification
    CLAUDE.md documents) could never load, and the Audit Log page fell back to
    five fabricated rows presented as real data with working filters over them.
    """

    def test_routes_are_registered(self):
        paths = app.openapi()["paths"]
        assert "/admin/businesses" in paths
        assert "get" in paths["/admin/businesses"]
        assert "/admin/businesses/{business_id}/verify" in paths
        assert "post" in paths["/admin/businesses/{business_id}/verify"]
        assert "/admin/audit-log" in paths
        assert "get" in paths["/admin/audit-log"]

    def test_they_all_require_an_admin(self, test_client):
        # Anonymous must never read the audit log or flip a licence.
        checks = (
            ("get", "/admin/businesses", {}),
            ("post", "/admin/businesses/abc/verify", {"json": {"verified": True}}),
            ("get", "/admin/audit-log", {}),
        )
        for method, path, kwargs in checks:
            res = getattr(test_client, method)(path, **kwargs)
            assert res.status_code in (401, 403), f"{method} {path} → {res.status_code}"

    def test_verify_writes_the_status_and_audits_it(self):
        import app.api.admin as admin_api

        source = inspect.getsource(admin_api.set_business_license)
        assert "license_status" in source
        assert "record_audit" in source, (
            "who verified a business, and when, is the only record we would have "
            "if one turned out not to be licensed"
        )

    def test_audit_log_reads_the_real_table(self):
        import app.api.admin as admin_api

        source = inspect.getsource(admin_api.read_audit_log)
        assert 'table("audit_log")' in source
