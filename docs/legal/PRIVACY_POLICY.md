# SwingBy — Privacy Policy (POINTER, NOT THE POLICY)

> **This file is not the privacy policy.** It used to hold a second, separately
> maintained copy dated 28 May 2026. That copy has been retired because two
> canonical policies cannot both be true, and they had already diverged on
> retention (7 years vs 6), on subprocessors, on the deletion model, and on the
> minimum age.

## The canonical privacy policy lives at

**[`privacy-and-security/privacy-policy.md`](../../privacy-and-security/privacy-policy.md)**

Edit that file. Do not re-add policy text here.

## Why `privacy-and-security/` won

- It is the fuller legal programme: the policy sits next to the PIPEDA
  compliance checklist, the subprocessor register, the DPA template, the data
  handling SOP, the incident-response runbook, and the cookie policy. Those
  documents cross-link into the policy and would break if the policy lived
  elsewhere.
- Its terms-of-service sibling was the only document whose cancellation ladder
  already matched the shipped `backend/app/services/escrow.py`.
- The open compliance register (`privacy-and-security/COMPLIANCE-REGISTER.md`)
  already tracks it as the document of record.

## What was carried over from the retired copy

Nothing was silently dropped. The following material only existed in this file
and has been merged into the canonical policy:

| Content in the retired copy | Where it went |
|---|---|
| Render as an API-hosting subprocessor (US) | canonical §6 and §12.2 |
| Expo push-token delivery as a subprocessor | canonical §6 |
| Cloudflare as a subprocessor | canonical §6 |
| Notion (waitlist) as a subprocessor | canonical §6 |
| Audit-log retention (24 months) | canonical §7 retention table |
| What a business can see on an open job post | canonical §6, corrected — the address is now masked to locality and the client's last name is withheld until acceptance |
| Explicit PIPEDA / Alberta PIPA framing | canonical §12.1 |

Claims in the retired copy that were **false against the code on `main`** were
not carried over: hard deletion within 30 days (the product does a soft delete
with PII scrub), a 7-year payment retention period (the CRA rule is 6 years from
the end of the tax year), and businesses seeing the client's full name and
street address before acceptance (masked since CARD-23).

## Other surfaces that render this policy

These are *derived* — they must be regenerated from the canonical text, never
edited independently:

| Surface | Status |
|---|---|
| `mobile/src/screens/profile/PrivacyPolicyScreen.js` | short in-app summary that links out to the canonical policy |
| `web/launch/src/pages/PrivacyPage.jsx` | web summary + link; **not currently deployed** |
| `web/pre-launch/src/pages/PrivacyPage.jsx` | **this is what swingbyy.com/privacy actually serves, and it is dated "May 2025"** — see `COMPLIANCE-REGISTER.md` section H |
| App Store / Play Store privacy disclosures | must match the canonical policy |
