// Guards the two things that make this screen wrong rather than ugly: a code that
// does not match what the sender sees, and copy that promises something the code
// does not do.
import { normaliseCode } from '../BetaInviteCardScreen';
import i18n from '../../../i18n';

describe('normaliseCode', () => {
  it.each([
    ['swing-a7x3', 'SWING-A7X3'],
    ['SWINGA7X3', 'SWING-A7X3'],
    ['SWING-A7X3', 'SWING-A7X3'],
    ['  swing a7x3  ', 'SWING-A7X3'],
  ])('normalises %s to %s', (raw, expected) => {
    expect(normaliseCode(raw)).toBe(expected);
  });

  it('returns null for a missing or unusable code, so the screen can say so', () => {
    // A link can arrive without a code. Rendering "SWING-" or "undefined" as if it
    // were a real invite is worse than admitting the link was incomplete.
    expect(normaliseCode(undefined)).toBeNull();
    expect(normaliseCode(null)).toBeNull();
    expect(normaliseCode('')).toBeNull();
    expect(normaliseCode('   ')).toBeNull();
    expect(normaliseCode('!!!')).toBeNull();
    expect(normaliseCode(12345)).toBeNull();
  });

  it('leaves a non-SWING code alone rather than inventing a prefix', () => {
    expect(normaliseCode('BETA99')).toBe('BETA99');
  });
});

describe('invite copy tells the truth', () => {
  const all = ['en', 'fr-CA', 'ar', 'uk'];

  it('never claims an expiry — no invite expiry exists in the backend', () => {
    // The 2026-06-17 spec said "Invite expires in 7 days". Nothing enforces that.
    // Same class as the 50/50 payment claim that had to be pulled from the store
    // listing: copy promising a rule the code does not have.
    for (const locale of all) {
      const blob = Object.entries(i18n.translations[locale])
        .filter(([k]) => k.startsWith('invite.'))
        .map(([, v]) => v)
        .join(' ');
      expect(blob).not.toMatch(/expir|expire|expiry|витікає|تنتهي|expire/i);
    }
  });

  it('never names a company that does not exist', () => {
    // The legal entity is `4alkubati`. "SwingBy Inc." is not a real corporation and
    // must not appear in a copyright line on the first screen a stranger sees.
    for (const locale of all) {
      const blob = Object.entries(i18n.translations[locale])
        .filter(([k]) => k.startsWith('invite.'))
        .map(([, v]) => v)
        .join(' ');
      expect(blob).not.toMatch(/\bInc\.?\b|\bLLC\b|\bLtd\.?\b/i);
    }
  });

  it('is translated into every shipped locale', () => {
    const enKeys = Object.keys(i18n.translations.en).filter((k) =>
      k.startsWith('invite.'),
    );
    expect(enKeys.length).toBeGreaterThan(15);
    for (const locale of all) {
      const missing = enKeys.filter((k) => !i18n.translations[locale][k]);
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });
});
