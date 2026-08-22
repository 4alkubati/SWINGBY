"""POST /internal/tick — let an external ticker drive the lazy settlements.

WHY THIS EXISTS
---------------
This deployment has no application scheduler: no APScheduler, no Celery, no
worker, no cron service. `pg_cron` exists in the database but can only run SQL,
so it cannot call Python. Every time-based settlement is therefore LAZY — it
runs when somebody happens to load a screen:

  * `approvals.settle_if_due` — the 24h client-approval auto-release, run from
    `_attach_payment_state` on both booking read paths.
  * `expiry_sweep.sweep_for_client` — the expired-post refund, run from
    `GET /service-posts/my`.

Lazy settlement is a genuinely good design here and this endpoint does not
replace it: the guarantee "correct the moment either party looks" needs no
infrastructure to be true, which is why it was chosen. But it is not a
guarantee about *money moving on time*, and two cases fall through it:

  1. **The business is owed money and the client goes quiet.** The 24h window
     closes, but nothing releases until someone opens the booking. The party
     who is owed is the one least able to make that happen.
  2. **A post expires and the client never comes back.** `sweep_once` refunds
     it; `sweep_for_client` only runs when that client loads their jobs.

Both are latent today because almost nothing is capture-backed in beta. Both
become real money the day charge-at-post is enabled — see
`payment_triggers.charge_at_post_enabled`, reason 2.

WHY A TOKEN AND NOT ADMIN AUTH
------------------------------
The admin sweep routes already exist (`POST /admin/sweeps/*`) and are the right
tool for a human. A cron is not a human: giving a shell script on a laptop an
admin JWT that can also suspend users and read the platform ledger is a much
larger grant than "run the sweeps". This endpoint can do exactly two things,
neither of which is destructive, and it holds a secret scoped to that.

Follows the `HEALTH_DIAGNOSTICS_TOKEN` convention already in `main.py`:
`secrets.compare_digest`, because a naive `==` on a shared secret is a timing
oracle.

UNSET IS OFF. With no `TICK_TOKEN` the route answers 404 — not 403 — so an
unconfigured deployment does not advertise that it exists.

HOW TO TURN IT ON (both steps, or it does nothing):
  1. Render dashboard → Environment → `TICK_TOKEN=<a long random string>`.
     Render is NOT blueprint-managed, so render.yaml will not do this.
  2. On the ticker box, extend the existing 10-minute keep-warm cron:
       curl -fsS -X POST https://swingbyy-api.onrender.com/internal/tick \\
            -H "X-Tick-Token: $TICK_TOKEN" -o /dev/null
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import settings
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/tick")
@limiter.limit("30/hour")
def tick(request: Request, x_tick_token: str = Header(default="")):
    """Run the settlements that would otherwise wait for a page view.

    Returns what moved. Safe to call repeatedly: both sweeps are idempotent on
    the money — a booking whose window has not closed and a post with zero
    escrow are each skipped on the amount, not on a flag.
    """
    expected = settings.TICK_TOKEN
    if not expected:
        # Not configured. 404 rather than 403: do not confirm the route exists.
        raise HTTPException(status_code=404, detail="Not Found")
    if not secrets.compare_digest(str(x_tick_token or ""), expected):
        raise HTTPException(status_code=403, detail="Bad tick token")

    from app.services import approvals, expiry_sweep

    out: dict = {}

    # Each sweep is isolated. A failure in one must not stop the other — they
    # settle different money for different people, and this endpoint exists
    # precisely for the case where nobody is watching.
    try:
        out["approvals"] = approvals.settle_due()
    except Exception:
        logger.exception("tick: approval-release sweep failed")
        out["approvals"] = {"error": "failed"}

    try:
        out["post_expiry"] = expiry_sweep.sweep_once()
    except Exception:
        logger.exception("tick: post-expiry sweep failed")
        out["post_expiry"] = {"error": "failed"}

    # Only log when something actually moved — this runs every 10 minutes and a
    # heartbeat nobody reads is how a real signal gets buried.
    if any(
        isinstance(v, dict)
        and (v.get("released") or v.get("refunded") or v.get("error"))
        for v in out.values()
    ):
        logger.info("tick: %s", out)

    return out
