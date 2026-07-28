# Handoff: SwingByy Logo & App Icon

## Overview
Final wordmark and app icon system for SwingByy. The wordmark types "SwingByy" in two colors with the trailing double-y tightly overlapped into a single mark (turn 4b, "Type only"). The app icon set shows the full "SwingByy" name (not a mark-only crop), stacked on two lines to stay legible at small sizes.

## About the Design Files
The bundled file (`SwingByy Logo.dc.html`) is a **design reference built in HTML** — it shows the intended look, colors, type, and layout. It is not production code to copy in directly. Recreate this design in the target app's existing environment (React Native, SwiftUI, Android/Kotlin, web, etc. — whichever the codebase already uses) using its established component and asset patterns. If exporting as an app icon, generate flattened PNG/SVG masters per platform spec rather than shipping live HTML/CSS.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and the overlap amount are final values — recreate pixel-perfectly.

## Chosen Direction: Turn 4b + full-name icon
Skip turns 1–3 and 5 in the file — those are earlier explorations kept for reference/contrast only. The approved design is:

### Wordmark (4b, "Type only")
- Font: **Space Grotesk**, weight 700, italic none.
- Text: `Swing` + `By` + `y` (three consecutive spans, no space).
- Color split: `Swing` = Snow `#F4F6FA`, `By` = Pulse `#8878F9`, trailing `y` = Snow `#F4F6FA`.
- At the reference display size (font-size 112px, letter-spacing -5px), the trailing `y` overlaps the previous `y` by **30px** (~27% of the cap size) via `margin-left: -30px` on the last `y` span — tight enough the two nearly merge but the purple y's tail still reads underneath the white one.
- Scale the overlap proportionally with font size (≈0.27 × font-size as a negative margin on the last glyph).
- Line-height: 1. No drop shadow, no bevel.

### App icon — full name, not mark-only
Unlike earlier turns, the icon shows the complete name, stacked two lines to fit a square tile:
- Line 1: `Swing`
- Line 2: `By` + `y` (same color split and overlap logic as the wordmark, scaled down)
- Line-height: 0.92 (tight stack), letter-spacing scales with font-size (≈ -0.048 × font-size).

Two background/foreground pairings:
- **Jet tile** (dark bg `#07080A`, 1px border `#1F232B`): `Swing` in Snow `#F4F6FA`, `By` in Pulse `#8878F9`, trailing `y` in Snow `#F4F6FA`.
- **Pulse tile** (bg `#8878F9`, no border): `Swing` and `By` in Jet `#07080A` (purple-on-purple is invisible, so both render dark), trailing `y` in Snow `#F4F6FA` — the white y still visibly overlaps the dark one.

Reference sizes used in the mock (scale font/letter-spacing/position proportionally for any other size):
| Tile size | Corner radius | Font size | Letter-spacing | Overlap margin |
|---|---|---|---|---|
| 96px | 22px | 29px | -1.4px | -8px |
| 64px | 15px | 19.5px | -0.9px | -5px |
| 54px (home screen) | 13px | 16.4px | -0.75px | -4.5px |
| 40px | 10px | 12.2px | -0.55px | -3px |

Below ~40px, if the stacked two-line name stops being legible, fall back to a mark-only tile (see turn 5's interlocked-yy mark in the file) rather than shrinking type further.

## Design Tokens
- **Snow** `#F4F6FA` — primary light/foreground.
- **Pulse** `#8878F9` — primary accent/purple.
- **Jet** `#07080A` — background/dark.
- Light-bg variant: swap Pulse for `#6E56F7` (slightly deeper) when placed on Snow backgrounds, per the "light bg" wordmark samples in the file.
- Font: **Space Grotesk** (700) for all logo/wordmark type; **Inter** (400–700) for surrounding UI/body copy — not part of the logo itself.
- Border radius on icon tiles follows standard iOS-style superellipse proportions: ~22.9% of tile size (e.g. 22px on a 96px tile).
- Tile border (dark tiles only): 1px solid `#1F232B`.

## Assets
No external image assets — the wordmark and icon are pure type (Space Grotesk) plus flat color fills, no SVG artwork required for this final direction.

## Files
- `SwingByy Logo.dc.html` — full exploration doc; the approved design is **turn 4, option 4b** (wordmark) plus the "Jet tile / Pulse tile — full name" and "Home screen" icon examples in that same turn. Turns 1, 2, 3, and 5 are prior explorations, kept for context only — do not implement them.
