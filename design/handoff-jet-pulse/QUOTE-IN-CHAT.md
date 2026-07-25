# Quote-in-chat — pinned quote card (handoff)

> ⚠ **SUPERSEDED — do not build from this file.** The adopted model is in **`MESSAGES-AND-QUOTES.md`** (quotes live behind a bubble in the inbox; the quote card sits inline in the thread) and **`PAYMENTS.md`** (the shared pay sheet). Two things below are specifically wrong now: the card is **not** pinned over the composer, and the CTA is **"Accept & pay"** — accepting always opens the pay sheet, never books directly. Kept only because the `ChatQuoteCard` styling and the accepted-system-bubble snippet are still the reference implementations.

**What:** an incoming quote docks at the **bottom of the message thread** — Instagram-request placement (sticky, action-required, sits above the composer and replaces it until actioned) with a **Facebook-style card** look (bordered card, price, service rows, two buttons). On **Accept** it collapses into a confirmed system bubble in the thread and the composer returns. **Decline** removes the card and returns the composer.

Reference frame: section **1a "Quote in chat"** (top of `SwingBy All Screens.dc.html`) — pending on the left, accepted on the right.

## File
`mobile/src/screens/messages/MessageThreadScreen.js` — render the pinned card between the message list and the composer.

## Behavior
- Show the pinned card when the thread has a quote with `status === 'pending'` (from the existing quote/booking data on the thread — no new fetch).
- **Accept & book** → call the existing accept-quote action (same as `QuoteComparisonScreen` "Accept"); on success set the quote to `accepted`, append a system message, hide the card, show the composer.
- **Decline** → existing decline action; hide the card, show the composer, optional system line.
- While the card is shown, hide the text composer (IG-request pattern). One quote at a time; if multiple pending, show the newest and badge the rest in the pinned banner.
- Accepted/declined states persist from server data — don't rebuild on refresh.

## Tokens (all existing 2a — see README)
Card `#0F1115` + border `rgba(136,120,249,0.28)` (borderAccent) + radius 18 + shadow `0 12px 40px rgba(0,0,0,0.5)`. Price Space Grotesk 700, `#2EBD85`. Eyebrow "NEW QUOTE" 10.5px/600/1.2px `#8B92A0`. Expiry warning `#F6B23B`. Accept = solid `#6E56F7` white 600; Decline = `#161A21` bg + `#1F232B` border + `#8B92A0`, fixed 104px, both 46px tall, radius 12. Escrow line: lock icon + caption `#8B92A0`. Accepted bubble check in `rgba(46,189,133,0.14)` circle.

## Component (drop into the screen or `components/`)

```jsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, font } from '../../theme/tokens';

// quote: { businessName, price, service, when, expiresInHours }
export function ChatQuoteCard({ quote, onAccept, onDecline }) {
  return (
    <View style={{
      marginHorizontal: 12, marginBottom: 8, padding: 16,
      backgroundColor: colors.surface, borderWidth: 1,
      borderColor: colors.borderAccent, borderRadius: 18,
      shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 }, elevation: 8, gap: 14,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accentMuted,
          alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="briefcase" size={16} color={colors.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 1.2,
            color: colors.textSecondary }}>NEW QUOTE</Text>
          <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.textPrimary }}>
            {quote.businessName}</Text>
        </View>
        <Text style={{ fontFamily: font.grotesk700, fontSize: 22, letterSpacing: -0.5,
          color: colors.success }}>${quote.price}</Text>
      </View>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      <View style={{ gap: 6 }}>
        <Row label="Service" value={quote.service} />
        <Row label="When" value={quote.when} />
        <Row label="Expires" value={`in ${quote.expiresInHours} h`} valueColor={colors.warning} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Feather name="lock" size={12} color={colors.textSecondary} />
        <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
          Payment releases only when you approve the work.</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onDecline}
          style={({ pressed }) => [{ width: 104, height: 46, borderRadius: 12,
            backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.9 }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 14.5, fontWeight: '600' }}>Decline</Text>
        </Pressable>
        <Pressable onPress={onAccept}
          style={({ pressed }) => [{ flex: 1, height: 46, borderRadius: 12,
            backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
          <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '600' }}>Accept &amp; book</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '500', color: valueColor || colors.textPrimary }}>
        {value}</Text>
    </View>
  );
}
```

### Wiring in MessageThreadScreen

```jsx
{pendingQuote ? (
  <ChatQuoteCard
    quote={pendingQuote}
    onAccept={() => acceptQuote(pendingQuote.id)}   // existing action
    onDecline={() => declineQuote(pendingQuote.id)} // existing action
  />
) : (
  <Composer />
)}
```

### Accepted system bubble (append to the message list after accept)

```jsx
<View style={{ alignSelf: 'center', width: '88%', backgroundColor: colors.surface,
  borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13,
  flexDirection: 'row', alignItems: 'center', gap: 11 }}>
  <View style={{ width: 32, height: 32, borderRadius: 999,
    backgroundColor: 'rgba(46,189,133,0.14)', alignItems: 'center', justifyContent: 'center' }}>
    <Feather name="check" size={15} color={colors.success} />
  </View>
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.textPrimary }}>
      Quote accepted · <Text style={{ color: colors.success }}>${quote.price}</Text></Text>
    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
      {quote.service} · {quote.when} · booked</Text>
  </View>
  <Pressable onPress={() => navigation.navigate('BookingDetails', { id: quote.bookingId })}>
    <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.accentText }}>View</Text>
  </Pressable>
</View>
```

## Done criteria
Pending card matches frame 1a-left; accept → system bubble + composer returns (frame 1a-right); decline → card gone, composer back. Keyboard doesn't cover the card. No new fetch/state beyond the existing quote object. Run `POLISH-TIPS.md` §10 checklist + lint.
