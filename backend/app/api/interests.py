import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from app.deps import get_current_user
from app.privacy import mask_service_post_row
from app.supabase_client import supabase
from app.services.push import send_push_to_user
from app.services import money, payment_status, payment_ledger, stripe_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class InterestCreate(BaseModel):
    post_id: str = Field(..., min_length=1, max_length=64)
    quoted_price: Optional[float] = Field(None, gt=0, le=1_000_000)

    @field_validator("quoted_price")
    @classmethod
    def _validate_precision(cls, v: Optional[float]) -> Optional[float]:
        # PAYMENT-MODEL.md §3: "quoted_price must be validated to 2 decimal
        # places on input" — reject extra precision rather than silently
        # rounding a business's quote.
        if v is None:
            return v
        try:
            money.validate_two_decimal_places(v)
        except money.MoneyError as exc:
            raise ValueError(str(exc)) from exc
        return v


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
        items = res.data or []
        # CARD-23: a pending/rejected quote must not carry the client's full
        # address or last name — only an ACCEPTED interest means a booking
        # exists and the client has consented to share that.
        for item in items:
            post = item.get("service_posts")
            if post and item.get("status") != "accepted":
                item["service_posts"] = mask_service_post_row(post)
        return {"items": items}
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

    # CARD-20 (D2, 2026-07-19) — booking-entry flow. A post carries an
    # optional client-set `preferred_date` (service_posts.preferred_date).
    # If it was set, the date is already agreed — the resulting booking
    # should land the client straight in the confirmed "booking chat"
    # instead of running the propose/accept handshake. Fetched in its own
    # isolated call (never the primary post_res above) so a not-yet-migrated
    # column on live Supabase degrades to None instead of 404ing accept —
    # the migration (docs/service_posts_preferred_date.sql) may not be
    # applied yet in every environment.
    preferred_date = None
    try:
        pref_res = (
            supabase.table("service_posts")
            .select("preferred_date")
            .eq("id", post["id"])
            .single()
            .execute()
        )
        preferred_date = (pref_res.data or {}).get("preferred_date")
    except Exception:
        preferred_date = None

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

    # §3 — server-derive the charge amount from the stored quote. The client
    # never sends a price; whatever the quote/post carries is the only number
    # that can move money.
    try:
        ledger = money.derive_ledger(interest["quoted_price"] or post["budget"])
    except money.MoneyError as exc:
        raise HTTPException(status_code=400, detail=f"Could not accept interest: {exc}")

    # §5 — card on file is required to accept a quote, and the charge happens
    # BEFORE any booking exists: "money is committed before work happens."
    client_row = (
        supabase.table("users")
        .select("stripe_customer_id, default_payment_method_id")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    client_data = client_row.data or {}
    customer_id = client_data.get("stripe_customer_id")
    payment_method_id = client_data.get("default_payment_method_id")
    if not customer_id or not payment_method_id:
        raise HTTPException(
            status_code=402,
            detail="Add a card to book this service — no card on file.",
        )

    # Idempotency key is derived from interest_id (not time/random) so a
    # retried or double-tapped accept collapses into the SAME PaymentIntent on
    # Stripe's side instead of charging the client twice.
    idempotency_key = f"interest-accept-{interest_id}"
    try:
        intent = stripe_service.charge_off_session(
            customer_id=customer_id,
            payment_method_id=payment_method_id,
            amount=ledger.total_charged,
            idempotency_key=idempotency_key,
            description=f"SwingBy booking — quote {interest_id}",
        )
    except stripe_service.CardChargeError as exc:
        # Charge failed — nothing has been written yet. Interest stays
        # pending, post stays open, no booking is created (§5).
        raise HTTPException(status_code=402, detail=str(exc))

    try:
        # Charge succeeded. Booking + payment are created BEFORE the
        # interest/post are flipped to their resolved states, so that if
        # anything below fails, the interest is still 'pending' — a retry
        # re-uses the same idempotency key (safe, no double charge) instead
        # of landing in a stuck state with no recovery path (§8).
        booking_payment_status = (
            payment_status.PARTIAL_RELEASED if preferred_date else payment_status.HELD
        )
        total_amount = float(ledger.total_charged)

        booking_insert = {
            "client_id": current_user["id"],
            "business_id": interest["business_id"],
            "post_id": post["id"],
            "service_category": post["category"],
            "total_amount": total_amount,
            "commission_rate": float(money.PLATFORM_CUT_RATE),
            "platform_fee": float(ledger.platform_cut),
            "status": "confirmed",
            "payment_status": booking_payment_status,
        }
        if preferred_date:
            # Time was already given at posting — skip the propose/accept
            # handshake entirely, the date is confirmed from booking creation.
            booking_insert["confirmed_date"] = preferred_date

        booking_res = supabase.table("bookings").insert(booking_insert).execute()
        booking = booking_res.data[0]

        payment_row = payment_ledger.capture_payment_row(
            supabase,
            booking_id=booking["id"],
            ledger=ledger,
            stripe_payment_intent_id=intent["id"],
        )

        # Timeline entry for the auto-confirmed date — mirrors the
        # date_confirmed event PATCH /confirm-date records for the manual
        # handshake path (bookings.py), so the two entry paths leave the
        # same trail on the booking's Live Job Status timeline. Since the
        # date is already confirmed here, the first-release trigger ("date
        # confirmed", §5) fires immediately too.
        if preferred_date:
            payment_row = payment_ledger.release_first_tranche(supabase, payment_row)
            try:
                supabase.table("booking_events").insert(
                    {
                        "booking_id": booking["id"],
                        "actor_id": current_user["id"],
                        "event_type": "date_confirmed",
                        "note": f"Time set at posting: {preferred_date}",
                    }
                ).execute()
            except Exception:
                logger.warning(
                    "Could not record date_confirmed booking_event for %s",
                    booking["id"],
                    exc_info=True,
                )

        # Carry the pre-booking quote conversation into the booking thread —
        # stamped messages surface under the booking in /messages/threads.
        try:
            supabase.table("messages").update({"booking_id": booking["id"]}).eq(
                "interest_id", interest_id
            ).execute()
        except Exception:
            pass  # thread migration is best-effort

        # Now that the money + booking are secured, resolve the interest and
        # the post it came from.
        supabase.table("interests").update({"status": "accepted"}).eq(
            "id", interest_id
        ).execute()
        supabase.table("interests").update({"status": "rejected"}).eq(
            "post_id", post["id"]
        ).neq("id", interest_id).execute()
        supabase.table("service_posts").update({"status": "matched"}).eq(
            "id", post["id"]
        ).execute()

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

        # Funnel event (K7 — no-analytics) — best-effort, never blocks accept
        from app.services.analytics import track_event

        track_event(
            "Booking Created",
            url_path="/booking/created",
            props={"category": post.get("category")},
        )

        return {
            "message": "Interest accepted — booking and payment created",
            "booking": booking,
            "payment": payment_row,
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
