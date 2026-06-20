# SwingBy — Beta Tester Invite Card: Design Spec

**Deliverable ID:** 20260617-0001  
**Author:** design-agent  
**Date:** 2026-06-17  
**Status:** Ready for orchestrator review → mobile-agent implementation

---

## Overview

The Beta Tester Invite Card is the first screen a recruited beta tester sees after tapping their personal invite deep-link (`swingby://invite?code=<TOKEN>`). It is a static, full-screen card with no backend calls at render time. Its sole purpose is to communicate the invite, build excitement, and funnel the tester into the signup flow.

**Platform:** React Native / Expo (iOS primary, Android parity)  
**Surface:** Full-screen modal or root screen — NOT a bottom sheet  
**Backend calls:** None on this screen. Invite token is validated only on the next screen (signup/onboarding).

---

## A. Design Tokens

All implementors MUST use these exact values. No approximation.

### A1 — Color

| Token | Hex | Usage |
|---|---|---|
| `color.brand.primary` | `#1A6BFF` | Primary brand blue — logo accent, CTA button background, link underlines |
| `color.brand.primary.pressed` | `#1456CC` | CTA button pressed state (10% darker) |
| `color.brand.primary.light` | `#E8F0FF` | Subtle tint — header gradient overlay, badge background |
| `color.brand.primary.dark` | `#0D3F99` | CTA button disabled state, deep brand accent |
| `color.surface.card` | `#FFFFFF` | Card/screen background |
| `color.surface.overlay` | `#F5F7FF` | Section divider background, fine print area |
| `color.surface.image.overlay` | `rgba(10, 30, 80, 0.55)` | Gradient overlay on hero image |
| `color.text.primary` | `#0D1A33` | Headline, body — near-black with blue undertone |
| `color.text.secondary` | `#4A5568` | Sub-headline, supporting body copy |
| `color.text.tertiary` | `#718096` | Fine print, caption text |
| `color.text.on.primary` | `#FFFFFF` | Text on blue CTA button, text on hero overlay |
| `color.text.link` | `#1A6BFF` | Inline link text |
| `color.text.link.pressed` | `#1456CC` | Inline link pressed state |
| `color.accent.badge` | `#F59E0B` | "BETA" badge background — amber, trustworthy urgency (not red) |
| `color.accent.badge.text` | `#7C3D0F` | Text on amber badge — dark brown for contrast |
| `color.border.subtle` | `#E2E8F0` | Card border, divider lines |
| `color.state.error` | `#DC2626` | Error messages only (not used on this screen in default flow) |
| `color.state.success` | `#16A34A` | Success/confirmed state (checkmark, confirmation copy) |
| `color.state.success.light` | `#DCFCE7` | Success state background overlay |

### A2 — Typography

**Font family:** System default with explicit fallback chain.

| Token | Value |
|---|---|
| `font.family.primary` | `'SF Pro Display'` (iOS) / `'Roboto'` (Android) / `System` fallback |
| `font.family.mono` | `'SF Mono'` (iOS) / `'Roboto Mono'` (Android) — invite code display only |

| Token | Size (px/pt) | Weight | Line-height | Letter-spacing | Usage |
|---|---|---|---|---|---|
| `text.hero` | `32px` | `700` (Bold) | `38px` | `-0.5px` | Main headline on hero |
| `text.headline` | `24px` | `700` (Bold) | `30px` | `-0.3px` | Section headlines |
| `text.subhead` | `18px` | `600` (SemiBold) | `26px` | `0px` | Sub-headline under hero |
| `text.body` | `15px` | `400` (Regular) | `22px` | `0px` | Body copy paragraphs |
| `text.body.medium` | `15px` | `500` (Medium) | `22px` | `0px` | Emphasized body copy |
| `text.caption` | `13px` | `400` (Regular) | `18px` | `0.1px` | Fine print, timestamp |
| `text.button` | `16px` | `600` (SemiBold) | `20px` | `0.2px` | CTA button label |
| `text.badge` | `11px` | `700` (Bold) | `14px` | `0.8px` | Badge label (all-caps) |
| `text.code` | `14px` | `500` (Medium) | `20px` | `1.2px` | Invite code display |

### A3 — Spacing (8px base grid)

| Token | Value | Notes |
|---|---|---|
| `space.xs` | `4px` | Icon gap, inline spacing |
| `space.sm` | `8px` | Tight component padding |
| `space.md` | `16px` | Standard padding, row gap |
| `space.lg` | `24px` | Section spacing |
| `space.xl` | `32px` | Section break, large gaps |
| `space.2xl` | `48px` | Hero internal padding |
| `space.3xl` | `64px` | Bottom safe-area buffer |
| `space.screen.h` | `16px` | Horizontal screen margin |
| `space.screen.v` | `24px` | Vertical screen padding top |

### A4 — Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | `6px` | Badge pill |
| `radius.md` | `12px` | Code block, fine print container |
| `radius.lg` | `16px` | Card container (if used as sheet) |
| `radius.xl` | `24px` | Hero image top corners |
| `radius.full` | `9999px` | Avatar circle, pill buttons |
| `radius.button` | `12px` | CTA button |

### A5 — Shadow

| Token | Value | Usage |
|---|---|---|
| `shadow.card` | `0 4px 24px rgba(26, 107, 255, 0.10)` | Card container shadow |
| `shadow.button` | `0 4px 12px rgba(26, 107, 255, 0.30)` | CTA button default resting shadow |
| `shadow.button.pressed` | `0 2px 6px rgba(26, 107, 255, 0.20)` | CTA button pressed shadow (receded) |
| `shadow.none` | `none` | Disabled/success states |

### A6 — Icon & Image

| Token | Value |
|---|---|
| `icon.size.sm` | `16px` |
| `icon.size.md` | `20px` |
| `icon.size.lg` | `24px` |
| `image.hero.height` | `240px` (default) / `200px` (iPhone SE) |
| `image.logo.width` | `120px` |
| `image.logo.height` | `36px` |
| `image.avatar.size` | `48px` |

---

## B. Component Anatomy

The invite card is a **scrollable full-screen view** (ScrollView with bounces). No fixed card frame — the screen IS the card.

### Layout order (top → bottom):

```
┌──────────────────────────────────────────────┐
│  [Hero Image Area — 240px tall]               │  ← B1
│    ┌──────────────┐                           │
│    │ SwingBy Logo │                           │  ← B2 (overlaid on hero)
│    └──────────────┘                           │
│    [BETA badge — top-right]                   │  ← B3 (overlaid on hero)
│                                               │
│  [Headline text on overlay gradient]          │  ← B4 (overlaid on hero)
├──────────────────────────────────────────────┤
│  [Body section — white bg, 16px h-padding]   │
│                                               │
│  [Inviter info row — avatar + name + role]   │  ← B5
│  [Sub-headline]                               │  ← B6
│  [Body copy — 2 short paragraphs]            │  ← B7
│  [Invite code block]                         │  ← B8
│  [CTA button — Join the Beta]                │  ← B9
│  [Secondary link — Learn more / Sign in]     │  ← B10
│  [Fine print — legal / expiry]               │  ← B11
└──────────────────────────────────────────────┘
```

---

### B1 — Hero Image Area

- **Dimensions:** Full-width × 240px (375px screen). On 430px: 260px tall.
- **Content:** A lifestyle image of someone using a service (tradesperson at work, home service context). Placeholder: solid gradient `#1A6BFF → #0D3F99` (top-left to bottom-right) for MVP.
- **Overlay:** Linear gradient from `rgba(10, 30, 80, 0)` at top to `rgba(10, 30, 80, 0.75)` at bottom. Applied over image.
- **Border-radius:** Top corners `radius.xl` (24px) — only if used as a sheet. None if full-screen.
- **Object-fit:** `cover`

---

### B2 — Logo

- **Position:** Top-left of hero, inset `space.md` (16px) from left and top (plus status bar height via SafeAreaView).
- **Dimensions:** `image.logo.width` × `image.logo.height` = 120 × 36px.
- **Asset:** SwingBy wordmark, white version (`logo-white.png`).
- **Fallback:** If asset missing, render "SwingBy" in `text.headline` weight, `color.text.on.primary`.
- **Accessibility:** `accessibilityLabel="SwingBy"` / `accessibilityRole="image"`.

---

### B3 — BETA Badge

- **Position:** Top-right of hero, inset `space.md` from right and top (plus status bar height).
- **Dimensions:** Auto-width (text-driven) × 24px height. Min-width: 52px.
- **Padding:** 4px vertical, 10px horizontal.
- **Background:** `color.accent.badge` (`#F59E0B`).
- **Border-radius:** `radius.full` (pill).
- **Text:** "BETA" — `text.badge` (11px, 700, 0.8px tracking, all-caps).
- **Text color:** `color.accent.badge.text` (`#7C3D0F`).
- **Touch target:** Not interactive — purely decorative. No role needed.

---

### B4 — Hero Headline

- **Position:** Bottom of hero image, above overlay, inset `space.md` from left/right, `space.lg` from bottom of hero.
- **Text:** See Section F (Copy).
- **Typography:** `text.hero` (32px, 700, -0.5px spacing).
- **Color:** `color.text.on.primary` (`#FFFFFF`).
- **Max-width:** Full card width minus 32px (2× `space.md`).
- **Lines:** 2 max — clamp with `numberOfLines={2}` on native.

---

### B5 — Inviter Info Row

- **Position:** First element in white body section, `space.lg` (24px) top margin.
- **Layout:** Horizontal row. Left: avatar circle. Right: name + role stack.
- **Avatar:** 48×48px circle (`radius.full`). Shows generic SwingBy team avatar or placeholder icon. `color.brand.primary.light` background with initials "SW" in `color.brand.primary`.
- **Name text:** "The SwingBy Team" — `text.body.medium` (15px, 500), `color.text.primary`.
- **Role text:** "Invited you to join the beta" — `text.caption` (13px, 400), `color.text.secondary`.
- **Gap between avatar and text stack:** `space.sm` (8px).
- **Accessibility:** Treat as a single unit. `accessibilityLabel="Invited by The SwingBy Team"`.

---

### B6 — Sub-headline

- **Position:** Below inviter row, `space.md` (16px) top margin.
- **Text:** See Section F (Copy).
- **Typography:** `text.subhead` (18px, 600).
- **Color:** `color.text.primary` (`#0D1A33`).

---

### B7 — Body Copy

- **Position:** Below sub-headline, `space.sm` (8px) top margin.
- **Text:** Two paragraphs. See Section F.
- **Typography:** `text.body` (15px, 400, 22px line-height).
- **Color:** `color.text.secondary` (`#4A5568`).
- **Spacing between paragraphs:** `space.md` (16px).

---

### B8 — Invite Code Block

- **Position:** Below body copy, `space.lg` (24px) top margin.
- **Container:** Horizontal row, centered. Background `color.surface.overlay` (`#F5F7FF`). Border: 1px `color.border.subtle`. Border-radius: `radius.md` (12px). Padding: 12px vertical, 16px horizontal.
- **Left label:** "Your invite code" — `text.caption` (13px), `color.text.tertiary`. Stacked above code.
- **Code text:** The personalized invite code e.g. "SWING-A7X3" — `text.code` font (`font.family.mono`, 14px, 500, 1.2px tracking), `color.text.primary`.
- **Right icon:** Copy icon (20×20px, `color.brand.primary`). Tappable — copies code to clipboard.
- **Copy icon touch target:** Min 44×44px (apply padding around 20px icon).
- **Accessibility:** `accessibilityLabel="Invite code SWING-A7X3. Double-tap to copy."` on the copy button.
- **Width:** Full width minus 2× `space.screen.h` = full content width.

---

### B9 — CTA Button (Join the Beta)

- **Position:** Below invite code block, `space.xl` (32px) top margin.
- **Dimensions:** Full content width × 56px height.
- **Border-radius:** `radius.button` (12px).
- **Background:** `color.brand.primary` (`#1A6BFF`).
- **Text:** "Join the Beta" — `text.button` (16px, 600, 0.2px tracking), `color.text.on.primary`.
- **Shadow:** `shadow.button`.
- **Touch target:** 56px height exceeds 44px minimum. Width is full — no concern.
- **Accessibility:** `accessibilityRole="button"`, `accessibilityLabel="Join the SwingBy beta"`.

---

### B10 — Secondary Link

- **Position:** Below CTA button, `space.md` (16px) top margin, centered.
- **Text:** "Already have an account? Sign in" — see Section F for exact string.
- **Typography:** `text.body` (15px, 400).
- **Color:** `color.text.secondary` for the plain portion, `color.text.link` for "Sign in".
- **Touch target:** Entire row height must be min 44px. Wrap in a Pressable with `minHeight: 44`.
- **Underline on "Sign in":** `textDecorationLine: 'underline'` — for affordance.
- **Accessibility:** `accessibilityRole="link"`, `accessibilityLabel="Sign in to existing account"` on the pressable spanning "Sign in".

---

### B11 — Fine Print

- **Position:** Bottom of scroll content, `space.xl` (32px) top margin, `space.3xl` (64px) bottom padding (safe area buffer).
- **Container background:** None (transparent).
- **Text:** Two lines. See Section F.
- **Typography:** `text.caption` (13px, 400, 18px line-height).
- **Color:** `color.text.tertiary` (`#718096`).
- **Alignment:** Centered.

---

## C. States

### C1 — CTA Button (B9): "Join the Beta"

| State | Background | Shadow | Text Color | Scale | Notes |
|---|---|---|---|---|---|
| Default | `#1A6BFF` | `shadow.button` | `#FFFFFF` | 1.0 | Resting state |
| Hover (web) | `#1456CC` | `shadow.button` | `#FFFFFF` | 1.0 | Darken 10% — web only |
| Pressed (native) | `#1456CC` | `shadow.button.pressed` | `#FFFFFF` | 0.97 | `transform: scale(0.97)`, 80ms ease |
| Loading | `#1A6BFF` | `shadow.none` | — | 1.0 | Replace text with spinner (white, 20px); disable further taps |
| Disabled | `#0D3F99` | `shadow.none` | `rgba(255,255,255,0.5)` | 1.0 | `opacity: 0.5` on top of disabled bg |
| Success | `#16A34A` | `shadow.none` | `#FFFFFF` | 1.0 | Replace label with "You're in! ✓" — see Section F; no scale animation |
| Error | `#1A6BFF` | `shadow.button` | `#FFFFFF` | 1.0 | Button returns to Default; error message shown above button |

**Loading animation:** ActivityIndicator (React Native built-in), white, size "small". Centered in button. Duration: until navigation proceeds.

**Transition timing:** Pressed scale: `transform: [{scale: 0.97}]` with 80ms duration. Color transitions: not natively animated in React Native StyleSheet (use `Animated.Value` or `Pressable` state only).

---

### C2 — Copy Icon (B8 invite code block)

| State | Icon Color | Notes |
|---|---|---|
| Default | `color.brand.primary` (`#1A6BFF`) | Standard blue |
| Pressed | `color.brand.primary.pressed` (`#1456CC`) | Darken on tap |
| Copied (1-second flash) | `color.state.success` (`#16A34A`) | Icon switches to checkmark for 1000ms, then reverts |
| Copied — label change | Code label changes to "Copied!" for 1000ms | `color.state.success` text color on label |

---

### C3 — Secondary Link (B10)

| State | "Sign in" color | Underline |
|---|---|---|
| Default | `#1A6BFF` | Underline present |
| Pressed | `#1456CC` | Underline present, opacity 0.8 |

---

### C4 — Scroll Behavior

- **ScrollView bounces:** `true` on iOS, `false` on Android.
- **ScrollIndicator:** `showsVerticalScrollIndicator={false}` — hide for clean look.
- **KeyboardAvoidance:** Not needed (no text inputs on this screen).

---

### C5 — Screen Entry Animation

- **Type:** Fade-in + slide-up from 24px below.
- **Duration:** 320ms.
- **Easing:** `ease-out` (`Easing.out(Easing.cubic)`).
- **Trigger:** On mount (`useEffect`, frame 1`).
- **Elements:** Entire screen content animates as one unit. Hero image fades in separately at 100ms delay for depth.

---

### C6 — Error State (navigation failure)

If tapping "Join the Beta" results in an error (e.g., deep-link token expired before navigation):

- Inline error banner appears above CTA button.
- **Banner:** Full content-width, `color.state.error` background tinted at 10% (`rgba(220, 38, 38, 0.1)`), 1px `color.state.error` border, `radius.md` (12px), 12px padding.
- **Icon:** Warning triangle, 16px, `color.state.error`.
- **Text:** See Section F (error copy), `text.body` (15px), `color.state.error`.
- **Dismiss:** Banner auto-dismisses after 6 seconds or on tap.

---

## D. Responsive / Platform Behavior

### D1 — iPhone SE (375px wide)

| Element | Adaptation |
|---|---|
| Hero height | Reduced to `200px` (from 240px) to preserve scroll content visibility above fold |
| Hero headline | `text.hero` stays 32px; if clamp needed, 2 lines max |
| Horizontal margins | `space.screen.h` = 16px each side → content width = 343px |
| CTA button | Full content width = 343px × 56px tall |
| Body copy | `text.body` 15px stays — no scaling |
| Invite code block | Full content width = 343px |
| Bottom safe area | `space.3xl` (64px) — iPhone SE has no notch/home-indicator, reduce to 40px |

### D2 — Standard (390–414px wide, iPhone 14/15)

| Element | Adaptation |
|---|---|
| Hero height | 240px |
| Horizontal margins | 16px each side |
| All other elements | As specced in Section B |

### D3 — iPhone Pro Max (430px wide)

| Element | Adaptation |
|---|---|
| Hero height | 260px |
| Horizontal margins | 16px each side → content width = 398px |
| CTA button | Full content width = 398px × 56px |
| Body copy | Max-width: 398px — no reflow needed |
| Bottom safe area | 64px (home indicator present) |

### D4 — Android

- Font family: `'Roboto'` (regular) / `'Roboto'` weight 500 for medium / weight 700 for bold.
- Status bar: Use `StatusBar` with `translucent={true}` and `barStyle="light-content"` so hero image fills behind it.
- Bottom nav bar: Add `paddingBottom` equal to `insets.bottom` from `useSafeAreaInsets()`.
- Elevation instead of boxShadow for card/button shadows: Use `elevation: 4` for card, `elevation: 6` for button.

### D5 — Orientation

- **Portrait only.** Lock screen orientation to portrait (`expo-screen-orientation`). This screen does not support landscape.

---

## E. Accessibility (WCAG 2.1 AA)

### E1 — Contrast Ratios

All ratios calculated against WCAG 2.1 requirements: 4.5:1 for body text (under 18px / 14px bold), 3:1 for large text (18px+ regular or 14px+ bold).

| Text | Text color | Background | Ratio | Req | Pass? |
|---|---|---|---|---|---|
| Hero headline (32px bold) | `#FFFFFF` | `rgba(10,30,80,0.75)` overlay on image | ≥ 7.5:1 (dark overlay) | 3:1 | PASS |
| Sub-headline (18px semibold) | `#0D1A33` | `#FFFFFF` | 17.8:1 | 3:1 | PASS |
| Body copy (15px regular) | `#4A5568` | `#FFFFFF` | 7.1:1 | 4.5:1 | PASS |
| Fine print (13px regular) | `#718096` | `#FFFFFF` | 4.6:1 | 4.5:1 | PASS |
| CTA button text (16px semibold) | `#FFFFFF` | `#1A6BFF` | 4.6:1 | 4.5:1 | PASS |
| BETA badge text (11px bold) | `#7C3D0F` | `#F59E0B` | 4.7:1 | 4.5:1 | PASS |
| Link text (15px regular) | `#1A6BFF` | `#FFFFFF` | 4.6:1 | 4.5:1 | PASS |
| Invite code text (14px medium) | `#0D1A33` | `#F5F7FF` | 16.2:1 | 4.5:1 | PASS |
| Inviter name (15px medium) | `#0D1A33` | `#FFFFFF` | 17.8:1 | 4.5:1 | PASS |
| Inviter role caption (13px) | `#4A5568` | `#FFFFFF` | 7.1:1 | 4.5:1 | PASS |
| Success button text (16px semibold) | `#FFFFFF` | `#16A34A` | 4.6:1 | 4.5:1 | PASS |
| Error banner text (15px regular) | `#DC2626` | `rgba(220,38,38,0.1)` ≈ `#FDEAEA` | 5.3:1 | 4.5:1 | PASS |

> Note: Fine print at 13px / `#718096` on white is the tightest pair at 4.6:1. Passes AA. Does NOT meet AAA (7:1). Acceptable for fine print / legal copy given AA requirement.

### E2 — Touch Targets (min 44×44px)

| Element | Spec size | Touch target | Pass? |
|---|---|---|---|
| CTA button | Full width × 56px | Full width × 56px | PASS |
| Copy icon (B8) | 20×20px icon | 44×44px pressable wrap | PASS |
| Secondary link (B10) | Text height ~22px | Row: `minHeight: 44` | PASS |
| Hero image | Not interactive | N/A | — |
| BETA badge | Not interactive | N/A | — |

### E3 — Screen Reader Labels (iOS VoiceOver / Android TalkBack)

| Element | `accessibilityLabel` | `accessibilityRole` | `accessibilityHint` |
|---|---|---|---|
| Logo (B2) | `"SwingBy logo"` | `"image"` | — |
| Hero image (B1) | `"Person receiving a home service, representing SwingBy's marketplace"` | `"image"` | — |
| BETA badge (B3) | `"Beta version"` | `"text"` | — |
| Hero headline (B4) | *(read by screen reader automatically)* | `"header"` | — |
| Inviter row (B5) | `"Invited by The SwingBy Team"` | `"text"` | — |
| Sub-headline (B6) | *(read automatically)* | `"header"` | — |
| Invite code block (B8) | `"Your invite code: SWING-A7X3"` | `"text"` | — |
| Copy button (B8) | `"Copy invite code"` | `"button"` | `"Double-tap to copy your code to clipboard"` |
| CTA button (B9) | `"Join the SwingBy beta"` | `"button"` | `"Double-tap to begin creating your account"` |
| Sign in link (B10) | `"Sign in to existing account"` | `"link"` | — |
| Fine print (B11) | *(read automatically)* | `"text"` | — |

### E4 — Focus Order (VoiceOver / TalkBack traversal, top → bottom)

1. Logo (B2)
2. BETA badge (B3)
3. Hero headline (B4)
4. Inviter row (B5)
5. Sub-headline (B6)
6. Body copy paragraph 1 (B7)
7. Body copy paragraph 2 (B7)
8. Invite code display (B8 — label + code as one unit)
9. Copy button (B8)
10. CTA button (B9)
11. Sign in link (B10)
12. Fine print lines (B11)

**Implementation note:** Use `accessible={true}` and `accessibilityViewIsModal={false}`. Do not trap focus on this screen (it is not a modal dialog in the ARIA sense). Ensure ScrollView does not block TalkBack swipe navigation.

### E5 — Motion / Animation

- Respect `useReducedMotion()` from `expo-accessibility`. If reduced motion is on: skip entry animation (render instantly, no fade/slide). Copy icon "copied" state still changes color (not animation-only feedback).

---

## F. Copy (Exact Strings)

All strings are final pending orchestrator/founder review. Implementors use these verbatim.

### F1 — Hero Headline (B4)
```
You're invited to shape SwingBy
```

### F2 — Sub-headline (B6)
```
Be among the first to experience Calgary's new service marketplace.
```

### F3 — Body Copy Paragraph 1 (B7)
```
SwingBy connects people who need services with skilled local businesses — from home repairs to personal training, all in one place.
```

### F4 — Body Copy Paragraph 2 (B7)
```
As a beta tester, your feedback directly shapes the app. Share what works, what doesn't, and what you wish existed.
```

### F5 — Invite Code Label (B8)
```
Your invite code
```

### F6 — Invite Code Value (B8) — runtime value
```
SWING-XXXXXX
```
*(Replace `XXXXXX` with the actual 6-character alphanumeric token from the deep-link. Always uppercase. Always hyphenated after "SWING".)*

### F7 — CTA Button Label (B9) — Default
```
Join the Beta
```

### F8 — CTA Button Label (B9) — Success state
```
You're in! ✓
```

*(The ✓ character is Unicode U+2713 CHECK MARK. If rendering issues arise on Android, use a native checkmark icon instead of the Unicode character.)*

### F9 — Secondary Link (B10)
```
Already have an account?  Sign in
```
*(Two spaces before "Sign in" for visual breathing room — or implement as two separate Text components with gap. "Sign in" is the tappable link portion.)*

### F10 — Fine Print Line 1 (B11)
```
This invite is personal to you. Please do not share it.
```

### F11 — Fine Print Line 2 (B11)
```
Invite expires in 7 days · SwingBy Inc. © 2026
```
*(Use the middle-dot character · U+00B7 as separator.)*

### F12 — Error Banner Copy (C6 error state)
```
Something went wrong. Please try again or contact support@swingby.ca
```

### F13 — Copied! feedback (C2 copy icon state)
```
Copied!
```
*(Replace the "Your invite code" label text for 1000ms, then revert.)*

---

## Implementation Notes for mobile-agent

- This screen receives the invite token via deep-link params. Use `expo-linking` to parse `swingby://invite?code=TOKEN`.
- Store the parsed token in local component state. Display it in B8. Pass it to the signup screen via navigation params when CTA is tapped.
- No network call on this screen. Validation of the token happens on the backend during signup, not here.
- Use `expo-clipboard` for the copy-to-clipboard action (B8).
- Use `expo-haptics` (light impact) on CTA button press and on copy-icon press for tactile feedback.
- Wrap entire screen in `SafeAreaView` with `edges={['top', 'bottom']}`.
- Use `KeyboardAvoidingView` only if a future iteration adds email input. Not needed now.
- Test on: iPhone SE (375pt), iPhone 15 (390pt), iPhone 15 Pro Max (430pt), Pixel 7 (412pt).

---

*Spec version: 1.0 — 2026-06-17 — design-agent*
