# Shoot script — recording the real app for reels

Everything Kira types on camera, written out. Nothing here is invented: every
business, neighbourhood and trade is in `backend/scripts/demo_dataset.py`, and
every line a viewer will read is claim-checked against FACTS.md.

**Sign in as the demo cast, never a personal account.** Password for all of
them: set via `DEMO_SEED_PASSWORD` in `backend/.env` (gitignored — ask, do not
commit it here).

| Role | Account | Business |
|---|---|---|
| Client | `nadia-whitfield@demo.swingbyy.com` | — |
| Plumber | `priya-raghunathan@demo.swingbyy.com` | Kensington Tap & Drain |
| Plumber (alt) | `rasheed-malik@demo.swingbyy.com` | Renfrew Rooter Plumbing |
| Snow | `grant-whitlock@demo.swingbyy.com` | Hillhurst Snow & Ice |
| Lawn | `marisol-vega@demo.swingbyy.com` | Bow Ridge Lawn & Yard |

## Before you hit record

- **Do Not Disturb on.** A notification banner mid-take kills the clip, and the
  status bar is in frame for the whole recording.
- **Battery above 40%.** A red battery icon reads as "abandoned side project".
- Full screen brightness, and turn the keyboard's predictive bar off if it
  shows personal words.
- Record the whole flow in ONE take per scenario. Trimming inside Remotion is
  free (`startFrom`); re-shooting is not.
- Move deliberately and pause ~1s on each screen before tapping. The camera
  needs a beat to read a screen that you already know by heart.

---

## Scenario 1 — Plumbing. "Fix my sink."

The flagship. It maps to the reel's existing beats exactly, so the footage drops
straight into `cinematic-glide`.

**Post the job** (as Nadia)

| Step | Field | Type exactly |
|---|---|---|
| CATEGORY | Category | **Plumbing** |
| DETAILS | Title | `Kitchen sink won't drain` |
| DETAILS | Description | `Water backs up in the kitchen sink and drains very slowly. Tried a plunger and drain cleaner, no change. Under-sink pipes look dry, no visible leak.` |
| DETAILS | Date | any weekday this week |
| BUDGET | Budget | `150` |
| CONFIRM | — | review, then post |

Why this description: it is specific, it is a real symptom, and it says what has
already been tried — which is what makes a tradesperson able to quote without
calling. It also gives the pre-acceptance privacy beat something to mask.

**Send the quote** (switch to Priya — Kensington Tap & Drain)

- Quote: `165`
- Message: `Can come by tomorrow afternoon. Likely a blocked P-trap — I'll clear it and check the line while I'm under there.`

**Back to Nadia:** accept the quote, then open the booking so the
Confirmed → On the way → In progress → Done stepper is on screen. Pause on it —
that is the `status` caption's shot.

> **Do not narrate money.** No "held", "released", "escrow", "half now". The reel
> deliberately makes no payment claim (FACTS §2.5 freeze). Show the screens; the
> captions carry the meaning.

---

## Scenario 2 — Snow removal. "Before the next dump."

**Category is `Landscaping`** — snow removal is not its own category in the app.
Post as Nadia:

| Field | Type exactly |
|---|---|
| Category | **Landscaping** |
| Title | `Driveway and walk cleared after snowfall` |
| Description | `Double driveway plus the front walk and steps. Looking for someone who can come the morning after a heavy snowfall. Corner lot, so there's a city sidewalk along the side too.` |
| Budget | `90` |

**Quote** (as Grant — Hillhurst Snow & Ice): `85` —
`I do that block already. Can add you to the morning route after a big one.`

That "I do that block already" is the local-density story told without claiming
a supply number, which FACTS §4 bans.

---

## Scenario 3 — Landscaping. "Lawn, every two weeks."

| Field | Type exactly |
|---|---|
| Category | **Landscaping** |
| Title | `Lawn cut every two weeks` |
| Description | `Small back yard and a strip out front. Grass is getting away from me. Looking for a regular cut through the summer rather than a one-off.` |
| Budget | `60` |

**Quote** (as Marisol — Bow Ridge Lawn & Yard): `55` —
`Happy to put you on the bi-weekly route. Two-person crew, in and out in about half an hour.`

> **Recurring work is a story the app does not yet automate.** There is no
> scheduler (FACTS §2.1) — do not imply the app books the repeat visits for you.
> The client and business arrange it; the app is where they meet.

---

## Screens worth capturing beyond the flows

The three anchors `collect-screens.mjs` asks for:

1. **Client Home** — the feed with local jobs.
2. **Active Booking** — the live status stepper. The single best screen we have.
3. **Business Dashboard** — the other side of the marketplace.

## Screens to AVOID on camera

- **Terms, Privacy, Help/FAQ, Payment Method** — fixed on main as of #202/#203,
  but re-check the build you are recording actually contains those commits.
- Anything showing **ratings, review counts, or "N pros near you"** — seeded
  numbers, and FACTS §4 bans quoting them as traction. They may sit in a
  screenshot; they must never be the subject of a shot.
- **Business payouts / Wallet.** Payments run in sandbox (§5). No money has moved.

## After the shoot

```powershell
powershell -File scripts/pull-iphone.ps1 -List
powershell -File scripts/pull-iphone.ps1 -Name IMG_XXXX.MOV -Dest .\ingest
```

Move the clip you picked into `public/screens/`, then:

```bash
npm run collect          # hashes it, refuses duplicates, updates the manifest
npm run studio           # retime the beat around the new footage
```

Point the beat at it in `src/timeline.ts`:

```ts
{...BEAT.confirm(), screen: 'active-booking.mov', startFrom: 2.5}
```
