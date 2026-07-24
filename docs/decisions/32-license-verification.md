# Decision 32 — License verification (GAP-AUDIT #27/#50)

> STRATEGY lane, 2026-07-23. Analysis + one recommendation. No product code changed.

## Recommendation

**Do three things, in this order of honesty:**

1. **Rename the badge.** What the app calls "Verified" today is verified against **nothing** —
   `businesses.license_number` is a free-text field a business types into, and `license_status`
   is a manual flag an admin flips. There is no admin UI to flip it (grepped `admin.py`: no
   license endpoint) and **zero of the 18 seeded businesses have a `license_number` at all**
   (verified in the DB) yet 16 are marked `verified`. **A client-facing "Verified" badge on a
   number nobody checked is a liability, not a feature** — it is a representation you can't
   defend if a badged business damages a client's home. Until a real check exists, the badge
   must say **"Licence on file"** or **"ID submitted"**, never "Verified."

2. **Tier the real checks** by what has a lookup vs. what needs eyeballs (below). Verify the
   two cheap machine-checkable things at signup; verify the expensive human-checkable things
   only for the categories and the moment where they matter (property work, at first booking).

3. **Make the badge claim exactly what was checked** — a three-state badge, not a binary one.

## What actually needs verifying in Alberta, and whether a lookup exists

The seeded categories are Cleaning, Landscaping, Handyman, Painting, Plumbing, Electrical,
Moving, Carpentry (verified in DB). These split cleanly into "no provincial trade licence
required" (cleaning, landscaping, handyman, painting, moving, carpentry) and "regulated trade"
(plumbing, electrical). That split drives everything below.

| What | Why it matters | Real lookup? | Verdict |
|---|---|---|---|
| **City of Calgary business licence** | Legally required to operate a business in Calgary. | **YES — free open API.** `data.calgary.ca` Socrata dataset `vdjc-pybd` (~21.6k licences), queryable by trade name, with `licencetypes`, `jobstatusdesc` (e.g. "Renewal Licensed"), address, expiry. Most trades here map to `CONTRACTOR (NO PROVINCIAL LICENCE REQUIRED)` (1,120 records) or `CONTRACTOR` (661). | **Automate at signup.** Fuzzy-match business name + address against the dataset; store the matched `getbusid`. This is the single highest-value automatable check. |
| **Alberta corporate registry / legal entity** | Confirms the business is a real registered entity, not a person inventing a company name. | **Partial.** No free public REST API. Verification runs through authorized registry agents; a name/NUANS search is **~$10–60 per lookup** and is human-initiated. | **Manual, and only for Tier-C established companies.** Not worth it for a solo operator who is legitimately a sole proprietor with no incorporation. |
| **Trade certification (plumber / electrician journeyperson)** | For regulated trades, working uncertified is illegal and dangerous — this is the one that can flood a basement or start a fire. | **YES — free public lookup.** Alberta `tradesecrets.alberta.ca` Tradesperson Lookup verifies a journeyperson/Red Seal certificate by **first name + last name + certificate/AIT ID**. No bulk API, but a per-person check is free and authoritative. | **Require at first booking for Plumbing + Electrical only.** Ask the operator for their cert number; check it by hand (or a light scripted call). Do not badge a plumber "qualified" without it. |
| **Liability insurance (property work)** | If a painter wrecks a floor or a landscaper hits a gas line, this is what makes the client whole. It is the actual substance behind a "trust" badge. | **NO API.** Proof is a certificate/COI PDF from the insurer. | **Human eyeballs, at first booking, for anyone doing on-property work.** Collect the COI, check the named insured matches, check it is in-date. Cannot be automated. |
| **WCB Alberta coverage** | Required if the business has employees; protects the worker (and the client from a worker-injury claim on their property). | **Partial.** WCB clearance letters are requestable via the free `myWCB` portal, but the *client/platform* requesting one for a contractor still needs to initiate it; there is no open bulk API. | **Human, at first booking, only for businesses with employees** (SwingBy already knows employee count from the `employees` table). A true solo operator has no WCB obligation — don't demand it. |

## Tiered approach — what gets checked when

**At signup (automated, cheap, gates the account):**
- City of Calgary business licence lookup (open API) → sets a real, defensible sub-state.
- If no match: account still allowed, but badge stays at the lowest tier. Do not block signup
  on a fuzzy-match miss — names differ from legal names constantly.

**At first booking (human, category-gated, gates the "Verified" tier):**
- Plumbing/Electrical → trade certificate number checked on Tradesecrets.
- Any on-property category → liability insurance COI collected and eyeballed.
- Has employees → WCB clearance requested.
- This is deliberately lazy: you only pay the human-review cost for a business a real client is
  actually about to hire, not for every speculative signup. It scales with revenue, not with
  the signup funnel.

**Never (do not pretend to verify):**
- The typed `license_number` string on its own. It backs nothing.
- Corporate registry for sole proprietors.

## What the badge is honestly allowed to say

Replace the binary verified/not-verified with three explicit states, and make the copy match
the check that was actually run:

| Badge | Precondition | Honest claim |
|---|---|---|
| *(no badge)* | Nothing checked | — |
| **"Calgary licensed"** | Matched an active City of Calgary business licence via the open dataset | "We found this business on the City of Calgary licence registry." True and defensible. |
| **"Verified by SwingBy"** | Licence match **+** the category-appropriate human check passed (trade cert / insurance / WCB) | "We checked their credentials for this kind of work." This is the only state that earns the word *verified*, and only after a person looked. |

The web pricing page already sells a **"Verified Business badge — $99/year: Manual license,
insurance, and reference verification"** (`web/launch/src/pages/Pricing.jsx`). That copy is
honest *if and only if* the human check above actually happens for badged businesses. Today it
doesn't, so either the check ships or the badge claim softens. Selling "$99 verified" while
flipping a flag on an unchecked typed number is the liability the task warned about, in writing,
with a price tag on it.

## Build cost

- Calgary licence lookup: one backend service hitting the Socrata endpoint + a
  `city_licence_matched` boolean/`getbusid` column on `businesses`. Small, high value, no
  recurring cost (open data is free).
- Admin verify UI: the GAP-AUDIT #27 "upload → admin toggle" — but the toggle must record
  *what* was verified (cert? insurance? WCB?) and *by whom/when*, or you're back to an
  unaccountable flag. One small table (`license_verifications`: business_id, check_type,
  verified_by, verified_at, note) is worth more than a wider badge.

## One-line answer for the phone

Stop calling a typed-in, unchecked number "Verified" (16 of 18 seeded businesses are badged
against nothing); auto-check the City of Calgary open licence API at signup ("Calgary
licensed"), and reserve the word "Verified" for businesses where a human actually checked the
trade cert (free Tradesecrets lookup for plumbers/electricians) and insurance/WCB — done lazily
at first booking, per category, so the cost scales with revenue not signups.
