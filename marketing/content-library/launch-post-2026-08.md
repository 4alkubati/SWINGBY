# Launch posts — August 2026

**Two posts, one publish.** `tools/social_post.py` reads this file and sends the
same message to every configured platform in one command.

> **Every factual claim below was checked against the code on 2026-07-31**, not
> against older marketing copy. That matters here: `instagram-week-1.md` Day 2
> still described a staged payment split, which is not
> true and never was — the staged 50/50 release was removed (or never existed;
> `escrow.py:12` calls `partial_released` a legacy state). A claim like that in a
> post is the same defect that had to be pulled from the store listing on
> 2026-07-29.
>
> **What is true today:**
> - Posting a job is **free** and charges nothing. (`api/service_posts.py` —
>   charge-at-post is wired but gated OFF and cannot capture in this schema.)
> - The client pays **when they accept a quote** (`mobile/src/services/acceptAndPay.js`).
> - The money is **held** until the client approves the finished work, or 24h
>   after the business marks it done (`services/approvals.py`).
> - SwingBy keeps **10%** (`escrow.PLATFORM_RATE`).
> - Cancel more than 48h before the date: **full refund** (`escrow.compute_cancellation_split`).
> - Calgary only, for now.
>
> Do not write "vetted" without qualification either — `license_status` is
> verified **manually** by us and is not a background check.

---

## POST 1 — Launch (use this one first)

**id:** `launch-2026-08-01`

### Long form (Instagram, Facebook, LinkedIn)

```
SwingBy is live in Calgary.

Post what you need done — cleaning, handyman, lawn care, dog walking — and local
businesses send you real quotes. You pick one. You pay when you accept, not
before, and the money stays held until you say the work is done.

Free to post. Calgary only, for now.
```

**Hashtags (IG/FB):** `#SwingBy #YYC #Calgary #LocalServices #HireLocal #CalgaryBusiness #HomeServices`

### Short form (X, 280 chars)

```
SwingBy is live in Calgary.

Post a job. Local businesses quote you. You pay when you accept — and the money
stays held until you say the work is done.

Free to post.
```

### Image

`image_url` in the config. If none is set the script posts text-only where the
platform allows it and **skips Instagram**, which cannot accept a caption with
no media. It says so rather than reporting success.

---

## POST 2 — For businesses (schedule 48h after Post 1)

**id:** `launch-2026-08-03`

### Long form

```
Calgary trades: your next job is already posted.

People in your area are posting work on SwingBy right now — cleaning, repairs,
yard work. You see the job, you send your price, they pick. No cold calls, no ad
spend, no lead fees.

You get paid through the app when the client signs off. SwingBy takes 10%.
```

**Hashtags:** `#CalgaryBusiness #YYCBusiness #CalgaryContractor #SmallBusiness #SwingBy #Trades`

### Short form (X)

```
Calgary trades: your next job is already posted.

See the work, send your price, get picked. No cold calls, no lead fees. Paid
through the app when the client signs off. SwingBy takes 10%.
```

---

## Before either goes out

1. The handles must exist — **`swingbyy`** (`@swingbyapp` is taken by three
   other companies). HUMAN-TODO H14/H15.
2. "Link in bio" needs a link that works. `swingbyy.com` is still the frozen
   pre-launch site; the app is not on the App Store yet. Until one of those is
   true, **do not** write "download the app" — say "join the waitlist" and point
   at the waitlist form, or hold the posts.
