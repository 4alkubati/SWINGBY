"""
e2e_smoke.py — golden-path smoke test for the SwingBy booking loop.

Runs the full client<->business journey against a running backend using the
documented test accounts (CLAUDE.md):

  post job -> business quotes -> pre-booking chat -> client compares quotes
  -> accept -> booking + payment created -> chat migrates to booking thread
  -> business posts en_route event -> business completes -> escrow released

It verifies RESPONSE SHAPES, not just status codes — the flow graph catches
broken routes, this catches broken payloads (the "screen renders but empty"
class of bug).

Usage:
    python tools/e2e_smoke.py                    # against http://127.0.0.1:8000
    python tools/e2e_smoke.py http://host:8011   # against another base URL

Exit code 0 = all pass. Non-zero = something in the loop is broken; the FAIL
lines say exactly what.

Notes:
- Uses testclient@swingby.dev / testbusiness@swingby.dev (SwingBy2024!).
- Each run creates one post -> one completed booking on those accounts.
  That accumulation is intentional (test accounts double as demo data).
- Login is rate-limited 5/min/IP; the script logs in twice per run.
"""

import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
PASSWORD = "SwingBy2024!"
CLIENT_EMAIL = "testclient@swingby.dev"
BIZ_EMAIL = "testbusiness@swingby.dev"

failures = []


def call(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except json.JSONDecodeError:
            return e.code, {}


def check(label, cond, extra=""):
    line = ("PASS  " if cond else "FAIL  ") + label + (f"  {extra}" if extra else "")
    print(line)
    if not cond:
        failures.append(label)
    return cond


def login(email):
    s, r = call("POST", "/auth/login", body={"email": email, "password": PASSWORD})
    check(f"login {email}", s == 200, str(s))
    return r.get("access_token")


def main():
    stamp = int(time.time())

    ctok = login(CLIENT_EMAIL)
    btok = login(BIZ_EMAIL)
    if not (ctok and btok):
        print("\nRESULT: FAIL — cannot log in with documented test accounts")
        return 1

    # Both tokens must be valid SIMULTANEOUSLY (guards the shared-auth-client
    # regression where one login revoked/hijacked the other session).
    s, _ = call("GET", "/auth/me", ctok)
    check("client token valid after business login", s == 200, str(s))

    # 1. Client posts a job
    s, res = call("POST", "/service-posts/", ctok, {
        "title": f"Smoke test job {stamp}",
        "category": "cleaning",
        "budget": 200,
        "lat": 51.0447, "lng": -114.0719,
        "address": "123 Smoke Test Ave SW, Calgary",
    })
    if not check("create post", s == 200, str(s)):
        return finish()
    post_id = res["post"]["id"]
    check("category normalized to Cleaning",
          res.get("post", {}).get("category") == "Cleaning")

    # 1b. Verify post visible in business feed for same category
    s, feed = call("GET", "/service-posts/", btok)
    check("list service posts", s == 200, str(s))
    feed_post_ids = [p.get("id") for p in feed.get("items", [])]
    check("newly created post visible in business feed", post_id in feed_post_ids)

    # 2. Business quotes it
    s, res = call("POST", "/interests/", btok, {"post_id": post_id, "quoted_price": 180})
    if not check("create quote", s == 200, str(s)):
        return finish()
    interest_id = res["interest"]["id"]

    # 3. Pre-booking message on the quote thread
    s, _ = call("POST", "/messages/", btok, {
        "interest_id": interest_id, "content": f"smoke-{stamp} available Friday",
    })
    check("pre-booking message", s == 200, str(s))

    # 4. Client lists quotes — business info must come nested under `businesses`
    s, quotes = call("GET", f"/interests/post/{post_id}", ctok)
    check("list quotes", s == 200, str(s))
    q = (quotes or [{}])[0]
    check("quote has nested businesses{business_name}",
          isinstance(q.get("businesses"), dict) and "business_name" in q["businesses"])

    # 5. /service-posts/my must carry interest_count (My Jobs quote badge)
    s, my_posts = call("GET", "/service-posts/my", ctok)
    mine = next((p for p in my_posts.get("items", []) if p["id"] == post_id), {})
    check("post has interest_count >= 1", (mine.get("interest_count") or 0) >= 1,
          str(mine.get("interest_count")))

    # 6. Accept -> response must contain booking.id (mobile navigates with it)
    s, acc = call("PATCH", f"/interests/{interest_id}/accept", ctok, {})
    check("accept quote", s == 200, str(s))
    booking_id = (acc.get("booking") or {}).get("id")
    if not check("accept response has booking.id", bool(booking_id)):
        return finish()

    # 7. Bookings list + detail joins the mobile screens depend on
    s, blist = call("GET", "/bookings/", ctok)
    b = next((x for x in blist.get("items", []) if x["id"] == booking_id), {})
    check("bookings list: businesses join", isinstance(b.get("businesses"), dict))
    check("bookings list: service_posts join", isinstance(b.get("service_posts"), dict))

    s, bd = call("GET", f"/bookings/{booking_id}", ctok)
    check("booking detail", s == 200, str(s))
    check("detail: service_posts.address present",
          bool((bd.get("service_posts") or {}).get("address")))
    check("detail: businesses.review_count present",
          "review_count" in (bd.get("businesses") or {}))

    # 8. Quote conversation migrated onto the booking thread
    s, msgs = call("GET", f"/messages/{booking_id}", ctok)
    check("booking messages readable", s == 200, str(s))
    check("quote chat migrated to booking thread",
          any(f"smoke-{stamp}" in (m.get("content") or "") for m in msgs.get("items", [])))

    s, threads = call("GET", "/messages/threads", ctok)
    check("threads include the booking",
          any(t.get("thread_type") == "booking" and t.get("id") == booking_id
              for t in threads.get("items", [])))

    # 8b. Date handshake — client proposes times, business accepts one
    #     (two-sided handshake: the proposer can never confirm their own times)
    prop_iso = "2026-08-01T10:00:00"
    s, _ = call("PATCH", f"/bookings/{booking_id}/propose-dates", ctok,
                {"proposed_date_1": prop_iso})
    check("client proposes times", s == 200, str(s))

    s, res = call("PATCH", f"/bookings/{booking_id}/confirm-date", ctok,
                  {"confirmed_date": prop_iso})
    check("proposer blocked from self-confirm (403)", s == 403, str(s))

    s, res = call("PATCH", f"/bookings/{booking_id}/confirm-date", btok,
                  {"confirmed_date": prop_iso})
    check("business accepts proposed time", s == 200, str(s))
    check("booking in_progress after handshake",
          (res.get("booking") or {}).get("status") == "in_progress",
          str((res.get("booking") or {}).get("status")))

    s, ev = call("GET", f"/bookings/{booking_id}/events", ctok)
    ev_types = [e.get("event_type") for e in ev.get("items", [])]
    check("timeline has dates_proposed + date_confirmed",
          "dates_proposed" in ev_types and "date_confirmed" in ev_types,
          str(ev_types))

    # 9. Business advances: en_route event, then complete (releases escrow)
    s, _ = call("POST", f"/bookings/{booking_id}/events", btok, {"event_type": "en_route"})
    check("business posts en_route event", s == 200, str(s))

    s, _ = call("PATCH", f"/bookings/{booking_id}/complete", btok, {})
    check("complete booking (escrow release)", s == 200, str(s))

    s, pay = call("GET", f"/payments/{booking_id}", ctok)
    check("payment fully_released", pay.get("status") == "fully_released",
          str(pay.get("status")))

    return finish()


def finish():
    print("\nRESULT:", "ALL PASS" if not failures else f"{len(failures)} FAILURE(S): " + ", ".join(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
