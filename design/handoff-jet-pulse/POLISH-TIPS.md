# SwingBy Polish Tips — craft rules for coding agents

Read `README.md` first (direction 2a "Jet × Pulse", tokens, per-screen specs). This file is the **craft layer**: the details that separate "implemented the spec" from "looks designed". Apply on every screen, every PR. Reference mocks for ALL screens: `SwingBy All Screens.dc.html` (in this folder).

## 1. Typography
- Headings & all numerals: **Space Grotesk 700**. Body/UI: **Inter**. Never mix them within one text element.
- Tight tracking scales with size: 27–40px → −1 to −1.5px; 19–24px → −0.5px; below 17px → 0. Loose headings instantly look off-system.
- Uppercase section labels are EXACTLY: 11px / 600 / letter-spacing 1.4px / `#8B92A0`. Not 12px, not 700, not gray-white.
- Line-height: headings 1.1–1.15; body 1.5 (e.g. 15px/24px). Never default (`normal`) on multi-line body.
- Money: always Space Grotesk 700 + `#2EBD85`, even inline in a sentence ("$180 · held in escrow" — only the whole value phrase is green, not the label).
- No font-weight 400 headings, no 800/900 anywhere (not loaded — will fake-bold).

## 2. Color discipline
- Purple `#6E56F7` is a **scarce resource**: primary CTA (max one per screen), active nav item, live/pulse dots, selected states. If a screen has 3+ purple elements that aren't those, remove some.
- Text on dark surfaces is `#F4F6FA` / `#8B92A0` / `#565D6B` — three tiers only. Never pure `#FFF`, never `opacity:` to make text dimmer (use the tier token).
- Purple TEXT is always `#8878F9` (accentText), never `#6E56F7` (fails contrast on `#07080A`).
- Warnings `#F6B23B`, errors `#FF5C5C`, success/money `#2EBD85` — always as 14% alpha tinted chips/backgrounds (`rgba(x,y,z,0.14)`) with full-strength text, never solid saturated backgrounds.
- Every colored fill that isn't the accent CTA should be a tint, not a solid.

## 3. Surfaces, borders, depth
- Depth comes from **border + fill difference**, not shadow. Card = `#0F1115` + 1px `#1F232B`, radius 20. Nested element inside a card = `#161A21`, radius 12–14. Never nest same-color surfaces (invisible edges).
- Shadows only on: floating "+" nav button (`0 8px 24px rgba(110,86,247,0.4)`), overlapping status cards / sheets (`0 12px 40px rgba(0,0,0,0.5)`). Nowhere else.
- Row dividers inside cards: 1px `#1F232B`; list dividers on bg: 1px `#14171D` (darker — this distinction matters).
- Radius scale: 20–22 cards, 16 avatars/tiles, 12–14 buttons & inputs, 999 only for pills/dots/avatars-round. **Never pill-shaped buttons.**

## 4. Spacing & alignment
- Screen gutter: 20px, always. Content never touches the edge; full-bleed only for maps/hero images.
- One spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32. If you typed 13, 15 or 18px padding, snap it.
- Optical alignment: text inside cards aligns to one left edge — icon columns get fixed width so labels line up. Right-side metadata (timestamps, prices, chevrons) right-aligns to a single edge.
- Vertical rhythm on a screen: hero → 24–32px → first section; between sections 32px; section label → content 12–14px.
- Give lists breathing room: rows 14px vertical padding minimum; never let two 13px lines sit with <3px gap.

## 5. Icons
- Feather only, stroke 1.8 (nav 1.9), sizes 16–22. **Zero emoji anywhere** — including empty states, placeholders and toasts.
- Icon + label rows: icon 17–18px, `#8B92A0` unless the row is active/selected.
- Icons vertically center against the first line of text, not the whole block.

## 6. Touch targets & states
- Everything tappable ≥ 44px hit area (visual can be smaller — pad the pressable).
- Pressed states: buttons scale 0.98 + opacity 0.9 (RN `Pressable`); rows highlight `#0F1115`→`#12151B`. No state = feels broken.
- Disabled: 40% opacity on the whole button, never a gray recolor.
- Inputs on focus: border `#1F232B` → `#6E56F7` (1px stays 1px — don't grow to 2px, it shifts layout).

## 7. Motion
- Entry: existing spring (stiffness 220, damping 22), stagger 60–80ms, translateY 12–16px + fade. Cards only — never stagger individual text lines.
- Live/pulse dots: 1.8s loop, ring 0→9px expanding + fading. Only on genuinely live things.
- Never animate layout on data refresh (no cards jumping); crossfade content instead.
- Screen transitions, sheets, keyboards: platform defaults. Don't invent custom navigation transitions.

## 8. Content & edge cases (where polish usually dies)
- Long text: names/titles single-line + ellipsis; message previews single-line; addresses may wrap to 2 lines max.
- Empty states: Feather icon 28px in a 64px tinted circle (`#161A21`), one 15.5px/600 line, one 13.5px `#8B92A0` line, optional secondary button. No illustrations, no emoji.
- Skeletons: match final card dimensions exactly (radius included), fill `#0F1115`, shimmer to `#161A21`.
- Numbers align: tabular numerals (`fontVariant: ['tabular-nums']`) for prices, timers, stats columns.
- Timestamps: relative under 24h ("12 min ago"), then "Thu" / "Jun 30". 12px `#565D6B`.
- Avatars with no photo: initials tile, `#2A2247` bg + `#8878F9` Space Grotesk 700 — never gray, never a person icon.

## 9. iOS-specific
- Respect safe areas: bottom nav bar pads to home indicator (~30px); headers start below status bar (~60–70px), content never slides under it unscrolled.
- Keyboard: inputs scroll into view with 16px clearance; sticky CTAs lift above keyboard.
- Status bar: light content, bg `#07080A` (or transparent over maps).

## 10. Self-review checklist (run per screen before committing)
1. Screenshot the screen and compare side-by-side with its mock in `SwingBy All Screens.dc.html`. Spacing/hierarchy should match at a glance.
2. Count purple elements — CTA + active nav + live dots only?
3. Any emoji, pill buttons, pure-white text, default line-height, shadow on a resting card, off-scale padding? Fix.
4. Long-name test: swap in "Konstantinos Papadopoulos-Whitfield" and a 3-line address — nothing overflows or misaligns.
5. Empty + loading + error states styled, not just the happy path.
6. Tap every element — pressed state visible, hit area ≥44px.

## Common agent failure modes (seen before — don't repeat)
- Restyling the happy path and leaving empty/loading states in the old style.
- "Improving" the spec with extra gradients, glows or shadows. There are exactly two sanctioned glow moments (README §10).
- Replacing tokens with hardcoded near-miss hexes (`#0E1116` instead of `#0F1115`). Always import from `theme/tokens.js`.
- Making buttons pills or rounding cards to 24+.
- Bumping font sizes "for readability" — the scale is intentional; fix hierarchy with weight/color, not size.
- Adding icons/stats/badges the mock doesn't have. Less is more.
