import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class InterestCreate(BaseModel):
    post_id: str = Field(..., min_length=1, max_length=64)
    quoted_price: Optional[float] = Field(None, gt=0, le=1_000_000)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def express_interest(
    data: InterestCreate, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can express interest"
        )

    biz_res = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not biz_res.data:
        raise HTTPException(
            status_code=404, detail="You don't have a business registered"
        )
    business_id = biz_res.data["id"]

    post_res = (
        supabase.table("service_posts")
        .select("id, status")
        .eq("id", data.post_id)
        .single()
        .execute()
    )
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post_res.data["status"] != "open":
        raise HTTPException(
            status_code=400, detail="Post is no longer accepting interest"
        )

    dup = (
        supabase.table("interests")
        .select("id")
        .eq("post_id", data.post_id)
        .eq("business_id", business_id)
        .execute()
    )
    if dup.data:
        raise HTTPException(
            status_code=400, detail="You already expressed interest in this post"
        )

    try:
        res = (
            supabase.table("interests")
            .insert(
                {
                    "post_id": data.post_id,
                    "business_id": business_id,
                    "quoted_price": data.quoted_price,
                    "status": "pending",
                }
            )
            .execute()
        )
        interest = res.data[0]

        # Notify the post owner (client) — best-effort
        try:
            post_owner_res = (
                supabase.table("service_posts")
                .select("client_id, title")
                .eq("id", data.post_id)
                .single()
                .execute()
            )
            biz_name_res = (
                supabase.table("businesses")
                .select("business_name")
                .eq("id", business_id)
                .single()
                .execute()
            )
            client_id = (
                post_owner_res.data["client_id"] if post_owner_res.data else None
            )
            post_title = (
                post_owner_res.data["title"] if post_owner_res.data else "your job"
            )
            biz_name = (
                biz_name_res.data["business_name"]
                if biz_name_res.data
                else "A business"
            )
            if client_id:
                send_push_to_user(
                    client_id,
                    "New quote on your job",
                    f"{biz_name} is interested",
                )
                # Email the client too
                try:
                    from app.services.email import send_quote_received

                    client_user_res = (
                        supabase.table("users")
                        .select("email, first_name")
                        .eq("id", client_id)
                        .single()
                        .execute()
                    )
                    if client_user_res.data:
                        send_quote_received(
                            client_user_res.data["email"],
                            client_user_res.data["first_name"],
                            post_title,
                            biz_name,
                            data.quoted_price,
                        )
                except Exception:
                    pass
        except Exception:
            pass  # notification failure must not break the request

        return {"message": "Interest expressed", "interest": interest}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not express interest")
        raise HTTPException(status_code=400, detail="Could not express interest")


@router.get("/mine")
def list_my_interests(current_user: dict = Depends(get_current_user)):
    """Business owner's sent quotes with post + client context (Jobs tab)."""
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can view their quotes"
        )

    biz_res = (
        supabase.table("businesses")
        .select("id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not biz_res.data:
        return {"items": []}

    try:
        res = (
            supabase.table("interests")
            .select(
                "*, service_posts(id, title, category, status, address, "
                "users(first_name, last_name, avatar_url))"
            )
            .eq("business_id", biz_res.data["id"])
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        return {"items": res.data or []}
    except Exception:
        logger.exception("Could not list my interests")
        raise HTTPException(status_code=400, detail="Could not list quotes")


@router.get("/post/{post_id}")
def list_interests_on_post(
    post_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "client":
        raise HTTPException(
            status_code=403, detail="Only clients can view interests on their posts"
        )

    post_res = (
        supabase.table("service_posts")
        .select("client_id")
        .eq("id", post_id)
        .single()
        .execute()
    )
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post_res.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this post")

    try:
        res = (
            supabase.table("interests")
            .select(
                "*, businesses(business_name, category, avg_rating, review_count, description)"
            )
            .eq("post_id", post_id)
            .order("created_at")
            .execute()
        )
        return res.data
    except Exception:
        logger.exception("Could not list interests on post")
        raise HTTPException(status_code=400, detail="Could not list interests")


@router.patch("/{interest_id}/accept")
def accept_interest(interest_id: str, current_user: dict = Depends(get_current_user)):
    """
    Client accepts an interest.
    Atomically: accept interest → reject others → close post → create booking + payment.
    """
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can accept interests")

    int_res = (
        supabase.table("interests").select("*").eq("id", interest_id).single().execute()
    )
    if not int_res.data:
        raise HTTPException(status_code=404, detail="Interest not found")
    interest = int_res.data

    if interest["status"] != "pending":
        raise HTTPException(status_code=400, detail="Interest is not pending")

    post_res = (
        supabase.table("service_posts")
        .select("id, client_id, budget, category, status")
        .eq("id", interest["post_id"])
        .single()
        .execute()
    )
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = post_res.data

    if post["client_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="You don't own the post for this interest"
        )
    if post["status"] != "open":
        raise HTTPException(status_code=400, detail="Post is no longer open")

    # D2.4 — business subscription gate. Beta posture is track-only (default
    # 'trialing'), so this only rejects businesses actively past_due / canceled.
    biz_sub = (
        supabase.table("businesses")
        .select("subscription_status")
        .eq("id", interest["business_id"])
        .single()
        .execute()
    )
    sub_status = (biz_sub.data or {}).get("subscription_status") or "trialing"
    if sub_status not in ("active", "trialing"):
        raise HTTPException(
            status_code=402,
            detail="This business isn't accepting bookings right now — subscription is not active.",
        )

    try:
        supabase.table("interests").update({"status": "accepted"}).eq(
            "id", interest_id
        ).execute()
        supabase.table("interests").update({"status": "rejected"}).eq(
            "post_id", post["id"]
        ).neq("id", interest_id).execute()
        supabase.table("service_posts").update({"status": "matched"}).eq(
            "id", post["id"]
        ).execute()

        total_amount = float(interest["quoted_price"] or post["budget"])
        platform_fee = round(total_amount * 0.10, 2)
        half = round(total_amount * 0.50, 2)

        booking_res = (
            supabase.table("bookings")
            .insert(
                {
                    "client_id": current_user["id"],
                    "business_id": interest["business_id"],
                    "post_id": post["id"],
                    "service_category": post["category"],
                    "total_amount": total_amount,
                    "commission_rate": 0.10,
                    "platform_fee": platform_fee,
                    "status": "confirmed",
                    "payment_status": "partial_released",
                }
            )
            .execute()
        )
        booking = booking_res.data[0]

        # Carry the pre-booking quote conversation into the booking thread —
        # stamped messages surface under the booking in /messages/threads.
        try:
            supabase.table("messages").update({"booking_id": booking["id"]}).eq(
                "interest_id", interest_id
            ).execute()
        except Exception:
            pass  # thread migration is best-effort

        payment_res = (
            supabase.table("payments")
            .insert(
                {
                    "booking_id": booking["id"],
                    "total_charged": total_amount,
                    "escrow_held": half,
                    "released_to_business": half,
                    "platform_cut": platform_fee,
                    "status": "partial",
                }
            )
            .execute()
        )

        # Notify the business owner and client (push + email) — best-effort
        try:
            from app.services.email import (
                send_booking_confirmed_business,
                send_booking_confirmed_client,
            )

            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id, business_name")
                .eq("id", interest["business_id"])
                .single()
                .execute()
            )
            post_title_res = (
                supabase.table("service_posts")
                .select("title")
                .eq("id", post["id"])
                .single()
                .execute()
            )
            biz_owner_id = (
                biz_owner_res.data["owner_id"] if biz_owner_res.data else None
            )
            biz_name = (
                biz_owner_res.data["business_name"]
                if biz_owner_res.data
                else "Your business"
            )
            post_title = (
                post_title_res.data["title"] if post_title_res.data else "your quote"
            )

            if biz_owner_id:
                send_push_to_user(biz_owner_id, "Your quote was accepted", post_title)
                biz_owner_user_res = (
                    supabase.table("users")
                    .select("email")
                    .eq("id", biz_owner_id)
                    .single()
                    .execute()
                )
                if biz_owner_user_res.data:
                    send_booking_confirmed_business(
                        biz_owner_user_res.data["email"],
                        biz_name,
                        booking["id"],
                        total_amount,
                    )

            # Email the client too
            client_user_res = (
                supabase.table("users")
                .select("email, first_name")
                .eq("id", current_user["id"])
                .single()
                .execute()
            )
            if client_user_res.data:
                send_booking_confirmed_client(
                    client_user_res.data["email"],
                    client_user_res.data["first_name"],
                    booking["id"],
                    total_amount,
                )
        except Exception:
            pass  # notification failure must not break the request

        return {
            "message": "Interest accepted — booking and payment created",
            "booking": booking,
            "payment": payment_res.data[0],
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not accept interest")
        raise HTTPException(status_code=400, detail="Could not accept interest")


@router.patch("/{interest_id}/reject")
def reject_interest(interest_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can reject interests")

    int_res = (
        supabase.table("interests")
        .select("post_id, status, business_id")
        .eq("id", interest_id)
        .single()
        .execute()
    )
    if not int_res.data:
        raise HTTPException(status_code=404, detail="Interest not found")
    if int_res.data["status"] != "pending":
        raise HTTPException(status_code=400, detail="Interest is not pending")

    post_res = (
        supabase.table("service_posts")
        .select("client_id")
        .eq("id", int_res.data["post_id"])
        .single()
        .execute()
    )
    if not post_res.data or post_res.data["client_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="You don't own the post for this interest"
        )

    try:
        supabase.table("interests").update({"status": "rejected"}).eq(
            "id", interest_id
        ).execute()

        # Tell the business — a declined quote is a follow-up opportunity,
        # not a dead end (the chat thread stays open while the post is open).
        try:
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", int_res.data["business_id"])
                .single()
                .execute()
            )
            if biz_owner_res.data:
                send_push_to_user(
                    biz_owner_res.data["owner_id"],
                    "Quote not selected",
                    "Your quote wasn't chosen this time — you can still message the client to follow up.",
                )
        except Exception:
            pass  # push failure must not break the request

        return {"message": "Interest rejected"}
    except Exception:
        logger.exception("Could not reject interest")
        raise HTTPException(status_code=400, detail="Could not reject interest")
