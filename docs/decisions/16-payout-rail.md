# Decision 16 — Payout rail (Domino D8.2)

> STRATEGY lane, 2026-07-23. Analysis + one recommendation. No product code changed.
> Grounds every claim in the escrow code as it exists at `main` (a083f7b).

## Recommendation

**Stay on manual Interac e-Transfer payouts for the beta. Do NOT wire Stripe Connect yet.**
Switch to Connect (Express accounts, destination charges) when **either** threshold is
crossed, whichever comes first:

- **25 businesses with at least one completed on-platform booking**, OR
- **~40 payouts/month** going out by hand (roughly the point where manual reconciliation
  costs more than an hour a week), OR
- the day you turn on **card-based client payment for real money** at any volume — because
  once Stripe is holding real client funds, keeping payouts manual means you are personally
  moving money out of the platform account by hand and eating 100% of chargeback risk with
  no structured recourse.

Today SwingBy is at **18 businesses, 24 completed bookings, ~$4,585 released** — all demo/seed
data, none of it real money. There is no live payout obligation yet. Building Connect this
week spends days of engineering and adds a KYC wall in front of every business signup to solve
a problem you do not have on Saturday.

## What the escrow code actually assumes today

Verified in `backend/app/services/escrow.py` and `backend/app/api/payments*.py`:

- The ledger is a **single `payments` row per booking** with a status machine:
  `pending_payment → held → fully_released` (plus `paid_off_platform`, `refunded`, `failed`).
  See `escrow.py` `HELD_NOT_RELEASED` / `RELEASED_OR_SETTLED`.
- `released_to_business` is **a number in a database column, not a money movement.**
  `release_escrow_on_complete()` sets `status='fully_released'`, `escrow_held=0`, stamps
  `released_at` — and that is the entire "payout." **No money leaves any account.** There is
  no Stripe Transfer, no `destination`, no `application_fee` anywhere in the backend
  (grepped: zero hits for `connect`, `transfer`, `payout`, `destination`, `application_fee`).
- Client-side money-in is **Stripe Checkout one-off sessions** only
  (`stripe_service.create_checkout_session`, `mode: "payment"`, `currency: "cad"`), plus a
  fully-built **off-platform path** (`payments_offplatform.py`) where the business collects
  cash/e-transfer directly and marks it paid — no platform cut taken on that path.
- Refunds exist as `stripe_service.refund_payment_intent()` and admin dispute resolution
  (`disputes.py` `refund_amount`), but there is **no** business-directed payout primitive.

**Implication:** "released to business" is a promise the platform records but does not yet
keep automatically. Someone has to actually send the 90% to the business. Right now that
someone is a human. That is fine at 24 bookings; it is the thing Connect eventually replaces.

## Rework cost of each option

**Manual e-Transfer (recommended for beta) — ~0 new engineering.**
The rails already exist. `GET /payments/mine` already exposes `released_to_business` and
status per booking. The only additions worth making are operational, not architectural:
1. An admin view that lists `fully_released` payments not yet marked paid-out, with the
   business's payout email. (Backend already has `/admin/*`; this is one query + one column.)
2. A nullable `paid_out_at` / `payout_reference` on `payments` so a human can mark "e-transfer
   sent, ref #xxxx." One migration, must ship with the code that reads it (per the standing
   migrations rule).
3. Collect a **payout e-transfer email** on business signup (a single text field; today the
   `businesses` table has no payout destination at all — confirmed against `BusinessCreate`).

Interac business-account limits are $10k–$25k per transfer and $0–$1.50 per send at the big
banks — irrelevant friction at beta volume. You e-transfer each business their weekly total.

**Stripe Connect (the eventual answer) — multi-day build + a signup KYC wall.**
- **Account type: Express.** Standard makes the *business* the merchant of record and hands
  them the full Stripe dashboard — wrong for a marketplace that wants to own the client
  relationship and the dispute flow. Custom is more onboarding surface than a solo Calgary
  cleaner needs. Express is the standard marketplace choice: Stripe-hosted onboarding, Stripe
  handles the business's identity/tax collection, you keep control of the payment.
- **Real CAD fee structure (verified 2026):** card processing stays **2.9% + C$0.30**
  domestic. Connect Express/Custom adds **C$2 per active account per month** (only months an
  account is paid) **+ 0.25% + C$0.25 per payout** on top, when you use the "platform handles
  pricing" model. So on a $200 job: ~$6.10 processing + ~$0.75 payout fee + the $2/mo/active
  account. At 25 active businesses that is $50/mo in account fees alone before a single
  transaction — a **recurring subscription cost**, which is exactly what Kira's standing rule
  says to avoid until there is revenue to cover it.
- **Merchant of record / liability:** with **destination charges** (the natural fit for this
  escrow model), **the platform is the merchant of record** and Stripe debits disputes,
  refunds and fees **from the platform account**. You own chargeback liability. With direct
  charges the connected account owns it, but direct charges don't fit "platform holds escrow
  then releases." So Connect does not offload chargeback risk here — it structures it.
- **KYC/onboarding friction:** every business must complete Stripe Express identity
  verification (legal name, DOB, SIN or business number, bank account) **before they can be
  paid.** For a solo Calgary cleaner or a two-person landscaping crew this is a real drop-off
  point mid-signup. In a beta where the whole game is getting the first 25 businesses to say
  yes (see Decision 33), a bank-details wall on day one is an own-goal.
- **Rework:** new `stripe_connect` onboarding endpoints + webhook handling for
  `account.updated`, a `connect_account_id` + payout-status field on `businesses`, the mobile
  "Payout account — Connected" UI (flagged but unbuilt, see Decision 34 / spec #10 & #27
  "Withdraw" CTA), and swapping the release step from a DB write to a real Transfer. Several
  days, and it touches the money path — which is the one path with a mandatory smoke gate.

## Tax / CRA obligations (both options — this is not deferrable, but it is not blocking)

- **GST/HST on the platform fee:** SwingBy's own 10% cut is a taxable supply. Once SwingBy's
  revenue crosses **$30,000 CAD in 12 months**, SwingBy must register and charge 5% GST
  (Alberta) on its fee. Not there yet; flag for the accountant, not for this week.
- **Marketplace "deemed supplier" GST/HST rules do NOT apply here.** Those rules target
  *goods* fulfilled from Canadian warehouses and short-term accommodation. In-person local
  services fall outside the deemed-supplier regime — **each business remains responsible for
  charging/remitting GST on their own service.** SwingBy is a facilitator, not the supplier of
  the cleaning. Do not build GST collection on the service amount into the platform; you'd be
  collecting tax you have no obligation to remit and creating a liability.
- **CRA Part XX — Reporting Rules for Digital Platform Operators (this one bites eventually):**
  a platform that facilitates "relevant services" and connects sellers to customers is a
  *reporting platform operator*. Once businesses are transacting for real, SwingBy must, by
  **January 31 each year (for the prior calendar year)**, collect each reportable seller's
  legal name, address, and tax ID, and file an information return of amounts paid to them.
  This obligation exists **regardless of which payout rail you pick** — manual e-transfer does
  not exempt you. The practical consequence: whatever rail, **capture each business's legal
  name + address + business/GST number at onboarding.** Stripe Connect collects this for you
  as a side effect of KYC (a genuine point in Connect's favour later); with manual payouts you
  must collect it yourself. This is the strongest reason the switch is a *when*, not an *if*.

## One-line answer for the phone

Manual e-transfer now (zero build, no signup friction, no recurring fees); switch to Stripe
Connect **Express** at 25 paying businesses / ~40 payouts a month / the moment real card money
starts flowing — and capture every business's legal name + tax number at signup today so the
CRA Part XX return is possible whichever rail you're on.
