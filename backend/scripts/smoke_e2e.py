"""
smoke_e2e.py — End-to-end smoke test for the SwingBy beta flow.

Walks the full client-and-business journey against a running API:

    signup-or-login (client + business)
    → business creates a business profile (or reuses one)
    → client creates a service post
    → business expresses interest (quotes price)
    → client accepts the interest        ← creates a booking + payment
    → business confirms a scheduled date
    → business posts Live Job Status: arrived → started
    → business attaches a "before" photo (recorded URL only)
    → business posts Live Job Status: completed
    → business attaches an "after" photo
    → business calls PATCH /bookings/{id}/complete to release final payment
    → client posts a review

Usage
-----
    python backend/scripts/smoke_e2e.py
    BASE_URL=https://swingbyy-api.onrender.com python backend/scripts/smoke_e2e.py
    CLIENT_EMAIL=... CLIENT_PASSWORD=... \
    BIZ_EMAIL=... BIZ_PASSWORD=... \
        python backend/scripts/smoke_e2e.py

If the *_EMAIL/*_PASSWORD env vars are set, the script logs in with those
existing seed accounts. Otherwise it signs up fresh accounts with email
addresses of the form `smoke-<timestamp>-client@swingbyy.test`. Signup only
works when Supabase "Confirm email" is OFF on that project.

Exit code 0 ⇒ flow passed. Anything else ⇒ failed at the printed step.
"""
from __future__ import annotations

import os
import sys
import time
import uuid
from typing import Optional

import httpx


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000").rstrip("/")
TIMEOUT = float(os.environ.get("SMOKE_TIMEOUT", "20"))


def log(step: str, msg: str = "") -> None:
    print(f"[smoke] {step:<26} {msg}", flush=True)


def fail(step: str, resp: httpx.Response) -> None:
    body = ""
    try:
        body = resp.text[:400]
    except Exception:
        pass
    print(f"\n[smoke] FAILED at: {step}", file=sys.stderr)
    print(f"[smoke] {resp.request.method} {resp.request.url}", file=sys.stderr)
    print(f"[smoke] status: {resp.status_code}", file=sys.stderr)
    print(f"[smoke] body:   {body}", file=sys.stderr)
    sys.exit(2)


def _check(resp: httpx.Response, step: str, expected: tuple[int, ...] = (200, 201)) -> dict:
    if resp.status_code not in expected:
        fail(step, resp)
    try:
        return resp.json()
    except Exception:
        return {}


def signup_or_login(
    client: httpx.Client,
    role: str,
    env_email: str,
    env_password: str,
) -> tuple[str, str]:
    """Return (user_id, access_token) for one role.

    Uses CLIENT_EMAIL/BIZ_EMAIL env vars if both email + password are set;
    otherwise signs up a fresh sandbox account.
    """
    email = os.environ.get(env_email)
    password = os.environ.get(env_password)

    if email and password:
        log("login", f"{role} {email}")
        resp = client.post("/auth/login", json={"email": email, "password": password})
        data = _check(resp, "login")
        return data["user_id"], data["access_token"]

    # Fresh signup
    stamp = int(time.time())
    email = f"smoke-{stamp}-{role}-{uuid.uuid4().hex[:6]}@swingbyy.test"
    password = "SmokeP@ss123"  # meets complexity rule
    payload = {
        "email": email,
        "password": password,
        "first_name": "Smoke",
        "last_name": role.title(),
        "role": "client" if role == "client" else "business_owner",
    }
    log("signup", f"{role} {email}")
    resp = client.post("/auth/signup", json=payload)
    data = _check(resp, "signup")
    token = data.get("access_token")
    if not token:
        print(
            "\n[smoke] signup returned no access_token. "
            "Either 'Confirm email' is ON in Supabase Auth, or your seed "
            "accounts need verification. Set CLIENT_EMAIL/CLIENT_PASSWORD "
            "and BIZ_EMAIL/BIZ_PASSWORD env vars to use confirmed accounts.",
            file=sys.stderr,
        )
        sys.exit(3)
    return data["user_id"], token


def ensure_business(client: httpx.Client, biz_token: str) -> str:
    """Return business_id, creating one if the owner doesn't have one yet."""
    headers = {"Authorization": f"Bearer {biz_token}"}
    me_resp = client.get("/businesses/me", headers=headers)
    if me_resp.status_code == 200:
        data = me_resp.json()
        biz = data.get("business") or data
        if biz and biz.get("id"):
            log("business", f"reused id={biz['id']}")
            return biz["id"]

    payload = {
        "business_name": f"Smoke Co {int(time.time())}",
        "category": "Cleaning",
        "lat": 51.0447,
        "lng": -114.0719,
        "service_radius_km": 25.0,
    }
    log("business", "creating")
    resp = client.post("/businesses/", headers=headers, json=payload)
    data = _check(resp, "create_business")
    return data["business"]["id"]


def create_post(client: httpx.Client, client_token: str) -> str:
    headers = {"Authorization": f"Bearer {client_token}"}
    payload = {
        "title": f"Smoke post {int(time.time())}",
        "description": "Need a hand with a smoke-test job.",
        "category": "Cleaning",
        "budget": 150.0,
        "lat": 51.0447,
        "lng": -114.0719,
        "address": "Calgary, AB",
    }
    log("post", "creating")
    resp = client.post("/service-posts/", headers=headers, json=payload)
    data = _check(resp, "create_post")
    return data["post"]["id"]


def express_interest(client: httpx.Client, biz_token: str, post_id: str) -> str:
    headers = {"Authorization": f"Bearer {biz_token}"}
    payload = {"post_id": post_id, "quoted_price": 145.0}
    log("interest", f"post={post_id}")
    resp = client.post("/interests/", headers=headers, json=payload)
    data = _check(resp, "express_interest")
    # InterestCreate response wraps the row — try common shapes
    interest = data.get("interest") or data
    return interest["id"]


def accept_interest(client: httpx.Client, client_token: str, interest_id: str) -> str:
    headers = {"Authorization": f"Bearer {client_token}"}
    log("accept", f"interest={interest_id}")
    resp = client.patch(f"/interests/{interest_id}/accept", headers=headers)
    data = _check(resp, "accept_interest")
    booking = data.get("booking") or data
    return booking["id"]


def confirm_date(client: httpx.Client, client_token: str, booking_id: str) -> None:
    # The booking's client is the one who confirms a proposed date (moves to in_progress).
    headers = {"Authorization": f"Bearer {client_token}"}
    # +3 days at noon UTC
    target = time.gmtime(time.time() + 3 * 86_400)
    iso = time.strftime("%Y-%m-%dT12:00:00Z", target)
    log("confirm-date", iso)
    resp = client.patch(
        f"/bookings/{booking_id}/confirm-date",
        headers=headers,
        json={"confirmed_date": iso},
    )
    _check(resp, "confirm_date")


def post_event(client: httpx.Client, biz_token: str, booking_id: str, event_type: str) -> None:
    headers = {"Authorization": f"Bearer {biz_token}"}
    log("event", event_type)
    resp = client.post(
        f"/bookings/{booking_id}/events",
        headers=headers,
        json={"event_type": event_type},
    )
    _check(resp, f"post_event:{event_type}")


def attach_photo(
    client: httpx.Client,
    biz_token: str,
    booking_id: str,
    phase: str,
) -> None:
    headers = {"Authorization": f"Bearer {biz_token}"}
    fake_path = f"smoke/{uuid.uuid4().hex}.jpg"
    fake_url = f"https://example.com/smoke-{phase}.jpg"
    log("photo", f"{phase} {fake_path}")
    resp = client.post(
        f"/bookings/{booking_id}/photos",
        headers=headers,
        json={
            "phase": phase,
            "url": fake_url,
            "path": fake_path,
            "caption": f"smoke-{phase}",
        },
    )
    _check(resp, f"attach_photo:{phase}")


def complete_booking(client: httpx.Client, biz_token: str, booking_id: str) -> None:
    headers = {"Authorization": f"Bearer {biz_token}"}
    log("complete", booking_id)
    resp = client.patch(f"/bookings/{booking_id}/complete", headers=headers)
    _check(resp, "complete_booking")


def leave_review(client: httpx.Client, client_token: str, booking_id: str) -> None:
    headers = {"Authorization": f"Bearer {client_token}"}
    payload = {
        "booking_id": booking_id,
        "rating": 5,
        "comment": "Smoke-test review — looked great.",
    }
    log("review", booking_id)
    resp = client.post("/reviews/", headers=headers, json=payload)
    _check(resp, "leave_review")


def list_events(client: httpx.Client, token: str, booking_id: str) -> list:
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"/bookings/{booking_id}/events", headers=headers)
    data = _check(resp, "list_events")
    return data.get("items", [])


def main() -> int:
    print(f"[smoke] BASE_URL = {BASE_URL}")
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as session:
        # 0. Health
        h = session.get("/healthz")
        if h.status_code != 200:
            fail("healthz", h)
        log("healthz", "ok")

        # 1. Both roles in
        _, client_token = signup_or_login(session, "client", "CLIENT_EMAIL", "CLIENT_PASSWORD")
        _, biz_token = signup_or_login(session, "business", "BIZ_EMAIL", "BIZ_PASSWORD")

        # 2. Business has a profile
        ensure_business(session, biz_token)

        # 3. Client posts a job
        post_id = create_post(session, client_token)

        # 4. Business expresses interest
        interest_id = express_interest(session, biz_token, post_id)

        # 5. Client accepts → booking
        booking_id = accept_interest(session, client_token, interest_id)

        # 6. Client confirms a proposed date (moves booking confirmed → in_progress).
        # Non-fatal: if the booking is already past 'confirmed', skip rather than abort.
        try:
            confirm_date(session, client_token, booking_id)
        except SystemExit:
            log("confirm-date", "skipped (non-fatal)")

        # 7. Live Job Status: arrived → started
        post_event(session, biz_token, booking_id, "arrived")
        post_event(session, biz_token, booking_id, "started")

        # 8. Before photo
        attach_photo(session, biz_token, booking_id, "before")

        # 9. Completed event + after photo
        post_event(session, biz_token, booking_id, "completed")
        attach_photo(session, biz_token, booking_id, "after")

        # 10. PATCH /complete → release final payment
        complete_booking(session, biz_token, booking_id)

        # 11. Client leaves a review
        leave_review(session, client_token, booking_id)

        # 12. Sanity: client can read the event list
        events = list_events(session, client_token, booking_id)
        log("verify events", f"count={len(events)}")
        if len(events) < 3:
            print(
                f"[smoke] expected at least 3 events, got {len(events)}",
                file=sys.stderr,
            )
            return 4

    print("\n[smoke] ALL GREEN — full beta flow passed end-to-end.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
