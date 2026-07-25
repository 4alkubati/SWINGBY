# Payments & escrow — handoff

The missing piece referenced by `MESSAGES-AND-QUOTES.md` and `QUOTE-IN-CHAT.md`. Reference frames: section **2a "Two ways to pay"** in `SwingBy All Screens.dc.html`. Tokens in `README.md`, craft rules in `POLISH-TIPS.md`.

## The rule

Money is always taken **before** work is scheduled and always sits in escrow until the client approves the work. There are exactly two entry points, and both open **one shared pay sheet**.

| | Path A — post a job | Path B — book a company |
|---|---|---|
| Entry | Client taps **Post job & pay** on the review step | Client taps **Accept & pay** on a quote |
| Amount source | Client's own budget | The business's quote |
| Sheet title | "Hold payment" | "Pay quote" |
| Sheet CTA | "Confirm & hold $X" | "Confirm & pay $X" |
| After success | Job goes live to businesses | Quote becomes a booking, thread moves into Messages |

**The client-side service fee is added inside the sheet.** No button, note, or bubble before the sheet may quote a total — CTAs read "Post job & pay" and "Accept & pay" with no figure, and pre-sheet copy says "you'll see the total before confirming". This is the one rule that keeps the two paths from disagreeing about price.

## Files
| Piece | File |
|---|---|
| Shared pay sheet | `components/PaySheet.js` (new) |
| Path A entry + success | `client/PostJobScreen.js` |
| Path B entry | `messages/MessageThreadScreen.js` (quote card) |
| Card management | `profile/PaymentMethodScreen.js` (existing — reuse rows) |

## The pay sheet

Bottom sheet over a dimmed screen (`rgba(4,5,7,0.68)`). Panel: `#0F1115`, top border `#1F232B`, radius `24 24 0 0`, padding `12 20 32`, gap 16, shadow `0 -12px 40px rgba(0,0,0,0.5)`. Grab handle 38×4 `#1F232B`, centered.

1. **Title block** — title Space Grotesk 700 21px ls −0.5 ("Hold payment" / "Pay quote"); subtitle 13px `#8B92A0`: service · date.
2. **Breakdown card** — `#161A21`, radius 16, padding 14, gap 9. Rows 13.5px, label `#8B92A0` / value 500: "Job total", "Service fee". 1px `#1F232B` divider. Total row: "On hold today" 13.5px/600 + amount Space Grotesk 700 22px ls −0.5 `#2EBD85`. Tabular numerals on every amount.
3. **PAY WITH** — section label 10.5px/600/1.2px `#8B92A0`. Selected method card: `#0F1115`, radius 14, **1px `#6E56F7` border** (selection = accent border, not a checkmark), padding `13 14`, gap 12: 38×26 brand tile (`#161A21` + border, brand text Space Grotesk 700 10px) · "•••• 4242" 13.5px/600 over "Expires 08/28" 11.5px `#8B92A0` · "Change" 12.5px/600 `#8878F9`.
4. **Escrow caption** — lock icon 13px + 11.5px/18px `#8B92A0`: "Held in escrow — released only when you approve the work. Cancel free up to 24 h before."
5. **CTA** — full width, 52px, radius 12, solid `#6E56F7`, white 15.5px/600, text includes the total.

### States
- **Submitting** — CTA shows a spinner, label "Holding payment…", sheet not dismissable, backdrop taps ignored.
- **Card declined** — inline error above the CTA: 12.5px `#FF5C5C` on `rgba(255,92,92,0.14)` chip, radius 10, padding `9 12`; method card border turns `#FF5C5C`; CTA re-enables.
- **No card on file** — the method card becomes a dashed-border row "Add a payment method" (`#8878F9` text, plus icon) that pushes `PaymentMethodScreen`; CTA disabled at 40% opacity until one exists.
- **Amount changed under them** (quote edited while the sheet was open) — dismiss the sheet, toast "This quote changed — check the new total", reopen with fresh figures. Never charge a stale amount.

## Path A specifics

**Review step** (`PostJobScreen`, final step): summary card (Service / When / Where / Your budget — budget in green Space Grotesk 700), then an escrow explainer on `#161A21` radius 16: lock icon + "We place **your payment on hold** when you post — you'll see the total before confirming. Businesses only see paid jobs, and the money moves only when you approve the work." Sticky footer CTA "Post job & pay", 52px.

**Success screen:** purple radial glow behind the header (README §10a), 68px `rgba(46,189,133,0.14)` circle with a green check, "Job posted" 25px SG700 ls −0.8, then "**$189** is on hold. Nearby pros are being notified now." ($ amount green SG700 inline). Card beneath: "Payment on hold / Releases when you approve the work" row + divider + "Expect quotes within ~2 h". Secondary "View job" button.

Order of operations: **hold succeeds → job is created and made visible.** If the hold fails the job is not posted; keep the draft and return to the review step with the error.

## Path B specifics

Quote card CTA is "Accept & pay" (no figure). On tap open the sheet with the quote's amount. On success: append the accepted system record to the thread ("Accepted · $204 paid · Now a booking"), move the thread into the booked chat list, and remove the quote from the quotes list (see `MESSAGES-AND-QUOTES.md`). Do not mark the quote accepted before the charge clears.

## Release, refunds, disputes
- **Release** — client approves the work on `BookingDetailsScreen`; funds move to the business. Nothing auto-releases without approval in v1.
- **Cancel** — free up to 24 h before the slot: full refund of the held amount, service fee included. Inside 24 h, route through `flows/CancellationFlowScreen.js` and show the policy before confirming.
- **Dispute** — held funds stay held; `flows/DisputeFlowScreen.js` owns the flow. Never release while a dispute is open.
- Amounts, fees and refunds are **server-authoritative**. The sheet renders what the server quotes; it never computes a total client-side.

## Component sketch

```jsx
// components/PaySheet.js
export function PaySheet({ visible, mode, quote, onClose, onConfirm }) {
  // mode: 'hold' (Path A) | 'pay' (Path B)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const title = mode === 'hold' ? 'Hold payment' : 'Pay quote';
  const cta = `${mode === 'hold' ? 'Confirm & hold' : 'Confirm & pay'} $${quote.total}`;

  return (
    <Modal visible={visible} transparent animationType="slide"
           onRequestClose={busy ? undefined : onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(4,5,7,0.68)' }}
                 onPress={busy ? undefined : onClose} />
      <View style={{ backgroundColor: colors.surface, borderTopWidth: 1,
        borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }}>
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 999,
          backgroundColor: colors.border }} />

        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: font.grotesk700, fontSize: 21, letterSpacing: -0.5,
            color: colors.textPrimary }}>{title}</Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{quote.summary}</Text>
        </View>

        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 16,
          padding: 14, gap: 9 }}>
          <Amount label="Job total" value={quote.subtotal} />
          <Amount label="Service fee" value={quote.fee} />
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center' }}>
            <Text style={{ fontSize: 13.5, fontWeight: '600',
              color: colors.textPrimary }}>
              {mode === 'hold' ? 'On hold today' : 'Total'}</Text>
            <Text style={{ fontFamily: font.grotesk700, fontSize: 22, letterSpacing: -0.5,
              color: colors.success, fontVariant: ['tabular-nums'] }}>
              ${quote.total}</Text>
          </View>
        </View>

        <PaymentMethodRow method={quote.method} error={!!error} />

        {error && (
          <View style={{ backgroundColor: 'rgba(255,92,92,0.14)', borderRadius: 10,
            paddingVertical: 9, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 12.5, color: colors.danger }}>{error}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Feather name="lock" size={13} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 18,
            color: colors.textSecondary }}>
            Held in escrow — released only when you approve the work.
            Cancel free up to 24 h before.</Text>
        </View>

        <Pressable disabled={busy || !quote.method}
          onPress={async () => {
            setBusy(true); setError(null);
            try { await onConfirm(); }
            catch (e) { setError(e.message); }
            finally { setBusy(false); }
          }}
          style={({ pressed }) => [{ height: 52, borderRadius: 12,
            backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
            opacity: !quote.method ? 0.4 : 1 },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '600' }}>{cta}</Text>}
        </Pressable>
      </View>
    </Modal>
  );
}
```

## Done criteria
One `PaySheet` serves both entries. No dollar figure appears anywhere before the sheet. Hold-then-create ordering on Path A; charge-then-accept ordering on Path B. Declined, no-card, submitting and stale-amount states all styled. Totals use tabular numerals and come from the server. Escrow copy present on the entry screen, in the sheet, and on the success screen. `POLISH-TIPS.md` §10 checklist + lint.
