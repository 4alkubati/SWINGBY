"""
subscriptions.py — D2.4. Business subscription (Stripe Checkout + Portal).

Beta posture (locked 2026-06-27): track-only. Every business defaults to
`trialing`. The subscribe endpoint returns a Stripe Checkout URL only when
STRIPE_PRICE_SOLO / STRIPE_PRICE_TEAM env vars are set; otherwise it flips the
business to `trialing` without a Stripe charge so mobile flow works during beta.
"""

from __future__ import annotations

import os
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_user
from app.supabase_client import supabase

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_owner_business(owner_id: str) -> dict:
    res = (
        supabase.table("businesses")
        .select("*")
        .eq("owner_id", owner_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered"
        )
    return res.data


def _resolve_tier_and_price(
    business_id: str, owner_user_id: str | None = None
) -> tuple[str, str | None]:
    """Auto-derive tier from STAFF count — the owner does not count as staff.

    SB-0223. This used to count every active `employees` row, which sounds
    right and is not: `bookings._ensure_owner_employee` inserts the OWNER'S OWN
    row (role_title 'Owner', is_active True) the first time a solo operator is
    assigned to a job — that is the solo-owner auto-assign path, and it is the
    normal way a one-person business completes work. So the first job they
    assign themselves took the count from 0 to 1 and moved them to team pricing
    permanently. `solo` was unreachable for anyone who had ever done a job,
    which is every business that matters.

    Excluding by `user_id == owner_id` rather than by `role_title`: role_title
    is display text an owner can edit, so matching on it would silently break
    the moment someone renamed themselves.
    """
    q = (
        supabase.table("employees")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .eq("is_active", True)
    )
    if owner_user_id:
        q = q.neq("user_id", owner_user_id)
    emp_res = q.execute()
    count = emp_res.count or 0
    if count == 0:
        return "solo", os.getenv("STRIPE_PRICE_SOLO")
    return "team", os.getenv("STRIPE_PRICE_TEAM")


@router.post("/me/subscribe")
def subscribe(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can subscribe"
        )

    business = _get_owner_business(current_user["id"])
    tier, price_id = _resolve_tier_and_price(business["id"], business.get("owner_id"))

    # D13 — a misconfigured price id degrades to the beta posture instead of 500ing.
    #
    # This used to raise 500 as a deliberate fail-fast, so a bad env var could not
    # pass unnoticed. The intent was right and the blast radius was wrong.
    # `STRIPE_PRICE_TEAM` is set to `prod_Un0sRFGpiSHrL9` — a Product id where a
    # Price id is required, and one that does not exist in the Stripe account at
    # all. Every one of the 18 businesses is team-tier, so EVERY business owner
    # who tapped Subscribe got a 500, from two different screens, for weeks.
    #
    # A config mistake on the operator's side should not be an error surface for
    # the user. The correct beta behaviour already exists five lines below —
    # track-only, flip to `trialing`, charge nothing — and that is the documented
    # posture (locked 2026-06-27; payments stay in sandbox for the whole beta).
    # An unusable price id means "billing is not configured", which is exactly
    # the state the fallback was written for.
    #
    # Visibility is kept where it belongs: logger.error names the variable and
    # the value, so it is loud in the logs and silent in the product. Anything
    # that is not a `price_...` is treated the same way — a Product id was just
    # the shape we happened to ship.
    if price_id and not price_id.startswith("price_"):
        env_name = "STRIPE_PRICE_SOLO" if tier == "solo" else "STRIPE_PRICE_TEAM"
        logger.error(
            "%s is not a Stripe Price ID (got %r) — falling back to track-only. "
            "Open the Product in the Stripe Dashboard and copy its price_... id.",
            env_name,
            price_id,
        )
        price_id = None

    if not price_id:
        supabase.table("businesses").update(
            {
                "subscription_tier": tier,
                "subscription_status": "trialing",
            }
        ).eq("id", business["id"]).execute()
        return {
            "checkout_url": None,
            "status": "trialing",
            "tier": tier,
            "message": "Beta posture — trial activated without Stripe. Set STRIPE_PRICE_SOLO/STRIPE_PRICE_TEAM to enable live billing.",
        }

    try:
        import stripe

        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        if not stripe.api_key:
            raise HTTPException(
                status_code=503, detail="Stripe not configured on server"
            )

        customer_id = business.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.get("email"),
                name=business.get("business_name"),
                metadata={"business_id": business["id"]},
            )
            customer_id = customer.id
            supabase.table("businesses").update({"stripe_customer_id": customer_id}).eq(
                "id", business["id"]
            ).execute()

        success_url = os.getenv(
            "STRIPE_SUCCESS_URL", "https://swingbyy.com/subscription-success"
        )
        cancel_url = os.getenv(
            "STRIPE_CANCEL_URL", "https://swingbyy.com/subscription-cancel"
        )
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"business_id": business["id"], "tier": tier},
        )
        return {"checkout_url": session.url, "session_id": session.id, "tier": tier}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not create subscription checkout")
        raise HTTPException(
            status_code=400, detail="Could not start subscription checkout"
        )


@router.get("/me/subscription")
def my_subscription(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners have subscriptions"
        )

    business = _get_owner_business(current_user["id"])

    manage_url: str | None = None
    if business.get("stripe_customer_id"):
        try:
            import stripe

            stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
            if stripe.api_key:
                return_url = os.getenv(
                    "STRIPE_PORTAL_RETURN_URL", "https://swingbyy.com/account"
                )
                portal = stripe.billing_portal.Session.create(
                    customer=business["stripe_customer_id"],
                    return_url=return_url,
                )
                manage_url = portal.url
        except Exception:
            logger.warning("Could not create Stripe billing portal session")

    return {
        "tier": business.get("subscription_tier") or "solo",
        "status": business.get("subscription_status") or "trialing",
        "current_period_end": business.get("subscription_current_period_end"),
        "cancel_at": business.get("subscription_cancel_at"),
        "manage_url": manage_url,
    }
