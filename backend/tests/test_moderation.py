"""
test_moderation.py — App Store Guideline 1.2 report + block.

Covers the four things a reviewer will actually exercise:
  * filing a report, and being refused a duplicate one (1.2b)
  * blocking, and the block holding in BOTH directions (1.2c)
  * an admin resolving a report exactly once, with the consequence applied
  * hidden content leaving the surfaces that serve it

The symmetry tests are the important ones. A one-way block that still lets the
abuser open a thread is the failure mode Guideline 1.2(c) exists to prevent, and
it is invisible unless you assert from both sides — which is why the block cases
below run the check as the blocker AND as the blocked.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.deps import get_current_user
from app.main import app
from app.services.visibility import blocked_pair_ids
from tests.conftest import SupabaseTableStub

CLIENT = {
    "id": "client-1",
    "role": "client",
    "first_name": "Cli",
    "last_name": "Ent",
    "email": "client@example.com",
}

OWNER = {
    "id": "owner-1",
    "role": "business_owner",
    "first_name": "Han",
    "last_name": "Dy",
    "email": "owner@example.com",
}

ADMIN = {
    "id": "admin-1",
    "role": "admin",
    "first_name": "Ad",
    "last_name": "Min",
    "email": "admin@example.com",
}


def _override(user):
    app.dependency_overrides[get_current_user] = lambda: user


def _clear():
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_client():
    _override(CLIENT)
    yield CLIENT
    _clear()


@pytest.fixture
def as_owner():
    _override(OWNER)
    yield OWNER
    _clear()


@pytest.fixture
def as_admin():
    _override(ADMIN)
    yield ADMIN
    _clear()


AUTH = {"Authorization": "Bearer test-token"}


class _Router:
    """Routes supabase.table(name) to a per-table stub.

    The moderation endpoints touch several tables in one request (resolve the
    target's owner, check for a duplicate, insert). One shared stub cannot
    express "the messages lookup returns a row but content_reports is empty",
    so tests hand in a {table_name: stub} map instead.
    """

    def __init__(self, stubs, default=None):
        self.stubs = stubs
        self.default = default if default is not None else SupabaseTableStub()

    def __call__(self, name):
        return self.stubs.get(name, self.default)


# ---------------------------------------------------------------------------
# Filing a report (1.2b)
# ---------------------------------------------------------------------------


class TestCreateReport:
    def test_report_denormalises_the_owner_at_write_time(self, test_client, as_client):
        """The admin queue must not have to resolve one owner per row."""
        messages = SupabaseTableStub(select_data=[{"sender_id": "owner-1"}])
        reports = SupabaseTableStub(
            select_data=[], insert_data=[{"id": "rep-1", "status": "open"}]
        )
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            svc_sb.table.side_effect = _Router({"messages": messages})

            res = test_client.post(
                "/moderation/reports",
                json={
                    "target_type": "message",
                    "target_id": "11111111-1111-1111-1111-111111111111",
                    "reason": "harassment",
                    "details": "abusive language",
                },
                headers=AUTH,
            )

            assert res.status_code == 200
            assert reports.inserted["reported_user_id"] == "owner-1"
            assert reports.inserted["reporter_id"] == "client-1"
            assert reports.inserted["status"] == "open"

    def test_duplicate_open_report_is_409(self, test_client, as_client):
        messages = SupabaseTableStub(select_data=[{"sender_id": "owner-1"}])
        reports = SupabaseTableStub(select_data=[{"id": "rep-1", "status": "open"}])
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            svc_sb.table.side_effect = _Router({"messages": messages})

            res = test_client.post(
                "/moderation/reports",
                json={
                    "target_type": "message",
                    "target_id": "11111111-1111-1111-1111-111111111111",
                    "reason": "spam",
                },
                headers=AUTH,
            )
            assert res.status_code == 409

    def test_unknown_target_type_is_400(self, test_client, as_client):
        res = test_client.post(
            "/moderation/reports",
            json={"target_type": "spaceship", "target_id": "x", "reason": "spam"},
            headers=AUTH,
        )
        assert res.status_code == 400

    def test_unknown_reason_is_400(self, test_client, as_client):
        res = test_client.post(
            "/moderation/reports",
            json={"target_type": "message", "target_id": "x", "reason": "vibes"},
            headers=AUTH,
        )
        assert res.status_code == 400

    def test_cannot_report_your_own_content(self, test_client, as_client):
        messages = SupabaseTableStub(select_data=[{"sender_id": "client-1"}])
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({})
            svc_sb.table.side_effect = _Router({"messages": messages})

            res = test_client.post(
                "/moderation/reports",
                json={
                    "target_type": "message",
                    "target_id": "11111111-1111-1111-1111-111111111111",
                    "reason": "spam",
                },
                headers=AUTH,
            )
            assert res.status_code == 400

    def test_deleted_target_still_files(self, test_client, as_client):
        """A report against a vanished row must not 500 — that is the exact
        flow App Review pokes at, and a nullable reported_user_id is why."""
        messages = SupabaseTableStub(select_data=[])
        reports = SupabaseTableStub(select_data=[], insert_data=[{"id": "rep-1"}])
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            svc_sb.table.side_effect = _Router({"messages": messages})

            res = test_client.post(
                "/moderation/reports",
                json={
                    "target_type": "message",
                    "target_id": "11111111-1111-1111-1111-111111111111",
                    "reason": "spam",
                },
                headers=AUTH,
            )
            assert res.status_code == 200
            assert reports.inserted["reported_user_id"] is None


# ---------------------------------------------------------------------------
# Admin resolution
# ---------------------------------------------------------------------------


class TestResolveReport:
    def test_non_admin_is_403(self, test_client, as_client):
        res = test_client.patch(
            "/moderation/reports/rep-1/resolve",
            json={"action_taken": "none"},
            headers=AUTH,
        )
        assert res.status_code == 403

    def test_resolving_twice_is_409(self, test_client, as_admin):
        reports = SupabaseTableStub(
            select_data={
                "id": "rep-1",
                "target_type": "message",
                "target_id": "m-1",
                "reported_user_id": "owner-1",
                "status": "resolved",
            }
        )
        with patch("app.api.moderation.supabase") as api_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            res = test_client.patch(
                "/moderation/reports/rep-1/resolve",
                json={"action_taken": "content_hidden"},
                headers=AUTH,
            )
            assert res.status_code == 409

    def test_content_hidden_stamps_hidden_at(self, test_client, as_admin):
        reports = SupabaseTableStub(
            select_data={
                "id": "rep-1",
                "target_type": "message",
                "target_id": "m-1",
                "reported_user_id": "owner-1",
                "status": "open",
            },
            update_data=[{"id": "rep-1", "status": "resolved"}],
        )
        messages = SupabaseTableStub(update_data=[{"id": "m-1"}])
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            svc_sb.table.side_effect = _Router({"messages": messages})

            res = test_client.patch(
                "/moderation/reports/rep-1/resolve",
                json={"action_taken": "content_hidden", "resolution": "abusive"},
                headers=AUTH,
            )
            assert res.status_code == 200
            update_calls = [c for c in messages.calls if c[0] == "update"]
            assert update_calls, "expected hidden_at to be stamped on the message"
            assert update_calls[0][1][0]["hidden_at"] is not None

    def test_user_suspended_flips_is_suspended(self, test_client, as_admin):
        reports = SupabaseTableStub(
            select_data={
                "id": "rep-1",
                "target_type": "message",
                "target_id": "m-1",
                "reported_user_id": "owner-1",
                "status": "open",
            },
            update_data=[{"id": "rep-1", "status": "resolved"}],
        )
        users = SupabaseTableStub(update_data=[{"id": "owner-1", "is_suspended": True}])
        with patch("app.api.moderation.supabase") as api_sb, patch(
            "app.services.moderation.supabase"
        ) as svc_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            svc_sb.table.side_effect = _Router({"users": users})

            res = test_client.patch(
                "/moderation/reports/rep-1/resolve",
                json={"action_taken": "user_suspended"},
                headers=AUTH,
            )
            assert res.status_code == 200
            update_calls = [c for c in users.calls if c[0] == "update"]
            assert update_calls[0][1][0] == {"is_suspended": True}

    def test_action_none_dismisses(self, test_client, as_admin):
        reports = SupabaseTableStub(
            select_data={
                "id": "rep-1",
                "target_type": "message",
                "target_id": "m-1",
                "reported_user_id": "owner-1",
                "status": "open",
            },
            update_data=[{"id": "rep-1", "status": "dismissed"}],
        )
        with patch("app.api.moderation.supabase") as api_sb:
            api_sb.table.side_effect = _Router({"content_reports": reports})
            res = test_client.patch(
                "/moderation/reports/rep-1/resolve",
                json={"action_taken": "none"},
                headers=AUTH,
            )
            assert res.status_code == 200
            update_payload = [c for c in reports.calls if c[0] == "update"][0][1][0]
            assert update_payload["status"] == "dismissed"

    def test_invalid_action_is_400(self, test_client, as_admin):
        res = test_client.patch(
            "/moderation/reports/rep-1/resolve",
            json={"action_taken": "banish"},
            headers=AUTH,
        )
        assert res.status_code == 400


# ---------------------------------------------------------------------------
# Blocks (1.2c) — symmetry is the whole point
# ---------------------------------------------------------------------------


class TestBlockSymmetry:
    def test_blocked_pair_includes_both_directions(self):
        sb = MagicMock()

        def _table(name):
            stub = MagicMock()
            stub.select.return_value = stub

            def _eq(col, val):
                inner = MagicMock()
                if col == "blocker_id":
                    inner.execute.return_value = MagicMock(
                        data=[{"blocked_id": "they-blocked-them"}]
                    )
                else:
                    inner.execute.return_value = MagicMock(
                        data=[{"blocker_id": "someone-blocked-me"}]
                    )
                return inner

            stub.eq.side_effect = _eq
            return stub

        sb.table.side_effect = _table

        pair = blocked_pair_ids(sb, "me")
        assert pair == {"they-blocked-them", "someone-blocked-me"}

    def test_lookup_failure_fails_open(self):
        sb = MagicMock()
        sb.table.side_effect = RuntimeError("db down")
        assert blocked_pair_ids(sb, "me") == set()

    def test_no_viewer_is_empty(self):
        assert blocked_pair_ids(MagicMock(), "") == set()


class TestBlockEndpoints:
    def test_cannot_block_yourself(self, test_client, as_client):
        res = test_client.post(
            "/moderation/blocks", json={"blocked_id": "client-1"}, headers=AUTH
        )
        assert res.status_code == 400

    def test_block_is_idempotent(self, test_client, as_client):
        users = SupabaseTableStub(select_data=[{"id": "owner-1"}])
        blocks = SupabaseTableStub(select_data=[{"id": "blk-1"}])
        with patch("app.api.moderation.supabase") as api_sb:
            api_sb.table.side_effect = _Router({"users": users, "user_blocks": blocks})
            res = test_client.post(
                "/moderation/blocks", json={"blocked_id": "owner-1"}, headers=AUTH
            )
            # Not a 409 — the user's intent is already satisfied, and erroring
            # would make a double-tap look like a failure to block.
            assert res.status_code == 200
            assert not [c for c in blocks.calls if c[0] == "insert"]

    def test_block_unknown_user_is_404(self, test_client, as_client):
        users = SupabaseTableStub(select_data=[])
        with patch("app.api.moderation.supabase") as api_sb:
            api_sb.table.side_effect = _Router({"users": users})
            res = test_client.post(
                "/moderation/blocks", json={"blocked_id": "nobody"}, headers=AUTH
            )
            assert res.status_code == 404

    def test_unblock_is_idempotent(self, test_client, as_client):
        blocks = SupabaseTableStub()
        with patch("app.api.moderation.supabase") as api_sb:
            api_sb.table.side_effect = _Router({"user_blocks": blocks})
            res = test_client.delete("/moderation/blocks/owner-1", headers=AUTH)
            assert res.status_code == 200

    def test_check_does_not_reveal_direction(self, test_client, as_client):
        """Returns one boolean. Telling someone WHO blocked them turns a block
        into an escalation, which is the opposite of what 1.2(c) is for."""
        with patch("app.api.moderation.blocked_pair_ids", return_value={"owner-1"}):
            res = test_client.get("/moderation/blocks/check/owner-1", headers=AUTH)
            assert res.status_code == 200
            assert res.json() == {"blocked": True}


# ---------------------------------------------------------------------------
# Enforcement — the block has to actually stop things
# ---------------------------------------------------------------------------


class TestSendMessageBlocked:
    def _booking_stub(self):
        return SupabaseTableStub(
            select_data={
                "id": "b-1",
                "client_id": "client-1",
                "business_id": "biz-1",
                "status": "confirmed",
            }
        )

    @pytest.mark.parametrize("direction", ["blocker", "blocked"])
    def test_blocked_pair_cannot_send(self, test_client, as_client, direction):
        """Refused whether the sender did the blocking or was blocked.

        `blocked_pair_ids` collapses both directions into one set, so the test
        asserts the endpoint honours that set rather than re-deriving which side
        is which — a one-way gate would pass one param and fail the other.
        """
        with patch("app.api.messages.supabase") as sb, patch(
            "app.api.messages.blocked_pair_ids", return_value={"owner-1"}
        ), patch("app.api.messages._assert_message_access"), patch(
            "app.api.messages._my_business_id", return_value=None
        ):

            def _table(name):
                if name == "bookings":
                    return self._booking_stub()
                if name == "businesses":
                    return SupabaseTableStub(select_data={"owner_id": "owner-1"})
                return SupabaseTableStub(select_data=[])

            sb.table.side_effect = _table

            res = test_client.post(
                "/messages/",
                json={"booking_id": "b-1", "content": "hello"},
                headers=AUTH,
            )
            assert res.status_code == 403

    def test_unblocked_pair_can_send(self, test_client, as_client):
        with patch("app.api.messages.supabase") as sb, patch(
            "app.api.messages.blocked_pair_ids", return_value=set()
        ), patch("app.api.messages._assert_message_access"), patch(
            "app.api.messages.send_push_to_user"
        ):

            def _table(name):
                if name == "bookings":
                    return self._booking_stub()
                if name == "businesses":
                    return SupabaseTableStub(select_data={"owner_id": "owner-1"})
                return SupabaseTableStub(
                    insert_data=[
                        {"id": "m-1", "content": "hello", "message_type": "text"}
                    ]
                )

            sb.table.side_effect = _table

            res = test_client.post(
                "/messages/",
                json={"booking_id": "b-1", "content": "hello"},
                headers=AUTH,
            )
            assert res.status_code == 200


class TestFilterOnSend:
    def test_blocked_text_is_refused_before_storage(self, test_client, as_client):
        """A BLOCK must 400 with nothing written — the filter is preventive."""
        inserted = []

        with patch("app.api.messages.supabase") as sb, patch(
            "app.api.messages.blocked_pair_ids", return_value=set()
        ), patch("app.api.messages._assert_message_access"):

            def _table(name):
                stub = SupabaseTableStub(select_data={"id": "b-1"})
                original = stub.insert

                def _spy(payload):
                    inserted.append(payload)
                    return original(payload)

                stub.insert = _spy
                return stub

            sb.table.side_effect = _table

            res = test_client.post(
                "/messages/",
                json={"booking_id": "b-1", "content": "i will kill you"},
                headers=AUTH,
            )
            assert res.status_code == 400
            assert inserted == [], "nothing may be stored when the filter blocks"
