import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from app.deps import get_current_user
from app.privacy import mask_service_post_row
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

    # Ghost mode makes a business unbookable: no new quotes while ghosted.
    if current_user.get("is_ghosted"):
        raise HTTPException(
            status_code=403,
            detail="Cannot express interest while your account is in ghost mode",
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
        .select("id, status, target_business_id")
        .eq("id", data.post_id)
        .single()
        .execute()
    )
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    # LANE C — direct "Book now". Feed filtering hides a targeted post from
    # everyone but its target, but hiding is not enforcement: a business that
    # learned the post id another way could still quote on it. This is the
    # real gate. 404 (not 403) so we don't confirm the post exists to a
    # business that was never meant to see it.
    target_business_id = post_res.data.get("target_business_id")
    if target_business_id and target_business_id != business_id:
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
                "*, businesses(business_name, category, avg_rating, review_count, description, logo_url)"
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

        from app.services import escrow

        # Integer cents authoritative (migration 20260723120000).
        total_c = escrow.to_cents(interest["quoted_price"] or post["budget"])
        platform_fee_c = escrow.platform_cut_cents(total_c)
        total_amount = escrow.to_dollars(total_c)
        platform_fee = escrow.to_dollars(platform_fee_c)

        booking_insert = {
            "client_id": current_user["id"],
            "business_id": interest["business_id"],
            "post_id": post["id"],
            "service_category": post["category"],
            # Supply BOTH representations so the insert works whether or not the
            # cents-sync trigger is present (it is in prod; a fresh local DB that
            # hasn't run migration 20260723120000 would otherwise NULL the
            # NOT NULL total_amount). Cents are authoritative; the trigger keeps
            # them in lockstep from here on.
            "total_amount": total_amount,
            "total_amount_cents": total_c,
            "commission_rate": 0.10,
            "platform_fee": platform_fee,
            "platform_fee_cents": platform_fee_c,
            # Charge-before-service (2026-07-21). At accept NOTHING has been
            # captured — the job hasn't happened and Stripe hasn't charged — so
            # the payment state is 'pending_payment' (owed), NOT 'held'. It flips
            # to 'held' only when the capture webhook confirms real money, and to
            # 'fully_released' at /complete. The old code wrote 'held' + a full
            # escrow figure here, so every unpaid booking read as fully funded.
            "status": "confirmed",
            "payment_status": "pending_payment",
        }
        if preferred_date:
            # Time was already given at posting — skip the propose/accept
            # handshake entirely, the date is confirmed from booking creation.
            booking_insert["confirmed_date"] = preferred_date

        booking_res = supabase.table("bookings").insert(booking_insert).execute()
        booking = booking_res.data[0]

        # Carry the pre-booking quote conversation into the booking thread —
        # stamped messages surface under the booking in /messages/threads.
        try:
            supabase.table("messages").update({"booking_id": booking["id"]}).eq(
                "interest_id", interest_id
            ).execute()
        except Exception:
            pass  # thread migration is best-effort

        # Timeline entry for the auto-confirmed date — mirrors the
        # date_confirmed event PATCH /confirm-date records for the manual
        # handshake path (bookings.py), so the two entry paths leave the
        # same trail on the booking's Live Job Status timeline.
        if preferred_date:
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

        # ONE payments row per booking — payments.booking_id is UNIQUE
        # (payments_booking_id_key) and payments.py / bookings.py both .single()
        # on it. WHICH row that is depends on whether the client already paid at
        # posting, so the charge-at-post row has to be looked up BEFORE deciding
        # to write anything.
        #
        # Flow A (Post + Pay) charged the whole budget up front, so a payments
        # row already exists holding real captured money, bound to the POST.
        # That row IS this booking's payment: it gets settled to the accepted
        # amount and re-pointed at the booking.
        #
        # Flow B (browse → request one company) has charged nothing yet, so the
        # booking needs a fresh row saying exactly that.
        #
        # The previous code inserted the Flow B row unconditionally and only
        # THEN tried to re-point the Flow A row at the same booking. The UNIQUE
        # constraint rejected that second write and the surrounding except
        # swallowed it, so a Flow A client's captured money stayed orphaned on
        # the post while the booking carried a row claiming nothing was paid —
        # and trigger_on_accept, reading that empty row, charged them a second
        # time for a job they had already paid for.
        from app.services import budget_settlement, refunds

        post_payment = refunds.load_post_payment(post["id"])
        refund_result: dict = {"refunded_cents": 0}

        if post_payment:
            # ── Flow A — settle the row that already holds the money ──────────
            plan = budget_settlement.settle_on_accept(
                escrow.money_cents(post_payment, "total_charged"), total_c
            )

            # Bind to the booking FIRST, and outside the refund's try. Every
            # reader finds a payment by booking_id, so if a Stripe failure could
            # skip this write an already-paid booking would read as unpaid and
            # /complete would refuse to release it. The refund is retryable by
            # the sweep; this binding is not.
            #
            # platform_cut lands here because settle_at_post deliberately took
            # none — between posting and acceptance the platform had provided
            # nothing. It is knowable only now that an amount was accepted.
            #
            # status is deliberately untouched: it already describes real
            # captured money, and the accept-time vocabulary ('pending_payment')
            # would be a lie about a row that is genuinely paid.
            #
            # Only platform_cut is written. total_charged and escrow_held are
            # left to describe what was ACTUALLY captured: under budget,
            # refund_payment_row below walks escrow down to the accepted amount;
            # at budget they are already correct. Writing plan's figures
            # directly would claim money that has not moved — FINDING C.
            #
            # Accepting ABOVE budget leaves the client owing the difference.
            # Kira's ruling (2026-07-28): it is charged here, at accept —
            # trigger_on_accept below asks Stripe for the outstanding balance
            # rather than bailing out as "already paid". It derives that figure
            # from the row's own ledger (total_charged − refunded, capture-backed
            # only) instead of plan["additional_charge_cents"], so a refund that
            # has already gone out is counted and a retried accept cannot charge
            # twice. Leaving total_charged alone here is what makes that
            # subtraction honest.
            bind = {
                "booking_id": booking["id"],
                **escrow.ledger_write(platform_cut=plan["platform_cut_cents"]),
            }
            bound = (
                supabase.table("payments")
                .update(bind)
                .eq("id", post_payment["id"])
                .execute()
            )
            payment_row = ((bound.data or [None])[0]) or {**post_payment, **bind}

            # The booking's own mirror, which the client's screens read. The
            # money is genuinely held by now, so leaving the insert-time
            # 'pending_payment' would show a paid job as unpaid.
            if escrow.is_capture_backed(post_payment):
                try:
                    supabase.table("bookings").update({"payment_status": "held"}).eq(
                        "id", booking["id"]
                    ).execute()
                    booking["payment_status"] = "held"
                except Exception:
                    logger.warning(
                        "could not mirror held payment_status onto booking %s",
                        booking["id"],
                        exc_info=True,
                    )

            # AMENDMENT 1 (Kira, 2026-07-26) — "Budget 150, accept 100 -> 50 get
            # refunded". The part the client did not spend goes back the moment a
            # cheaper quote is accepted. Not at completion, not on request: now,
            # while they are looking at the screen that told them it would.
            #
            # BEST-EFFORT ON PURPOSE. A refund that fails must never undo an
            # accepted booking — the client chose their provider and that stands.
            # The money is still theirs and still held; the expiry/reconcile
            # sweep retries it, and Stripe's idempotency means a retry cannot
            # double-pay. Failing the whole accept over a Stripe hiccup would be
            # a far worse outcome than a refund landing a few minutes late.
            try:
                owed_back_c = plan["refund_cents"]
                if owed_back_c > 0:
                    refunded_row = refunds.refund_payment_row(
                        post_payment,
                        amount_cents=owed_back_c,
                        reason=refunds.REASON_UNDER_BUDGET,
                        actor_id=current_user["id"],
                    )
                    # Carries the post-refund ledger; keep the binding above,
                    # which refund_payment_row does not write.
                    payment_row = {**payment_row, **(refunded_row or {})}
                    refund_result = {"refunded_cents": owed_back_c}
            except Exception:
                logger.exception(
                    "under-budget refund failed for post %s (booking %s) — "
                    "booking stands and the payment is bound; money remains "
                    "held for the sweep to retry",
                    post["id"],
                    booking["id"],
                )
        else:
            # ── Flow B — nothing captured yet, so say so ─────────────────────
            # escrow_held is 0, not the full amount. Charge-before-service:
            # nothing is captured at accept, so nothing is "held in escrow" yet —
            # escrow_held becomes non-zero only when the Stripe capture webhook
            # confirms the money actually arrived. status='pending_payment'
            # means "owed, not captured". Setting escrow_held=total here (the
            # old code) made every unpaid booking read as fully funded.
            #
            # ('pending_payment' is the current vocabulary; the live
            # payments_status_check still accepts the legacy 'pending' too.
            # Earlier comments blamed a "migration 0001 applied 2026-07-22" — no
            # such migration exists in the repo or the live list; the value is
            # right, the cited reason was not.)
            created = (
                supabase.table("payments")
                .insert(
                    {
                        "booking_id": booking["id"],
                        **escrow.ledger_write(
                            total_charged=total_c,
                            escrow_held=0,
                            released_to_business=0,
                            platform_cut=platform_fee_c,
                        ),
                        "status": "pending_payment",
                    }
                )
                .execute()
            )
            payment_row = (created.data or [None])[0]

        # TRIGGER 2 (charge-before-service, ruling 2026-07-21): the moment the
        # client accepts, start the charge automatically instead of relying on
        # an optional "Pay with card" button they can skip. Never raises — a
        # Stripe hiccup must not undo an accepted booking; the escrow guard at
        # /complete still refuses to pay the business until a capture exists.
        # Returns a checkout_url the client is sent straight to.
        #
        # Flow A posts are already paid by this point, so this is a no-op for
        # them; it is Flow B (browse -> request one company) that charges here.
        from app.services import payment_triggers

        charge = payment_triggers.trigger_on_accept(
            booking=booking,
            client=current_user,
            post=post,
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
            # Present when charge-at-accept started a Stripe checkout. The client
            # app should open checkout_url immediately. When None (Stripe not
            # configured, e.g. the demo box), the booking still exists and can be
            # paid later or recorded as off-platform.
            "checkout_url": charge.get("checkout_url"),
            "payment_started": bool(charge.get("triggered")),
            # AMENDMENT 1 — how much of the pre-paid budget went back because
            # this quote came in under it. 0 for Flow B (nothing was charged at
            # post) and for a quote at or above budget. The client app should
            # say so plainly: they were told at posting that unused budget
            # comes back, and this is the moment it did.
            "refunded_cents": refund_result["refunded_cents"],
            "refunded": escrow.to_dollars(refund_result["refunded_cents"]),
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
