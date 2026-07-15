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


def _resolve_tier_and_price(business_id: str) -> tuple[str, str | None]:
    """Auto-derive tier from employees count."""
    emp_res = (
        supabase.table("employees")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .eq("is_active", True)
        .execute()
    )
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
    tier, price_id = _resolve_tier_and_price(business["id"])

    # Fail-fast: env var must hold a Price ID (price_...), not a Product ID (prod_...).
    # Stripe rejects prod_... in line_items.price with a cryptic "No such price" error.
    if price_id and price_id.startswith("prod_"):
        env_name = "STRIPE_PRICE_SOLO" if tier == "solo" else "STRIPE_PRICE_TEAM"
        logger.error(
            "%s is set to a Product ID (%s); Stripe requires a Price ID (price_...)",
            env_name,
            price_id,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                f"{env_name} is misconfigured: expected a Stripe Price ID "
                f"(price_...), got a Product ID ({price_id}). "
                "Open the Product in Stripe Dashboard and copy its Price ID."
            ),
        )

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
