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

import base64
import hashlib
import os
import re
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, HTTPException, Depends, Request
from supabase import AuthApiError
from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional

from app.supabase_client import supabase, supabase_auth
from app.deps import get_current_user
from app.limiter import limiter  # shared limiter — see app/limiter.py
from app.config import settings
from app.services import session_security, url_safety

logger = structlog.get_logger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# T18 — Brute-force lockout state
# ---------------------------------------------------------------------------
_LOCKOUT_WINDOW_SECONDS: int = 15 * 60  # 15 minutes
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
        ts for ts in _login_failures[key] if now - ts < _LOCKOUT_WINDOW_SECONDS
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


def _normalize_referral_code(v: Optional[str]) -> Optional[str]:
    """Blank -> None; otherwise uppercase + strip. Never raises — an
    unparseable/garbage code degrades to a no-op claim later, it must
    not block signup. Shared by every entry point that can create an
    account (email signup, social exchange, social id-token) so the
    normalization can't drift between them."""
    if v is None:
        return None
    v = str(v).strip().upper()
    return v or None


def _claim_referral_code(code: str, user_id: str) -> None:
    """Best-effort referral claim — never blocks the signup/social flow that
    calls it. Shared tail for /auth/signup and the two social entry points
    (F128): a beta-invite code was only ever attributed on the email/password
    path because the social flows had nowhere to send it. GAP-AUDIT-2026-07-18
    #4: an invalid/unknown code (or a self-refer edge case) silently degrades
    to a no-op; nothing sensitive is logged either way."""
    try:
        ref_res = (
            supabase.table("referrals")
            .select("referrer_id")
            .eq("code", code)
            .is_("referee_id", "null")
            .limit(1)
            .execute()
        )
        ref_rows = ref_res.data or []
        if ref_rows and ref_rows[0]["referrer_id"] != user_id:
            supabase.table("referrals").insert(
                {
                    "code": code,
                    "referrer_id": ref_rows[0]["referrer_id"],
                    "referee_id": user_id,
                    "status": "joined",
                    "credit_cents": 0,
                }
            ).execute()
    except Exception:
        pass


# ── Schemas ───────────────────────────────────────────────────────────────────


class SignupRequest(BaseModel):
    email: EmailStr = Field(..., max_length=320)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = Field(None, max_length=20)
    role: str = Field(..., max_length=500)
    hcaptcha_token: Optional[str] = None
    referral_code: Optional[str] = Field(None, max_length=32)
    # Recorded, not enforced — see _record_terms_acceptance for why.
    accepted_terms: bool = False

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError(
                "Password must be at least 8 characters with uppercase, lowercase, and a digit."
            )
        if not any(c.islower() for c in v):
            raise ValueError(
                "Password must be at least 8 characters with uppercase, lowercase, and a digit."
            )
        if not any(c.isupper() for c in v):
            raise ValueError(
                "Password must be at least 8 characters with uppercase, lowercase, and a digit."
            )
        if not any(c.isdigit() for c in v):
            raise ValueError(
                "Password must be at least 8 characters with uppercase, lowercase, and a digit."
            )
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

    @field_validator("referral_code", mode="before")
    @classmethod
    def normalize_referral_code(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_referral_code(v)


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

    @field_validator("avatar_url", mode="before")
    @classmethod
    def validate_avatar_url(cls, v):
        """D7.8 (pentest M-04) — refuse URLs that point inside the network.

        This field used to store anything: the cloud metadata IP, localhost,
        `file:///etc/passwd`, a gopher URL aimed at redis. Nothing on the
        server fetches it today, which is the only reason this was Medium — and
        exactly the reason to close it at the write, before something starts to.
        """
        try:
            return url_safety.validate_public_https_url(v)
        except url_safety.UnsafeUrl as exc:
            raise ValueError(str(exc)) from exc


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
        # supabase_auth (NOT supabase): sign_up creates a session, and a session
        # on the service-role client silently downgrades all table queries to
        # the new user's RLS context. See supabase_client.py.
        res = supabase_auth.auth.sign_up(
            {
                "email": str(data.email),
                "password": data.password,
            }
        )
        if not res.user:
            raise HTTPException(
                status_code=400,
                detail="Signup failed — check if email is already in use",
            )

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

        # Consent goes in its own write, not into the upsert above: if the
        # column is not there yet, only this statement fails.
        if data.accepted_terms:
            _record_terms_acceptance(user_id)

        # Referral code claim — best-effort, never blocks signup.
        if data.referral_code:
            _claim_referral_code(data.referral_code, user_id)

        # Welcome email — best-effort, never blocks signup
        try:
            from app.services.email import send_welcome_email

            send_welcome_email(str(data.email), data.first_name)
        except Exception:
            pass

        # Funnel event (K7 — no-analytics) — best-effort, never blocks signup
        from app.services.analytics import track_event

        track_event("Signup", url_path="/signup", props={"role": data.role})

        # If email confirmation is OFF, Supabase returns a live session immediately.
        # Return the token so the mobile app can auto-login.
        #
        # Unlike login, `res.session` is legitimately None here when email
        # confirmation is ON — the account exists but no session is issued until
        # the user confirms. So every field is read behind that check and all
        # three stay None on the confirmation path; the mobile client already
        # branches on a missing access_token (services/auth.js signup).
        #
        # refresh_token rides along for the same reason as login: without it the
        # ~1h access token expiry logs an auto-logged-in signup straight back out.
        session = res.session
        access_token = session.access_token if session else None
        refresh_token_value = (
            getattr(session, "refresh_token", None) if session else None
        )
        expires_in = getattr(session, "expires_in", None) if session else None
        return {
            "message": (
                "Account created"
                if access_token
                else "Account created — check your email to confirm"
            ),
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token": refresh_token_value,
            "expires_in": expires_in,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Signup failed")
        raise HTTPException(status_code=400, detail="Could not create account")


@router.post("/login")
# 10/minute, raised from 5 on 2026-08-14. The mobile client now retries a
# login whose connection dropped (see the retry interceptor in
# mobile/src/services/api.js), so one tap can legitimately cost up to three
# requests — at 5/minute a user with a flaky connection could exhaust the
# window on a single sign-in and be told "too many attempts" having made one.
#
# This is not the brute-force control and never was. That is T18's
# (email, ip) lockout below: 5 failures in 15 minutes, untouched. This limit
# only bounds request volume from one address, and 10 is still far under what
# a guessing attack needs.
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest):
    ip = _remote_ip(request)
    email = str(data.email)

    # T18 — Reject immediately if too many recent failures
    _check_lockout(email, ip)

    try:
        # supabase_auth (NOT supabase) — see supabase_client.py for why.
        res = supabase_auth.auth.sign_in_with_password(
            {
                "email": email,
                "password": data.password,
            }
        )
        if not res.session:
            # Treat missing session as a credential failure
            _record_failure(email, ip)
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Success — clear any accumulated failure count
        _clear_failures(email, ip)

        user_id = res.user.id

        # Read role + name + lifecycle flags from our users table (not Supabase
        # metadata). A suspended or soft-deleted account must not be able to
        # obtain a fresh token, so we re-check here as well as in get_current_user.
        db_res = (
            supabase.table("users")
            .select("role, first_name, last_name, is_suspended, deleted_at")
            .eq("id", user_id)
            .single()
            .execute()
        )
        user_data = db_res.data or {}

        if user_data.get("deleted_at"):
            raise HTTPException(status_code=403, detail="account_deactivated")
        if user_data.get("is_suspended"):
            raise HTTPException(status_code=403, detail="account_suspended")

        # Ghost mode lifts automatically on next successful login. Best-effort:
        # a failure here must not block an otherwise-valid login.
        try:
            supabase.table("users").update({"is_ghosted": False}).eq(
                "id", user_id
            ).execute()
        except Exception:
            logger.warning("auth.login ghost-clear failed", user_id=user_id)

        # A Supabase access token expires after ~1h. Hand back the refresh token
        # too so the mobile client can mint a new one instead of dumping the
        # user at the login screen mid-session (the 401 interceptor in
        # mobile/src/services/api.js consumes these). /auth/refresh already
        # returns the same pair; login never did, so there was nothing to
        # refresh WITH and the refresh path could never fire.
        #
        # getattr rather than attribute access: `res.session` is a Supabase
        # object whose shape we don't control, and a missing refresh_token must
        # degrade to None (client stores nothing, behaves as before) rather than
        # 500 an otherwise-valid login. The session itself is already known
        # non-None — the `if not res.session` guard above returns 401.
        session = res.session
        issued_refresh = getattr(session, "refresh_token", None)

        # D7.4 — date the refresh token this login issues. Without this, a user
        # who has just changed their password holds a token the watermark
        # cannot date, and the very login that proves they own the account
        # would be refused at its first refresh.
        if issued_refresh:
            session_security.record_issued(
                session_security.hash_refresh_token(issued_refresh), user_id
            )

        return {
            "access_token": session.access_token,
            "refresh_token": issued_refresh,
            "expires_in": getattr(session, "expires_in", None),
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

    D7.4 (pentest C-01) — replay detection. Supabase rotates the refresh token
    on every use but was still honouring the OLD one 65 seconds later, so a
    stolen refresh token granted indefinite reissue and there was no way to
    revoke a compromised session short of disabling the account. Every token
    this endpoint spends is now recorded by hash, and presenting a spent one
    again outside the grace window refuses the request and revokes the
    account's live sessions.

    Note what is NOT here: no idle timeout, no maximum session age. A signed-in
    user stays signed in until they log out. See services/session_security.py.
    """
    token_hash = session_security.hash_refresh_token(data.refresh_token)
    known = session_security.lookup_token(token_hash) if token_hash else None

    if known:
        watermark = None
        try:
            wm_res = (
                supabase.table("users")
                .select("sessions_valid_after")
                .eq("id", known["user_id"])
                .single()
                .execute()
            )
            watermark = (wm_res.data or {}).get("sessions_valid_after")
        except Exception:
            # Fail open — an unreadable watermark must not refuse a refresh.
            logger.exception("auth.refresh watermark read failed")

        verdict = session_security.classify_refresh(known, watermark)

        if verdict == "replay":
            # Outside the grace window there is no benign explanation left: a
            # client that received its rotated token has no reason to present
            # the old one, and one that did not would have retried immediately.
            # Treat it as stolen and kill the account's sessions, this one
            # included.
            session_security.revoke_sessions(
                known["user_id"], reason="refresh_token_replay"
            )
            logger.warning(
                "auth.refresh replay rejected",
                user_id=known.get("user_id"),
                ip=_remote_ip(request),
            )
            raise HTTPException(status_code=401, detail="Could not refresh session")

        if verdict == "revoked":
            logger.info(
                "auth.refresh rejected — issued before revocation",
                user_id=known.get("user_id"),
            )
            raise HTTPException(status_code=401, detail="Could not refresh session")

    try:
        # supabase_auth (NOT supabase) — see supabase_client.py for why.
        res = supabase_auth.auth.refresh_session(data.refresh_token)
        if not res.session:
            raise HTTPException(status_code=401, detail="Could not refresh session")

        # A suspended or soft-deleted account must not be able to mint a fresh
        # access token off an old refresh token.
        if res.user:
            guard = (
                supabase.table("users")
                .select("is_suspended, deleted_at")
                .eq("id", res.user.id)
                .single()
                .execute()
            )
            gu = guard.data or {}
            if gu.get("deleted_at"):
                raise HTTPException(status_code=403, detail="account_deactivated")
            if gu.get("is_suspended"):
                raise HTTPException(status_code=403, detail="account_suspended")

            # Mark the presented token spent, and date the one replacing it, so
            # the chain stays unbroken: the rotation product is what the client
            # will present next time, and it needs an issued_at of its own for
            # the watermark to reason about.
            session_security.record_consumed(token_hash, res.user.id)
            session_security.record_issued(
                session_security.hash_refresh_token(res.session.refresh_token),
                res.user.id,
            )

        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "expires_in": res.session.expires_in,
        }
    except HTTPException:
        raise
    except AuthApiError as exc:
        # A refresh token that is expired, revoked or already-used is the NORMAL
        # end of a session, not a server fault: Supabase rotates the token on
        # every use, so an app resumed from the background, a reinstall, or a
        # second device all land here routinely. Logging it with
        # logger.exception raised an ERROR-level Sentry event every time and
        # buried the real bugs under "Invalid Refresh Token: Already Used"
        # (cleaned up 2026-08-04). The client's job is unchanged — a 401 here
        # means log in again — so only the log level moves.
        logger.info("auth.refresh rejected", reason=str(exc))
        raise HTTPException(status_code=401, detail="Could not refresh session")
    except Exception:
        # Anything that is NOT an auth rejection is still a real fault.
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
    redirect_to = (
        getattr(settings, "PASSWORD_RESET_REDIRECT_URL", None)
        or "https://swingbyy.com/reset-password"
    )
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
        "id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "role",
        "avatar_url",
        "created_at",
    }
    profile = {k: v for k, v in current_user.items() if k in safe_fields}

    # Business owners need business_id so the mobile "My Business" tab can
    # resolve their business without a second round-trip.
    if current_user.get("role") == "business_owner":
        try:
            biz = (
                supabase.table("businesses")
                .select("id")
                .eq("owner_id", current_user["id"])
                .limit(1)
                .execute()
            )
            profile["business_id"] = biz.data[0]["id"] if biz.data else None
        except Exception:
            logger.warning("get_me business lookup failed", user_id=current_user["id"])
            profile["business_id"] = None

    return profile


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


# ═════════════════════════════════════════════════════════════════════════════
# Social sign-in — Google (all platforms) + Apple (iOS only)
# ═════════════════════════════════════════════════════════════════════════════
#
# WHY THE BACKEND MEDIATES THIS
# -----------------------------
# The mobile app never talks to Supabase directly (see CLAUDE.md: "service_role
# key backend-only"). More importantly, a social sign-in is the ONE path where
# a Supabase Auth user can come into existence without ever passing through
# POST /auth/signup — so nothing would set `users.role`, `first_name` or
# `last_name`. The `handle_new_user()` trigger on auth.users does insert a bare
# row (role defaults to 'client', names default to ''), which satisfies the
# NOT NULL constraints but leaves a nameless profile behind. Verified against
# the live database on 2026-07-23:
#
#   users: id, first_name NOT NULL, last_name NOT NULL, email NOT NULL UNIQUE,
#          phone, role NOT NULL (CHECK client|business_owner|employee|admin,
#          no default), avatar_url, created_at, deleted_at, is_suspended NOT
#          NULL, is_ghosted NOT NULL, stripe_customer_id,
#          default_payment_method_id
#   trigger: auth.users AFTER INSERT -> public.handle_new_user()
#
# So every social entry point below funnels through _provision_social_user(),
# which backfills names/avatar from the provider identity and pins the role.
# That is what makes a social user indistinguishable from an email signup.
#
# TWO FLOWS
# ---------
# 1. PKCE redirect  (Google, every platform)
#      POST /auth/social/authorize -> {url, code_verifier}
#      app opens `url` in a browser tab, Supabase runs the Google dance,
#      redirects back to the app scheme with ?code=...
#      POST /auth/social/exchange  -> session + provisioned profile
#
# 2. Native ID token  (Apple on iOS; also works for Google native SDKs)
#      POST /auth/social/id-token  -> session + provisioned profile
#
# Flow 2 is what expo-apple-authentication feeds. It is INERT until an Apple
# Developer account exists and the Apple provider is enabled in Supabase —
# see docs/SOCIAL_SIGNIN_SETUP.md. Nothing in flow 2 is reachable from the
# Android build.

_SOCIAL_PROVIDERS = ("google", "apple")

# Redirect targets we are willing to hand a Supabase auth code to. An open
# redirect here would let an attacker harvest auth codes, so this is an
# allowlist of URL *prefixes*, not a free-text field.
#   - `swingby://`         the app's own scheme (app.json -> expo.scheme)
#   - `https://swingbyy.com/` the web property
# Extra prefixes (e.g. `exp://10.0.0.168:8081/--/` for Expo Go, or a tunnel
# URL) come from SOCIAL_AUTH_REDIRECT_PREFIXES as a comma-separated list.
# Read via os.getenv rather than app.config.settings because config.py is not
# owned by this module; adding it to _OPTIONAL there is a follow-up nicety.
_DEFAULT_REDIRECT_PREFIXES = ("swingby://", "https://swingbyy.com/")


def _allowed_redirect_prefixes() -> Tuple[str, ...]:
    extra = os.getenv("SOCIAL_AUTH_REDIRECT_PREFIXES", "")
    parsed = tuple(p.strip() for p in extra.split(",") if p.strip())
    return _DEFAULT_REDIRECT_PREFIXES + parsed


# D7.5 (pentest M-01) — the only callback the app ever constructs.
#
# `getRedirectUri()` in mobile/src/services/socialAuth.js is
# `Linking.createURL('auth-callback')` and nothing else. That renders as
# `swingby://auth-callback` in a standalone build and
# `exp://<host>:<port>/--/auth-callback` under Expo Go, so the host varies and
# the tail does not. Match on the tail.
_REDIRECT_CALLBACK_SUFFIX = "auth-callback"


def _validate_redirect(redirect_to: str) -> str:
    """Allowlist a post-OAuth redirect target.

    D7.5 (pentest M-01) — this used to be `startswith(prefix)` and nothing
    else. That correctly refused `https://evil.tld`, subdomain confusion,
    `@`-hijack and `javascript:`, but it accepted **`swingby://../../root`**
    (200) and echoed it straight into the Supabase authorize URL: any path
    passed as long as the scheme matched.

    The scheme gate stays exactly as it was — it is doing real work. What is
    added is that the rest of the URL now has to be the callback, rather than
    merely being attached to an approved scheme:

      * no `..` and no backslash anywhere. Traversal is meaningless in a
        callback, and a backslash is how a parser is talked into reading part
        of a path as a host.
      * no query or fragment. Supabase appends `?code=…` on the way back; the
        client has no business specifying either on the way out.
      * the path must END in `auth-callback`. Matching the tail rather than the
        whole remainder is what keeps Expo Go working, where the host and port
        are part of the URL and change per machine.

    `SOCIAL_AUTH_REDIRECT_PREFIXES` still extends the scheme list for Expo Go.
    It now grants a scheme rather than a blanket.
    """
    redirect_to = (redirect_to or "").strip()
    if not redirect_to:
        raise HTTPException(status_code=400, detail="redirect_to is not allowed")

    if not any(redirect_to.startswith(p) for p in _allowed_redirect_prefixes()):
        raise HTTPException(status_code=400, detail="redirect_to is not allowed")

    if ".." in redirect_to or "\\" in redirect_to:
        raise HTTPException(status_code=400, detail="redirect_to is not allowed")

    if "?" in redirect_to or "#" in redirect_to:
        raise HTTPException(status_code=400, detail="redirect_to is not allowed")

    if redirect_to.rstrip("/").split("/")[-1] != _REDIRECT_CALLBACK_SUFFIX:
        raise HTTPException(status_code=400, detail="redirect_to is not allowed")

    return redirect_to


def _pkce_pair() -> Tuple[str, str]:
    """Returns (code_verifier, code_challenge) for RFC 7636 S256.

    The verifier is handed back to the app, which holds it for the round trip
    and returns it on /exchange. That is the standard public-client shape:
    the code alone is useless to anyone who intercepts the redirect.
    """
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode().rstrip("=")
    return verifier, challenge


def _split_provider_name(meta: dict, email: str) -> Tuple[str, str]:
    """Best-effort first/last name out of an OIDC identity.

    Google sends given_name/family_name (and name/full_name). Apple sends a
    name ONLY on the very first authorization and only via the native SDK, so
    the client passes it explicitly. Falls back to the email local-part —
    users.first_name is NOT NULL, so this must never return an empty first
    name. last_name is NOT NULL too but '' is a legal value.
    """
    meta = meta or {}
    first = (meta.get("given_name") or meta.get("first_name") or "").strip()
    last = (meta.get("family_name") or meta.get("last_name") or "").strip()

    if not first:
        full = (meta.get("full_name") or meta.get("name") or "").strip()
        if full:
            parts = full.split()
            first = parts[0]
            if not last and len(parts) > 1:
                last = " ".join(parts[1:])

    if not first:
        local_part = (email or "").split("@")[0].strip()
        first = local_part or "SwingBy"

    return first[:80], last[:80]


def _provision_social_user(
    auth_user,
    provider: str,
    requested_role: Optional[str],
    name_hint: Optional[Dict[str, str]] = None,
):
    """Guarantee a complete `users` row for a social identity.

    Returns (user_row, is_new_user).

    The handle_new_user() trigger has almost certainly already inserted a bare
    row by the time we get here (role='client', first_name='', last_name='').
    "New" is therefore detected as *no row* or *a row with a blank first
    name* — not as "row missing", which would never be true.

    Lifecycle guards mirror /auth/login exactly: a soft-deleted or suspended
    account cannot obtain a session through the social door either.
    """
    user_id = auth_user.id
    email = (getattr(auth_user, "email", None) or "").strip().lower()
    meta = dict(getattr(auth_user, "user_metadata", None) or {})
    if name_hint:
        # Client-supplied names (Apple's first-authorization payload) only
        # fill gaps; they never override what the provider itself asserted.
        for k, v in name_hint.items():
            if v and not meta.get(k):
                meta[k] = v

    existing = (
        supabase.table("users")
        .select(
            "id, first_name, last_name, email, role, avatar_url, "
            "is_suspended, deleted_at, created_at"
        )
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    row = rows[0] if rows else None

    is_new = row is None or not (row.get("first_name") or "").strip()

    if row is not None:
        # Guard BEFORE writing anything — a banned account gets no side effects.
        if row.get("deleted_at"):
            raise HTTPException(status_code=403, detail="account_deactivated")
        if row.get("is_suspended"):
            raise HTTPException(status_code=403, detail="account_suspended")

    first_name, last_name = _split_provider_name(meta, email)
    avatar = (meta.get("avatar_url") or meta.get("picture") or "").strip() or None

    # D7.8 — the same rule PATCH /auth/me enforces, applied to the provider's
    # value. Google and Apple send public https URLs, so this should never
    # fire; it is here because "the identity provider gave it to us" is a trust
    # assumption, and an unsafe avatar must not get in through a second door
    # just because the first one is now locked. Drop it rather than fail the
    # sign-in: a missing picture is not a reason to refuse someone entry.
    if avatar:
        try:
            avatar = url_safety.validate_public_https_url(avatar)
        except url_safety.UnsafeUrl:
            logger.warning("auth.social rejected provider avatar", user_id=user_id)
            avatar = None

    if row is None:
        # Trigger did not fire (or a race lost it) — write the whole row.
        payload = {
            "id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": requested_role or "client",
        }
        if avatar:
            payload["avatar_url"] = avatar[:2048]
        supabase.table("users").upsert(payload).execute()
        row = payload
    else:
        patch: Dict[str, object] = {}
        if not (row.get("first_name") or "").strip():
            patch["first_name"] = first_name
            patch["last_name"] = last_name
        if not (row.get("email") or "").strip() and email:
            patch["email"] = email
        if avatar and not (row.get("avatar_url") or "").strip():
            patch["avatar_url"] = avatar[:2048]
        # Role is only ever set on the way IN. An established account keeps
        # the role it has — a social re-login must not silently demote a
        # business_owner (or, worse, be usable to change an admin's role).
        if is_new and requested_role and row.get("role") != requested_role:
            patch["role"] = requested_role
        if patch:
            supabase.table("users").update(patch).eq("id", user_id).execute()
            row = {**row, **patch}

    # Ghost mode lifts on a successful sign-in, same as /auth/login.
    try:
        supabase.table("users").update({"is_ghosted": False}).eq(
            "id", user_id
        ).execute()
    except Exception:
        logger.warning("auth.social ghost-clear failed", user_id=user_id)

    if is_new:
        # Best-effort side effects — identical to /auth/signup, and identical
        # in that neither may block the request.
        try:
            from app.services.email import send_welcome_email

            send_welcome_email(email, row.get("first_name") or first_name)
        except Exception:
            pass
        try:
            from app.services.analytics import track_event

            track_event(
                "Signup",
                url_path="/auth/social",
                props={"role": row.get("role"), "method": provider},
            )
        except Exception:
            pass

    return row, is_new


def _record_terms_acceptance(user_id: str) -> None:
    """Stamp `users.terms_accepted_at` — best-effort, never blocks a signup.

    The app gates account creation behind a real checkbox; this is the record
    that it was ticked. Two deliberate weaknesses, both load-bearing:

    1. BEST-EFFORT. `20260731140000_terms_consent.sql` may not be applied yet
       when this code deploys. If the column is missing PostgREST errors, and
       the only acceptable outcome is a log line — locking every new user out of
       the app over a pending migration would be a far worse bug than a missing
       consent timestamp.
    2. NOT ENFORCED SERVER-SIDE. `accepted_terms` defaults to False rather than
       being required, because TestFlight builds already in the wild do not send
       it. Requiring it would 400 every signup from an older binary. Flip it to
       a hard requirement once no such build is in circulation.
    """
    try:
        supabase.table("users").update(
            {"terms_accepted_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", user_id).execute()
    except Exception:
        logger.warning("auth.terms_consent record failed", user_id=user_id)


def _social_session_response(
    res,
    provider: str,
    requested_role: Optional[str],
    name_hint: Optional[Dict[str, str]] = None,
    accepted_terms: bool = False,
    referral_code: Optional[str] = None,
) -> dict:
    """Shared tail for both social flows: provision, then return the SAME
    token envelope /auth/login returns so the mobile client has one code path.
    """
    session = getattr(res, "session", None)
    user = getattr(res, "user", None)
    if not session or not user:
        raise HTTPException(status_code=401, detail="Social sign-in failed")

    row, is_new = _provision_social_user(user, provider, requested_role, name_hint)

    # Only on the way IN. A returning user re-consenting on every sign-in would
    # overwrite the date they actually agreed, which is the one thing this
    # column exists to preserve.
    if is_new and accepted_terms:
        _record_terms_acceptance(user.id)

    # F128 — same "only on the way in" rule as terms acceptance: a returning
    # social user who happens to carry a stale invite param from a link they
    # tapped once must never claim a second referral against their own
    # existing account.
    if is_new and referral_code:
        _claim_referral_code(referral_code, user.id)

    return {
        "access_token": session.access_token,
        "refresh_token": getattr(session, "refresh_token", None),
        "expires_in": getattr(session, "expires_in", None),
        "user_id": user.id,
        "role": row.get("role"),
        "first_name": row.get("first_name"),
        "last_name": row.get("last_name"),
        "provider": provider,
        "is_new_user": is_new,
    }


def _validate_social_role(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    if v not in ("client", "business_owner"):
        raise ValueError("role must be 'client' or 'business_owner'")
    return v


class SocialAuthorizeRequest(BaseModel):
    provider: str = Field(..., max_length=16)
    redirect_to: str = Field(..., max_length=512)
    role: Optional[str] = Field(None, max_length=32)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in _SOCIAL_PROVIDERS:
            raise ValueError(f"provider must be one of {', '.join(_SOCIAL_PROVIDERS)}")
        return v

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v):
        return _validate_social_role(v)


class SocialExchangeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=2048)
    code_verifier: str = Field(..., min_length=1, max_length=256)
    provider: str = Field("google", max_length=16)
    role: Optional[str] = Field(None, max_length=32)
    accepted_terms: bool = False
    # F128 — the beta-invite code rides through Signup's route params on the
    # email path (referral_code) but had no field to travel on here, so a
    # tester who signed up with Google after tapping an invite link never got
    # attributed. Same normalization as SignupRequest.referral_code.
    referral_code: Optional[str] = Field(None, max_length=32)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = (v or "google").strip().lower()
        if v not in _SOCIAL_PROVIDERS:
            raise ValueError(f"provider must be one of {', '.join(_SOCIAL_PROVIDERS)}")
        return v

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v):
        return _validate_social_role(v)

    @field_validator("referral_code", mode="before")
    @classmethod
    def normalize_referral_code(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_referral_code(v)


class SocialIdTokenRequest(BaseModel):
    provider: str = Field(..., max_length=16)
    id_token: str = Field(..., min_length=1, max_length=8192)
    nonce: Optional[str] = Field(None, max_length=256)
    first_name: Optional[str] = Field(None, max_length=80)
    last_name: Optional[str] = Field(None, max_length=80)
    role: Optional[str] = Field(None, max_length=32)
    accepted_terms: bool = False
    # F128 — same as SocialExchangeRequest.referral_code: this is the Apple
    # (and native-Google) door, which needs the same attribution path.
    referral_code: Optional[str] = Field(None, max_length=32)

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in _SOCIAL_PROVIDERS:
            raise ValueError(f"provider must be one of {', '.join(_SOCIAL_PROVIDERS)}")
        return v

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v):
        return _validate_social_role(v)

    @field_validator("referral_code", mode="before")
    @classmethod
    def normalize_referral_code(cls, v: Optional[str]) -> Optional[str]:
        return _normalize_referral_code(v)


class SocialRoleRequest(BaseModel):
    role: str = Field(..., max_length=32)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("client", "business_owner"):
            raise ValueError("role must be 'client' or 'business_owner'")
        return v


@router.post("/social/authorize")
@limiter.limit("10/minute")
def social_authorize(request: Request, data: SocialAuthorizeRequest):
    """Step 1 of the PKCE redirect flow.

    Returns the Supabase `/auth/v1/authorize` URL to open in a browser tab plus
    the code_verifier the caller must hold and send back to /social/exchange.
    No secret leaves the server: the verifier is a per-attempt random value,
    and the Supabase URL is public information anyway.
    """
    redirect_to = _validate_redirect(data.redirect_to)
    verifier, challenge = _pkce_pair()

    base = settings.SUPABASE_URL.rstrip("/")
    query = urlencode(
        {
            "provider": data.provider,
            "redirect_to": redirect_to,
            "code_challenge": challenge,
            "code_challenge_method": "s256",
        }
    )
    return {
        "url": f"{base}/auth/v1/authorize?{query}",
        "code_verifier": verifier,
        "redirect_to": redirect_to,
        "provider": data.provider,
    }


@router.post("/social/exchange")
@limiter.limit("10/minute")
def social_exchange(request: Request, data: SocialExchangeRequest):
    """Step 2 of the PKCE redirect flow — code + verifier -> session.

    Runs on supabase_auth (NOT supabase) for the reason spelled out in
    supabase_client.py: a session on the service-role client silently
    downgrades every subsequent .table() call to that user's RLS context.
    """
    try:
        res = supabase_auth.auth.exchange_code_for_session(
            {"auth_code": data.code, "code_verifier": data.code_verifier}
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("auth.social exchange failed", provider=data.provider)
        raise HTTPException(status_code=401, detail="Social sign-in failed")

    return _social_session_response(
        res,
        data.provider,
        data.role,
        accepted_terms=data.accepted_terms,
        referral_code=data.referral_code,
    )


@router.post("/social/id-token")
@limiter.limit("10/minute")
def social_id_token(request: Request, data: SocialIdTokenRequest):
    """Native ID-token sign-in — this is the Apple-on-iOS door.

    expo-apple-authentication returns an identityToken (a signed OIDC JWT) and
    the nonce it was minted with; Supabase verifies the signature against
    Apple's JWKS. We never trust the client's claim about who they are — the
    only thing the client can influence is the display name, and only when the
    provider did not supply one (Apple only sends the name on first auth).

    UNTESTED END-TO-END: no Apple Developer account exists (see the report),
    so no real identityToken has ever been through this. The Supabase call and
    the profile provisioning are covered by unit tests with a stubbed client.
    """
    name_hint = {}
    if data.first_name:
        name_hint["first_name"] = data.first_name.strip()
    if data.last_name:
        name_hint["last_name"] = data.last_name.strip()

    credentials = {"provider": data.provider, "token": data.id_token}
    if data.nonce:
        credentials["nonce"] = data.nonce

    try:
        res = supabase_auth.auth.sign_in_with_id_token(credentials)
    except HTTPException:
        raise
    except Exception:
        logger.exception("auth.social id_token failed", provider=data.provider)
        raise HTTPException(status_code=401, detail="Social sign-in failed")

    return _social_session_response(
        res,
        data.provider,
        data.role,
        name_hint or None,
        accepted_terms=data.accepted_terms,
        referral_code=data.referral_code,
    )


@router.post("/social/role")
@limiter.limit("5/minute")
def social_set_role(
    request: Request,
    data: SocialRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """One-shot role pick for a freshly-created social account.

    A social sign-in started from the LOGIN screen carries no role, so the new
    account lands as 'client' (the trigger's default). This lets the app ask
    "actually, are you offering services?" straight afterwards.

    Deliberately narrow so it can never be used for privilege escalation:
      - only 'client' -> 'business_owner' | 'client' (never employee/admin,
        and never FROM employee/admin/business_owner)
      - only within 24h of account creation
      - only while the user owns no businesses
    Anything else is a 403. Note that picking business_owner at signup is
    already unrestricted (see SignupRequest.validate_role), so this grants
    nothing a normal signup would not.
    """
    if current_user.get("role") != "client":
        raise HTTPException(status_code=403, detail="role is already set")

    created_at = current_user.get("created_at")
    if created_at:
        try:
            parsed = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - parsed > timedelta(hours=24):
                raise HTTPException(status_code=403, detail="role is already set")
        except HTTPException:
            raise
        except Exception:
            # Unparseable created_at — fail closed rather than open.
            raise HTTPException(status_code=403, detail="role is already set")

    try:
        owned = (
            supabase.table("businesses")
            .select("id")
            .eq("owner_id", current_user["id"])
            .limit(1)
            .execute()
        )
        if owned.data:
            raise HTTPException(status_code=403, detail="role is already set")
    except HTTPException:
        raise
    except Exception:
        logger.warning(
            "auth.social role business lookup failed", user_id=current_user["id"]
        )

    if data.role == "client":
        return {"role": "client"}

    try:
        supabase.table("users").update({"role": data.role}).eq(
            "id", current_user["id"]
        ).execute()
    except Exception:
        logger.exception("auth.social role update failed")
        raise HTTPException(status_code=400, detail="Could not set role")

    return {"role": data.role}
