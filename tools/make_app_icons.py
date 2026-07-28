#!/usr/bin/env python3
"""Render the SwingByy app icon + splash masters from the design handoff.

Handoff: design/handoff-logo/README.md — the approved direction is turn 4b
("Type only") plus the full-name stacked icon tile. The handoff explicitly
says NOT to ship its reference HTML: "generate flattened PNG/SVG masters per
platform spec". So we lay the type out directly with the real Space Grotesk
700 face the app already bundles, and write the four masters app.json points
at. Rerun after any brand change:

    python3 tools/make_app_icons.py mobile      # needs Pillow

Regenerating is deterministic — same input font, same bytes out.

Spec ratios, derived from the handoff's reference table and checked against
all four of its rows (96/64/54/40px tiles):
    font-size      =  0.3021 x tile   (29/96)
    letter-spacing = -0.0146 x tile   (-1.4/96, i.e. -0.048 x font-size)
    overlap margin = -0.0833 x tile   (-8/96,   i.e. -0.276 x font-size)
    corner radius  =  0.2292 x tile   (22/96)
    line-height    =  0.92   x font-size  (baseline-to-baseline)

The wordmark (single line, splash) uses its own reference values:
    letter-spacing = -0.0446 x font-size  (-5/112)
    overlap margin = -0.2679 x font-size  (-30/112)
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

MOBILE = pathlib.Path(sys.argv[1])
OUT = MOBILE / "assets"
FONT_PATH = (MOBILE / "node_modules/@expo-google-fonts/space-grotesk"
                      "/700Bold/SpaceGrotesk_700Bold.ttf")

# Design tokens (handoff "Design Tokens")
JET = (0x07, 0x08, 0x0A, 255)
SNOW = (0xF4, 0xF6, 0xFA, 255)
PULSE = (0x88, 0x78, 0xF9, 255)
BORDER = (0x1F, 0x23, 0x2B, 255)

SS = 4  # supersample factor; everything is drawn at SSx then LANCZOS'd down


def kerned_positions(runs, font, letter_spacing):
    """Lay out one line given as (text, colour, extra_x_offset) runs.

    Each glyph's x comes from measuring the whole prefix before it, so the
    font's own kerning pairs survive; uniform tracking is then added per
    glyph. That is what CSS `letter-spacing` does on top of kerning.
    """
    placed = []
    prefix = ""
    shift = 0.0
    for text, colour, offset in runs:
        shift += offset
        for i, ch in enumerate(text):
            x = font.getlength(prefix) + len(prefix) * letter_spacing + shift
            placed.append((x, ch, colour))
            prefix += ch
    return placed


def render_text(runs, font, letter_spacing, line_gap=0.0):
    """Draw `runs` (a list of lines, each a list of runs) on a transparent
    layer and crop to the ink. Returns the cropped RGBA image."""
    pad = int(font.size * 2)
    w = int(sum(font.getlength(t) for line in runs for t, _, _ in line) + pad * 2)
    h = int(font.size * 3 + line_gap * len(runs) + pad * 2)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    for li, line in enumerate(runs):
        placed = kerned_positions(line, font, letter_spacing)
        # centre each line horizontally on the layer by its own advance width
        advance = max(x + font.getlength(ch) for x, ch, _ in placed)
        x0 = (w - advance) / 2
        baseline = pad + font.size + li * line_gap
        for x, ch, colour in placed:
            d.text((x0 + x, baseline), ch, font=font, fill=colour, anchor="ls")

    return layer.crop(layer.getbbox())


def tile(size, *, radius_ratio=0.0, border=False, bg=JET, transparent=False):
    """A blank tile at SSx resolution."""
    px = size * SS
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    if transparent:
        return img
    d = ImageDraw.Draw(img)
    r = radius_ratio * px
    if r > 0:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=r, fill=bg)
        if border:
            d.rounded_rectangle([0, 0, px - 1, px - 1], radius=r,
                                outline=BORDER, width=max(1, round(px / size)))
    else:
        d.rectangle([0, 0, px - 1, px - 1], fill=bg)
    return img


def paste_centre(base, art, cy_ratio=0.5):
    x = (base.width - art.width) // 2
    y = int(base.height * cy_ratio - art.height / 2)
    base.alpha_composite(art, (x, y))
    return base


def stacked_icon(size, *, scale=1.0, radius_ratio=0.0, border=False,
                 transparent=False, fit_circle=None):
    """The two-line 'Swing / Byy' app-icon tile, per the handoff table."""
    px = size * SS
    fs = 0.3021 * px * scale
    ls = -0.0146 * px * scale
    ov = -0.0833 * px * scale
    font = ImageFont.truetype(str(FONT_PATH), int(round(fs)))

    art = render_text(
        [[("Swing", SNOW, 0.0)],
         [("By", PULSE, 0.0), ("y", SNOW, ov)]],
        font, ls, line_gap=0.92 * fs)

    if fit_circle:
        # Android adaptive: the launcher mask may be a circle, so the whole
        # ink box has to fit inside the guaranteed-visible circle.
        import math
        diag = math.hypot(art.width, art.height)
        target = fit_circle * px
        if diag > target:
            k = target / diag
            art = art.resize((max(1, int(art.width * k)),
                              max(1, int(art.height * k))), Image.LANCZOS)

    base = tile(size, radius_ratio=radius_ratio, border=border,
                transparent=transparent)
    paste_centre(base, art)
    return base.resize((size, size), Image.LANCZOS)


def wordmark(width, height, *, target_width_ratio=0.55):
    """Single-line 'SwingByy' wordmark (turn 4b) centred on a Jet field."""
    px_w, px_h = width * SS, height * SS
    # solve font size so the ink lands at the requested share of the width
    fs = px_w * 0.12
    for _ in range(6):
        font = ImageFont.truetype(str(FONT_PATH), int(round(fs)))
        art = render_text([[("Swing", SNOW, 0.0), ("By", PULSE, 0.0),
                            ("y", SNOW, -0.2679 * fs)]],
                          font, -0.0446 * fs)
        err = (target_width_ratio * px_w) / art.width
        if abs(err - 1) < 0.01:
            break
        fs *= err

    base = Image.new("RGBA", (px_w, px_h), JET)
    paste_centre(base, art)
    return base.resize((width, height), Image.LANCZOS)


def save(img, name, alpha=False):
    # App Store review rejects an icon that carries an alpha channel, so the
    # opaque masters are flattened to RGB. Only the Android foreground and the
    # rounded favicon actually need transparency.
    p = OUT / name
    img.convert("RGBA" if alpha else "RGB").save(p, "PNG", optimize=True)
    print(f"OK  {name:20s} {img.width}x{img.height}  "
          f"{'RGBA' if alpha else 'RGB '}  {p.stat().st_size:,}b")


# iOS / Play store master: full bleed, square. Both OSes apply their own mask,
# so a pre-rounded or pre-bordered master would get double-masked and clipped.
save(stacked_icon(1024), "icon.png")

# Android adaptive foreground: transparent, ink fitted inside the safe circle
# (66% of the canvas) so no launcher mask can crop the wordmark.
save(stacked_icon(1024, transparent=True, fit_circle=0.66),
     "adaptive-icon.png", alpha=True)

# Web favicon: a real tile, never OS-masked — so it keeps the handoff's
# 22.9% radius and 1px #1F232B border (and needs alpha for the corners).
save(stacked_icon(48, radius_ratio=0.2292, border=True),
     "favicon.png", alpha=True)

# Splash: the single-line wordmark on Jet, matching app.json backgroundColor.
save(wordmark(1242, 2688), "splash.png")
