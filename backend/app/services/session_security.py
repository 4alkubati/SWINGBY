"""
session_security.py — D7.4 (pentest C-01): refresh-token replay detection and
the session revocation watermark.

THE TWO RULES THIS FILE ENFORCES, AND WHY THEY DO NOT CONTRADICT EACH OTHER
---------------------------------------------------------------------------
1. **A session never expires on its own.** Signed in is signed in until the
   user logs out. Nothing here introduces an idle timeout, a maximum session
   age, or a periodic re-login. `sessions_valid_after` is NULL for everybody
   until something security-relevant happens to their specific account.

2. **A spent refresh token is spent.** Replaying one is the signature of a
   stolen token, and it is the finding this file exists to close: the API used
   to accept the same refresh token indefinitely, 65 seconds after it had
   already been rotated.

Rule 2 can only threaten rule 1 if a legitimate client replays a token. That is
narrower than it sounds, and the grace window below is sized for exactly the
case where it happens.

THE GRACE WINDOW
----------------
`mobile/src/services/api.js:232` already single-flights refresh, so a burst of
parallel 401s inside one running app shares ONE refresh call — the classic
concurrent-refresh race cannot reach us from a healthy client.

What can still reach us is a client that never persisted the rotated token: the
server rotates, the response is lost (app killed, process backgrounded and
reaped, network drop after the server committed), and the client comes back
holding the old token because that is genuinely all it has. That client is not
an attacker and must not be signed out.

So a replay inside REPLAY_GRACE_SECONDS is allowed — it is a retry of a request
whose answer never landed. A replay after it is refused AND revokes the
account's live sessions, because at that distance the benign explanation is
gone: a real client that got its new token has no reason to ever present the
old one again, and one that did not get it would have retried immediately.

Sixty seconds is chosen over something tighter because the failure modes are
asymmetric. Too long and a stolen token stays usable for another minute — it
was usable forever before this file existed. Too short and we sign real people
out of an app whose whole product promise is that you stay signed in.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog

from app.supabase_client import supabase

logger = structlog.get_logger(__name__)

# A replay this recent is treated as a client that never received the rotated
# token, not as an attacker. See the module docstring.
REPLAY_GRACE_SECONDS: int = 60

# Spent-token rows older than this are pruned. A refresh token that reappears
# after the horizon is treated as unseen, which is safe: Supabase rejects
# refresh tokens far younger than 30 days on its own.
USAGE_RETENTION_DAYS: int = 30


def hash_refresh_token(token) -> Optional[str]:
    """SHA-256 of a refresh token, hex encoded. None if there is nothing to hash.

    The token itself is never stored. A table of live refresh tokens would be a
    worse liability than the replay bug it exists to fix, and a hash is all
    reuse detection needs — we only ever ask "have I seen this exact string
    before", never "what was it".

    Non-strings return None rather than raising. `session.refresh_token` comes
    off a Supabase object whose shape we do not control, and the callers sit on
    the login and refresh paths: a TypeError here would be caught by their
    broad `except Exception` and turned into "invalid credentials" for a user
    whose password was correct. Bookkeeping must not be able to fail a login.
    """
    if not isinstance(token, str) or not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_ts(value) -> Optional[datetime]:
    """Parse a timestamp into an aware datetime, or None.

    Handles the three shapes that actually reach this module:

      * a Postgres ``timestamptz`` string, from our own columns;
      * a ``datetime``, if a caller has already parsed one;
      * an **integer epoch-seconds** value, which is how a JWT's ``iat`` claim
        arrives. Missing this was a real bug — `is_token_revoked` compares an
        `iat` against a column, so an unparsed int silently failed open and the
        watermark did nothing on the access-token path.

    Returns None rather than raising on anything else. Every caller treats None
    as "no constraint recorded" — see `is_token_revoked` for why that direction.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    # bool is an int subclass; it is never a timestamp.
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_token_revoked(issued_at, sessions_valid_after) -> bool:
    """True if an access token issued at ``issued_at`` has been revoked.

    FAIL-OPEN, DELIBERATELY. A missing or unparseable watermark means "nothing
    has been revoked for this account", which is the state every user is in.
    A missing or unparseable ``iat`` means we cannot place the token in time.

    Neither is allowed to lock anybody out, because the blast radius is not
    symmetric: erring towards "revoked" on a parse failure would sign out the
    entire platform the first time a column read came back in an unexpected
    shape, to defend against a stolen token we have no evidence of. Erring
    towards "valid" leaves the watermark unenforced for that one request, and
    the request still has to carry a signature Supabase already validated.
    """
    watermark = _parse_ts(sessions_valid_after)
    if watermark is None:
        return False
    issued = _parse_ts(issued_at)
    if issued is None:
        return False
    return issued < watermark


def revoke_sessions(user_id: str, reason: str) -> None:
    """Stamp the revocation watermark, killing this account's live sessions.

    Best-effort by design: this is called from paths that are already refusing
    the request. If the stamp fails we must still refuse, so a raise here would
    convert a correct 401 into a 500 and tell an attacker their replay hit
    something interesting.
    """
    try:
        supabase.table("users").update(
            {"sessions_valid_after": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
        logger.warning("session.revoked", user_id=user_id, reason=reason)
    except Exception:
        logger.exception("session.revoke_failed", user_id=user_id, reason=reason)


def lookup_token(token_hash: str) -> Optional[dict]:
    """Look up what we know about a refresh token.

    Returns the row (``user_id``, ``issued_at``, ``consumed_at``) if we issued
    this token, else None.

    None also means "the lookup failed" and, importantly, "this token predates
    the D7.4 rollout". Both are treated as unknown-but-allowed by the caller.
    That is not laxity, it is the migration path: every session alive when this
    shipped holds a token this table has never seen, and refusing those would
    sign out the entire user base on deploy to defend against a replay nobody
    has performed. Unknown tokens still have to satisfy Supabase, and the first
    refresh brings them into the table, so the gap closes itself within one
    token lifetime per user.
    """
    try:
        res = (
            supabase.table("refresh_token_usage")
            .select("token_hash, user_id, issued_at, consumed_at")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        # Fail open. If the usage table is unreachable the choice is between
        # "nobody can refresh" and "replay detection is down for this request".
        # Signing out every user in the app because one table is unavailable is
        # a self-inflicted outage; the pre-existing behaviour is the fallback.
        logger.exception("session.lookup_failed")
        return None


def is_within_grace(consumed_at, now: Optional[datetime] = None) -> bool:
    """True if a prior use is recent enough to be a lost-response retry."""
    consumed = _parse_ts(consumed_at)
    if consumed is None:
        # Unparseable timestamp — treat as in-grace rather than revoking a real
        # user's sessions on the strength of a value we could not read.
        return True
    now = now or datetime.now(timezone.utc)
    return (now - consumed) <= timedelta(seconds=REPLAY_GRACE_SECONDS)


def record_issued(token_hash: Optional[str], user_id: str) -> None:
    """Record a refresh token we have just handed out.

    Called from /auth/login and from /auth/refresh (for the rotation product),
    so every token in a session's chain is dated. That date is what lets the
    revocation watermark distinguish "issued before the password changed" from
    "issued by the login that followed it".

    Best-effort: a failure here means this token looks unknown next time, which
    degrades to the pre-D7.4 behaviour for one token. It is never worth failing
    a valid login or refresh over bookkeeping.

    A None hash means there was no token to record — nothing to do, and not an
    error worth a log line on every anonymous path.
    """
    if not token_hash:
        return
    try:
        supabase.table("refresh_token_usage").upsert(
            {
                "token_hash": token_hash,
                "user_id": user_id,
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "consumed_at": None,
            },
            on_conflict="token_hash",
        ).execute()
    except Exception:
        logger.exception("session.record_issued_failed", user_id=user_id)


def record_consumed(token_hash: Optional[str], user_id: str) -> None:
    """Record that a refresh token has been spent.

    Upsert rather than update: a token issued before D7.4 shipped has no row to
    update, and a replay inside the grace window reaches this line a second
    time — neither may surface as an error.

    ``issued_at`` is deliberately not written here. On the upsert path for an
    unknown (pre-rollout) token the column takes its default of now(), which is
    the most conservative thing available: we know we saw it now, we do not
    know when it was minted, and dating it now means the watermark treats it as
    current rather than silently killing a session we have no evidence against.
    """
    if not token_hash:
        return
    try:
        supabase.table("refresh_token_usage").upsert(
            {
                "token_hash": token_hash,
                "user_id": user_id,
                "consumed_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="token_hash",
        ).execute()
    except Exception:
        logger.exception("session.record_consumed_failed", user_id=user_id)


def classify_refresh(row: Optional[dict], sessions_valid_after, now=None) -> str:
    """Decide what to do with a presented refresh token.

    Returns one of:

    ``"ok"``       — spend it.
    ``"unknown"``  — we did not issue it (or the lookup failed). Spend it, but
                     see `lookup_token`: this is the rollout path, not a hole.
    ``"replay"``   — spent before, outside the grace window. Refuse AND revoke.
    ``"revoked"``  — issued before the account's revocation watermark. Refuse.

    Pure and clock-injectable so the whole decision table is unit-testable
    without a database; the endpoint does the I/O and this does the thinking.
    """
    if row is None:
        return "unknown"

    now = now or datetime.now(timezone.utc)

    consumed_at = row.get("consumed_at")
    if consumed_at and not is_within_grace(consumed_at, now=now):
        return "replay"

    # The watermark question is asked against when we ISSUED the token, not
    # when it was used. A token minted after the password changed is exactly
    # the one the user's new login is holding, and it must survive.
    if is_token_revoked(row.get("issued_at"), sessions_valid_after):
        return "revoked"

    return "ok"


def prune_refresh_usage() -> int:
    """Delete token rows past the retention horizon.

    Keyed on ``issued_at`` rather than ``consumed_at``, because an issued-but-
    never-spent token has a NULL ``consumed_at`` and would otherwise live in
    this table for ever.

    Returns the number of rows removed, 0 on failure. This table grows by one
    row per login and per refresh, so something has to sweep it.
    """
    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=USAGE_RETENTION_DAYS)
    ).isoformat()
    try:
        res = (
            supabase.table("refresh_token_usage")
            .delete()
            .lt("issued_at", cutoff)
            .execute()
        )
        return len(res.data or [])
    except Exception:
        logger.exception("session.prune_failed")
        return 0
