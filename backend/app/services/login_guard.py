"""
login_guard.py — durable brute-force lockout (checklist #4) and the failed-login
audit trail (checklist #19).

WHAT WAS WRONG WITH THE OLD ONE
-------------------------------
T18's lockout lived in a module-level `defaultdict` in `api/auth.py`, keyed on
`(email, ip)`. It executed, so it was not missing — it was walkable, three
different ways, none of which required defeating any logic:

  1. **Rotate the source IP.** The key includes the IP, so every new address is
     a fresh budget of five guesses. A trivial proxy pool made the limit
     meaningless against the one attack it exists to stop.
  2. **Wait for a restart.** A dict dies with the process. Every deploy, every
     Render idle-spin-down, reset every counter on the platform.
  3. **Land on another worker.** Each worker had its own dict, so N workers
     meant 5N attempts.

It also emitted NOTHING. A credential-stuffing run against this API produced no
log line, no audit row, no signal of any kind — which is checklist #19's finding
and, in practice, the more expensive half: you cannot respond to what you cannot
see.

THE SHAPE OF THE FIX
--------------------
Failures are recorded in `login_attempts` (Postgres, shared by every worker and
surviving restarts) and counted two ways on each attempt:

  * **per email**, across all addresses — this is the control that actually
    bites, because it is the one an IP rotation cannot walk around. An account
    is what the attacker is trying to reach, so an account is what gets the
    budget.
  * **per IP**, across all emails — catches the other shape, one host spraying
    one password across many accounts, which a per-email counter alone would
    never notice.

Both are rolling windows. A successful login clears that email's failures.

WHY THE EMAIL IS HASHED
-----------------------
The table stores `email_hash`, an HMAC of the lowercased address, never the
address. This table is a list of accounts that someone has been failing to log
into — the single most useful artifact in the database for an attacker who gets
read access, and a plaintext-email breach notification for us if it leaks. HMAC
with SECRET_KEY rather than a bare SHA-256, because the input space (email
addresses) is small enough to enumerate offline against an unkeyed digest.
Counting only ever asks "how many rows share this hash", which a keyed digest
answers exactly as well.

FAIL-OPEN OR FAIL-CLOSED?
-------------------------
If the database is unreachable, this **fails open** — the lockout stops working
and logins proceed. That is the same call `session_security.lookup_token` makes
and for the same reason: the alternative is that a Postgres blip logs the entire
platform out and nobody can sign in. The rate limiter in front of `/login`
(10/minute per IP) is still standing in that window, so "open" is not "unguarded".
"""

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog

from app.config import settings
from app.supabase_client import supabase

logger = structlog.get_logger(__name__)

# Rolling window, and the two budgets inside it.
WINDOW_MINUTES: int = 15

# Per account. Unchanged from T18's 5 — the number was never the problem.
MAX_FAILURES_PER_EMAIL: int = 5

# Per source address, across every account it has touched. Deliberately looser:
# a shared NAT (an office, a campus, a coffee shop) can produce a genuine
# handful of failures from unrelated people, and this must not lock out a
# building. Password spraying looks nothing like that — it is dozens of distinct
# accounts from one host — so the gap between 5 and 30 is where the two
# behaviours separate.
MAX_FAILURES_PER_IP: int = 30

# How long a row is kept. Long enough to investigate an incident, short enough
# that this never becomes a durable record of who tried to log in when.
RETENTION_DAYS: int = 7


def hash_email(email: str) -> str:
    """Keyed digest of an email address. See the module docstring."""
    normalized = (email or "").strip().lower().encode("utf-8")
    key = (settings.SECRET_KEY or "").encode("utf-8")
    if not key:
        # SECRET_KEY is a required var (config.py hard-fails without it), so
        # this is unreachable in a booted app. Degrading to an unkeyed digest
        # rather than raising keeps a misconfigured dev box able to log in.
        return hashlib.sha256(normalized).hexdigest()
    return hmac.new(key, normalized, hashlib.sha256).hexdigest()


def _window_start() -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)).isoformat()


def _count(column: str, value: str) -> Optional[int]:
    """Rows matching `column == value` inside the window, or None on failure.

    None is the fail-open signal — the caller treats it as "no opinion" rather
    than as zero, so a database problem cannot be mistaken for a clean record.
    """
    try:
        res = (
            supabase.table("login_attempts")
            .select("id", count="exact")
            .eq(column, value)
            .gte("attempted_at", _window_start())
            .execute()
        )
        if res.count is not None:
            return int(res.count)
        return len(res.data or [])
    except Exception:
        logger.exception("login_guard.count_failed", column=column)
        return None


def check_lockout(email: str, ip: str) -> Optional[str]:
    """Return a lockout reason if this attempt must be refused, else None.

    The reason is for OUR logs, never for the response body — the endpoint
    answers with one generic message either way, so that a locked-out account
    and an unknown one stay indistinguishable (checklist #5).
    """
    email_failures = _count("email_hash", hash_email(email))
    if email_failures is not None and email_failures >= MAX_FAILURES_PER_EMAIL:
        return "email_threshold"

    if ip and ip != "unknown":
        ip_failures = _count("ip", ip)
        if ip_failures is not None and ip_failures >= MAX_FAILURES_PER_IP:
            return "ip_threshold"

    return None


def record_failure(email: str, ip: str, reason: str = "invalid_credentials") -> None:
    """Persist one failed attempt AND log it.

    Best-effort on the write, unconditional on the log line: if Postgres is
    down we lose the counter but must not also lose the only evidence that
    someone is knocking.
    """
    email_hash = hash_email(email)
    logger.warning(
        "auth.login_failed",
        email_hash=email_hash[:16],
        ip=ip,
        reason=reason,
    )
    try:
        supabase.table("login_attempts").insert(
            {
                "email_hash": email_hash,
                "ip": ip if ip and ip != "unknown" else None,
                "reason": reason,
            }
        ).execute()
    except Exception:
        logger.exception("login_guard.record_failed")


def record_lockout(email: str, ip: str, reason: str) -> None:
    """Log a refused-because-locked attempt.

    Distinct from `record_failure` and deliberately does NOT insert a row: the
    attempt never reached a password check, and counting it would let an
    attacker extend their own lockout indefinitely by continuing to knock —
    turning a 15-minute window into a permanent denial of service against the
    account they are targeting. This is the line an alert should fire on.
    """
    logger.warning(
        "auth.login_locked_out",
        email_hash=hash_email(email)[:16],
        ip=ip,
        reason=reason,
    )


def clear_failures(email: str) -> None:
    """Wipe an account's failures after a successful login.

    Keyed on the email alone, not (email, ip): the point is that the real owner
    has just proven themselves, so the attacker's accumulated count against that
    account is no longer evidence of anything.
    """
    try:
        supabase.table("login_attempts").delete().eq(
            "email_hash", hash_email(email)
        ).execute()
    except Exception:
        logger.exception("login_guard.clear_failed")


def prune_attempts() -> int:
    """Delete rows past the retention horizon. Returns the count removed."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat()
    try:
        res = (
            supabase.table("login_attempts")
            .delete()
            .lt("attempted_at", cutoff)
            .execute()
        )
        return len(res.data or [])
    except Exception:
        logger.exception("login_guard.prune_failed")
        return 0
