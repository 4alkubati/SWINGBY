"""
test_expiry_sweep_statuses.py — SB-0074: a post the cron expired can never be
refunded, because the refund sweep is coded to skip exactly that status.

`docs/expiry_cron.sql` is scheduled hourly and does one thing:

    update service_posts set status='expired'
    where status='open' and expires_at < now();

It moves NO money. `expiry_sweep.SWEEPABLE_STATUSES` was `("open",)`, with a
comment asserting that "'cancelled' and 'expired' have already been settled by
whatever cancelled or expired them". That is true of a cancellation, which goes
through the cancellation ladder, and false of this cron, which is a one-line
UPDATE.

So the two halves raced: whichever ran first decided the outcome. If a client
opened My Jobs before the hour, the lazy sweep refunded them. If the cron got
there first, the post moved to a status the sweep would never look at again and
the escrow sat there permanently.

CLAUDE.md is explicit that this path must not be weakened: "if a post expires
with no accepted quote, any escrow held against it is refunded immediately —
not held ... do not make it conditional or deferred (Kira's ruling)."
"""

from app.services import expiry_sweep


class TestSweepableStatuses:
    def test_expired_posts_are_still_candidates(self):
        """
        The status the cron writes must be a status the sweep will pick up,
        or the cron silently becomes a way to strand money.
        """
        assert "expired" in expiry_sweep.SWEEPABLE_STATUSES, (
            "the hourly pg_cron sets status='expired' and moves no money; "
            "excluding it here means escrow on a cron-expired post is never "
            "refunded (SB-0074)"
        )

    def test_open_posts_are_still_candidates(self):
        """The lazy read-path sweep must keep working — it is the primary one."""
        assert "open" in expiry_sweep.SWEEPABLE_STATUSES

    def test_matched_posts_are_not_swept(self):
        """A matched post has a booking behind it; its money is not stranded."""
        assert "matched" not in expiry_sweep.SWEEPABLE_STATUSES

    def test_cancelled_posts_are_not_swept(self):
        """
        Cancellation goes through the ladder in escrow.compute_cancellation_split,
        which settles the money as part of cancelling. Sweeping it again would
        be a second settlement of the same post.
        """
        assert "cancelled" not in expiry_sweep.SWEEPABLE_STATUSES

    def test_the_stale_claim_is_gone_from_the_comment(self):
        """
        The wrong comment is the actual defect — it is what made excluding
        'expired' look deliberate and correct to every reader since.
        """
        import inspect

        src = inspect.getsource(expiry_sweep)
        assert "'cancelled' and\n# 'expired' have already been settled" not in src
        assert (
            "have already been settled by whatever cancelled or expired them" not in src
        )
