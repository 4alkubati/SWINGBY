"""D7.4 (pentest C-01) — refresh-token replay and the revocation watermark.

The decision table lives in `session_security.classify_refresh` and is pure, so
every branch below runs without a database. The two properties worth stating
before the assertions, because they are the ones in tension:

  * A session never expires on its own. There is no idle timeout and no maximum
    age — several tests pin that a very old, untouched token is still fine.
  * A spent token is spent. Replaying one outside the grace window is refused
    and revokes the account.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.services import session_security as ss

NOW = datetime(2026, 8, 14, 12, 0, 0, tzinfo=timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ── hashing ──────────────────────────────────────────────────────────────────


def test_hash_is_stable_and_does_not_contain_the_token():
    token = "some-supabase-refresh-token"
    digest = ss.hash_refresh_token(token)
    assert digest == ss.hash_refresh_token(token)
    assert token not in digest
    assert len(digest) == 64  # sha256 hex


def test_different_tokens_hash_differently():
    assert ss.hash_refresh_token("a") != ss.hash_refresh_token("b")


# ── the watermark ────────────────────────────────────────────────────────────


def test_no_watermark_means_nothing_is_revoked():
    """The normal state for every user. Signed in stays signed in."""
    assert ss.is_token_revoked(iso(NOW - timedelta(days=400)), None) is False


def test_token_issued_before_the_watermark_is_revoked():
    assert ss.is_token_revoked(iso(NOW - timedelta(minutes=5)), iso(NOW)) is True


def test_token_issued_after_the_watermark_survives():
    """The password-change case: the login that follows must not be killed."""
    assert ss.is_token_revoked(iso(NOW + timedelta(seconds=1)), iso(NOW)) is False


def test_unparseable_values_fail_open():
    """A parse failure must never sign out the platform. See the docstring."""
    assert ss.is_token_revoked("not-a-date", iso(NOW)) is False
    assert ss.is_token_revoked(iso(NOW), "not-a-date") is False
    assert ss.is_token_revoked(None, iso(NOW)) is False


def test_epoch_seconds_iat_is_accepted():
    """`iat` arrives off a JWT as an integer, not an ISO string."""
    watermark = iso(NOW)
    before = int((NOW - timedelta(hours=1)).timestamp())
    after = int((NOW + timedelta(hours=1)).timestamp())
    assert ss.is_token_revoked(before, watermark) is True
    assert ss.is_token_revoked(after, watermark) is False


# ── the grace window ─────────────────────────────────────────────────────────


def test_replay_inside_the_grace_window_is_allowed():
    """A client that never persisted the rotated token is not an attacker."""
    consumed = NOW - timedelta(seconds=ss.REPLAY_GRACE_SECONDS - 5)
    assert ss.is_within_grace(iso(consumed), now=NOW) is True


def test_replay_outside_the_grace_window_is_not():
    consumed = NOW - timedelta(seconds=ss.REPLAY_GRACE_SECONDS + 5)
    assert ss.is_within_grace(iso(consumed), now=NOW) is False


def test_the_65_second_replay_from_the_finding_is_caught():
    """The literal reproduction in the report: refresh, wait 65s, replay."""
    consumed = NOW - timedelta(seconds=65)
    assert ss.is_within_grace(iso(consumed), now=NOW) is False


# ── the decision table ───────────────────────────────────────────────────────


def test_unknown_token_is_allowed_through():
    """Rollout path: every session alive at deploy holds a token we never saw.

    Refusing these would sign out the whole user base on deploy to defend
    against a replay nobody performed.
    """
    assert ss.classify_refresh(None, None, now=NOW) == "unknown"


def test_fresh_unspent_token_is_ok():
    row = {"issued_at": iso(NOW - timedelta(hours=2)), "consumed_at": None}
    assert ss.classify_refresh(row, None, now=NOW) == "ok"


def test_ancient_unspent_token_is_still_ok():
    """No maximum session age. This is the "like Instagram" requirement."""
    row = {"issued_at": iso(NOW - timedelta(days=365)), "consumed_at": None}
    assert ss.classify_refresh(row, None, now=NOW) == "ok"


def test_spent_token_replayed_late_is_a_replay():
    row = {
        "issued_at": iso(NOW - timedelta(hours=1)),
        "consumed_at": iso(NOW - timedelta(minutes=10)),
    }
    assert ss.classify_refresh(row, None, now=NOW) == "replay"


def test_spent_token_replayed_immediately_is_ok():
    row = {
        "issued_at": iso(NOW - timedelta(hours=1)),
        "consumed_at": iso(NOW - timedelta(seconds=2)),
    }
    assert ss.classify_refresh(row, None, now=NOW) == "ok"


def test_token_issued_before_a_password_change_is_revoked():
    watermark = iso(NOW - timedelta(minutes=1))
    row = {"issued_at": iso(NOW - timedelta(days=3)), "consumed_at": None}
    assert ss.classify_refresh(row, watermark, now=NOW) == "revoked"


def test_token_issued_by_the_login_after_a_password_change_survives():
    """The regression that would lock a user out of their own account."""
    watermark = iso(NOW - timedelta(minutes=10))
    row = {"issued_at": iso(NOW - timedelta(minutes=1)), "consumed_at": None}
    assert ss.classify_refresh(row, watermark, now=NOW) == "ok"


def test_replay_outranks_revocation():
    """Both true: report the replay, because that one also revokes."""
    watermark = iso(NOW - timedelta(minutes=1))
    row = {
        "issued_at": iso(NOW - timedelta(days=3)),
        "consumed_at": iso(NOW - timedelta(hours=1)),
    }
    assert ss.classify_refresh(row, watermark, now=NOW) == "replay"


@pytest.mark.parametrize("bad", ["", "nonsense", None])
def test_unreadable_consumed_at_does_not_revoke_anyone(bad):
    row = {"issued_at": iso(NOW - timedelta(hours=1)), "consumed_at": bad}
    assert ss.classify_refresh(row, None, now=NOW) == "ok"


# ── the bookkeeping that the decision table above depends on ─────────────────
#
# 2026-08-15 sweep: every test above this line exercises `classify_refresh`,
# which is pure and was always correct. The bug was one layer down, in what got
# WRITTEN to the row it reads. `record_issued` upserted an explicit
# `"consumed_at": None`, so on the `/auth/refresh` path — `record_consumed(old)`
# immediately followed by `record_issued(new)` — a Supabase response that
# returned the SAME refresh token (GoTrue does this inside its reuse interval)
# collided on `token_hash` and erased the `consumed_at` written one line
# earlier. The row looked unspent for ever and `classify_refresh` answered "ok"
# to every subsequent replay.
#
# A detector that overwrites its own evidence passes every test of its decision
# table. These tests are on the write path for that reason.


class _FakeTable:
    """Upsert with real Postgres semantics: only supplied columns are written."""

    def __init__(self, store):
        self.store = store

    def upsert(self, payload, on_conflict=None):
        row = self.store.setdefault(
            payload["token_hash"],
            {
                "token_hash": payload["token_hash"],
                "issued_at": None,
                "consumed_at": None,
            },
        )
        row.update(payload)
        return self

    def execute(self):
        return type("Res", (), {"data": []})()


@pytest.fixture
def store(monkeypatch):
    rows: dict = {}
    monkeypatch.setattr(
        ss, "supabase", type("C", (), {"table": lambda self, n: _FakeTable(rows)})()
    )
    return rows


def test_record_issued_never_writes_consumed_at(store):
    """The one-key regression, stated directly."""
    ss.record_issued("hash-a", "user-1")
    ss.record_consumed("hash-a", "user-1")
    ss.record_issued("hash-a", "user-1")

    assert store["hash-a"]["consumed_at"] is not None, (
        "record_issued erased consumed_at — a spent token now reads as unspent "
        "and every replay of it will classify as 'ok'"
    )


def test_a_replayed_token_is_still_caught_after_a_same_token_refresh(store):
    """End to end: the stolen-token path the erasure reopened."""
    h = ss.hash_refresh_token("token-supabase-handed-back-unchanged")
    ss.record_issued(h, "user-1")
    ss.record_consumed(h, "user-1")
    ss.record_issued(h, "user-1")  # same hash — the collision that did the damage

    row = store[h]
    spent_at = ss._parse_ts(row["consumed_at"])
    assert (
        ss.classify_refresh(row, None, now=spent_at + timedelta(minutes=10)) == "replay"
    )


def test_the_lost_response_retry_still_survives_that_refresh(store):
    """The fix must not buy replay detection with a signed-out real user."""
    h = ss.hash_refresh_token("token-supabase-handed-back-unchanged")
    ss.record_issued(h, "user-1")
    ss.record_consumed(h, "user-1")
    ss.record_issued(h, "user-1")

    row = store[h]
    spent_at = ss._parse_ts(row["consumed_at"])
    assert ss.classify_refresh(row, None, now=spent_at + timedelta(seconds=5)) == "ok"


def test_a_genuinely_rotated_token_starts_unspent(store):
    """The normal path: a new hash gets its own row with a NULL consumed_at."""
    old = ss.hash_refresh_token("old-token")
    new = ss.hash_refresh_token("rotated-token")
    ss.record_issued(old, "user-1")
    ss.record_consumed(old, "user-1")
    ss.record_issued(new, "user-1")

    assert store[new]["consumed_at"] is None
    assert store[new]["issued_at"] is not None
    assert store[old]["consumed_at"] is not None
    assert ss.classify_refresh(store[new], None, now=NOW) == "ok"
