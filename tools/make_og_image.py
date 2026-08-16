#!/usr/bin/env python3
"""Render web/*/public/og-image.png — the card every share of swingbyy.com shows.

    python3 tools/make_og_image.py            # writes both web apps' public/
    python3 tools/make_og_image.py --check    # exit 1 if the PNGs are stale

WHY THIS FILE EXISTS
--------------------
Until 2026-08-15 the card was a hand-made PNG that nothing regenerated, and it
carried three claims we are not allowed to make:

    "Verified reviews"   a verification gate that does not exist, and ratings
                         that have never been collected — FACTS.md §4, the
                         clause that bans inventing social proof outright
    "The trust layer     an unbacked quality claim about our own supply
     for local services"
    "SwingBy"            the dead one-y wordmark, banned by §0 since 08-08

That card is what renders in iMessage, WhatsApp, Discord, Slack, X and Google
for every link anyone has ever shared. It was the single most-seen surface we
have and the least audited, because it is pixels and every check we run reads
text. Generating it from a script means the claims live in source, in one
place, where `tools/claim_lint.py` and code review can both see them.

WHAT MAY GO ON THE CARD
-----------------------
Only mechanism, never quality. Every line below is traceable:

  wordmark   §0 + design/handoff-logo/README.md turn 4b
  headline   §1 — post a job, local businesses bid
  chips      §1 (Calgary only) and §3.2 (photos KEPT; name, address and budget
             masked pre-acceptance — verified in backend/app/privacy.py)

Deliberately absent: any adjective about the businesses, anything about
earnings or payouts (payments are in sandbox, §5), any count, rating or badge,
and any date — the same image is served by the pre-launch and launch apps, so
a date baked into it goes stale on its own.

THE WORDMARK RATIOS ARE NOT MINE TO CHANGE. They come from
design/handoff-logo/README.md and are the same numbers tools/make_app_icons.py
uses, kept in sync by hand and documented in both places:

    letter-spacing = -0.0446 x font-size   (-5/112)
    overlap margin = -0.2679 x font-size   (-30/112)

The trailing `y` overlapping the previous one IS the mark. It looks like a
rendering bug and it is not — a previous agent "fixed" it and deleted the
brand. See FACTS.md §0.1 before touching it.
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = pathlib.Path(__file__).resolve().parent.parent
FONTS = REPO / "mobile/node_modules/@expo-google-fonts"
GROTESK = FONTS / "space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf"
INTER = FONTS / "inter/400Regular/Inter_400Regular.ttf"
INTER_SEMI = FONTS / "inter/600SemiBold/Inter_600SemiBold.ttf"

TARGETS = [REPO / "web/pre-launch/public/og-image.png",
           REPO / "web/launch/public/og-image.png"]

W, H = 1200, 630          # the size every crawler expects; do not change
SS = 3                    # supersample, then LANCZOS down

# Design tokens — design/handoff-logo/README.md "Design Tokens"
JET = (0x07, 0x08, 0x0A, 255)
SNOW = (0xF4, 0xF6, 0xFA, 255)
PULSE = (0x88, 0x78, 0xF9, 255)
DIM = (0x9A, 0xA2, 0xB4, 255)
FAINT = (0x5A, 0x62, 0x73, 255)
CHIP_BG = (0x14, 0x16, 0x1C, 255)
CHIP_EDGE = (0x24, 0x28, 0x33, 255)

HEADLINE = "Post a job. Local businesses send you their price."
CHIPS = ["Calgary, AB", "They price from your photos", "Your budget stays private"]
DOMAIN = "swingbyy.com"


def kerned(runs, font, letter_spacing):
    """Lay out (text, colour, extra_x_offset) runs, preserving the font's own
    kerning pairs and adding uniform tracking on top — what CSS letter-spacing
    does. Same routine as tools/make_app_icons.py; both derive from the handoff."""
    placed, prefix, shift = [], "", 0.0
    for text, colour, offset in runs:
        shift += offset
        for ch in text:
            placed.append((font.getlength(prefix) + len(prefix) * letter_spacing + shift,
                           ch, colour))
            prefix += ch
    return placed


def wordmark(font_px):
    """`Swing` + `By` + overlapping `y`, cropped to its ink."""
    font = ImageFont.truetype(str(GROTESK), font_px)
    ls = -0.0446 * font_px
    ov = -0.2679 * font_px
    placed = kerned([("Swing", SNOW, 0.0), ("By", PULSE, 0.0), ("y", SNOW, ov)], font, ls)
    pad = font_px
    layer = Image.new("RGBA", (int(font_px * 9), int(font_px * 3)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x, ch, colour in placed:
        d.text((pad + x, pad + font_px), ch, font=font, fill=colour, anchor="ls")
    return layer.crop(layer.getbbox())


def glow(size, centre, radius, colour, strength):
    """A soft radial bloom, built small and upscaled — a real gaussian at this
    size costs more than the rest of the card put together."""
    w, h = size
    small = Image.new("L", (w // 16, h // 16), 0)
    d = ImageDraw.Draw(small)
    cx, cy = centre[0] / 16, centre[1] / 16
    r = radius / 16
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(255 * strength))
    small = small.filter(ImageFilter.GaussianBlur(r / 3))
    mask = small.resize((w, h), Image.BICUBIC)
    tint = Image.new("RGBA", (w, h), colour)
    tint.putalpha(mask)
    return tint


def chip(text, font, pad_x, pad_y, radius):
    tw = font.getlength(text)
    asc, desc = font.getmetrics()
    w = int(tw + pad_x * 2)
    h = int(asc + desc + pad_y * 2)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=CHIP_BG, outline=CHIP_EDGE, width=SS)
    d.text((pad_x, pad_y + asc), text, font=font, fill=DIM, anchor="ls")
    return img


def render():
    w, h = W * SS, H * SS
    card = Image.new("RGBA", (w, h), JET)
    card.alpha_composite(glow((w, h), (w / 2, h * 0.34), w * 0.34, PULSE, 0.30))

    mark = wordmark(int(118 * SS))
    card.alpha_composite(mark, ((w - mark.width) // 2, int(h * 0.30 - mark.height / 2)))

    d = ImageDraw.Draw(card)
    head_font = ImageFont.truetype(str(INTER), int(34 * SS))
    d.text((w / 2, int(h * 0.565)), HEADLINE, font=head_font, fill=SNOW, anchor="ms")

    chip_font = ImageFont.truetype(str(INTER_SEMI if INTER_SEMI.exists() else INTER), int(21 * SS))
    chips = [chip(c, chip_font, 20 * SS, 11 * SS, 8 * SS) for c in CHIPS]
    gap = 14 * SS
    total = sum(c.width for c in chips) + gap * (len(chips) - 1)
    x = (w - total) // 2
    y = int(h * 0.685)
    for c in chips:
        card.alpha_composite(c, (x, y))
        x += c.width + gap

    foot_font = ImageFont.truetype(str(INTER), int(22 * SS))
    d.text((w / 2, int(h * 0.90)), DOMAIN, font=foot_font, fill=FAINT, anchor="ms")

    return card.resize((W, H), Image.LANCZOS).convert("RGB")


def main() -> int:
    for p in (GROTESK, INTER):
        if not p.exists():
            print(f"missing font: {p}\n  run `npm install` in mobile/ first", file=sys.stderr)
            return 2
    card = render()
    check = "--check" in sys.argv
    stale = []
    for target in TARGETS:
        if check:
            if not target.exists():
                stale.append(f"{target} does not exist")
                continue
            import io
            buf = io.BytesIO()
            card.save(buf, "PNG", optimize=True)
            if buf.getvalue() != target.read_bytes():
                stale.append(f"{target} is stale — rerun tools/make_og_image.py")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        card.save(target, "PNG", optimize=True)
        print(f"wrote {target.relative_to(REPO)} ({target.stat().st_size // 1024} KB)")
    if stale:
        print("\n".join(stale), file=sys.stderr)
        return 1
    if check:
        print("og-image.png is current in both web apps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
