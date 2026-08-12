/**
 * Text's line box must grow with the OS font setting.
 *
 * All 17 variants in typeScale hardcode a lineHeight next to a fontSize
 * (display1 40/48, h1 20/26, body 16/24...). React Native scales fontSize when
 * allowFontScaling is on, but never a hardcoded lineHeight — so at Android's
 * 2.0x accessibility setting the glyphs doubled inside their original line box
 * and clipped. Every style in the app, not just headings.
 *
 * Found via ScreenHeader (2026-08-11), where it was fixed locally by unsetting
 * lineHeight. This is the app-wide fix, and it keeps the designed ratios rather
 * than discarding them.
 */
import { PixelRatio } from 'react-native';
import { scaledLineHeight } from '../Text';
import { typeScale } from '../../theme/typography';

const at = (scale, fn) => {
  const spy = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(scale);
  try { return fn(); } finally { spy.mockRestore(); }
};

describe('line height scales with the OS font setting', () => {
  it('does not touch the style at default scale', () => {
    // Returning null keeps typeScale's own lineHeight in the style array —
    // no override, no behaviour change for the overwhelming majority of users.
    at(1, () => expect(scaledLineHeight('h1')).toBeNull());
  });

  it('grows the line box at 2.0x so the glyph cannot clip', () => {
    at(2, () => {
      expect(scaledLineHeight('h1')).toEqual({ lineHeight: typeScale.h1.lineHeight * 2 });
    });
  });

  it('preserves each variant own ratio rather than flattening them', () => {
    // moneyLarge is deliberately tight (1.10), body deliberately loose (1.50).
    // Scaling must not homogenise them into one house ratio.
    at(1.75, () => {
      for (const v of ['body', 'moneyLarge', 'display1', 'caption', 'label']) {
        const scaled = scaledLineHeight(v).lineHeight;
        const scaledFontSize = typeScale[v].fontSize * 1.75;
        expect(scaled / scaledFontSize).toBeCloseTo(
          typeScale[v].lineHeight / typeScale[v].fontSize, 5,
        );
      }
    });
  });

  it('stops at maxFontSizeMultiplier, so a capped Text gains no dead space', () => {
    // A capped Text stops growing at the cap; its box must stop there too.
    at(2, () => {
      expect(scaledLineHeight('h1', 1.3)).toEqual({
        lineHeight: typeScale.h1.lineHeight * 1.3,
      });
    });
  });

  it('never shrinks the box below the design', () => {
    // Some devices report a scale under 1. Shrinking a designed line box is a
    // different bug, not a fix for this one.
    at(0.85, () => expect(scaledLineHeight('body')).toBeNull());
  });

  it('is inert for a variant with no lineHeight to scale', () => {
    expect(scaledLineHeight('definitely-not-a-variant')).toBeNull();
  });

  it('covers every variant in the scale — none left clipping', () => {
    at(2, () => {
      for (const [name, style] of Object.entries(typeScale)) {
        if (!style.lineHeight || !style.fontSize) continue;
        expect(scaledLineHeight(name)).toEqual({ lineHeight: style.lineHeight * 2 });
      }
    });
  });
});
