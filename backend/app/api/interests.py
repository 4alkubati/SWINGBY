from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.deps import get_current_user
from app.supabase_client import supabase

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class InterestCreate(BaseModel):
    post_id: str = Field(..., min_length=1)
    quoted_price: Optional[float] = Field(None, gt=0, le=1_000_000)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/")
def express_interest(data: InterestCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "business_owner":
        raise HTTPException(status_code=403, detail="Only business owners can express interest")

    biz_res = supabase.table("businesses").select("id").eq("owner_id", current_user["id"]).single().execute()
    if not biz_res.data:
        raise HTTPException(status_code=404, detail="You don't have a business registered")
    business_id = biz_res.data["id"]

    post_res = supabase.table("service_posts").select("id, status").eq("id", data.post_id).single().execute()
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post_res.data["status"] != "open":
        raise HTTPException(status_code=400, detail="Post is no longer accepting interest")

    dup = (
        supabase.table("interests")
        .select("id")
        .eq("post_id", data.post_id)
        .eq("business_id", business_id)
        .execute()
    )
    if dup.data:
        raise HTTPException(status_code=400, detail="You already expressed interest in this post")

    try:
        res = supabase.table("interests").insert({
            "post_id": data.post_id,
            "business_id": business_id,
            "quoted_price": data.quoted_price,
            "status": "pending",
        }).execute()
        return {"message": "Interest expressed", "interest": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/post/{post_id}")
def list_interests_on_post(post_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can view interests on their posts")

    post_res = supabase.table("service_posts").select("client_id").eq("id", post_id).single().execute()
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    if post_res.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own this post")

    try:
        res = (
            supabase.table("interests")
            .select("*, businesses(business_name, category, avg_rating, review_count, description)")
            .eq("post_id", post_id)
            .order("created_at")
            .execute()
        )
        return res.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{interest_id}/accept")
def accept_interest(interest_id: str, current_user: dict = Depends(get_current_user)):
    """
    Client accepts an interest.
    Atomically: accept interest → reject others → close post → create booking + payment.
    """
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can accept interests")

    int_res = supabase.table("interests").select("*").eq("id", interest_id).single().execute()
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
        raise HTTPException(status_code=403, detail="You don't own the post for this interest")
    if post["status"] != "open":
        raise HTTPException(status_code=400, detail="Post is no longer open")

    try:
        supabase.table("interests").update({"status": "accepted"}).eq("id", interest_id).execute()
        supabase.table("interests").update({"status": "rejected"}).eq("post_id", post["id"]).neq("id", interest_id).execute()
        supabase.table("service_posts").update({"status": "matched"}).eq("id", post["id"]).execute()

        total_amount = float(interest["quoted_price"] or post["budget"])
        platform_fee = round(total_amount * 0.10, 2)
        half = round(total_amount * 0.50, 2)

        booking_res = supabase.table("bookings").insert({
            "client_id": current_user["id"],
            "business_id": interest["business_id"],
            "post_id": post["id"],
            "service_category": post["category"],
            "total_amount": total_amount,
            "commission_rate": 0.10,
            "platform_fee": platform_fee,
            "status": "confirmed",
            "payment_status": "partial_released",
        }).execute()
        booking = booking_res.data[0]

        payment_res = supabase.table("payments").insert({
            "booking_id": booking["id"],
            "total_charged": total_amount,
            "escrow_held": half,
            "released_to_business": half,
            "platform_cut": platform_fee,
            "status": "partial",
        }).execute()

        return {
            "message": "Interest accepted — booking and payment created",
            "booking": booking,
            "payment": payment_res.data[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{interest_id}/reject")
def reject_interest(interest_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can reject interests")

    int_res = supabase.table("interests").select("post_id, status").eq("id", interest_id).single().execute()
    if not int_res.data:
        raise HTTPException(status_code=404, detail="Interest not found")
    if int_res.data["status"] != "pending":
        raise HTTPException(status_code=400, detail="Interest is not pending")

    post_res = supabase.table("service_posts").select("client_id").eq("id", int_res.data["post_id"]).single().execute()
    if not post_res.data or post_res.data["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You don't own the post for this interest")

    try:
        supabase.table("interests").update({"status": "rejected"}).eq("id", interest_id).execute()
        return {"message": "Interest rejected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
