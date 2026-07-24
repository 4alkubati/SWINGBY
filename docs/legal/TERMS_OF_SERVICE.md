# SwingBy — Terms of Service (POINTER, NOT THE TERMS)

> **This file is not the terms of service.** It used to hold a second,
> separately maintained copy dated 28 May 2026 that contradicted the other one
> on payment timing, on the cancellation ladder, on the liability cap, on the
> minimum age, and on dispute resolution. Two sets of terms cannot both bind a
> user.

## The canonical terms of service live at

**[`privacy-and-security/terms-of-service.md`](../../privacy-and-security/terms-of-service.md)**

Edit that file. Do not re-add contract text here.

## What the retired copy got wrong

Verified against the code on `main` (`backend/app/services/escrow.py`,
`backend/app/api/bookings.py`, `backend/app/api/interests.py`):

| Retired copy said | Reality |
|---|---|
| §4.2 "50% released to business on booking confirmation, 50% on completion" | Nothing is released before completion. The full amount is charged up front and held; 100% less the 10% fee is released on completion. |
| §4.3 client-cancel penalties 25% / 50% / 100% | The shipped ladder is a *refund* ladder: 100% / 75% / 50% refund to the client at >48h / ≤48h / after the confirmed time. |
| §1 minimum age 16 | 18, in the canonical terms and in the app. |
| §10 liability cap: greater of $100 or 12 months of fees | The canonical cap is the greater of $100 or 6 months of fees. |
| §7 disputes resolved "within 5 business days" with SwingBy's decision final | Kept, but reworded — there is no dispute SLA enforced in code, and the canonical terms now say "aims to respond within 5 business days" and that the determination is not arbitration. |
| §3.3 "Businesses send quotes (price only — no message attached)" | Accurate, and carried over into the canonical §5 flow description. |

## What was carried over

- The plain-language marketplace framing ("what we are / what we are not").
- The acceptable-use list, including the Canadian-licensing examples.
- The Alberta *Consumer Protection Act* carve-out on the liability cap.
- The explicit note that a "verified" badge is a one-time manual licence check
  and is not continuously monitored.
