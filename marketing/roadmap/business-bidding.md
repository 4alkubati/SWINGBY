---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# Roadmap: Business Bidding Marketplace (eBay-Style)

> Status: Planned — post-MVP  
> Owner: TBD  
> Dependencies: current Interests system, payment escrow

---

## Vision

For large or complex jobs (renovations, commercial contracts, recurring services), clients post a job with a maximum budget and set an **auction window** (e.g., 48 hours). Businesses submit competitive bids. At window close, the client picks the winner — or a reserve-price auto-accept fires.

This replaces the current "interest → quote → accept" flow with a transparent marketplace dynamic that drives better prices for clients and qualified leads for businesses.

---

## Use Cases

| # | Scenario |
|---|---|
| 1 | Homeowner needs a basement renovation. Posts with $25,000 max, 5-day auction. 8 contractors bid; winner is chosen based on price + rating. |
| 2 | Property manager needs recurring cleaning for 10 units. Posts monthly contract with reserve price. Auction auto-accepts first bid at or below $400/month. |
| 3 | Client is in a hurry. Posts with "Buy Now" price at $300 — first business to accept locks the booking immediately. |
| 4 | Business sets a minimum job value threshold. Bids below $50 never appear in their feed. |

---

## Mechanics

### Auction Window

- Client sets `bid_deadline` when posting (1 hour → 7 days).
- After deadline: client sees ranked bids (price, rating, reviews). Accepts one.
- Optional: `reserve_price` — if any bid hits it before deadline, auto-accept fires and booking is created immediately.
- Optional: `buy_now_price` — instant close, no auction needed.

### Bid Notifications

- All bidding businesses notified 1 hour before auction closes ("You're in 2nd place — last chance to rebid").
- Client notified when first bid comes in and when auction closes.
- Outbid notification to losing businesses (so they can pursue other jobs).

### Bid History

- Full bid history visible to client (business names hidden until accepted, to prevent collusion).
- After close: winning business sees all losing bids (transparency for market research). Losing businesses see only their own rank.

---

## Risks

### Race Conditions

- Two businesses submit identical bids simultaneously. Resolve: first-write-wins (Postgres `INSERT … ON CONFLICT` with timestamp tiebreaker).
- Client accepts a bid while a new lower bid is being submitted. Resolve: lock booking row on accept, reject any concurrent bids with "auction closed" response.

### Gaming

- Businesses place a high bid to "claim" the job, then renegotiate offline. Mitigate: escrow deposit required on bidding (refunded if outbid).
- Shill bidding (business creates client accounts to drive up apparent demand). Mitigate: phone-verified accounts required to bid; IP rate limiting.
- Bid sniping (submitting a winning bid 1 second before close). Mitigate: if a bid arrives in the last 5 minutes, extend auction by 5 minutes (eBay's "overtime" pattern).

### Pricing Pressure

- Race to the bottom devalues quality work. Mitigate: prominently display rating + reviews alongside bid price; offer "Best Value" badge (not just lowest price).

---

## Database Changes Needed

```sql
-- Add to service_posts
ALTER TABLE service_posts
  ADD COLUMN bid_deadline   TIMESTAMPTZ,
  ADD COLUMN reserve_price  NUMERIC(10,2),
  ADD COLUMN buy_now_price  NUMERIC(10,2),
  ADD COLUMN auction_mode   BOOLEAN DEFAULT false;

-- Extend interests table for bid tracking
ALTER TABLE interests
  ADD COLUMN rebid_count  INT DEFAULT 0,
  ADD COLUMN bid_rank     INT;  -- computed on close
```

---

## MVP Scope for Bidding

1. `auction_mode` flag on service_posts (client opts in at post time).
2. `bid_deadline` stored and enforced server-side.
3. Bid list sorted by price ascending; client picks winner manually.
4. Outbid push notification to losing businesses on auction close.
5. No reserve price, no buy-now, no overtime extension at MVP.

---

## Open Questions

- Should businesses see each other's prices in real time (live auction) or only on close (sealed bid)?
- Do we charge a listing fee for auction posts to reduce spam?
- How does bidding interact with the current "express interest" flow for small jobs?

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
