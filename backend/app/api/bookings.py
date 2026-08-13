import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from app.deps import get_current_user
from app.supabase_client import supabase
from app.services import approvals
from app.services.push import send_push_to_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────


class AssignEmployee(BaseModel):
    # Accepts an `employees.id` OR the literal sentinel "owner" (OWNER_SENTINEL
    # below) meaning "assign the business owner themselves" — walkthrough M8.
    employee_id: str = Field(..., min_length=1, max_length=500)
    proposed_date_1: Optional[str] = Field(None, max_length=500)  # ISO-8601 strings
    proposed_date_2: Optional[str] = Field(None, max_length=500)
    proposed_date_3: Optional[str] = Field(None, max_length=500)


class ProposeDates(BaseModel):
    proposed_date_1: str = Field(..., min_length=1, max_length=500)  # ISO-8601
    proposed_date_2: Optional[str] = Field(None, max_length=500)
    proposed_date_3: Optional[str] = Field(None, max_length=500)


class ConfirmDate(BaseModel):
    confirmed_date: str = Field(
        ..., max_length=500
    )  # the accepting side picks one of the proposed dates


class CancelBooking(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000)


# ── Money truth (audit L5 / L6, 2026-07-24) ──────────────────────────────────
#
# The shipped app showed "$150 held in escrow" and "Confirmed — pending payment
# $150" on bookings where nothing had ever been captured. Both surfaces were
# reading `bookings.total_amount` — the AGREED PRICE — and captioning it with
# escrow copy. A booking row cannot tell you whether money moved; only the
# payments ledger can, and only when a Stripe capture (or a recorded
# off-platform payment) stands behind it.
#
# So every booking read now carries an explicit `payment_state` block that
# separates the two numbers that were being conflated:
#
#     amount_due    — what the client still owes. Real money that has NOT moved.
#     amount_held   — what is actually captured and sitting in escrow.
#     amount_released — what has actually gone out to the business.
#
# Invariant the clients can rely on: **amount_held is non-zero only when
# escrow.is_capture_backed() is true.** A ledger row that merely *says* 'held'
# with no PaymentIntent behind it (which is what production is full of — see
# escrow.CaptureRequiredError) reports amount_held = 0 and
# capture_backed = false, so no surface can render escrow that does not exist.
# Anything unknown fails closed to "unpaid".

_PAYMENT_LABELS = {
    "unpaid": "Payment due",
    "held": "Held in escrow",
    "released": "Released to the business",
    "paid_off_platform": "Paid directly to the business",
    "refunded": "Refunded",
}


def _payment_state(booking: dict, payment: Optional[dict]) -> dict:
    """Build the honest money block for one booking. Never raises."""
    from app.services import escrow

    total_c = (
        int(booking["total_amount_cents"])
        if booking.get("total_amount_cents") is not None
        else escrow.to_cents(booking.get("total_amount"))
    )

    payment = payment or {}
    status = payment.get("status")
    off_platform = (
        status == "paid_off_platform"
        or payment.get("method") in escrow.OFF_PLATFORM_METHODS
    )
    # escrow.is_capture_backed() answers "is escrow real *right now*", so it
    # deliberately excludes 'fully_released' (escrow is gone, it was paid out).
    # For a display state we also need "was this ever really paid" — that is
    # escrow.was_ever_captured(), which is this same branch, extracted so the
    # three readers of it (here, payments.list_my_payments, and D5's payout
    # balance) cannot drift. payments.py had already drifted: it summed
    # is_capture_backed alone and reported zero verified released money.
    # A 'fully_released' row with NO intent is still FINDING C's phantom payout
    # — 24 such rows and $4,675.50 exist in production — and still fails here.
    captured = escrow.was_ever_captured(payment)

    held_c = 0
    released_c = 0
    due_c = total_c

    if status == "refunded":
        state = "refunded"
        due_c = 0
    elif captured and off_platform:
        # Money changed hands off SwingBy: nothing is held, nothing is owed to
        # us, and there is no escrow to release.
        state = "paid_off_platform"
        due_c = 0
    elif captured and status == "fully_released":
        state = "released"
        released_c = escrow.money_cents(payment, "released_to_business")
        due_c = 0
    elif captured:
        state = "held"
        held_c = escrow.money_cents(payment, "escrow_held")
        released_c = escrow.money_cents(payment, "released_to_business")
        due_c = max(total_c - held_c - released_c, 0)
    else:
        # No payments row, no PaymentIntent, or a status claiming money that
        # never arrived. All three mean the same thing to a human: unpaid.
        state = "unpaid"

    return {
        "state": state,
        "label": _PAYMENT_LABELS[state],
        # True only when a Stripe capture or a recorded off-platform payment
        # stands behind the figures below.
        "capture_backed": captured,
        "currency": "CAD",
        "amount_due": escrow.to_dollars(due_c),
        "amount_held": escrow.to_dollars(held_c),
        "amount_released": escrow.to_dollars(released_c),
        "amount_total": escrow.to_dollars(total_c),
        "amount_due_cents": due_c,
        "amount_held_cents": held_c,
        "amount_released_cents": released_c,
        "amount_total_cents": total_c,
        # The raw ledger status, for debugging/admin. Never render this.
        "ledger_status": status,
    }


def _attach_payment_state(bookings: list[dict]) -> list[dict]:
    """Annotate each booking with `payment_state`, in one batched ledger read.

    Best-effort by design: if the payments read fails, every booking reports
    the conservative "unpaid" state rather than inheriting last release's lie
    that the money is in escrow.
    """
    rows = [b for b in bookings if b]

    # Settle any approval window that has closed, BEFORE the ledger is read —
    # otherwise the caller is told "held" about money that just became theirs.
    #
    # This is where the 24-hour auto-release actually happens. It is deliberately
    # lazy rather than scheduled: there is no scheduler in this deployment (see
    # services/approvals.py — expiry_sweep.sweep_once has existed for weeks and
    # is called by nothing but its own tests), so a timer would never fire and
    # the money would sit held forever. Settling on read means the answer is
    # correct the moment either party looks, with no infrastructure required.
    # Each call is a no-op unless a deadline has passed, and it never raises.
    for _b in rows:
        try:
            approvals.settle_if_due(_b)
        except Exception:  # pragma: no cover — settle_if_due swallows its own
            logger.warning("settle_if_due raised for %s", _b.get("id"), exc_info=True)

    ids = [b["id"] for b in rows if b.get("id")]
    by_booking: dict = {}
    if ids:
        try:
            res = (
                supabase.table("payments").select("*").in_("booking_id", ids).execute()
            )
            for p in res.data or []:
                by_booking[p.get("booking_id")] = p
        except Exception:
            logger.warning("payment_state_lookup_failed", exc_info=True)
    for b in rows:
        b["payment_state"] = _payment_state(b, by_booking.get(b.get("id")))
    return bookings


# ── Who is actually showing up (walkthrough M8) ──────────────────────────────
#
# Two bugs lived here. The owner of a one-person business had no `employees`
# row, so the assign picker rendered "No active employees found." and the job
# could never be handed to anybody — including the person who was going to do
# it. And a booking with no employee yet showed a blank assignee instead of the
# business the client actually hired.
#
# The model now: **the owner IS an assignee.** They get a real `employees` row
# (role_title 'Owner', created on first use / backfilled by migration
# 20260725220000) so every downstream join keeps working untouched —
# bookings.employee_id → employees → users, the invoice's "delivered by", and
# proof_of_work's provider check. Until somebody is assigned, the booking
# presents the BUSINESS; once assigned it presents that person, with their
# completed-job count and how long they have been on the team.
#
# Both of those figures are derived HERE, from real rows. A figure we cannot
# compute comes back as null and the clients render nothing — never a made-up
# zero (Kira has rejected fake $0.00-style placeholders before).

OWNER_SENTINEL = "owner"
OWNER_ROLE_TITLE = "Owner"

_EMPLOYEE_COLUMNS = (
    "id, business_id, user_id, role_title, avatar_url, is_active, created_at, "
    "users(first_name, last_name, avatar_url)"
)


def _rows(res) -> list[dict]:
    """PostgREST results as a list, whether the query used .single() or not."""
    data = getattr(res, "data", None)
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    return [data] if isinstance(data, dict) else []


def _ensure_owner_employee(business_id: str, owner_user_id: str) -> Optional[dict]:
    """The owner's own `employees` row, created on first use.

    Returns None only if the read AND the write both fail — callers treat that
    as "no roster" rather than raising, so a Supabase hiccup degrades the
    picker instead of 500ing the screen.
    """
    if not business_id or not owner_user_id:
        return None
    try:
        existing = _rows(
            supabase.table("employees")
            .select(_EMPLOYEE_COLUMNS)
            .eq("business_id", business_id)
            .eq("user_id", owner_user_id)
            .limit(1)
            .execute()
        )
        if existing:
            return existing[0]
    except Exception:
        logger.warning(
            "owner employee lookup failed for business %s", business_id, exc_info=True
        )
        return None

    try:
        supabase.table("employees").insert(
            {
                "business_id": business_id,
                "user_id": owner_user_id,
                "role_title": OWNER_ROLE_TITLE,
                "is_active": True,
            }
        ).execute()
    except Exception:
        # A concurrent request may have won the race against the unique index
        # added by migration 20260725220000 — fall through and re-read.
        logger.warning(
            "owner employee insert failed for business %s", business_id, exc_info=True
        )

    try:
        return (
            _rows(
                supabase.table("employees")
                .select(_EMPLOYEE_COLUMNS)
                .eq("business_id", business_id)
                .eq("user_id", owner_user_id)
                .limit(1)
                .execute()
            )
            or [None]
        )[0]
    except Exception:
        logger.warning(
            "owner employee re-read failed for business %s", business_id, exc_info=True
        )
        return None


def _completed_job_counts(employee_ids: list[str]) -> Optional[dict]:
    """{employee_id: completed bookings}. None when the count is UNKNOWABLE.

    The None/{} distinction is the whole point: an employee genuinely sitting
    at zero completed jobs is a fact worth showing ("new to the team"), while a
    failed query is not — and must never be rendered as "0 jobs".
    """
    if not employee_ids:
        return {}
    try:
        rows = _rows(
            supabase.table("bookings")
            .select("employee_id")
            .in_("employee_id", employee_ids)
            .eq("status", "completed")
            .execute()
        )
    except Exception:
        logger.warning("completed-job count lookup failed", exc_info=True)
        return None
    counts: dict = {eid: 0 for eid in employee_ids}
    for row in rows:
        eid = row.get("employee_id")
        if eid in counts:
            counts[eid] += 1
    return counts


def _tenure(joined_at) -> tuple:
    """(days, human label) since an employee joined. (None, None) when unknown."""
    if not joined_at:
        return None, None
    try:
        joined = datetime.fromisoformat(str(joined_at).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None, None
    if joined.tzinfo is None:
        joined = joined.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - joined).days
    if days < 0:
        return None, None
    if days == 0:
        return 0, "joined today"
    if days < 31:
        return days, f"{days} day{'s' if days != 1 else ''}"
    if days < 365:
        months = days // 30
        return days, f"{months} month{'s' if months != 1 else ''}"
    years = days // 365
    return days, f"{years} year{'s' if years != 1 else ''}"


def _assignee_from_employee(
    employee: dict, business: dict, jobs_completed: Optional[int]
) -> dict:
    user = employee.get("users") or {}
    name = " ".join(
        p for p in (user.get("first_name"), user.get("last_name")) if p
    ).strip()
    days, label = _tenure(employee.get("created_at"))
    owner_id = business.get("owner_id")
    return {
        "type": "employee",
        "employee_id": employee.get("id"),
        "name": name or None,
        "role_title": employee.get("role_title"),
        "avatar_url": employee.get("avatar_url") or user.get("avatar_url"),
        "is_owner": bool(owner_id) and employee.get("user_id") == owner_id,
        "is_active": employee.get("is_active", True),
        "business_name": business.get("business_name"),
        "jobs_completed": jobs_completed,
        "tenure_days": days,
        "tenure_label": label,
        "since": employee.get("created_at"),
    }


def _unassigned_assignee(business: dict) -> dict:
    """The booking belongs to the business until a person is put on it."""
    return {
        "type": "business",
        "employee_id": None,
        "name": business.get("business_name"),
        "role_title": None,
        "avatar_url": None,
        "is_owner": False,
        "is_active": True,
        "business_name": business.get("business_name"),
        "jobs_completed": None,
        "tenure_days": None,
        "tenure_label": None,
        "since": None,
    }


def _attach_assignee(bookings: list[dict]) -> list[dict]:
    """Annotate each booking with `assignee`, in three batched reads.

    Best-effort: every lookup degrades to "unknown" rather than raising, so a
    booking read never fails because the roster could not be resolved.
    """
    rows = [b for b in bookings if isinstance(b, dict)]
    if not rows:
        return bookings

    emp_ids = sorted({b["employee_id"] for b in rows if b.get("employee_id")})
    biz_ids = sorted({b["business_id"] for b in rows if b.get("business_id")})

    employees_by_id: dict = {}
    if emp_ids:
        try:
            for emp in _rows(
                supabase.table("employees")
                .select(_EMPLOYEE_COLUMNS)
                .in_("id", emp_ids)
                .execute()
            ):
                employees_by_id[emp.get("id")] = emp
        except Exception:
            logger.warning("assignee employee lookup failed", exc_info=True)

    businesses_by_id: dict = {}
    if biz_ids:
        try:
            for biz in _rows(
                supabase.table("businesses")
                .select("id, business_name, owner_id")
                .in_("id", biz_ids)
                .execute()
            ):
                businesses_by_id[biz.get("id")] = biz
        except Exception:
            logger.warning("assignee business lookup failed", exc_info=True)

    counts = _completed_job_counts(list(employees_by_id.keys()))

    for booking in rows:
        business = businesses_by_id.get(booking.get("business_id")) or {}
        employee = employees_by_id.get(booking.get("employee_id"))
        if employee:
            done = counts.get(employee.get("id")) if counts is not None else None
            booking["assignee"] = _assignee_from_employee(employee, business, done)
        else:
            booking["assignee"] = _unassigned_assignee(business)
    return bookings


# ── Helpers ───────────────────────────────────────────────────────────────────


def _assert_booking_access(booking: dict, current_user: dict):
    """Raises 403 if the current user has no relationship to this booking."""
    role = current_user["role"]
    uid = current_user["id"]

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

    raise HTTPException(status_code=403, detail="Access denied")


def _assert_handshake_party(booking: dict, current_user: dict) -> None:
    """403 unless the caller is the booking's client or the owner of its business.

    The date handshake runs between exactly these two parties — employees and
    admins are not part of it.
    """
    role = current_user["role"]
    uid = current_user["id"]

    if role == "client":
        if booking["client_id"] != uid:
            raise HTTPException(status_code=403, detail="This is not your booking")
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
        raise HTTPException(
            status_code=403, detail="This booking doesn't belong to your business"
        )

    raise HTTPException(
        status_code=403,
        detail="Only the client or the business can schedule a booking",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/")
def list_my_bookings(
    limit: int = Query(20, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: dict = Depends(get_current_user),
):
    """Returns bookings relevant to the current user (client / owner / employee)."""
    role = current_user["role"]
    uid = current_user["id"]

    try:
        if role == "client":
            res = (
                supabase.table("bookings")
                .select(
                    "*, businesses(business_name, category, avg_rating, logo_url), "
                    "employees(role_title, avatar_url, users(first_name, last_name)), "
                    "service_posts(title, address, lat, lng)"
                )
                .eq("client_id", uid)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        elif role == "business_owner":
            biz = (
                supabase.table("businesses")
                .select("id")
                .eq("owner_id", uid)
                .single()
                .execute()
            )
            if not biz.data:
                return {
                    "items": [],
                    "limit": limit,
                    "offset": offset,
                    "next_offset": None,
                }
            res = (
                supabase.table("bookings")
                .select(
                    "*, users!bookings_client_id_fkey(first_name, last_name, avatar_url), "
                    "employees(role_title, users(first_name, last_name)), "
                    "service_posts(title, address, lat, lng)"
                )
                .eq("business_id", biz.data["id"])
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        elif role == "employee":
            emp = (
                supabase.table("employees")
                .select("id")
                .eq("user_id", uid)
                .single()
                .execute()
            )
            if not emp.data:
                return {
                    "items": [],
                    "limit": limit,
                    "offset": offset,
                    "next_offset": None,
                }
            res = (
                supabase.table("bookings")
                .select(
                    "*, users!bookings_client_id_fkey(first_name, last_name), businesses(business_name, logo_url), "
                    "service_posts(title, address, lat, lng)"
                )
                .eq("employee_id", emp.data["id"])
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        else:
            return {"items": [], "limit": limit, "offset": offset, "next_offset": None}

        items = _attach_payment_state(res.data or [])
        # M8: who is showing up — the business until a person is assigned, then
        # that person with their real job count + tenure.
        _attach_assignee(items)
        next_offset = offset + limit if len(items) == limit else None
        return {
            "items": items,
            "limit": limit,
            "offset": offset,
            "next_offset": next_offset,
        }
    except Exception:
        logger.exception("Could not list bookings")
        raise HTTPException(status_code=400, detail="Could not list bookings")


@router.get("/{booking_id}")
def get_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("bookings")
            .select(
                "*, users!bookings_client_id_fkey(first_name, last_name, avatar_url), "
                "businesses(business_name, category, avg_rating, review_count, logo_url, "
                "owner:users!businesses_owner_id_fkey(phone)), "
                "employees(role_title, avatar_url, users(first_name, last_name, phone)), "
                "service_posts(title, address, lat, lng)"
            )
            .eq("id", booking_id)
            .single()
            .execute()
        )
        _assert_booking_access(res.data, current_user)
        # Money truth (L5/L6): the booking row alone cannot say whether anything
        # was paid — attach the ledger-derived state so no screen has to guess.
        _attach_payment_state([res.data])
        _attach_assignee([res.data])
        return res.data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Booking not found")


@router.patch("/{booking_id}/assign-employee")
def assign_employee(
    booking_id: str,
    data: AssignEmployee,
    current_user: dict = Depends(get_current_user),
):
    """Business owner assigns one of their employees and proposes up to 3 dates."""
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can assign employees"
        )

    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    biz = (
        supabase.table("businesses")
        .select("id, business_name, owner_id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    if not biz.data or biz.data["id"] != booking["business_id"]:
        raise HTTPException(
            status_code=403, detail="This booking doesn't belong to your business"
        )

    # Status guard. This used to be an ALLOW-list of ('confirmed',
    # 'in_progress'), which made the owner unable to say who was going until
    # after the date handshake had closed — walkthrough M8: "Owner can assign
    # BEFORE the job is approved." Deciding the crew is the first thing a real
    # owner does, often before anyone has agreed a time. So the guard is now a
    # DENY-list: only terminal bookings are off-limits, because re-attributing
    # work after the money has settled is what the original guard was for.
    if booking.get("status") in ("completed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign an employee to a '{booking.get('status')}' booking",
        )

    # "owner" = assign the business owner themselves. A solo operator has no
    # staff to pick from; they ARE the staff. This materialises their employees
    # row so the booking carries a real employee_id like any other assignment.
    if data.employee_id.strip().lower() == OWNER_SENTINEL:
        owner_row = _ensure_owner_employee(biz.data["id"], current_user["id"])
        if not owner_row or not owner_row.get("id"):
            raise HTTPException(
                status_code=400, detail="Could not assign this job to you"
            )
        employee_id = owner_row["id"]
    else:
        # Validate employee is active and belongs to this business
        emp = (
            supabase.table("employees")
            .select("id, is_active")
            .eq("id", data.employee_id)
            .eq("business_id", biz.data["id"])
            .single()
            .execute()
        )
        if not emp.data:
            raise HTTPException(
                status_code=404, detail="Employee not found in your business"
            )
        if not emp.data["is_active"]:
            raise HTTPException(status_code=400, detail="Employee is deactivated")
        employee_id = data.employee_id

    update_payload = {"employee_id": employee_id}
    if data.proposed_date_1:
        update_payload["proposed_date_1"] = data.proposed_date_1
    if data.proposed_date_2:
        update_payload["proposed_date_2"] = data.proposed_date_2
    if data.proposed_date_3:
        update_payload["proposed_date_3"] = data.proposed_date_3
    if any((data.proposed_date_1, data.proposed_date_2, data.proposed_date_3)):
        # Track the proposer so /confirm-date can enforce the handshake rule
        # (the other side accepts, never the proposer).
        update_payload["date_proposed_by"] = current_user["id"]

    try:
        res = (
            supabase.table("bookings")
            .update(update_payload)
            .eq("id", booking_id)
            .execute()
        )
        updated = res.data[0]
        # Hand the caller the resolved assignee so the screen can render the
        # name / job count / tenure straight away instead of refetching.
        _attach_assignee([updated])
        return {"message": "Employee assigned", "booking": updated}
    except Exception:
        logger.exception("Could not assign employee to booking")
        raise HTTPException(status_code=400, detail="Could not assign employee")


@router.get("/{booking_id}/assignees")
def list_assignees(booking_id: str, current_user: dict = Depends(get_current_user)):
    """Everyone this job can be handed to. The OWNER IS ALWAYS IN THE LIST.

    Walkthrough M8: the assign picker used to read `GET /employees/` and
    dead-end on "No active employees found." for the (very common) business
    with no staff. This roster cannot be empty — the owner is materialised as
    a real employee row and returned first, flagged `is_owner`.
    """
    if current_user["role"] != "business_owner":
        raise HTTPException(
            status_code=403, detail="Only business owners can assign employees"
        )

    booking_res = (
        supabase.table("bookings")
        .select("id, business_id, employee_id, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    biz_res = (
        supabase.table("businesses")
        .select("id, business_name, owner_id")
        .eq("owner_id", current_user["id"])
        .single()
        .execute()
    )
    business = biz_res.data or {}
    if not business or business.get("id") != booking["business_id"]:
        raise HTTPException(
            status_code=403, detail="This booking doesn't belong to your business"
        )

    owner_row = _ensure_owner_employee(business["id"], current_user["id"])

    staff: list[dict] = []
    try:
        staff = [
            e
            for e in _rows(
                supabase.table("employees")
                .select(_EMPLOYEE_COLUMNS)
                .eq("business_id", business["id"])
                .order("created_at")
                .execute()
            )
            if e.get("is_active", True)
        ]
    except Exception:
        logger.warning(
            "roster lookup failed for business %s", business["id"], exc_info=True
        )

    ordered: list[dict] = []
    seen: set = set()
    for row in ([owner_row] if owner_row else []) + staff:
        eid = row.get("id")
        if not eid or eid in seen:
            continue
        seen.add(eid)
        ordered.append(row)

    counts = _completed_job_counts([r["id"] for r in ordered])
    items = []
    for row in ordered:
        entry = _assignee_from_employee(
            row, business, counts.get(row["id"]) if counts is not None else None
        )
        # The owner's own name may be missing from `users` on a half-finished
        # profile; fall back to the business rather than to a blank row.
        if entry["is_owner"] and not entry["name"]:
            entry["name"] = business.get("business_name")
        entry["is_you"] = row.get("user_id") == current_user["id"]
        entry["is_assigned"] = row["id"] == booking.get("employee_id")
        items.append(entry)

    return {
        "items": items,
        "assigned_employee_id": booking.get("employee_id"),
        "can_assign": booking.get("status") not in ("completed", "cancelled"),
    }


@router.patch("/{booking_id}/propose-dates")
def propose_dates(
    booking_id: str,
    data: ProposeDates,
    current_user: dict = Depends(get_current_user),
):
    """Either side of the booking proposes up to 3 times (the chat handshake).

    Kira's design: after a quote is accepted, the CLIENT sends the handshake
    from their side of the chat and the BUSINESS approves it — but either
    party may propose; whoever did NOT propose accepts one of the times via
    PATCH /confirm-date. Re-proposing overwrites the previous slate (a
    counter-offer).
    """
    booking_res = (
        supabase.table("bookings")
        .select("client_id, business_id, status")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    _assert_handshake_party(booking, current_user)

    if booking["status"] != "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Times can only be proposed while the booking awaits a confirmed date",
        )

    try:
        res = (
            supabase.table("bookings")
            .update(
                {
                    "proposed_date_1": data.proposed_date_1,
                    "proposed_date_2": data.proposed_date_2,
                    "proposed_date_3": data.proposed_date_3,
                    "date_proposed_by": current_user["id"],
                }
            )
            .eq("id", booking_id)
            .execute()
        )
        updated_booking = res.data[0]

        # Record the proposal on the live timeline — best-effort, mirrors the
        # date_confirmed insert below.
        try:
            dates = [
                d
                for d in (
                    data.proposed_date_1,
                    data.proposed_date_2,
                    data.proposed_date_3,
                )
                if d
            ]
            supabase.table("booking_events").insert(
                {
                    "booking_id": booking_id,
                    "actor_id": current_user["id"],
                    "event_type": "dates_proposed",
                    "note": "Proposed times: " + ", ".join(dates),
                }
            ).execute()
        except Exception:
            logger.warning(
                "Could not record dates_proposed booking_event for %s",
                booking_id,
                exc_info=True,
            )

        # Nudge the other side — best-effort
        try:
            if current_user["role"] == "client":
                biz_owner_res = (
                    supabase.table("businesses")
                    .select("owner_id")
                    .eq("id", booking["business_id"])
                    .single()
                    .execute()
                )
                other_uid = (
                    biz_owner_res.data["owner_id"] if biz_owner_res.data else None
                )
            else:
                other_uid = booking["client_id"]
            if other_uid:
                send_push_to_user(
                    other_uid,
                    "New times proposed",
                    "Pick a time to confirm your booking",
                )
        except Exception:
            pass  # notification failure must not break the request

        return {
            "message": "Times proposed — waiting for the other side to accept",
            "booking": updated_booking,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not propose dates for booking %s", booking_id)
        raise HTTPException(status_code=400, detail="Could not propose dates")


@router.patch("/{booking_id}/confirm-date")
def confirm_date(
    booking_id: str,
    data: ConfirmDate,
    current_user: dict = Depends(get_current_user),
):
    """The side that did NOT propose accepts a time — moves booking to in_progress."""
    booking_res = (
        supabase.table("bookings")
        .select("client_id, business_id, status, date_proposed_by")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    _assert_handshake_party(booking, current_user)

    if booking["status"] != "confirmed":
        raise HTTPException(
            status_code=400, detail="Booking is not in 'confirmed' state"
        )

    # Handshake rule: the proposer can never accept their own times.
    proposer = booking.get("date_proposed_by")
    if proposer and proposer == current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="You proposed these times — waiting for the other side to accept",
        )
    if not proposer and current_user["role"] != "client":
        # Legacy bookings (proposer untracked): the dates came from the
        # business via assign-employee, so only the client may accept.
        raise HTTPException(
            status_code=403, detail="Waiting for the client to accept a proposed time"
        )

    try:
        res = (
            supabase.table("bookings")
            .update(
                {
                    "confirmed_date": data.confirmed_date,
                    "status": "in_progress",
                }
            )
            .eq("id", booking_id)
            .execute()
        )
        updated_booking = res.data[0]

        # Record the handshake on the live timeline — best-effort, must not
        # break the request if it fails (mirrors the notification try/except
        # below).
        try:
            supabase.table("booking_events").insert(
                {
                    "booking_id": booking_id,
                    "actor_id": current_user["id"],
                    "event_type": "date_confirmed",
                    "note": f"Confirmed date: {data.confirmed_date}",
                }
            ).execute()
        except Exception:
            logger.warning(
                "Could not record date_confirmed booking_event for %s",
                booking_id,
                exc_info=True,
            )

        # Notify both client and business owner — best-effort
        try:
            full_booking = (
                supabase.table("bookings")
                .select("client_id, business_id")
                .eq("id", booking_id)
                .single()
                .execute()
            )
            if full_booking.data:
                client_uid = full_booking.data["client_id"]
                biz_id = full_booking.data["business_id"]

                # Notify client
                if client_uid:
                    send_push_to_user(
                        client_uid,
                        "Booking confirmed",
                        "Your booking date is confirmed",
                    )

                # Look up business owner + email date-confirmed notification
                biz_owner_res = (
                    supabase.table("businesses")
                    .select("owner_id, business_name")
                    .eq("id", biz_id)
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
                if biz_owner_id:
                    send_push_to_user(
                        biz_owner_id,
                        "Booking confirmed",
                        "A booking date has been confirmed",
                    )
                    try:
                        from app.services.email import send_date_confirmed_business

                        biz_owner_user_res = (
                            supabase.table("users")
                            .select("email")
                            .eq("id", biz_owner_id)
                            .single()
                            .execute()
                        )
                        if biz_owner_user_res.data:
                            send_date_confirmed_business(
                                biz_owner_user_res.data["email"],
                                biz_name,
                                booking_id,
                                data.confirmed_date,
                            )
                    except Exception:
                        pass
        except Exception:
            pass  # notification failure must not break the request

        return {
            "message": "Date confirmed — booking is now in progress",
            "booking": updated_booking,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not confirm booking date")
        raise HTTPException(status_code=400, detail="Could not confirm booking date")


@router.patch("/{booking_id}/complete")
def complete_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    """
    Business owner or assigned employee marks job complete.

    Payment logic:
      - Booking: status → completed, payment_status → fully_released
      - Payment: release the whole held escrow minus the 10 % platform cut.
        e.g. $100 total: nothing released before this point, now release $90,
        SwingBy keeps $10. There is no staged/partial release — see
        tests/test_no_staged_release_claim.py.
    """
    if current_user["role"] not in ("business_owner", "employee"):
        raise HTTPException(
            status_code=403,
            detail="Only business owners or employees can complete bookings",
        )

    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["status"] == "completed":
        raise HTTPException(status_code=400, detail="Booking is already completed")

    # Authorisation
    owner_business_id = None
    if current_user["role"] == "business_owner":
        biz = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .single()
            .execute()
        )
        if not biz.data or biz.data["id"] != booking["business_id"]:
            raise HTTPException(
                status_code=403, detail="This booking doesn't belong to your business"
            )
        owner_business_id = biz.data["id"]
    else:  # employee
        emp = (
            supabase.table("employees")
            .select("id")
            .eq("user_id", current_user["id"])
            .single()
            .execute()
        )
        if not emp.data or emp.data["id"] != booking.get("employee_id"):
            raise HTTPException(
                status_code=403, detail="You are not assigned to this booking"
            )

    try:
        # NO MONEY MOVES HERE — 2026-07-31.
        #
        # This endpoint used to call escrow.release_escrow_on_complete() itself.
        # It is gated to business_owner/employee (a client gets 403 above), so
        # the business marked its own job done and paid itself, with the client
        # nowhere in the path — while the pay sheet promised them "held in
        # escrow, released only when you approve the work". Caught on the first
        # iOS walkthrough: Cleared jumped $75 -> $237 with escrow held flat.
        #
        # Now this only says the WORK is done. `status` becomes 'completed'
        # because that is true; `payment_status` stays 'held' and a 24h approval
        # window opens. The client releases it by approving, or it releases
        # itself when the window closes. See services/approvals.py.
        #
        # The capture guard still runs first, and still refuses: telling a
        # business "waiting for the client to approve" about money that was
        # never collected would be a second lie in place of the first.
        from app.services import approvals, escrow

        try:
            approvals.assert_releasable(booking_id)
        except escrow.CaptureRequiredError:
            # FINDING C (money audit, 2026-07-23). Completing a job used to pay
            # the business whether or not anyone had ever paid — proven live by
            # releasing $180 against a booking with no Stripe charge.
            #
            # WARNING, not exception, since 2026-08-13. This branch is the guard
            # WORKING: an unpaid booking is a legitimate state (the client never
            # completed checkout), the caller gets a clean 409, and nothing is
            # broken. logger.exception shipped it to Sentry as an Error with a
            # traceback, so correct behaviour paged someone — SWINGBY-API-S. A
            # guard that alerts every time it succeeds is how people learn to
            # ignore the alert, which is the opposite of what FINDING C bought.
            #
            # The EscrowError branch below stays at exception on purpose: "no
            # payments row at all" is not a legitimate state, it means a booking
            # exists whose money never got recorded.
            logger.warning(
                "complete_booking: BLOCKED — booking %s has no captured payment",
                booking_id,
            )
            raise HTTPException(
                status_code=409,
                detail="Cannot complete: this booking has not been paid. "
                "No Stripe charge was captured and no off-platform payment was "
                "recorded, so there is no money to release to the business.",
            )
        except escrow.EscrowError:
            logger.exception(
                "complete_booking: no releasable payment for booking %s", booking_id
            )
            raise HTTPException(
                status_code=409,
                detail="Cannot complete: no payment record to release. "
                "Contact support — this booking's payment is missing.",
            )

        # Who actually did this job? (W3, 2026-08-09 walkthrough; ported here
        # 2026-08-12 after the money moved out of this endpoint.)
        #
        # This endpoint validated role, existence, not-already-completed and
        # ownership — and never looked at `employee_id`. Proven against
        # production on 2026-08-12: 248 bookings reached `fully_released` with
        # `employee_id IS NULL`, 19 of them backed by a real Stripe
        # PaymentIntent. Unassigned is the DEFAULT state (254 of 263 rows), not
        # an edge case.
        #
        # WHY HERE, and not in approvals.release() where the money actually
        # moves: release() is reached from settle_if_due(), which is best-effort
        # and swallows every exception. Raising there would convert a leak into a
        # permanent trap — escrow stuck, retried on every read, no human present
        # to see the error. start_approval_window() has exactly one caller (this
        # line) and nothing else writes payment_status='awaiting_approval', so
        # this is a genuine chokepoint.
        #
        # WHY AFTER assert_releasable and not before the auth block: an unpaid
        # booking must still answer 409 "not paid" rather than 400 "assign
        # someone" — the payment fact is the more specific one, and e2e_smoke
        # pins it. Placing the guard here also means the auto-assign below never
        # mutates a booking that was going to be refused anyway.
        #
        # Only owners reach this with a null employee_id: the employee branch
        # above already requires emp.id == booking.employee_id.
        #
        # A blanket refusal would be a worse bug. A solo operator never sees an
        # assign screen — that is why /assign-employee and /assignees both
        # materialise the owner as a real assignee via _ensure_owner_employee —
        # so hard-refusing would dead-end them on a job they actually finished,
        # with the money stuck behind the very guard meant to protect it.
        if owner_business_id and not booking.get("employee_id"):
            try:
                other_staff = [
                    e
                    for e in _rows(
                        supabase.table("employees")
                        .select("id, user_id, is_active")
                        .eq("business_id", owner_business_id)
                        .execute()
                    )
                    if e.get("is_active", True)
                    and e.get("user_id") != current_user["id"]
                ]
            except Exception:
                # Money path — fail closed rather than guessing "solo" when we
                # cannot see the roster.
                logger.exception(
                    "roster lookup failed for business %s while completing booking %s",
                    owner_business_id,
                    booking_id,
                )
                raise HTTPException(
                    status_code=400,
                    detail="Could not verify who's assigned to this job. Try again.",
                )

            if other_staff:
                raise HTTPException(
                    status_code=400,
                    detail="Assign someone to this job before marking it complete.",
                )

            owner_row = _ensure_owner_employee(owner_business_id, current_user["id"])
            if not owner_row or not owner_row.get("id"):
                raise HTTPException(
                    status_code=400,
                    detail="Could not assign this job to you before completing it.",
                )
            try:
                supabase.table("bookings").update({"employee_id": owner_row["id"]}).eq(
                    "id", booking_id
                ).execute()
            except Exception:
                logger.exception(
                    "could not persist owner auto-assignment for booking %s", booking_id
                )
                raise HTTPException(
                    status_code=400,
                    detail="Could not assign this job to you before completing it.",
                )
            booking["employee_id"] = owner_row["id"]

        # Closes the live-status timeline too: start_approval_window writes the
        # `completed` booking_event itself, so this endpoint no longer appends a
        # second one. (It used to write it here; two inserts would now collapse
        # onto one row via the same-stage guard, but relying on that to hide a
        # duplicate is not a reason to keep writing it.)
        deadline = approvals.start_approval_window(booking_id, current_user["id"])

        # Email the client a completion notice + review nudge — best-effort
        try:
            from app.services.email import send_booking_completed_client

            client_user_res = (
                supabase.table("users")
                .select("email, first_name")
                .eq("id", booking["client_id"])
                .single()
                .execute()
            )
            biz_name_res = (
                supabase.table("businesses")
                .select("business_name")
                .eq("id", booking["business_id"])
                .single()
                .execute()
            )
            biz_name = (
                biz_name_res.data["business_name"]
                if biz_name_res.data
                else "the business"
            )
            if client_user_res.data:
                send_booking_completed_client(
                    client_user_res.data["email"],
                    client_user_res.data["first_name"],
                    booking_id,
                    biz_name,
                )
        except Exception:
            pass

        # Funnel event (K7 — no-analytics) — best-effort, never blocks completion
        from app.services.analytics import track_event

        track_event(
            "Booking Completed",
            url_path="/booking/completed",
            props={"category": booking.get("service_category")},
        )

        # The message is now the truth rather than the old "full payment
        # released": nothing was released here. `approval_deadline_at` is what
        # the business's screen should render a countdown from.
        if deadline:
            return {
                "message": "Work marked done. Waiting for the client to approve — "
                "payment releases automatically after 24 hours.",
                "approval_deadline_at": deadline,
                "payment_status": "held",
            }
        return {
            "message": "Booking completed.",
            "approval_deadline_at": None,
            "payment_status": "settled",
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not complete booking")
        raise HTTPException(status_code=400, detail="Could not complete booking")


@router.post("/{booking_id}/approve")
def approve_completed_work(
    booking_id: str, current_user: dict = Depends(get_current_user)
):
    """The CLIENT approves finished work, which is what releases the money.

    Distinct from `POST /bookings/{id}/proof/approve`, which approves a
    *proof-of-work submission* (before/after photos + voice note) and requires
    one to exist. Most jobs never get photos, and those clients still need a way
    to say "yes, this is done" — without this endpoint the only route to release
    was the 24-hour timeout, which is a fallback, not a flow.

    Client only. The business marking work done opens the window; only the
    person who paid can close it early.
    """
    booking_res = (
        supabase.table("bookings")
        .select("id, client_id, status, payment_status, approval_deadline_at")
        .eq("id", booking_id)
        .single()
        .execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    if booking["client_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="Only the client on this booking can approve it"
        )

    if booking.get("payment_status") == "fully_released":
        # Idempotent: approving twice is a double-tap, not an error.
        return {
            "message": "Already approved — payment released.",
            "outcome": "already_released",
        }

    if booking.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail="This job isn't marked done yet, so there's nothing to approve.",
        )

    from app.services import approvals, escrow

    try:
        outcome = approvals.release(
            booking_id, actor_id=current_user["id"], reason="client_approved"
        )
    except escrow.CaptureRequiredError:
        raise HTTPException(
            status_code=409,
            detail="This booking has no captured payment, so there is nothing to release.",
        )
    except escrow.EscrowError as exc:
        logger.exception("client approval could not release booking %s", booking_id)
        raise HTTPException(status_code=409, detail=str(exc))

    return {
        "message": "Approved — payment released to the business.",
        "outcome": outcome.get("outcome"),
    }


def _has_submitted_proof(booking_id: str) -> bool:
    """Did the provider submit before/after photos + voice note for this job?

    The question a cancellation refund turns on: with proof there is something for
    an admin to review, without it there is not. Read-only and defensive — if this
    lookup fails we answer False, which routes the cancellation down the
    settle-immediately path. Getting this wrong in the safe direction pays a
    client back money they might have owed; getting it wrong the other way holds
    their money hostage to a review with no evidence in it.
    """
    try:
        res = (
            supabase.table("booking_proofs")
            .select("submitted_at")
            .eq("booking_id", booking_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return bool(rows and rows[0].get("submitted_at"))
    except Exception:
        logger.exception(
            "could not read proof state for booking %s — treating as no proof",
            booking_id,
        )
        return False


@router.patch("/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    data: CancelBooking,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancel a booking. Penalty ladder (published ToS, measured against
    confirmed_date; see escrow.compute_cancellation_split):

      CLIENT cancels
        >48h    → client refunded 100%, business 0%
        <=48h   → client refunded  75%, business 25%
        no-show → client refunded  50%, business 50%

      BUSINESS cancels
        >48h    → client refunded 100%, business penalty 0
        <=48h   → client refunded 100% + goodwill CREDIT, business penalty 25%
        no-show → client refunded 100% + goodwill CREDIT, business penalty 50%

      No confirmed date yet → 0 penalty either way, no credit.
    """
    booking_res = (
        supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    )
    if not booking_res.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking = booking_res.data

    # fix G: cancellation carries a financial penalty and moves the ledger —
    # only the two handshake parties (client, business owner) may cancel. An
    # assigned employee must not trigger refunds/penalties.
    _assert_handshake_party(booking, current_user)

    if booking["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel a booking with status '{booking['status']}'",
        )

    from app.services import escrow

    # Actor is derived from the authenticated user's role (the two handshake
    # parties only — enforced above). "who cancelled" is also persisted on
    # cancellations.cancelled_by below.
    actor = "business" if current_user["role"] == "business_owner" else "client"
    total = booking.get("total_amount", 0)
    timing = escrow.classify_cancellation_timing(booking.get("confirmed_date"))

    split = escrow.compute_cancellation_split(total, actor, timing)
    # Figure recorded on the cancellations row (business_keeps for a client
    # cancel, the business penalty for a business cancel).
    penalty_amount = split["penalty_amount"]

    # Has anyone actually been to the property? Kira's ruling (2026-07-30): a
    # cancelled job's refund is a REQUEST that SwingBy approves or declines after
    # reviewing the before/after photos and the voice memo — money no longer
    # leaves the instant someone taps Cancel.
    #
    # But that review only has an object when there IS proof. Cancel the day
    # before and nobody has visited: no photos, no voice note, nothing to judge.
    # Holding that money pending a decision nobody can make would be strictly
    # worse than paying it straight back, so the ladder still settles those
    # instantly. The request path engages only where work was genuinely begun and
    # the money is genuinely contestable.
    proof_submitted = _has_submitted_proof(booking_id)

    try:
        # Update booking. `payment_status` must NOT claim 'refunded' on the
        # request path — nothing has been refunded yet and the money is still
        # held pending review. 'held' is the honest value and is what
        # escrow.HELD_NOT_RELEASED already recognises.
        supabase.table("bookings").update(
            {
                "status": "cancelled",
                "payment_status": "held" if proof_submitted else "refunded",
            }
        ).eq("id", booking_id).execute()

        # Log cancellation
        supabase.table("cancellations").insert(
            {
                "booking_id": booking_id,
                "cancelled_by": current_user["id"],
                "reason": data.reason,
                "penalty_amount": penalty_amount,
            }
        ).execute()

        # Move the payment ledger to match reality: the business keeps
        # `business_keeps` (the penalty), the client is refunded the rest.
        # fix D: previously the code only stamped status='refunded' and left
        # released_to_business/escrow_held untouched — a cancelled booking still
        # read as 50% released to the business.
        payment = escrow.load_single_payment(booking_id)
        if payment and proof_submitted:
            # THE REQUEST PATH. The business's share is settled by the ladder
            # exactly as before, but the client's share stays in `escrow_held` —
            # that column means "collected, destination not yet decided", which is
            # precisely the state a pending refund request is in. Nothing is sent
            # to Stripe here. Approving the request refunds this figure; declining
            # it moves the same figure across to the business.
            hold_ledger = escrow.ledger_write(
                released_to_business=split["business_keeps_cents"],
                escrow_held=split["client_refund_cents"],
                platform_cut=0,
            )
            hold_ledger["status"] = "held"
            supabase.table("payments").update(hold_ledger).eq(
                "id", payment["id"]
            ).execute()

        elif payment:
            # Integer cents (migration 20260723120000): the split is computed in
            # cents, so write cents and let escrow.ledger_write emit the legacy
            # dollar mirror from the same integer.
            # F011 (money audit, 2026-08-10): `refunded` must be written here too
            # — the ledger invariant is escrow_held + released_to_business +
            # refunded == total_charged, and this branch is claiming
            # status='refunded' a few lines below. Leaving refunded_cents at its
            # pre-cancel value (typically 0) broke that invariant for every
            # cancellation with a nonzero client_refund, even though the refund
            # itself (Stripe or ledger-only) genuinely happened.
            cancel_ledger = escrow.ledger_write(
                released_to_business=split["business_keeps_cents"],
                escrow_held=0,
                # No platform cut is taken on a cancellation — the retained
                # penalty goes entirely to the business as compensation.
                platform_cut=0,
                refunded=escrow.money_cents(payment, "refunded")
                + split["client_refund_cents"],
            )
            cancel_ledger["status"] = "refunded"
            cancel_ledger["released_at"] = datetime.now(timezone.utc).isoformat()
            supabase.table("payments").update(cancel_ledger).eq(
                "id", payment["id"]
            ).execute()

            # Real money movement: only call Stripe when a real charge was
            # captured (stripe_payment_intent_id present). In beta almost no
            # booking has one, so this is ledger-only — we deliberately do NOT
            # call Stripe for the common case.
            intent_id = payment.get("stripe_payment_intent_id")
            refund_amount = split["client_refund"]
            if intent_id and refund_amount > 0:
                try:
                    from app.services import stripe_service

                    stripe_service.refund_payment_intent(
                        payment_intent_id=intent_id, amount_cad=refund_amount
                    )
                except Exception:
                    # Ledger already reflects the refund; a failed Stripe call
                    # must be reconciled out-of-band, but must not 500 the cancel.
                    logger.exception(
                        "Stripe refund failed for booking %s (intent %s) — "
                        "LEDGER SAYS REFUNDED, STRIPE DID NOT. Needs reconciliation.",
                        booking_id,
                        intent_id,
                    )
            elif refund_amount > 0:
                logger.info(
                    "cancel booking %s: ledger-only refund of %.2f "
                    "(no Stripe charge captured)",
                    booking_id,
                    refund_amount,
                )

        # Open the refund request. Deliberately AFTER the ledger is settled: the
        # money being correctly held is what makes the request meaningful, and a
        # request row pointing at un-held money would be worse than none.
        #
        # System-opened, always against the business and on the client's behalf
        # regardless of who cancelled, because it is the client's money whose
        # destination is in question. `POST /disputes/` rejects this issue_type,
        # so it cannot be manufactured from a phone.
        if proof_submitted:
            try:
                supabase.table("disputes").insert(
                    {
                        "booking_id": booking_id,
                        "opened_by": current_user["id"],
                        "against_party": "business",
                        "issue_type": "cancellation_refund",
                        "description": (
                            f"Cancelled by the {actor} ({timing}). "
                            f"Proof of work was submitted, so ${split['client_refund']:.2f} "
                            f"is held pending review; the business retains "
                            f"${split['business_keeps']:.2f} under the cancellation "
                            f"ladder. Reason given: {data.reason}"
                        )[:2000],
                        "status": "open",
                        "refund_amount": split["client_refund"],
                    }
                ).execute()
            except Exception:
                # Loud, because the money is now held with nothing tracking it.
                # Better to surface a stuck hold than to silently refund past a
                # review Kira asked for.
                logger.exception(
                    "cancel booking %s: escrow HELD but the refund request could "
                    "not be opened — $%.2f has no request against it",
                    booking_id,
                    split["client_refund"],
                )

        # Goodwill credit accrual: the ladder grants the client a credit when
        # the BUSINESS cancels late / no-shows. grant_credit is best-effort
        # (logs loudly on failure) so a goodwill gesture can never 500 the
        # cancel or roll back the refund already applied above.
        if split["credit_cents"] > 0:
            from app.services import credits

            credits.grant_credit(
                user_id=booking["client_id"],
                amount_cents=split["credit_cents"],
                reason=f"business_cancel_{timing}",
                booking_id=booking_id,
            )

        # Email the OTHER party (whoever didn't cancel) — best-effort
        try:
            from app.services.email import send_booking_cancelled

            canceller_id = current_user["id"]
            client_id = booking["client_id"]
            biz_id = booking["business_id"]

            # Find the business owner's user_id
            biz_owner_res = (
                supabase.table("businesses")
                .select("owner_id")
                .eq("id", biz_id)
                .single()
                .execute()
            )
            biz_owner_id = (
                biz_owner_res.data["owner_id"] if biz_owner_res.data else None
            )

            # Determine which user to email (the one who did NOT cancel)
            other_user_id = None
            if canceller_id == client_id and biz_owner_id:
                other_user_id = biz_owner_id
            elif canceller_id != client_id:
                other_user_id = client_id

            if other_user_id:
                other_user_res = (
                    supabase.table("users")
                    .select("email, first_name")
                    .eq("id", other_user_id)
                    .single()
                    .execute()
                )
                if other_user_res.data:
                    # `penalty_amount` carries TWO different meanings depending
                    # on who cancelled (escrow.py::compute_cancellation_split):
                    #
                    #   client cancelled   -> business_keeps, money genuinely
                    #                         withheld from the client's refund
                    #   business cancelled -> business_penalty, which is
                    #                         AUDIT-ONLY. business_keeps stays 0
                    #                         and the client is refunded 100%.
                    #                         Nothing charges it. Ever.
                    #
                    # The template renders "Penalty applied: $X" for anything
                    # > 0, so a provider cancelling sent the client a full
                    # refund AND an email saying "Penalty applied: $25.00".
                    # Nobody was charged $25; it reads as either "you were
                    # charged" or "the provider was fined", and both are false.
                    #
                    # One variable, two meanings, one label — so only the
                    # meaning that represents real money reaches the email.
                    charged_penalty = penalty_amount if actor == "client" else 0.0
                    send_booking_cancelled(
                        other_user_res.data["email"],
                        other_user_res.data["first_name"],
                        booking_id,
                        charged_penalty,
                    )
        except Exception:
            pass

        return {
            "message": "Booking cancelled",
            "penalty_amount": penalty_amount,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Could not cancel booking")
        raise HTTPException(status_code=400, detail="Could not cancel booking")
