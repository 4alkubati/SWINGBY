import hashlib
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Literal, Optional
from app.deps import get_current_user
from app.privacy import mask_service_post_row, mask_user_public
from app.services.contact_masking import mask_contact_info
from app.services import content_moderation
from app.services import moderation as moderation_service
from app.services.visibility import blocked_pair_ids
from app.supabase_client import supabase
from app.services.push import send_push_to_user

# Thread photos ride the SAME bucket the rest of the app's images already use
# (POST /uploads/image). Imported rather than re-declared so there is one
# definition of where an image lives — see _attachment_url() for the privacy
# reasoning and for why reads re-derive the URL from the stored path.
from app.api.uploads import BUCKET as IMAGE_BUCKET

logger = logging.getLogger(__name__)

router = APIRouter()

# A network retry of a POST /messages/ that actually committed (server wrote
# the row, then the response was lost — classic on a Render cold start) would
# otherwise double-post. The mobile retry interceptor stamps X-Send-Retry on
# retried writes; send_message() then treats an identical just-stored message
# in the same thread as this same send re-arriving. Window covers the client's
# retry backoff (0.3s + 0.8s + 2s) plus request time, with margin.
RESEND_DEDUPE_SECONDS = 15


def _require_uuid(value: str, label: str) -> None:
    """Guard so non-UUID path params (e.g. "threads" hitting /{booking_id})
    return 404 instead of blowing up Postgres with an invalid uuid cast."""
    try:
        UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=404, detail=f"{label} not found")


# ── Schemas ───────────────────────────────────────────────────────────────────


class MessageSend(BaseModel):
    # A message belongs to exactly one thread: a confirmed booking OR a quote
    # (interest) — pre-booking negotiation happens on the interest thread.
    booking_id: Optional[str] = Field(None, min_length=1, max_length=500)
    interest_id: Optional[str] = Field(None, min_length=1, max_length=500)
    # M11: a thread message is now typed. 'text' keeps the exact old contract
    # (required, non-blank content); 'image' carries the photo in the
    # attachment_* fields and treats `content` as an optional caption.
    # 'terms' is NOT sendable here — it goes through POST /messages/terms so an
    # agreement can never be forged by hand-posting a message row.
    message_type: Literal["text", "image"] = "text"
    content: Optional[str] = Field(None, max_length=2000)
    attachment_url: Optional[str] = Field(None, max_length=2000)
    attachment_path: Optional[str] = Field(None, max_length=1000)
    attachment_width: Optional[int] = Field(None, gt=0, le=20000)
    attachment_height: Optional[int] = Field(None, gt=0, le=20000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v):
        if v is None:
            return None
        return str(v).strip() or None

    @model_validator(mode="after")
    def one_thread_only(self):
        if bool(self.booking_id) == bool(self.interest_id):
            raise ValueError("Provide exactly one of booking_id or interest_id")
        return self

    @model_validator(mode="after")
    def payload_matches_type(self):
        if self.message_type == "text":
            if not self.content:
                raise ValueError("Message content cannot be blank")
        else:
            if not self.attachment_url or not self.attachment_path:
                raise ValueError("An image message needs attachment_url and path")
            # The list preview and the accessibility label both read `content`,
            # so an uncaptioned photo still says what it is.
            if not self.content:
                self.content = "Photo"
        return self


class TermsPropose(BaseModel):
    """A business proposing scope of work for the client to explicitly accept."""

    booking_id: Optional[str] = Field(None, min_length=1, max_length=500)
    interest_id: Optional[str] = Field(None, min_length=1, max_length=500)
    title: str = Field(..., min_length=1, max_length=120)
    terms_text: str = Field(..., min_length=1, max_length=4000)

    @field_validator("title", "terms_text", mode="before")
    @classmethod
    def strip_text(cls, v):
        v = str(v).strip()
        if not v:
            raise ValueError("Terms cannot be blank")
        return v

    @model_validator(mode="after")
    def one_thread_only(self):
        if bool(self.booking_id) == bool(self.interest_id):
            raise ValueError("Provide exactly one of booking_id or interest_id")
        return self


# ── Helpers ───────────────────────────────────────────────────────────────────


def _my_business_id(uid: str) -> Optional[str]:
    res = (
        supabase.table("businesses").select("id").eq("owner_id", uid).limit(1).execute()
    )
    return res.data[0]["id"] if res.data else None


def _assert_message_access(booking: dict, current_user: dict):
    uid = current_user["id"]
    role = current_user["role"]

    if booking["client_id"] == uid:
        return
    if role == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", uid)
            .single()
            .execute()
        )
        if biz.data and biz.data["id"] == booking["business_id"]:
            return
    if role == "employee":
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", uid)
            .single()
            .execute()
        )
        if emp.data and emp.data["id"] == booking.get("employee_id"):
            return

    raise HTTPException(
        status_code=403, detail="You are not a participant in this booking"
    )


def _get_interest_thread(interest_id: str) -> dict:
    """Interest + its post; 404 if either is missing."""
    res = (
        supabase.table("interests")
        .select(
            "*, service_posts(id, title, status, client_id, expires_at), "
            "businesses(business_name, logo_url)"
        )
        .eq("id", interest_id)
        .single()
        .execute()
    )
    if not res.data or not res.data.get("service_posts"):
        raise HTTPException(status_code=404, detail="Quote thread not found")
    return res.data


def _assert_interest_access(interest: dict, current_user: dict):
    """Participants: the post's client, or the quoting business's owner."""
    uid = current_user["id"]
    if interest["service_posts"]["client_id"] == uid:
        return
    if current_user["role"] in ("business_owner", "employee"):
        biz_id = _my_business_id(uid)
        if biz_id and biz_id == interest["business_id"]:
            return
        if current_user["role"] == "employee":
            emp = (
                supabase.table("employees")
                .select("business_id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            if emp.data and emp.data["business_id"] == interest["business_id"]:
                return
    raise HTTPException(
        status_code=403, detail="You are not a participant in this conversation"
    )


# ── M11: typed messages — photos and in-thread agreements ────────────────────


def _attachment_url(row: dict) -> Optional[str]:
    """Viewable URL for an image message, re-derived from the stored path.

    PRIVACY (walkthrough audit L3 — client photos as "a burglary recon tool"):
    thread photos deliberately reuse the SAME upload path and bucket as every
    other image in the app (`job-photos`, public-read, POST /uploads/image).
    That bucket is public-read, so the URL itself is the capability — but the
    object key is a server-generated UUIDv4 under the uploader's user id, so it
    is not enumerable, and the URL is only ever *handed out* by the two thread
    reads below, both of which already gate on participation
    (_assert_message_access / _assert_interest_access). Nothing here widens who
    can read a thread: a business still sees only photos posted into a thread
    it is a party to, and pre-acceptance quote threads keep their existing
    masking.

    The deliberate part is that the URL is re-derived from `attachment_path` on
    every read instead of replaying the URL frozen at write time — the same
    discipline uploads.sign_audio_path uses for the PRIVATE voice-note bucket.
    That means moving thread photos to a private bucket + short-lived signed
    URLs later is a change to this one function, not a migration over every
    historical row. It was not done now because it needs a second bucket and a
    storage-policy change that cannot ship as part of an over-the-air JS update
    alongside this feature.
    """
    path = row.get("attachment_path")
    stored = row.get("attachment_url")
    if not path:
        return stored
    try:
        url = supabase.storage.from_(IMAGE_BUCKET).get_public_url(path)
    except Exception:
        logger.warning("attachment_url_derive_failed", exc_info=True)
        return stored
    # Under test doubles / a storage outage this can come back as anything;
    # never hand a non-string down to the serializer.
    return url if isinstance(url, str) and url else stored


def _attachment_columns(data: "MessageSend") -> dict:
    """Extra insert columns for a typed message.

    A plain text send returns {} so its stored row is byte-identical to what
    this endpoint has always written (message_type defaults to 'text' in the
    DB) — no behaviour change for the 99% path.
    """
    if data.message_type != "image":
        return {}
    return {
        "message_type": "image",
        "attachment_url": data.attachment_url,
        "attachment_path": data.attachment_path,
        "attachment_width": data.attachment_width,
        "attachment_height": data.attachment_height,
    }


def _terms_fingerprint(
    message_id: str, proposed_by: str, title: str, terms_text: str
) -> str:
    """SHA-256 over exactly what was proposed, bound to the message it rode in.

    Any edit to the wording, the title, the author, or which message this
    belongs to produces a different digest — which is what makes a silent
    rewrite detectable at read time rather than only arguable after the fact.
    """
    canonical = "\n".join(
        [
            "swingby-terms-v1",
            str(message_id),
            str(proposed_by),
            title,
            terms_text,
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _acceptance_fingerprint(terms_hash: str, accepted_by: str, accepted_at: str) -> str:
    """SHA-256 over the acceptance, chained to the terms digest.

    Chained on purpose: because the acceptance digest is computed OVER
    terms_hash, changing one character of the agreed text breaks the terms link
    AND the acceptance link together. There is no way to keep a valid-looking
    acceptance attached to altered wording.
    """
    canonical = "\n".join(
        [
            "swingby-terms-accept-v1",
            str(terms_hash),
            str(accepted_by),
            str(accepted_at),
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _terms_public(row: dict, viewer_id: str, thread_client_id: Optional[str]) -> dict:
    """Shape a message_terms row for the app, with its integrity re-checked.

    `verified` is recomputed from the stored columns on EVERY read. The DB
    trigger (migration 20260725230000) already refuses edits — including from
    the backend's own service_role key — so a false here means something
    changed the row out of band, and the app is expected to render that as a
    broken record rather than as a valid agreement.
    """
    expected_terms = _terms_fingerprint(
        row.get("message_id"),
        row.get("proposed_by"),
        row.get("title") or "",
        row.get("terms_text") or "",
    )
    verified = bool(row.get("terms_hash")) and row.get("terms_hash") == expected_terms

    if verified and row.get("accepted_at"):
        expected_acceptance = _acceptance_fingerprint(
            row.get("terms_hash"),
            row.get("accepted_by"),
            row.get("accepted_at"),
        )
        verified = row.get("acceptance_hash") == expected_acceptance

    return {
        "id": row.get("id"),
        "message_id": row.get("message_id"),
        "title": row.get("title"),
        "terms_text": row.get("terms_text"),
        "status": row.get("status"),
        "proposed_by": row.get("proposed_by"),
        "created_at": row.get("created_at"),
        "accepted_by": row.get("accepted_by"),
        "accepted_at": row.get("accepted_at"),
        "accepted_name": row.get("accepted_name"),
        "verified": verified,
        # Only the thread's client accepts, and never their own proposal. The
        # server re-checks this on POST .../accept — this is just so the app
        # knows whether to draw the button.
        "can_accept": (
            row.get("status") == "pending"
            and bool(thread_client_id)
            and viewer_id == thread_client_id
            and viewer_id != row.get("proposed_by")
        ),
    }


def _decorate_messages(
    items: list, viewer_id: str, thread_client_id: Optional[str] = None
) -> list:
    """Attach image URLs and agreement records to a page of messages.

    Best-effort by design: a message list must still render if the terms lookup
    fails, so a failure here downgrades a terms bubble to its preview line
    rather than 500-ing the whole thread.
    """
    if not items:
        return items

    for row in items:
        if row.get("message_type") == "image":
            row["attachment_url"] = _attachment_url(row)

    terms_ids = [row.get("id") for row in items if row.get("message_type") == "terms"]
    if not terms_ids:
        return items

    try:
        res = (
            supabase.table("message_terms")
            .select("*")
            .in_("message_id", terms_ids)
            .execute()
        )
        by_message = {
            r["message_id"]: r for r in (res.data or []) if r.get("message_id")
        }
    except Exception:
        logger.warning("terms_lookup_failed", exc_info=True)
        return items

    for row in items:
        if row.get("message_type") != "terms":
            continue
        terms_row = by_message.get(row.get("id"))
        row["terms"] = (
            _terms_public(terms_row, viewer_id, thread_client_id) if terms_row else None
        )
    return items


def _resolve_thread(
    booking_id: Optional[str], interest_id: Optional[str], current_user: dict
) -> dict:
    """Access-checked lookup shared by the terms endpoints.

    Returns {thread_field, thread_id, client_id, business_id, recipient_id}.
    Raises the same 403/404s the send/read paths already raise.
    """
    uid = current_user["id"]

    if booking_id:
        _require_uuid(booking_id, "Booking")
        res = (
            supabase.table("bookings")
            .select("*")
            .eq("id", booking_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking = res.data
        _assert_message_access(booking, current_user)
        client_id = booking["client_id"]
        business_id = booking["business_id"]
        thread_field, thread_id = "booking_id", booking_id
    else:
        _require_uuid(interest_id, "Quote thread")
        interest = _get_interest_thread(interest_id)
        _assert_interest_access(interest, current_user)
        client_id = interest["service_posts"]["client_id"]
        business_id = interest["business_id"]
        thread_field, thread_id = "interest_id", interest_id

    if client_id == uid:
        owner = (
            supabase.table("businesses")
            .select("owner_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        recipient_id = owner.data["owner_id"] if owner.data else None
    else:
        recipient_id = client_id

    return {
        "thread_field": thread_field,
        "thread_id": thread_id,
        "client_id": client_id,
        "business_id": business_id,
        "recipient_id": recipient_id,
    }


def _quote_context_for_booking(booking: dict) -> Optional[dict]:
    """
    DQ-4 continuity: the pre-booking quote's job title + quoted price, so the
    booking chat header keeps the same context the quote thread showed.

    accept_interest() already re-parents the quote thread's message rows onto
    the booking (stamps booking_id alongside the existing interest_id — see
    interests.py), so GET /messages/{booking_id} already returns the full
    message history unbroken. What's still missing without this is the
    "<job title> · $X quoted" context line ChatScreen renders from
    `threadInfo` — that block only ever arrived via GET /messages/interest/*,
    so it went blank the moment the thread flipped from interest_id to
    booking_id routing, which is what read as "a new chat" in QA.

    Returns the same shape as the `interest` key in get_interest_messages()
    so the existing mobile ChatScreen (`data?.interest` → threadInfo) picks
    it up with no client-side change. Best-effort / read-only: returns None
    for direct geo-browse bookings with no post_id, or on any lookup error —
    never blocks the message list itself.
    """
    post_id = booking.get("post_id")
    if not post_id:
        return None
    try:
        res = (
            supabase.table("interests")
            .select("id, status, quoted_price, service_posts(title, status)")
            .eq("post_id", post_id)
            .eq("business_id", booking["business_id"])
            .eq("status", "accepted")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        row = rows[0]
        post = row.get("service_posts") or {}
        return {
            "id": row["id"],
            "status": row["status"],
            "quoted_price": row.get("quoted_price"),
            "post_title": post.get("title"),
            "post_status": post.get("status"),
        }
    except Exception:
        logger.warning("quote_context_lookup_failed", exc_info=True)
        return None


def _counterpart_user_id(
    *, viewer_id: str, client_id: str | None, business_id: str | None
) -> str | None:
    """The USER on the other side of a thread.

    Report needs no user id (the backend resolves the owner from the message
    itself), but BLOCK does — `user_blocks` is user-to-user, and a business id is
    not a user id. Both message read endpoints return this so the chat header can
    offer Block without a second round trip to work out who it would be blocking.

    Best-effort: a missing counterpart hides the Block control rather than
    breaking the thread.
    """
    if client_id and viewer_id != client_id:
        # The viewer is on the business side; the client is the counterpart.
        return client_id
    if not business_id:
        return None
    try:
        res = (
            supabase.table("businesses")
            .select("owner_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        # `.single()` yields a dict, but tolerate a list too: this runs on the
        # message-read path, and unwrapping is INSIDE the try because a shape
        # surprise here must degrade to "no Block control" rather than 400 the
        # whole thread. The metadata is decorative; the thread is not.
        data = res.data
        if isinstance(data, list):
            data = data[0] if data else {}
        owner_id = (data or {}).get("owner_id")
    except Exception:
        logger.warning("counterpart_lookup_failed", exc_info=True)
        return None
    # A business owner viewing their own thread has no counterpart on this path.
    return None if owner_id == viewer_id else owner_id


def _has_unread(items: list, uid: str) -> bool:
    """True if any already-fetched message is unread and not sent by the reader.

    Lets callers skip the _mark_read DB WRITE entirely on the common polling
    case (nothing new since last read) — the message list is polled every 5s,
    so an unconditional write per poll was pure write amplification against
    Postgres for no state change.
    """
    return any(m.get("read_at") is None and m.get("sender_id") != uid for m in items)


def _mark_read(thread_field: str, thread_id: str, uid: str):
    """Mark everything in the thread not sent by the reader as read."""
    try:
        (
            supabase.table("messages")
            .update({"read_at": datetime.now(timezone.utc).isoformat()})
            .eq(thread_field, thread_id)
            .neq("sender_id", uid)
            .is_("read_at", "null")
            .execute()
        )
    except Exception:
        pass  # read receipts are best-effort


# The statuses on which a booking still has a REACHABLE message thread.
#
# One constant, three readers, on purpose. This rule was previously written out
# by hand in `list_threads` and in `send_message`, and NOT applied in
# `unread_count` — so a cancelled booking vanished from the inbox while its
# unread messages kept feeding the tab-bar badge. The badge counted a thread
# with nowhere left to open it, and nothing ever clears `read_at` on cancel, so
# the number was permanent. Meanwhile the Dashboard's own unread pill, built
# from the filtered thread list, showed a different number for the same account
# at the same moment.
#
# Sentinel, 2026-08-01. Any new reader of "which bookings have threads" uses
# this rather than retyping the tuple.
THREADED_BOOKING_STATUSES = ("confirmed", "in_progress", "completed")


def _thread_visible(booking: dict) -> bool:
    """True if this booking's thread is reachable in the app."""
    return (booking or {}).get("status") in THREADED_BOOKING_STATUSES


def _accessible_thread_ids(current_user: dict):
    """(booking_ids, interest_ids, context) the user participates in."""
    uid = current_user["id"]
    role = current_user["role"]
    booking_rows, interest_rows = [], []

    if role == "client":
        booking_rows = (
            supabase.table("bookings")
            .select(
                # owner_id is not rendered anywhere — it is here so list_threads
                # can tell whether the counterpart is a blocked user without a
                # second round trip per thread.
                "id, status, business_id, confirmed_date, "
                "businesses(business_name, logo_url, owner_id)"
            )
            .eq("client_id", uid)
            .execute()
        ).data or []
        interest_rows = (
            supabase.table("interests")
            .select(
                "id, status, quoted_price, business_id, "
                "service_posts!inner(id, title, status, client_id), "
                "businesses(business_name, logo_url, owner_id)"
            )
            .eq("service_posts.client_id", uid)
            .execute()
        ).data or []
    elif role in ("business_owner", "employee"):
        biz_id = _my_business_id(uid)
        if not biz_id and role == "employee":
            emp = (
                supabase.table("employees")
                .select("business_id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            biz_id = emp.data["business_id"] if emp.data else None
        if biz_id:
            booking_rows = (
                supabase.table("bookings")
                .select(
                    "id, status, client_id, confirmed_date, "
                    "users!bookings_client_id_fkey(first_name, last_name, avatar_url)"
                )
                .eq("business_id", biz_id)
                .execute()
            ).data or []
            interest_rows = (
                supabase.table("interests")
                .select(
                    "id, status, quoted_price, business_id, "
                    "service_posts(id, title, status, client_id, "
                    "users(first_name, last_name, avatar_url))"
                )
                .eq("business_id", biz_id)
                .execute()
            ).data or []

    return booking_rows, interest_rows


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/")
def send_message(
    data: MessageSend,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    recipient_id = None

    # Off-platform-leakage guard (item 31): strip phone numbers / emails BEFORE
    # anything is stored or compared, so a swapped contact detail never lands in
    # a readable form in the DB and can't be pulled back out via any read path.
    # Chat unlocks on the interest (quote) thread the moment a business quotes
    # an OPEN post — pre-acceptance, pre-payment — which is the exact window a
    # client + business would use to take the job off-platform. Masking (not
    # gating) is used deliberately: pre-booking chat on interest threads is a
    # shipped, smoke-covered flow (CLAUDE.md "MESSAGES span the quote → booking
    # arc"), so gating it would break the demo. mask_contact_info is
    # false-positive-safe for prices/addresses/dates (tests/test_contact_masking).
    masked_content, was_masked = mask_contact_info(data.content)

    # Objectionable-content filter (App Store Guideline 1.2(a)). Same choke
    # point, immediately after masking: a BLOCK must be refused before anything
    # is stored, and screening the MASKED text means a phone number can't be
    # used as padding to break a term apart. A FLAG stores normally and files a
    # report for a human — see the "deliberately not a profanity filter" note in
    # services/content_moderation.py for why the two outcomes differ.
    screen_outcome, screen_reasons = content_moderation.screen_text(masked_content)
    if screen_outcome == content_moderation.BLOCK:
        raise HTTPException(status_code=400, detail=content_moderation.BLOCK_MESSAGE)

    if data.booking_id:
        booking_res = (
            supabase.table("bookings")
            .select("*")
            .eq("id", data.booking_id)
            .single()
            .execute()
        )
        if not booking_res.data:
            raise HTTPException(status_code=404, detail="Booking not found")

        booking = booking_res.data
        # GAP #65: /messages/threads lists completed bookings as chattable
        # threads (see list_threads below), so a completed booking must stay
        # sendable here too — a listed thread that 400s on send is the bug.
        # Product ruling: keep it sendable, not read-only.
        if not _thread_visible(booking):
            raise HTTPException(
                status_code=400,
                detail="Messages are only available on confirmed, in-progress, or completed bookings",
            )
        _assert_message_access(booking, current_user)

        if booking["client_id"] == uid:
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", booking["business_id"])
                .single()
                .execute()
            )
            recipient_id = (
                biz_owner_res.data["owner_id"] if biz_owner_res.data else None
            )
        else:
            recipient_id = booking["client_id"]

        row = {
            "booking_id": data.booking_id,
            "sender_id": uid,
            "content": masked_content,
            **_attachment_columns(data),
        }
    else:
        interest = _get_interest_thread(data.interest_id)
        _assert_interest_access(interest, current_user)

        # Thread stays open while the post is negotiable (open) or already
        # matched via this interest; closed/expired posts end the conversation.
        post_status = interest["service_posts"]["status"]
        if post_status not in ("open", "matched") and interest["status"] != "accepted":
            raise HTTPException(
                status_code=400, detail="This job post is no longer open for messages"
            )

        client_id = interest["service_posts"]["client_id"]
        if client_id == uid:
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", interest["business_id"])
                .single()
                .execute()
            )
            recipient_id = (
                biz_owner_res.data["owner_id"] if biz_owner_res.data else None
            )
        else:
            recipient_id = client_id

        row = {
            "interest_id": data.interest_id,
            "sender_id": uid,
            "content": masked_content,
            **_attachment_columns(data),
        }

    # Block gate (App Store Guideline 1.2(c)). Placed here, after BOTH branches
    # have resolved recipient_id, so booking threads and pre-acceptance interest
    # threads are covered by one check rather than two that can drift.
    #
    # Symmetric: `blocked_pair_ids` returns people the sender blocked AND people
    # who blocked the sender. Either direction refuses the send — a block that
    # only stops one side still leaves the abuser able to keep initiating, which
    # is the behaviour 1.2(c) exists to stop.
    #
    # 403 rather than 400: this is an authorisation outcome, and the mobile
    # client keys its "you can't reply in this thread" state off the status.
    if recipient_id and recipient_id in blocked_pair_ids(supabase, uid):
        raise HTTPException(
            status_code=403,
            detail="You can't message this person because one of you blocked the other.",
        )

    # Retry-safe insert: only retried requests carry X-Send-Retry, so the happy
    # path pays nothing. A retry first looks for an identical message it may
    # have already stored and returns that instead of posting a duplicate.
    if request.headers.get("x-send-retry"):
        thread_field = "booking_id" if data.booking_id else "interest_id"
        thread_id = data.booking_id or data.interest_id
        cutoff = (
            datetime.now(timezone.utc) - timedelta(seconds=RESEND_DEDUPE_SECONDS)
        ).isoformat()
        try:
            query = (
                supabase.table("messages")
                .select("*")
                .eq(thread_field, thread_id)
                .eq("sender_id", uid)
                .eq("content", masked_content)
            )
            # Two different photos sent seconds apart share the default "Photo"
            # caption, so content alone would collapse them into one. The
            # storage path is unique per upload, which makes it the right
            # identity for an image retry.
            if data.message_type == "image":
                query = query.eq("attachment_path", data.attachment_path)
            existing = (
                query.gte("sent_at", cutoff)
                .order("sent_at", desc=True)
                .limit(1)
                .execute()
            )
            if existing.data:
                row_out = existing.data[0]
                if row_out.get("message_type") == "image":
                    row_out["attachment_url"] = _attachment_url(row_out)
                return {
                    "message": "Sent",
                    "data": row_out,
                    "masked": was_masked,
                }
        except Exception:
            pass  # dedupe is best-effort — fall through to a normal insert

    try:
        res = supabase.table("messages").insert(row).execute()

        # Notify the other participant — best-effort, and OFF the request path.
        # send_push_to_user() POSTs to Expo serially per token with a 5s timeout,
        # which used to add up to ~10s to every send when run inline. Handing it
        # to BackgroundTasks lets the response return the instant the row is
        # written; the push fans out after. send_push_to_user never raises.
        if recipient_id and recipient_id != uid:
            push_body = (
                f"Photo · {masked_content[:80]}"
                if data.message_type == "image" and masked_content != "Photo"
                else (
                    "Sent a photo"
                    if data.message_type == "image"
                    else masked_content[:100]
                )
            )
            background_tasks.add_task(
                send_push_to_user, recipient_id, "New message", push_body
            )

        # `masked` lets the mobile client surface a "we hid that contact info —
        # keep it on SwingBy" notice on the just-sent message.
        sent_row = res.data[0]
        if sent_row.get("message_type") == "image":
            sent_row["attachment_url"] = _attachment_url(sent_row)

        # A FLAG from the content filter stores normally and raises a report for
        # a human. Fired AFTER the insert because the report has to point at a
        # message id that exists. Best-effort by contract — the send has already
        # succeeded and must not be undone by moderation bookkeeping.
        if screen_outcome == content_moderation.FLAG:
            moderation_service.file_automatic_report(
                target_type="message",
                target_id=sent_row["id"],
                author_id=uid,
                reason=screen_reasons[0],
                details=f"Auto-flagged by the content filter ({', '.join(screen_reasons)}).",
            )

        return {"message": "Sent", "data": sent_row, "masked": was_masked}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not send message")
        raise HTTPException(status_code=400, detail="Could not send message")


# ── In-thread agreements (M11) ────────────────────────────────────────────────
#
# Why this is not just a message with a button on it: "agreed" has to survive
# somebody later saying "that is not what I signed up for". So the record has
# to answer WHO agreed, to exactly WHAT text, and WHEN — and none of those may
# be editable afterwards.
#
#   • the wording lives in message_terms.terms_text, verbatim, and is the same
#     string the bubble renders — there is no second, prettier copy;
#   • acceptance stores accepted_by, accepted_at AND accepted_name (the name as
#     shown at the moment of acceptance, so a later profile rename cannot
#     restate who signed);
#   • both are fingerprinted (SHA-256, chained) and re-verified on every read;
#   • the DB trigger from migration 20260725230000 refuses edits — including
#     from this service, which holds the service_role key.
#
# Deliberately carries NO money. The price lives in the quote card and the pay
# sheet (PAYMENTS.md), and a second place to state a total is a second place to
# be wrong about what was charged.


@router.post("/terms")
def propose_terms(
    data: TermsPropose,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Business proposes scope of work for the client to explicitly accept."""
    uid = current_user["id"]

    # Only the provider side proposes; the client is the one who agrees. A
    # client "agreeing" with themselves would be a worthless record. Checked
    # before the thread lookup — it needs no DB round-trip to answer.
    if current_user.get("role") not in ("business_owner", "employee"):
        raise HTTPException(
            status_code=403, detail="Only the business can send terms to agree to"
        )

    thread = _resolve_thread(data.booking_id, data.interest_id, current_user)
    if thread["client_id"] == uid:
        raise HTTPException(status_code=403, detail="You cannot send yourself terms")

    # Same off-platform-leakage guard as ordinary chat (item 31), applied
    # BEFORE the fingerprint — otherwise "terms" would be the one message type
    # you could smuggle a phone number through, and the stored text would not
    # be the text that was hashed.
    title, _ = mask_contact_info(data.title)
    terms_text, was_masked = mask_contact_info(data.terms_text)

    preview = f"Scope of work: {title}"[:200]
    message_row = {
        thread["thread_field"]: thread["thread_id"],
        "sender_id": uid,
        "content": preview,
        "message_type": "terms",
    }

    try:
        msg_res = supabase.table("messages").insert(message_row).execute()
        message = msg_res.data[0]
    except Exception:
        logger.exception("Could not create the terms message")
        raise HTTPException(status_code=400, detail="Could not send these terms")

    terms_row = {
        "message_id": message["id"],
        thread["thread_field"]: thread["thread_id"],
        "proposed_by": uid,
        "title": title,
        "terms_text": terms_text,
        "terms_hash": _terms_fingerprint(message["id"], uid, title, terms_text),
        "status": "pending",
    }

    try:
        terms_res = supabase.table("message_terms").insert(terms_row).execute()
        terms = terms_res.data[0]
    except Exception:
        logger.exception("Could not store the terms record")
        # The bubble would otherwise render as an agreement with nothing behind
        # it. The message has no acceptance yet, so removing it is safe (the
        # trigger only protects accepted rows).
        try:
            supabase.table("messages").delete().eq("id", message["id"]).execute()
        except Exception:
            logger.warning("orphan_terms_message_cleanup_failed", exc_info=True)
        raise HTTPException(status_code=400, detail="Could not send these terms")

    if thread["recipient_id"] and thread["recipient_id"] != uid:
        background_tasks.add_task(
            send_push_to_user,
            thread["recipient_id"],
            "Terms to review",
            f"{title[:80]} — tap to read and agree",
        )

    message["terms"] = _terms_public(terms, uid, thread["client_id"])
    return {"message": "Sent", "data": message, "masked": was_masked}


@router.post("/terms/{terms_id}/accept")
def accept_terms(
    terms_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """The client agrees. This writes the record that has to hold up later."""
    _require_uuid(terms_id, "Terms")
    uid = current_user["id"]

    res = (
        supabase.table("message_terms")
        .select("*")
        .eq("id", terms_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Terms not found")
    terms = res.data

    thread = _resolve_thread(
        terms.get("booking_id"), terms.get("interest_id"), current_user
    )
    if uid != thread["client_id"]:
        raise HTTPException(
            status_code=403, detail="Only the client on this job can agree to terms"
        )
    if uid == terms.get("proposed_by"):
        raise HTTPException(
            status_code=403, detail="You cannot agree to your own terms"
        )
    if terms.get("status") != "pending":
        raise HTTPException(
            status_code=409, detail=f"These terms were already {terms.get('status')}"
        )

    # Refuse to sign something that no longer matches what was proposed. If the
    # stored wording and its fingerprint have drifted apart, the honest answer
    # is "this cannot be agreed to", not "sign it anyway".
    expected = _terms_fingerprint(
        terms.get("message_id"),
        terms.get("proposed_by"),
        terms.get("title") or "",
        terms.get("terms_text") or "",
    )
    if terms.get("terms_hash") != expected:
        logger.error("terms_fingerprint_mismatch id=%s", terms_id)
        raise HTTPException(
            status_code=409,
            detail="These terms can no longer be verified — ask for them to be re-sent",
        )

    accepted_at = datetime.now(timezone.utc).isoformat()
    accepted_name = (
        " ".join(
            filter(
                None,
                [current_user.get("first_name"), current_user.get("last_name")],
            )
        ).strip()
        or current_user.get("email")
        or "Client"
    )
    update = {
        "status": "accepted",
        "accepted_by": uid,
        "accepted_at": accepted_at,
        "accepted_name": accepted_name,
        "acceptance_hash": _acceptance_fingerprint(
            terms["terms_hash"], uid, accepted_at
        ),
    }

    try:
        # Conditional on status='pending': two taps racing each other cannot
        # both write an acceptance, and the second one comes back empty rather
        # than overwriting the first one's timestamp.
        upd = (
            supabase.table("message_terms")
            .update(update)
            .eq("id", terms_id)
            .eq("status", "pending")
            .execute()
        )
    except Exception:
        logger.exception("Could not record the terms acceptance")
        raise HTTPException(status_code=400, detail="Could not record your agreement")

    if not upd.data:
        raise HTTPException(status_code=409, detail="These terms were already resolved")

    if terms.get("proposed_by") and terms["proposed_by"] != uid:
        background_tasks.add_task(
            send_push_to_user,
            terms["proposed_by"],
            "Terms agreed",
            f"{accepted_name} agreed to “{(terms.get('title') or '')[:60]}”",
        )

    return {
        "message": "Agreed",
        "data": _terms_public(upd.data[0], uid, thread["client_id"]),
    }


@router.post("/terms/{terms_id}/withdraw")
def withdraw_terms(terms_id: str, current_user: dict = Depends(get_current_user)):
    """The proposer pulls back terms the client has not agreed to yet.

    Only ever pending → withdrawn. An accepted agreement is final: the trigger
    rejects the update even if this route somehow reached it.
    """
    _require_uuid(terms_id, "Terms")
    uid = current_user["id"]

    res = (
        supabase.table("message_terms")
        .select("*")
        .eq("id", terms_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Terms not found")
    terms = res.data

    thread = _resolve_thread(
        terms.get("booking_id"), terms.get("interest_id"), current_user
    )
    if terms.get("proposed_by") != uid:
        raise HTTPException(
            status_code=403, detail="Only whoever sent these terms can withdraw them"
        )
    if terms.get("status") != "pending":
        raise HTTPException(
            status_code=409, detail=f"These terms were already {terms.get('status')}"
        )

    try:
        upd = (
            supabase.table("message_terms")
            .update({"status": "withdrawn"})
            .eq("id", terms_id)
            .eq("status", "pending")
            .execute()
        )
    except Exception:
        logger.exception("Could not withdraw the terms")
        raise HTTPException(status_code=400, detail="Could not withdraw these terms")

    if not upd.data:
        raise HTTPException(status_code=409, detail="These terms were already resolved")

    return {
        "message": "Withdrawn",
        "data": _terms_public(upd.data[0], uid, thread["client_id"]),
    }


@router.get("/threads")
def list_threads(
    limit: int = Query(50, ge=1, le=200, description="Max threads to return"),
    current_user: dict = Depends(get_current_user),
):
    """
    Unified inbox: one row per booking thread and per quote (interest) thread.

    Booking threads appear for confirmed / in-progress / completed bookings even
    with no messages yet. Interest threads appear once they carry at least one
    message (quoting without a note doesn't clutter the inbox).

    M19 — capped. This was unbounded: every booking thread plus every quote
    thread the user has ever had, assembled in Python on a screen every user
    opens. Fine at ten bookings, and the first query to degrade as volume grows.
    The cap is applied AFTER the newest-first sort so it drops the oldest
    threads rather than an arbitrary slice.
    """
    uid = current_user["id"]
    try:
        booking_rows, interest_rows = _accessible_thread_ids(current_user)

        # Guideline 1.2(c): a blocked counterpart's thread leaves the inbox in
        # both directions. Computed once for the whole page — the set is small
        # and the alternative is a lookup per thread.
        blocked = blocked_pair_ids(supabase, uid)

        booking_ids = [b["id"] for b in booking_rows]
        interest_ids = [i["id"] for i in interest_rows]

        msgs = []
        if booking_ids or interest_ids:
            q = supabase.table("messages").select(
                "id, booking_id, interest_id, sender_id, content, sent_at, "
                "read_at, message_type"
            )
            if booking_ids and interest_ids:
                q = q.or_(
                    f"booking_id.in.({','.join(booking_ids)}),"
                    f"interest_id.in.({','.join(interest_ids)})"
                )
            elif booking_ids:
                q = q.in_("booking_id", booking_ids)
            else:
                q = q.in_("interest_id", interest_ids)
            msgs = (q.order("sent_at", desc=True).limit(1000).execute()).data or []

        by_booking: dict = {}
        by_interest: dict = {}
        for m in msgs:
            key = m.get("booking_id") or m.get("interest_id")
            bucket = by_booking if m.get("booking_id") else by_interest
            agg = bucket.setdefault(key, {"last": m, "unread": 0})
            if m["sender_id"] != uid and not m.get("read_at"):
                agg["unread"] += 1

        threads = []

        for b in booking_rows:
            if not _thread_visible(b):
                continue
            # The counterpart is the business owner when the viewer is the
            # client, and the client when the viewer is the business — exactly
            # the two shapes _accessible_thread_ids returns.
            b_counterpart = (b.get("businesses") or {}).get("owner_id") or b.get(
                "client_id"
            )
            if b_counterpart and b_counterpart in blocked:
                continue
            agg = by_booking.get(b["id"], {"last": None, "unread": 0})
            client_user = b.get("users") or {}
            client_name = " ".join(
                filter(
                    None, [client_user.get("first_name"), client_user.get("last_name")]
                )
            )
            biz = b.get("businesses") or {}
            counterpart = biz.get("business_name") or client_name or "Chat"
            # Who the viewer is looking at decides the shape of the tile:
            # businesses are TILES with a logo, people are CIRCLES with an
            # avatar (BusinessLogo.js / POLISH-TIPS §8). Only the client-side
            # query embeds `businesses`, so this is a business counterpart
            # exactly when that embed came back — a business never sees its own
            # logo here.
            is_business = bool(biz.get("business_name"))
            threads.append(
                {
                    "thread_type": "booking",
                    "id": b["id"],
                    "title": counterpart,
                    "counterpart_name": counterpart,
                    "counterpart_avatar": client_user.get("avatar_url"),
                    "counterpart_type": "business" if is_business else "person",
                    "counterpart_logo": biz.get("logo_url") if is_business else None,
                    "status": b.get("status"),
                    # CARD-20 — lets the Messages list render the floating
                    # booking badge as "confirmed" vs "pending a time"
                    # without a second round-trip to /bookings/{id}.
                    "confirmed_date": b.get("confirmed_date"),
                    "last_message": (agg["last"] or {}).get("content"),
                    "last_at": (agg["last"] or {}).get("sent_at"),
                    # M11: lets the inbox row badge a photo / an agreement
                    # instead of showing its plain-text preview line.
                    "last_message_type": (agg["last"] or {}).get("message_type")
                    or "text",
                    "unread_count": agg["unread"],
                }
            )

        for i in interest_rows:
            agg = by_interest.get(i["id"])
            if not agg:
                continue  # no conversation yet
            i_counterpart = (i.get("businesses") or {}).get("owner_id") or (
                i.get("service_posts") or {}
            ).get("client_id")
            if i_counterpart and i_counterpart in blocked:
                continue
            post = i.get("service_posts") or {}
            # Quote threads are pre-acceptance by default — until the client
            # accepts, the business's chat header shows the anonymous "Client"
            # label, no name and no avatar (audit L1, 2026-07-24). Only an
            # accepted interest reveals the person on the other side.
            if i.get("status") != "accepted":
                post = mask_service_post_row(post)
            client_user = post.get("users") or {}
            i_biz = i.get("businesses") or {}
            i_is_business = bool(i_biz.get("business_name"))
            counterpart = (
                i_biz.get("business_name")
                or " ".join(
                    filter(
                        None,
                        [client_user.get("first_name"), client_user.get("last_name")],
                    )
                )
                or client_user.get("display_name")
                or "Chat"
            )
            threads.append(
                {
                    "thread_type": "interest",
                    "id": i["id"],
                    "title": post.get("title") or "Job post",
                    "counterpart_name": counterpart,
                    "counterpart_avatar": client_user.get("avatar_url"),
                    "counterpart_type": "business" if i_is_business else "person",
                    "counterpart_logo": (
                        i_biz.get("logo_url") if i_is_business else None
                    ),
                    "status": i.get("status"),
                    "quoted_price": i.get("quoted_price"),
                    # Lets a client tap through from the inbox / chat header to
                    # the quoting business's profile without a second fetch.
                    "business_id": i.get("business_id"),
                    "last_message": (agg["last"] or {}).get("content"),
                    "last_at": (agg["last"] or {}).get("sent_at"),
                    "last_message_type": (agg["last"] or {}).get("message_type")
                    or "text",
                    "unread_count": agg["unread"],
                }
            )

        threads.sort(key=lambda t: t.get("last_at") or "", reverse=True)
        total = len(threads)
        # `total` is reported so a client can tell "these are all of them" from
        # "these are the newest 50", which a bare truncated list cannot express.
        return {"items": threads[:limit], "total": total, "limit": limit}
    except Exception:
        logger.exception("Could not list threads")
        raise HTTPException(status_code=400, detail="Could not list threads")


@router.get("/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    """Total unread messages across all of the user's threads (30s mobile poll)."""
    uid = current_user["id"]
    try:
        booking_rows, interest_rows = _accessible_thread_ids(current_user)
        # Only bookings whose thread can still be OPENED. Counting a cancelled
        # booking's unread messages gave the tab-bar badge a number the user
        # could never clear — the thread is gone from the inbox, nothing clears
        # read_at on cancel, and the badge sat there forever disagreeing with
        # the Dashboard's own pill.
        booking_ids = [b["id"] for b in booking_rows if _thread_visible(b)]
        interest_ids = [i["id"] for i in interest_rows]
        if not booking_ids and not interest_ids:
            return {"total": 0, "by_booking": {}}

        q = (
            supabase.table("messages")
            .select("id, booking_id, interest_id", count="exact")
            .neq("sender_id", uid)
            .is_("read_at", "null")
        )
        if booking_ids and interest_ids:
            q = q.or_(
                f"booking_id.in.({','.join(booking_ids)}),"
                f"interest_id.in.({','.join(interest_ids)})"
            )
        elif booking_ids:
            q = q.in_("booking_id", booking_ids)
        else:
            q = q.in_("interest_id", interest_ids)
        res = q.execute()
        rows = res.data or []
        by_booking: dict = {}
        for r in rows:
            if r.get("booking_id"):
                by_booking[r["booking_id"]] = by_booking.get(r["booking_id"], 0) + 1
        return {"total": len(rows), "by_booking": by_booking}
    except Exception:
        logger.exception("Could not compute unread count")
        return {"total": 0, "by_booking": {}}


@router.get("/interest/{interest_id}")
def get_interest_messages(
    interest_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    before: Optional[str] = Query(
        None, description="ISO-8601 timestamp — return messages sent before this time"
    ),
    current_user: dict = Depends(get_current_user),
):
    _require_uuid(interest_id, "Quote thread")
    interest = _get_interest_thread(interest_id)
    _assert_interest_access(interest, current_user)

    try:
        query = (
            supabase.table("messages")
            .select("*, users(first_name, last_name)")
            .eq("interest_id", interest_id)
            # See the booking-thread read below — hidden messages never render.
            .is_("hidden_at", "null")
        )
        if before:
            query = query.lt("sent_at", before)

        query = query.order("sent_at", desc=True).limit(limit)
        res = query.execute()
        items = res.data or []
        # CARD-23: a pending quote thread is pre-acceptance — the client's
        # last name must not ride along on their own chat messages until
        # the interest is accepted. Only the client's own messages carry
        # their name via this join, so only those need masking.
        client_id = interest["service_posts"]["client_id"]
        if interest["status"] != "accepted" and current_user["id"] != client_id:
            for item in items:
                if item.get("sender_id") == client_id and item.get("users"):
                    item["users"] = mask_user_public(item["users"])
        # M11: image URLs re-derived from their stored path, agreement records
        # attached to their terms bubbles. Runs AFTER masking so it cannot
        # reintroduce anything masking just removed.
        items = _decorate_messages(items, current_user["id"], client_id)
        if _has_unread(items, current_user["id"]):
            _mark_read("interest_id", interest_id, current_user["id"])
        next_before = items[-1]["sent_at"] if items else None
        return {
            "items": items,
            "limit": limit,
            "before": before,
            "next_before": next_before,
            "interest": {
                "id": interest["id"],
                "status": interest["status"],
                "quoted_price": interest.get("quoted_price"),
                # F020/F046: ChatScreen's quote-status check needs these two to
                # do the same expiry-clock comparison MessagesScreen's inbox
                # already does (utils/quoteStatus.quoteExpiry) — without them a
                # quote the inbox shows "Expired" still renders live Accept &
                # pay / Decline buttons in the thread.
                "created_at": interest.get("created_at"),
                "post_expires_at": interest["service_posts"].get("expires_at"),
                # Header tap-through to the business profile (client side) —
                # the interest thread has no bookingMeta to read business_id off.
                "business_id": interest.get("business_id"),
                # The quoting business's face for the chat header. Safe in both
                # directions: a business's name and logo are public, and the
                # client-side masking above only ever concerns the client.
                "business_name": (interest.get("businesses") or {}).get(
                    "business_name"
                ),
                "business_logo": (interest.get("businesses") or {}).get("logo_url"),
                "post_title": interest["service_posts"].get("title"),
                "post_status": interest["service_posts"].get("status"),
                # Guideline 1.2(c): the header's Block control needs a USER id,
                # and `business_id` is not one.
                "counterpart_user_id": _counterpart_user_id(
                    viewer_id=current_user["id"],
                    client_id=client_id,
                    business_id=interest.get("business_id"),
                ),
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not retrieve messages")
        raise HTTPException(status_code=400, detail="Could not retrieve messages")


@router.get("/{booking_id}")
def get_messages(
    booking_id: str,
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    before: Optional[str] = Query(
        None, description="ISO-8601 timestamp — return messages sent before this time"
    ),
    current_user: dict = Depends(get_current_user),
):
    _require_uuid(booking_id, "Booking")
    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")

    _assert_message_access(booking_res.data, current_user)

    try:
        query = (
            supabase.table("messages")
            .select("*, users(first_name, last_name)")
            .eq("booking_id", booking_id)
            # Moderation (Guideline 1.2): a message an admin hid stops rendering
            # for everyone, including the sender. The row is retained — hiding
            # is a soft-hide so the admin trail and the CRA-retention posture in
            # me.py both survive it.
            .is_("hidden_at", "null")
        )
        if before:
            query = query.lt("sent_at", before)

        query = query.order("sent_at", desc=True).limit(limit)
        res = query.execute()
        items = res.data or []
        items = _decorate_messages(
            items, current_user["id"], booking_res.data.get("client_id")
        )
        if _has_unread(items, current_user["id"]):
            _mark_read("booking_id", booking_id, current_user["id"])
        next_before = items[-1]["sent_at"] if items else None
        return {
            "items": items,
            "limit": limit,
            "before": before,
            "next_before": next_before,
            "interest": _quote_context_for_booking(booking_res.data),
            # Guideline 1.2(c). Lives at the top level rather than inside
            # `interest`, which is None for a direct geo-browse booking with no
            # post — and Block has to work on those threads too.
            "counterpart_user_id": _counterpart_user_id(
                viewer_id=current_user["id"],
                client_id=booking_res.data.get("client_id"),
                business_id=booking_res.data.get("business_id"),
            ),
        }
    except Exception:
        logger.exception("Could not retrieve messages")
        raise HTTPException(status_code=400, detail="Could not retrieve messages")
