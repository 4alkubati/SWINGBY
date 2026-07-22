---
group: plan
project: swingby
hub: "[[MOC-Plan]]"
tags: [plan]
---
# D4 Tester Brief — hand this to your tester

> Supports [[D4-friend-tester]]. DRAFT — Kira fills `{{EXPO_LINK}}` and sends himself. ~10 min of their time.

---

## What is SwingBy

SwingBy is a local app for finding and booking trusted trades and services in Calgary — think "post what you need, get real quotes, watch the job happen live." No haggling, no guessing if the work actually got done.

## The frame (say this before they touch the phone)

> "This is alpha — it's rough in places. Tell me *everything* that confuses you, even small stuff. Bugs are valuable to me, not embarrassing. You can't do this wrong."

## How to get in

1. Install **Expo Go** from the App Store / Google Play (free).
2. Open this link or scan this QR with Expo Go: {{EXPO_LINK}}
3. It'll load the SwingBy beta build directly — no separate app-store download needed.

## Which role you're playing

Pick based on who they are — a client walkthrough works for anyone; the business path is better if they're a real tradesperson.

### Path A — Client (post a job)
1. Sign up (email + password) — check for the branded welcome email.
2. Post a job: pick a category, write what you need, set a rough budget/address.
3. Wait for / view a business's quote (interest) on your post.
4. Accept the quote → this creates a booking.
5. Send a message to the business in-app.
6. Watch **Live Job Status** update (Arrived → Started → Completed) as the business taps through it on their end.
7. Mark the job complete, leave a review.
8. Check the receipt/payment screen.

### Path B — Business (deliver a job)
1. Sign up as a business (email + password), fill basic business info.
2. Receive a client's job post → express interest with a quote.
3. Client accepts → booking is created.
4. Tap through **Live Job Status**: Arrived → Started → Completed.
5. Confirm payment shows as received.

## Payment — nothing real happens

Payment runs in **Stripe test mode**. When asked for a card, use:

- Card number: `4242 4242 4242 4242`
- Expiry: any future date (e.g. 12/30)
- CVC: any 3 digits

No real money moves. This is safe to use exactly like a real card in the flow.

## Time expectation

About **10 minutes** end to end. If they get stuck or bored before that — that's exactly the kind of signal worth capturing. Don't rush them past confusion.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Plan]] · **Home:** [[SWINGBY]]

**Related:** [[D4-friend-tester]]
<!-- graph-wire:end -->
