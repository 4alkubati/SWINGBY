# Messages & quotes — handoff

Covers the whole messaging surface: what belongs in the chat list, where quotes live, and the quote card itself. Reference frames are in `SwingBy All Screens.dc.html` — section **5a** (inbox model, current), **3a** (the quote card), **4a** (in-thread floating bubble, *not* adopted — kept for reference). Tokens in `README.md`, craft rules in `POLISH-TIPS.md`.

## The model (5a — build this)

**The chat list holds booked work only.** A thread appears in Messages the moment a quote is accepted and paid — never before. This is what keeps the inbox readable without anyone deleting threads.

**Everything still being negotiated sits behind one bubble** docked at the bottom-right of the message list, above the tab bar. Tapping it swaps the list in place — same screen, no navigation push — and the bubble becomes "Back to chats".

Same component on both sides; only copy and row content differ:
- **Client** → received quotes ("Quotes · 3 open · not booked yet").
- **Business** → sent quotes ("Sent quotes · 4 out · $1,145 pending"). **Business Jobs no longer lists pending quotes at all** — a job lands in Jobs on acceptance only.

### Files
| Piece | File |
|---|---|
| Chat list + bubble + quotes list | `messages/MessagesScreen.js` |
| Quote thread & quote card | `messages/MessageThreadScreen.js` |
| Business Jobs (remove pending quotes) | `business/JobManagementScreen.js` |

## The bubble

- 56px circle, `#6E56F7`, shadow `0 8px 24px rgba(110,86,247,0.4)` (accentGlow). Feather `briefcase`, white, 22px, stroke 1.8.
- Docked `right: 16`, `bottom: 104` (clears the 86px tab bar). Whole bubble is the tap target; ≥44px clearance from other controls.
- **Count badge** top-right: `#07080A` fill, 1px `#2A2247` inset ring, Space Grotesk 700 11.5px `#F4F6FA` — the number of open quotes.
- **Left pill** attached to the bubble (`#0F1115` + 1px `#1F232B`, radius `999 0 0 999`, no right border): two lines — "Quotes" 12.5px/600 over "2 expiring" 10.5px `#F6B23B` when anything is under 24 h; otherwise a single centered count line.
- **Open state:** bubble goes neutral (`#161A21` + border), icon becomes an X `#8B92A0`, pill reads "Back to chats".
- A new quote arriving pulses the bubble's ring once (1.8s pulse, see README §8). No message is inserted into any thread.

## Quotes list rows

Card per quote: radius 16, `#0F1115`. **Border `rgba(136,120,249,0.28)` while it awaits the viewer's action**, plain `#1F232B` otherwise (waiting on them / expired).

Left: 46px initials tile (radius 14; `#2A2247`/`#8878F9` for the active one, else surface + border). Middle: name 15px/600 → service line 13px `#8B92A0` → status 11.5px (`#F6B23B` when expiring, `#8B92A0` neutral, `#565D6B` expired). Right: price Space Grotesk 700 19px `#2EBD85` (`#565D6B` when expired) over relative timestamp 11.5px `#565D6B`. All three text lines single-line + ellipsis.

Footer caption, 11.5px `#565D6B` with an info icon: client "Accepted quotes move into Messages as booked jobs." / business "Accepted quotes appear in Jobs — only then."

**Lifecycle:** declined and expired quotes stay in this list, greyed, for 30 days, then drop off. Nothing is deleted by hand.

## The quote card (3a) — inside a quote thread

The quote is a bubble in the thread, from the business, left-aligned, `width: 88%`, radius `18 18 18 6`, `#0F1115` + border `rgba(136,120,249,0.28)`, padding 15, gap 13:

1. Header row: 32px `#2A2247` tile w/ briefcase `#8878F9` · eyebrow "QUOTE" 10.5px/600/1.2px `#8B92A0` · price Space Grotesk 700 21px `#2EBD85`.
2. 1px `#1F232B` divider.
3. Rows 12.5px, label `#8B92A0` / value 500: Service, When, Expires (`#F6B23B`).
4. Buttons: "Decline" 92px + "Accept & pay" flex:1 — both 44px, radius 12; Decline `#161A21`/`#1F232B`/`#8B92A0`, Accept solid `#6E56F7` white 600.

Thread header subtitle reads "Quote · not booked yet" in `#F6B23B` while pending.

**Business's own view:** same bubble, tail on the right (`18 18 6 18`), neutral border, eyebrow "QUOTE SENT", status row "Awaiting reply · 22 h left", actions "Withdraw" / "Edit quote" (both secondary).

**On resolve** the bubble collapses to a one-line record — full width, centered, neutral border, no tail, no buttons: accepted (green check, "Accepted · $204 paid · Now a booking", View link), expired (amber clock, Re-request), declined (red x, "You can keep chatting").

## Payment

"Accept & pay" opens the shared pay sheet (section 2a) — never charges silently. The client-side service fee is added inside the sheet, so **no button or note before the sheet shows a total**. Full spec: `PAYMENTS.md`.

## Not adopted (4a)

Section 4a puts the bubble inside the thread instead of the inbox. Kept in the canvas for reference only — do not build it. If it ever comes back, the reusable parts are the collapsed-bubble states and the expand-over-dimmed-thread panel.

## Component sketch

```jsx
// MessagesScreen.js
const [tab, setTab] = useState('chats');   // 'chats' | 'quotes'

<FlatList data={tab === 'chats' ? bookedThreads : openQuotes}
          renderItem={tab === 'chats' ? renderChatRow : renderQuoteRow} />

<QuotesBubble
  count={openQuotes.length}
  expiringSoon={openQuotes.filter(q => q.hoursLeft < 24).length}
  open={tab === 'quotes'}
  onPress={() => setTab(t => (t === 'chats' ? 'quotes' : 'chats'))}
/>
```

```jsx
function QuotesBubble({ count, expiringSoon, open, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => [{ position: 'absolute', right: 16, bottom: 104,
        flexDirection: 'row', alignItems: 'center' }, pressed && { opacity: 0.9 }]}>
      <View style={{ height: 42, paddingLeft: 15, paddingRight: 13, justifyContent: 'center',
        backgroundColor: colors.surface, borderWidth: 1, borderRightWidth: 0,
        borderColor: colors.border, borderTopLeftRadius: 999, borderBottomLeftRadius: 999 }}>
        {open ? (
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.textPrimary }}>
            Back to chats</Text>
        ) : (
          <>
            <Text style={{ fontSize: 12.5, fontWeight: '600', lineHeight: 15,
              color: colors.textPrimary }}>Quotes</Text>
            <Text style={{ fontSize: 10.5, lineHeight: 14,
              color: expiringSoon ? colors.warning : colors.textSecondary }}>
              {expiringSoon ? `${expiringSoon} expiring` : `${count} open`}</Text>
          </>
        )}
      </View>
      <View style={{ width: 56, height: 56, borderRadius: 999,
        backgroundColor: open ? colors.surfaceAlt : colors.accent,
        borderWidth: open ? 1 : 0, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
        ...(open ? {} : { shadowColor: colors.accent, shadowOpacity: 0.4, shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 }, elevation: 8 }) }}>
        <Feather name={open ? 'x' : 'briefcase'} size={open ? 21 : 22}
          color={open ? colors.textSecondary : '#fff'} />
        {!open && count > 0 && (
          <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 21, height: 21,
            borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1,
            borderColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.grotesk700, fontSize: 11.5,
              color: colors.textPrimary }}>{count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
```

The quote-card component itself (`ChatQuoteCard`) is in `QUOTE-IN-CHAT.md` — same code, now rendered inline in the thread rather than pinned.

## Done criteria
Chat list contains zero unbooked threads. Bubble present with correct badge/pill and swaps the list in place. Quote rows match 5a (borders, colors, ellipsis, tabular price). Quote thread renders the 3a bubble with all four resolve states. Accept opens the pay sheet. Business Jobs shows no pending quotes. Empty states for both lists ("No booked jobs yet" / "No open quotes"). `POLISH-TIPS.md` §10 checklist + lint.
