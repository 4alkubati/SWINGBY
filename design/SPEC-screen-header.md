# SPEC — `ScreenHeader` (shared component)

> Status: spec only. No code in `mobile/src/` yet — Kira reviews this before mobile-agent
> implements it. Extends **Jet × Pulse** (`design/DESIGN-SYSTEM.md`); invents nothing new
> except one component and the two tokens called out below.
> Measured against `main` @ `1b0cf9f`.

---

## 1. For Kira, in plain language

Every screen in this app draws its own back button, because the app turns off the
system's native header everywhere (`headerShown: false`) and never turned it back on.
Nobody ever wrote down what that back button should look like, so 45 screens each
invented their own — different icon, different size, different color, different tap
area. Three screens forgot to draw one at all; on your iPhone the only way out was an
edge-swipe gesture, which is exactly the thing you told us an older user won't know to
do. Those three are fixed and a test now blocks a new screen from shipping with no way
back at all.

What the test doesn't catch: it only checks a back control *exists* somewhere in the
file — not that it's big enough to tap reliably, not that it looks the same screen to
screen, not that it survives someone's phone set to large text. This spec is one
component, `ScreenHeader`, that every screen uses instead of hand-drawing its own. One
place to get it right means it's right everywhere, and the next screen can't ship it
wrong because there's nothing left to invent.

Two rules carry the whole spec: the back icon is always big enough to hit with a
thumb — 44×44 points, the same minimum Apple and Google both write into their own
guidelines — and it says "Back" or "Close" out loud to a screen reader even though
sighted users only see an arrow. Nobody has to remember either of those; the component
does it every time.

---

## 2. Scope

`ScreenHeader` governs the top bar of a **pushed screen** — anything reached by
`navigation.navigate(...)` and registered as a `<Stack.Screen>`. It does not touch:

- **The native header.** `headerShown: false` stays exactly as it is on every navigator.
  This is not a proposal to turn native headers back on. Reason: the app already
  draws its own chrome for everything else (bottom nav, safe-area padding, the glow
  moments in `handoff-jet-pulse/README.md`) — a native header would be a second,
  inconsistent chrome system fighting the one that's already there, and 45 screens of
  custom layout already assume there isn't one. `ScreenHeader` is that same
  own-drawn-chrome approach, just no longer reinvented per screen.
- **Tab/stack roots** — Home, Dashboard, the auth/onboarding flow. Nothing to go back
  to; these already greet the user with their own hero header
  (`handoff-jet-pulse/README.md` §"Header: 'Good morning'…") which is a different,
  deliberately bigger component and out of scope here.
- **True modal sheets** — `SendTermsSheet.js` and anything else built on RN's own
  `<Modal>` or `components/BottomSheet.js`. These aren't `<Stack.Screen>` routes, the
  back-affordance guard test doesn't see them, and they already have one consistent
  dismiss pattern (grabber + `x`, top-right, e.g. `SendTermsSheet.js:64-83`). Leave
  them alone.
- **One full-bleed exception**: `NearbyMapScreen.js`. Its back control is a
  translucent 40px circle floating over a live map (`MapOverlayButton`,
  `NearbyMapScreen.js:437-444`), because an opaque bar over a full-bleed map would
  cut the map down and defeat the point of the screen. This is the only screen in the
  app with that shape today — do not build a second variant of `ScreenHeader` to
  absorb it; leave it as a named, permanent exception.

---

## 3. Anatomy

```
┌─────────────────────────────────────────────────┐
│  safe-area top inset                             │
│  ┌────┐                                 ┌────┐   │
│  │ ←  │  Screen title                   │ ⋮  │   │  ← 44×44 tap targets,
│  └────┘  (flex, 1 line, truncates)      └────┘   │    title fills the rest
└─────────────────────────────────────────────────┘
```

- **Back control** — fixed-left, always present, always the same tap target.
- **Title** — left-aligned immediately after the back control, not centered.
- **Trailing action** — optional, fixed-right, same tap-target treatment as back.
  Absent by default; nothing is drawn in its place (no dummy spacer).

Centering the title (today's pattern: an invisible `<View style={{width:20}}/>` spacer
opposite the icon) is dropped. It only balances when the spacer width matches the
icon's width exactly, and today's icons range 14–22px against a fixed 20px spacer —
so on several screens the "centered" title is already off-center. Left-aligning
removes the need for the spacer entirely: the title just starts where the back
control ends, and a trailing action (or its absence) can't shift it.

---

## 4. Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | yes | Always visible text, never empty. No screen using `ScreenHeader` may omit it — an icon-only header is the `NearbyMapScreen` exception's shape, not this component's. |
| `onBack` | `() => void` | yes | Not defaulted to a bare `navigation.goBack()` inside the component, on purpose — `DisputeFlowScreen.js:181` needs "pop one wizard step, then go back," and forcing that logic to live outside the component keeps `ScreenHeader` navigation-library-agnostic. Screens that just want `goBack()` pass `() => navigation.goBack()`. |
| `variant` | `'push' \| 'modal'` | no, default `'push'` | Selects the icon and label. See §6. Set to `'modal'` only when the screen's own `<Stack.Screen options>` set `presentation: 'modal'` (i.e. it uses `modalScreenOptions` from `navigation/transitions.js`) — this is a mechanical, look-it-up decision, never a feel call. |
| `trailingIcon` | `string` (Feather glyph name) | no | Omit for no trailing action. |
| `onTrailingPress` | `() => void` | required if `trailingIcon` is set | — |
| `trailingAccessibilityLabel` | `string` | required if `trailingIcon` is set | E.g. `"More options"`, `"Edit"`. The component should warn in `__DEV__` if `trailingIcon` is passed without this — an icon-only button with no label is exactly the kind of a11y gap this spec exists to close. |
| `testID` | `string` | no | Passthrough for QA. |

No `style`, `color`, or typography override props. That's deliberate — see §9.

---

## 5. Visual spec (exact values)

All from `mobile/src/theme/tokens.js` / `typography.js`. No new hex, one new numeric
constant (`HEADER_TAP_TARGET`, justified in §7).

**Container**
- `backgroundColor: colors.bg` — explicit, not transparent. The header sits flush
  with the screen, no separate surface fill, no border, no shadow. This matches the
  majority of measured screens today and keeps faith with "there is no native
  header": a bottom border or elevation would make it read as chrome bolted on top
  of the page again.
- `paddingTop: insets.top + spacing.sm` (component reads `useSafeAreaInsets()`
  itself — see §8 migration note on what this replaces).
- `paddingBottom: spacing.sm`
- `paddingHorizontal: spacing.base`
- `minHeight: 44 + spacing.sm * 2` (**`minHeight`, never `height`** — a fixed height
  is exactly what clips a title that grows at large accessibility text sizes; see §9).
- `flexDirection: 'row'`, `alignItems: 'center'`.

**Back / dismiss control**
- Tap target: `44×44`, `alignItems: 'center'`, `justifyContent: 'center'`.
- `marginLeft: -spacing.sm` — pulls the glyph optically back to the screen's left
  content edge, so it lines up with the cards below it instead of sitting visibly
  indented by its own padding.
- Icon: `Feather`, `size={20}`, `color={colors.textSecondary}`.
- `hitSlop`: not used as the sizing mechanism — see §7.
- `accessibilityRole="button"`, `accessibilityLabel="Back"` (`variant="push"`) or
  `"Close"` (`variant="modal"`).

**Title**
- `Text` variant `h1` (`SpaceGrotesk_700Bold`, 20px, `colors.textPrimary`).
- `marginLeft: spacing.sm`, `flex: 1`.
- `numberOfLines={1}`, `ellipsizeMode="tail"`.
- `accessibilityRole="header"`.

**Trailing action** (only when `trailingIcon` is set)
- Same `44×44` tap target and centering as the back control, mirrored:
  `marginRight: -spacing.sm`.
- Icon: `Feather`, `size={20}`, `color={colors.textPrimary}` — one shade brighter
  than the back control on purpose: it's an action the screen wants noticed (edit,
  more, share), where back is wayfinding chrome the eye should skip past on the way
  to the title. This is the one place the header uses two different icon colors, and
  it's a hierarchy choice, not an oversight.
- `accessibilityRole="button"`, `accessibilityLabel={trailingAccessibilityLabel}`.

---

## 6. Which measured variant wins, and why

Measured on `main` across the 45 guarded screens:

| Element | Variants found | Picked | Why |
|---|---|---|---|
| Icon | `arrow-left` @ 14/18/19/20/22px, `textSecondary` (17×) / `textPrimary` (24× combined) / `accentText` (1×) | **`arrow-left`, 20px, `textSecondary`** | 20px is the mode (34 of ~54 sites) and pairs 1:1 with the `h1` title's 20px, so the two sit on the same optical scale without contrivance. Color is the real decision: `textPrimary` is this app's content color (titles, emphasis); `textSecondary` is its wayfinding/meta color (captions, labels, section headers per `handoff-jet-pulse/README.md` §7). A back control is wayfinding, not content — if it shared `textPrimary` with the title next to it, the two would compete for the same glance instead of the eye landing on the title. `accentText` is dropped outright: `DESIGN-SYSTEM.md` reserves purple for "one primary CTA per screen, active nav, live/pulse dots, selected states" — a back button is none of those. |
| Title | `bodyMedium` (41×), `h1` (24×), `display3` (18×), `h2` (9×) | **`h1`** | `bodyMedium` is `Inter_600SemiBold` — an Inter *body* style, and `DESIGN-SYSTEM.md`'s non-negotiables are explicit: "Headings/numerals Space Grotesk 700, body Inter." A screen title is a heading. Using `bodyMedium` on 41 of 45 screens isn't a style choice that happens to be common — it's the same rule violation repeated 41 times. Between the three Space Grotesk options, `h1` (20px) is mid-scale: bigger than body text so it reads as a title, smaller than `hero`/`display2` (32/28px) so it doesn't compete with the greeting headers on Home/Dashboard, and it's already the second-most-used, so most migrated screens change less than they'd expect. `h2` is out for an unrelated reason: it was the screen title style that shipped at the wrong font-weight (`typography.js`'s own comment: "every screen title using it read a weight lighter than the system") before being patched — it's the exact history this spec exists to stop repeating with a different property (size/color instead of weight). |
| `hitSlop` | `6, 8, 10, 12`, object forms | **not used for sizing — see §7** | — |

Every non-conforming screen becomes: `arrow-left`/20/`textSecondary` for the icon,
`h1` for the title, regardless of what it shipped with. There is no per-screen
judgement call here — this table is the whole decision.

---

## 7. Touch target — the 44×44 guarantee

**Minimum: 44×44 points** (iOS HIG and Android's own accessibility guidance both land
here; it's also larger than every `hitSlop` value shipping today, the smallest of
which — **6px** on an ~18-20px glyph, giving a ~30×30 effective target — is the
worst offender found).

The guarantee does **not** come from `hitSlop` math. `hitSlop` expands the tappable
area *around whatever the glyph's rendered box happens to be*, and a Feather glyph's
actual bounding box isn't a reliable, guaranteed-stable size to build arithmetic on —
which is exactly how the app ended up with five different `hitSlop` values, each
somebody's best guess at compensating for a different icon size.

Instead: the `Pressable` wrapping the icon is given a fixed `width: 44, height: 44`
independent of the icon inside it, with the icon centered. Change the icon's `size`
prop and the tap target does not move — the 44×44 box and the 20px glyph inside it are
two unrelated numbers, on purpose. This is why §4 says no per-screen icon-size prop:
there is nothing left to tune, and nothing left to get wrong.

`HEADER_TAP_TARGET = 44` is the one new numeric constant this spec introduces
(alongside the existing `spacing` scale) — name it that in the component file so a
future reviewer can search for the number's justification instead of re-deriving it.

---

## 8. Font scaling — no cap, and what a long title does at 2.0×

**No `maxFontSizeMultiplier` on the title.** The caps swept 84 → 11 app-wide
(`Text.js`'s `CAPPED_VARIANTS` comment, B-03) exist only for chrome-constrained
label-ish text (`caption`, `label`, `smallMedium`) where clipping was audited
call-site by call-site. A screen title is exactly the kind of primary, must-read text
that sweep was protecting, not capping — capping it here would be reintroducing the
same bug this spec is meant to prevent.

At Android's 2.0× accessibility setting, a 20px `h1` title renders at ~40px. Two
things happen, both deliberate:

1. **Horizontal: truncates, doesn't wrap.** `numberOfLines={1}` + `ellipsizeMode="tail"`
   (§5). A header title is the shortest, most repeatable route back to "what screen
   am I on" — truncation is the same behavior iOS and Android's own native headers
   use, so it's not a novel pattern for anyone reading it. Wrapping was rejected: a
   two-line title makes the header's height a function of *this screen's specific
   title string* at *this specific font scale*, which reintroduces per-screen
   layout variance — the exact fragmentation this component exists to remove — and
   at 2.0× a long title could wrap to 3+ lines and push page content off the visible
   fold entirely.
2. **Vertical: the row must not clip the glyph.** `typeScale.h1` sets a fixed
   `lineHeight: 26`. React Native scales `fontSize` with the OS accessibility
   setting but does **not** scale an explicitly-set `lineHeight` to match — so at
   2.0× a ~40px-tall glyph would be asked to fit inside an un-scaled 26px line box,
   clipping ascenders/descenders. `ScreenHeader`'s title `Text` must override
   `lineHeight` to `undefined` (letting RN fall back to the font's natural
   metrics) rather than inheriting `h1`'s fixed value, and the container uses
   `minHeight` (§5), not `height`, so the row can grow those few extra pixels
   without clipping anything above or below it. Mobile-agent: verify this on a
   physical device or the Android emulator's Settings → Accessibility → Font size
   at "Largest" before calling the component done — this class of bug does not show
   up in a default-size screenshot.

---

## 9. Dismiss vs. back

One mechanical rule, driven by the navigator, never by feel:

> **If the screen's `<Stack.Screen>` sets `presentation: 'modal'`
> (`navigation/transitions.js`'s `modalScreenOptions`), `ScreenHeader` renders `x`
> and `accessibilityLabel="Close"`. Every other pushed screen renders `arrow-left`
> and `accessibilityLabel="Back"`. Both call the same `onBack` prop.**

Why this resolves cleanly instead of becoming a second judgement call: `modalScreenOptions`
already exists in the codebase (`navigation/transitions.js:32-37` — `slide_from_bottom`,
`presentation: 'modal'`) but **zero screens use it today** — it was built for a future
screen that slides up over the current one rather than pushing in from the side, and
that's precisely the shape where a user expects `x`, not a back arrow (native iOS modal
sheets don't get swipe-back-from-edge, either — `x` is the only obvious way out). Tying
`ScreenHeader`'s icon to that option, instead of to a developer's sense of whether a
screen "feels modal," means the same screen can never end up with a mismatched
icon/gesture pair, and there's a single lookup — the navigator file — to check, not a
style debate per screen.

The real `x`-dismiss sheets already in the app (`SendTermsSheet.js` and friends,
§2) are a different, already-consistent pattern and are untouched by this rule — they
were never candidates for `arrow-left` in the first place, since they don't sit in the
navigation stack at all.

---

## 10. The design-system rule (for `design/DESIGN-SYSTEM.md`)

Add to the "Non-negotiables" section:

> **Every pushed screen renders `ScreenHeader` — no screen draws its own back icon,
> title style, or hit target.** `headerShown: false` stays on every navigator; this is
> the app's only header. Icon and label follow the screen's `presentation` option
> (`arrow-left`/"Back" for `card`, `x`/"Close" for `modal`) — never a per-screen
> choice. See `design/SPEC-screen-header.md`.

Two sentences, both binding, both mechanically checkable (a screen either imports
`ScreenHeader` or it doesn't; the icon either matches its own `presentation` option or
it doesn't) — nothing here is a matter of taste to relitigate per screen.

---

## 11. Migration — 45 screens

Order by risk and mechanical-ness, cheapest first:

**Bucket A — mechanical, ~38 screens.** Any screen whose header is
`arrow-left` + title + `navigation.goBack()`, no trailing action, no custom back
logic. This is the overwhelming majority (38 of 45 screens draw `arrow-left` today).
Swap the hand-rolled header block for `<ScreenHeader title="…" onBack={() =>
navigation.goBack()} />`, delete the screen's own `header` style block and its
`paddingTop: insets.top` on the outer container (`ScreenHeader` now owns the
safe-area inset — leaving both in place double-pads the top of the screen, so this
removal is not optional, it's a visible bug if skipped). No judgement calls; this
bucket can go first and fastest, and is the right shape for a single PR per handful
of screens rather than one 45-screen PR.

**Bucket B — needs a trailing-action decision, ~2 screens.** `ChatScreen.js`
(`more-vertical` → thread menu) and `MyJobsScreen.js` (its own trailing icon).
Someone has to write the specific `trailingAccessibilityLabel` for each (e.g. `"Thread
options"`), because the component won't invent one — that's the point of making it
required (§4).

**Bucket C — needs the custom `onBack`, 1 screen.** `DisputeFlowScreen.js`: pass
`onBack={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}` — the
existing logic moves into the prop unchanged, nothing about the wizard behavior
changes.

**Bucket D — `variant="modal"`, 0 screens today.** No screen currently registers
`presentation: 'modal'`. Nothing to migrate; this bucket exists so that the *next*
screen built that way starts correct instead of inventing an `x` pattern from scratch.

**Deliberate exceptions — do not migrate:**
- `RequestSent` — reached via `navigation.reset()`, gesture disabled on purpose so a
  submitted form can't be swiped back into. No back control at all is correct here;
  `ScreenHeader` always requires `onBack`, so this screen must keep not using it.
- `Login`, `Signup`, `Onboarding` (and the rest of `NOT_PUSHED` in the guard test) —
  stack/tab roots, nothing to go back to.
- `NearbyMapScreen.js` — the floating-circle-over-map exception, §2.

**Suggested follow-up (not part of this spec, flag for a later ticket):** once Bucket
A–C land, tighten `pushed-screens-have-a-way-back.test.js`'s regex. Today it matches
`arrow-left|chevron-left|name="x"` anywhere in a screen's source, which is why
`chevron-left` on `ApproveWorkScreen.js`'s photo-comparator swipe hint and `x` on three
different "remove photo" buttons all read as valid back-affordances despite having
nothing to do with the header — the guard has been passing on incidental matches, not
verified ones. Once every screen renders `<ScreenHeader`, the test can check for that
import instead of loosely pattern-matching icon names, which closes that gap for good.

---

## 12. What this deliberately does not do

- **No color, style, or typography override props.** The whole point is that a
  screen can't reinvent the header — an escape hatch on day one becomes the sixth
  variant by month two.
- **No subtitle / secondary line under the title.** No measured screen needed one;
  add it only against a real screen that does, not speculatively.
- **No badge/dot on the trailing icon.** Not observed anywhere in the current 45
  screens; if a future screen needs a notification dot on a trailing action, spec
  that addition separately rather than building it in unused now.
- **Does not touch true `<Modal>`/`BottomSheet` sheet headers.** Different
  component, different territory (§2) — not a gap, a boundary.
- **Does not turn `headerShown` back on anywhere.** Covered in §2; stated twice
  because it's the thing most likely to get re-litigated by someone who didn't read
  this far.
- **Does not change what happens when a screen has genuinely nothing to go back
  to.** That's `NOT_PUSHED` in the guard test, unchanged by this spec.
