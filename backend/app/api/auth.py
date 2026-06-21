"""
auth.py — Authentication endpoints for the SwingBy backend.

Security features
-----------------
T17  Rate limiting via slowapi:
     - /signup  : 5 requests / minute per IP
     - /login   : 5 requests / minute per IP (combined with T18 lockout below)

T18  Brute-force lockout on /login:
     - Failed login attempts are tracked in an in-memory dict keyed by
       (email, remote_ip).  After 5 failures within a 15-minute window the
       endpoint returns 429 "Too many attempts; try again in N minutes."
     - A successful login clears the counter for that (email, ip) pair.
     - NOTE: This in-memory store is appropriate for an MVP single-instance
       deployment.  For production with multiple workers / replicas, migrate
       this to a shared Redis store (e.g. via slowapi's redis backend or a
       custom middleware).
"""

import re
import time
from collections import defaultdict
from typing import Dict, List, Tuple

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional

from app.supabase_client import supabase
from app.deps import get_current_user
from app.limiter import limiter  # shared limiter — see app/limiter.py
from app.config import settings
from app.services.notion_crm import sync_user_to_crm

logger = structlog.get_logger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# T18 — Brute-force lockout state
# ---------------------------------------------------------------------------
_LOCKOUT_WINDOW_SECONDS: int = 15 * 60   # 15 minutes
_MAX_FAILURES: int = 5

# Maps (email, remote_ip) -> list of epoch timestamps for each failure
_login_failures: Dict[Tuple[str, str], List[float]] = defaultdict(list)

# T24 — E.164 phone pattern
_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def _remote_ip(request: Request) -> str:
    """Best-effort extraction of the real client IP."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_lockout(email: str, ip: str) -> None:
    """
    Raises HTTP 429 if this (email, ip) pair has exceeded the failure
    threshold within the rolling window.
    """
    key = (email.lower(), ip)
    now = time.monotonic()
    # Prune stale entries outside the window
    _login_failures[key] = [
        ts for ts in _login_failures[key]
        if now - ts < _LOCKOUT_WINDOW_SECONDS
    ]
    if len(_login_failures[key]) >= _MAX_FAILURES:
        oldest = min(_login_failures[key])
        retry_in = int(_LOCKOUT_WINDOW_SECONDS - (now - oldest)) // 60 + 1
        # Generic message — do not reveal that the account exists or the
        # exact reason for the block (avoids username-enumeration signal).
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts; try again in {retry_in} minute(s).",
        )


def _record_failure(email: str, ip: str) -> None:
    key = (email.lower(), ip)
    _login_failures[key].append(time.monotonic())


def _clear_failures(email: str, ip: str) -> None:
    key = (email.lower(), ip)
    _login_failures.pop(key, None)


def _validate_phone(v: Optional[str]) -> Optional[str]:
    """Shared E.164 validator: empty string → None, invalid format → error."""
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    if not _E164_RE.match(v):
        raise ValueError("Phone must be in E.164 format, e.g. +12125551234")
    return v


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(..., max_length=500)
    hcaptcha_token: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters with uppercase, lowercase, and a digit.")
        if not any(c.islower() for c in v):
            raise ValueError("Password must be at least 8 characters with uppercase, lowercase, and a digit.")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must be at least 8 characters with uppercase, lowercase, and a digit.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must be at least 8 characters with uppercase, lowercase, and a digit.")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("client", "business_owner"):
            raise ValueError("role must be 'client' or 'business_owner'")
        return v

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = str(v).strip()
        if not v:
            raise ValueError("Name fields cannot be blank")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return _validate_phone(v)


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=2048)


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=80)
    last_name: Optional[str] = Field(None, min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=2048)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_name(cls, v):
        if v is not None:
            v = str(v).strip()
            if not v:
                raise ValueError("Name fields cannot be blank")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return _validate_phone(v)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup")
@limiter.limit("5/minute")
def signup(request: Request, data: SignupRequest):
    # T75 — hCaptcha guard (placeholder: skipped when HCAPTCHA_SECRET unset)
    if settings.HCAPTCHA_SECRET and not data.hcaptcha_token:
        raise HTTPException(status_code=429, detail="Captcha required")
    if settings.HCAPTCHA_SECRET and data.hcaptcha_token:
        try:
            captcha_resp = httpx.post(
                "https://api.hcaptcha.com/siteverify",
                data={
                    "secret": settings.HCAPTCHA_SECRET,
                    "response": data.hcaptcha_token,
                    "sitekey": settings.HCAPTCHA_SITEKEY,
                },
                timeout=5.0,
            )
            captcha_json = captcha_resp.json()
        except Exception:
            raise HTTPException(status_code=429, detail="Captcha failed")
        if not captcha_json.get("success"):
            raise HTTPException(status_code=429, detail="Captcha failed")

    try:
        # 1. Create Supabase Auth user
        res = supabase.auth.sign_up({
            "email": str(data.email),
            "password": data.password,
        })
        if not res.user:
            raise HTTPException(status_code=400, detail="Signup failed — check if email is already in use")

        user_id = res.user.id

        # 2. Upsert into our users table.
        # handle_new_user() trigger may have already inserted a bare row (id only).
        # upsert overwrites it with the full profile — no duplicate-key error.
        row = {
            "id": user_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": str(data.email),
            "role": data.role,
        }
        if data.phone:
            row["phone"] = data.phone
        supabase.table("users").upsert(row).execute()

        # Sync to Notion CRM — best-effort, never blocks signup
        try:
            sync_user_to_crm(
                user_id=user_id,
                email=str(data.email),
                first_name=data.first_name,
                last_name=data.last_name,
                role=data.role,
            )
        except Exception:
            pass

        # Welcome email — best-effort, never blocks signup
        try:
            from app.services.email import send_welcome_email
            send_welcome_email(str(data.email), data.first_name)
        except Exception:
            pass

        # If email confirmation is OFF, Supabase returns a live session immediately.
        # Return the token so the mobile app can auto-login.
        access_token = res.session.access_token if res.session else None
        return {
            "message": "Account created" if access_token else "Account created — check your email to confirm",
            "user_id": user_id,
            "access_token": access_token,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Signup failed")
        raise HTTPException(status_code=400, detail="Could not create account")


@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest):
    ip = _remote_ip(request)
    email = str(data.email)

    # T18 — Reject immediately if too many recent failures
    _check_lockout(email, ip)

    try:
        res = supabase.auth.sign_in_with_password({
            "email": email,
            "password": data.password,
        })
        if not res.session:
            # Treat missing session as a credential failure
            _record_failure(email, ip)
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Success — clear any accumulated failure count
        _clear_failures(email, ip)

        user_id = res.user.id

        # Read role + name from our users table (not Supabase metadata)
        db_res = supabase.table("users").select("role, first_name, last_name").eq("id", user_id).single().execute()
        user_data = db_res.data or {}

        return {
            "access_token": res.session.access_token,
            "user_id": user_id,
            "role": user_data.get("role"),
            "first_name": user_data.get("first_name"),
            "last_name": user_data.get("last_name"),
        }

    except HTTPException:
        raise
    except Exception:
        # Any exception from Supabase auth (wrong password, user not found, etc.)
        # is counted as a failure to prevent enumeration through timing.
        _record_failure(email, ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/refresh")
@limiter.limit("10/minute")
def refresh_token(request: Request, data: RefreshRequest):
    """
    T28 — Exchanges a refresh_token for a new access_token + refresh_token pair.
    Rate-limited to 10/minute per IP.
    """
    try:
        res = supabase.auth.refresh_session(data.refresh_token)
        if not res.session:
            raise HTTPException(status_code=401, detail="Could not refresh session")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "expires_in": res.session.expires_in,
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("auth.refresh failed")
        raise HTTPException(status_code=401, detail="Could not refresh session")


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """
    T29 — Invalidates the current session server-side.
    Always returns 200 so the client can safely clear its local tokens.
    """
    uid = current_user.get("id")
    try:
        supabase.auth.admin.sign_out(uid)
    except Exception:
        # Best-effort — logout should always appear to succeed from client's perspective
        logger.warning("auth.logout sign_out failed", user_id=uid)
    logger.info("auth.logout", user_id=uid)
    return {"message": "logged_out"}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPasswordRequest):
    """
    Triggers a Supabase password-reset email for the given address.
    Always returns 200 to avoid email enumeration.

    The redirect target is the web reset page (works for both web and mobile
    users — a mobile user opens the link in a browser, sets a new password,
    then signs back into the app). The site URL is configurable via
    PASSWORD_RESET_REDIRECT_URL; defaults to https://swingbyy.com/reset-password.
    """
    redirect_to = getattr(settings, "PASSWORD_RESET_REDIRECT_URL", None) \
        or "https://swingbyy.com/reset-password"
    try:
        supabase.auth.reset_password_email(
            data.email,
            options={"redirect_to": redirect_to},
        )
    except Exception:
        logger.warning("auth.forgot_password failed (non-fatal)", email=data.email)
    return {"message": "If that email exists, a reset link has been sent"}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns the full profile of the currently authenticated user."""
    # Omit sensitive internal fields before returning
    safe_fields = {
        "id", "first_name", "last_name", "email", "phone", "role", "avatar_url", "created_at"
    }
    return {k: v for k, v in current_user.items() if k in safe_fields}


@router.patch("/me")
def update_me(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update the current user's own profile."""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        res = (
            supabase.table("users")
            .update(update_data)
            .eq("id", current_user["id"])
            .execute()
        )
        return {"message": "Profile updated", "user": res.data[0]}
    except Exception:
        logger.exception("Profile update failed")
        raise HTTPException(status_code=400, detail="Could not update profile")
