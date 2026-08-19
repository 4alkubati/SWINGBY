# Phone retest — 2026-08-19

Build under test: _______________   ledger @ `140ed84`

Walk the app once. For each check write **PASS** (behaves correctly) or
**FAIL** (still wrong), and for a FAIL add one line on what you actually saw.
Photograph anything that fails into `~/brain/inbox/debugging/`.

---

## A. Confirm the fixes actually landed (2)

These are marked fixed in code but **not yet confirmed on a device**.
A FAIL here is the most valuable result in the sheet — it means a fix
did not survive the trip to the phone, which has now happened once.

### SB-0007 — Business dashboard renders hardcoded English literals in every locale

- **do** Open the business Dashboard with the language badge reading EN. Section headers render as 'НАСТУПНА РОБОТА', 'Немає запланованих робіт', 'переказано вам', 'ГРОШІ В РУСІ', 'На депонуванні', 'Переказано', while 'Good evening', 'THIS WEEK', 'TODAY', 'RATING' and the tab bar stay English.
- **PASS if** 17 new dashboard.* keys translated into en/fr-CA/ar/uk, and every literal call site routed through i18n.t()
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0008 — Language badge reads EN while Ukrainian is the checked selection

- **do** Settings -> Language. Set Ukrainian, back out to Settings, read the chip on the Language row. Then set Arabic and read it again. Then English.
- **PASS if** the chip reads UK for Ukrainian, AR for Arabic, EN for English, FR for French — always matching the checkmark in the sheet, and still matching after force-quitting and relaunching the app
- [ ] PASS  [ ] FAIL → what you saw: ______________________

---

## B. Does it still reproduce? (8)

### BROKEN

**SB-0001 — Quote thread header says 'pending payment' while the accepted card below it says 'paid'**

- **do** Client accepts a quote and pays. Open the message thread with the business. The booking summary card at the top of the thread reads 'pending payment - $180' while the system card directly beneath it reads 'Accepted - $180 paid'.
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0003 — Business setup trades do not populate 'Services & pricing' — a categorised business shows 'No services listed yet'**

- **do** Business completed onboarding with category 'Moving'. My Business -> SERVICES & PRICING shows 'No services listed yet' with the subtitle 'The trades you picked during setup show here.'
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0005 — Owner's own review renders on the business public profile as a Swingbyy review**

- **do** View Amr's Moving Company public profile. Under SWINGBYY REVIEWS a 5-star review by 'Amr' reading 'Really loved their services.' is shown, and the business owner is also named Amr (TEAM shows 'Amr - Owner'). Rating reads 5.0 from 1 review.
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0006 — 'Propose a time' CTA shown for bookings whose date is already confirmed**

- **do** Business -> Jobs -> Needs action. Two bookings from the same client both show a 'Propose a time' pill, though the client-side thread for that booking (Img1) shows the booking as CONFIRMED with a date of Sun, Aug 9, 11:36 PM.
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0009 — A booking reaches 'Job complete' with zero proof-of-work photos**

- **do** Booking Details for a completed booking: the timeline shows Date confirmed -> On the way -> Pro arrived -> Job started -> Job complete, while the Proof of work section reads 'No photos yet', 'No before photos yet', 'No after photos yet'.
- [ ] still broken  [ ] looks fixed now  → note: ______________

### SLOPPY

**SB-0002 — Business profile-completeness hint is truncated mid-sentence with no way to read it**

- **do** Log in as a business, open My Business. The completeness card reads '80% - Add a description t...' and clips. The remaining instruction is unreachable.
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0004 — Public-profile preview shows a back arrow underneath the 'Done' preview banner — two conflicting exits**

- **do** My Business -> Preview public. The purple 'Previewing your public profile / Done' banner appears, and a normal screen back arrow renders directly below it.
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0010 — Booking timeline logs 'Date confirmed' four hours before the events it precedes, with a posting time in the future**

- **do** Booking Details timeline reads 'Date confirmed / Time set at posting: Sun, Aug 16, 10:13 PM / Logged 1:19 AM', then On the way 1:21 AM, Pro arrived 1:21 AM, Job started 1:27 AM, Job complete 1:28 AM.
- [ ] still broken  [ ] looks fixed now  → note: ______________

---

## C. Anything else

Screens where something looked wrong that is not listed above. Name the
screen and what you expected — a screenshot into
`~/brain/inbox/debugging/` is enough.

1. ______________________________________________
2. ______________________________________________
3. ______________________________________________

---

## Feeding results back

```
# still broken
python tools/bugctl.py verified SB-0003 --result still-broken --note "<what you saw>"
# no longer reproduces
python tools/bugctl.py verified SB-0003 --result gone --note "confirmed on <build>"
# a fix survived to the device
python tools/bugctl.py note SB-0008 "device-confirmed on <build>"
```

