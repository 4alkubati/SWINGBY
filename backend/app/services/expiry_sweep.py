"""expiry_sweep.py — give the money back when nobody took the job.

AMENDMENT 1 charges the client's whole budget at post time. That is only
defensible because of this file.

A post expires seven days after it is created (`service_posts.expires_at`). If
no quote was ever accepted, the client has paid for a job that never happened
and there is NOTHING in the app that would tell them — no booking, no invoice,
no screen. The money would simply sit in escrow forever, and the only person
who could notice is the one person who cannot see the ledger.

So this sweep is not a nicety attached to the payment model. It is the half of
it that makes charging up front honest, and it must run whether or not anyone
remembers to look.

DESIGN
------
* **Idempotent.** Re-running it is safe and expected. A post that has already
  been refunded is skipped because its escrow is zero, not because of a flag
  that could drift out of sync with the money.
* **Per-post isolation.** One post's failure must not abandon the rest. Every
  refund is attempted independently and failures are counted, not raised — the
  next run retries them, and Stripe idempotency means a retry cannot double-pay.
* **Refund first, then mark expired.** If the order were reversed, a crash
  between the two would leave a post marked expired with the client's money
  still held and nothing left to indicate it was owed.
* **Never touches a post with an accepted quote.** `status='matched'` means a
  booking exists and the money belongs to that job, not back in a pocket.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.services import escrow, refunds
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

# Only these are candidates. 'matched' has a booking behind it; 'cancelled' and
# 'expired' have already been settled by whatever cancelled or expired them.
SWEEPABLE_STATUSES = ("open",)


def find_expired_unquoted_posts(now: Optional[datetime] = None, limit: int = 200):
    """Open posts whose expiry has passed. Oldest first, so a backlog drains."""
    cutoff = (now or datetime.now(timezone.utc)).isoformat()
    try:
        res = (
            supabase.table("service_posts")
            .select("id, client_id, title, status, expires_at")
            .in_("status", list(SWEEPABLE_STATUSES))
            .lt("expires_at", cutoff)
            .order("expires_at", desc=False)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception:
        logger.exception("expiry sweep: could not list expired posts")
        return []


def sweep_once(now: Optional[datetime] = None, limit: int = 200) -> dict:
    """Refund every expired, unquoted, pre-paid post. Returns a summary.

    Never raises. A sweep that dies halfway leaves money stranded until someone
    notices, which is the exact failure it exists to prevent.
    """
    posts = find_expired_unquoted_posts(now=now, limit=limit)
    summary = {
        "examined": len(posts),
        "refunded": 0,
        "refunded_cents": 0,
        "nothing_to_refund": 0,
        "failed": 0,
        "expired_marked": 0,
    }

    for post in posts:
        post_id = post.get("id")
        payment = refunds.load_post_payment(post_id)

        # No payment row at all is the normal Flow B case, and a zero-escrow row
        # means it was already swept. Both simply become 'expired'.
        held_c = escrow.money_cents(payment, "escrow_held") if payment else 0

        if held_c > 0:
            try:
                refunds.refund_payment_row(
                    payment,
                    amount_cents=held_c,
                    reason=refunds.REASON_EXPIRED,
                )
                summary["refunded"] += 1
                summary["refunded_cents"] += held_c
                logger.info(
                    "expiry sweep: refunded %dc for unquoted post %s", held_c, post_id
                )
            except refunds.RefundNotPossible as exc:
                # e.g. no captured intent — nothing was ever taken, so there is
                # nothing to give back. Not a failure; the post still expires.
                summary["nothing_to_refund"] += 1
                logger.info(
                    "expiry sweep: nothing to refund for post %s (%s)", post_id, exc
                )
            except Exception:
                # Leave the post OPEN so the next run retries it. Marking it
                # expired here would hide an unpaid debt behind a settled state.
                summary["failed"] += 1
                logger.exception(
                    "expiry sweep: refund FAILED for post %s — left open for retry",
                    post_id,
                )
                continue
        else:
            summary["nothing_to_refund"] += 1

        try:
            supabase.table("service_posts").update({"status": "expired"}).eq(
                "id", post_id
            ).execute()
            summary["expired_marked"] += 1
        except Exception:
            # The money is already back, which is the part that matters. The
            # post will be picked up again next run and skipped as zero-escrow.
            logger.exception(
                "expiry sweep: refunded post %s but could not mark it expired",
                post_id,
            )

        # TELL THEM. This module's whole reason for existing is that a client who
        # paid for a job that never happened has no way to find out — and until
        # now the sweep fixed the money and still told them nothing. The refund
        # landed on a card statement days later with no explanation, against a
        # post that had quietly disappeared from My Jobs.
        #
        # Deliberately last and deliberately swallowed: the money and the status
        # are the load-bearing parts, and a push failure must never make a
        # settled post look unsettled to the next run.
        if held_c > 0:
            try:
                _notify_client_of_refund(post, held_c)
            except Exception:
                logger.exception(
                    "expiry sweep: refunded and expired post %s but could not "
                    "notify the client",
                    post_id,
                )

    if summary["refunded"] or summary["failed"]:
        logger.info("expiry sweep summary: %s", summary)
    return summary


def _notify_client_of_refund(post: dict, refunded_cents: int) -> None:
    """Tell the client their unquoted post expired and the money is back.

    States the amount, because "your post expired" next to an unexplained card
    credit is worse than saying nothing. Named jobs read better than "your post",
    so the title is used when there is one.
    """
    client_id = post.get("client_id")
    if not client_id:
        return

    # Local import: expiry_sweep is imported by the scheduler at startup, and
    # push pulls in the Expo SDK. Keeping it lazy means a push-layer import
    # problem cannot stop the sweep from running at all.
    from app.services.push import send_push_to_user

    dollars = escrow.to_dollars(refunded_cents)
    title = (post.get("title") or "").strip()
    subject = f'"{title}"' if title else "Your job post"

    send_push_to_user(
        client_id,
        "Refunded — nobody quoted your job",
        f"{subject} expired after 7 days with no quotes, so the "
        f"${dollars:.2f} you paid has been refunded. It's in your Past jobs.",
    )
