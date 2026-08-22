/**
 * Outro calls to action — an ENUM, deliberately, so no free-text CTA can reach
 * a frame.
 *
 * FACTS.md section 5: the app is NOT on the App Store until Oct 1-10, 2026, and
 * iOS goes to TestFlight first. Any store-install call to action is banned, as is
 * any wording implying the app can be installed today. FACTS section 5 names the
 * three correct calls to action verbatim; these are them and there are no others.
 *
 * To add a fourth, change FACTS.md first. That is the whole point of the enum.
 */

export const CTA = {
  WAITLIST: 'waitlist',
  FOLLOW: 'follow',
  EARLY_ACCESS: 'early_access',
} as const;

export type CtaKey = (typeof CTA)[keyof typeof CTA];

export const CTA_COPY: Record<CtaKey, {line: string; sub: string; facts: string}> = {
  [CTA.WAITLIST]: {
    line: 'Join the waitlist',
    sub: 'swingbyy.com',
    facts: '§5',
  },
  [CTA.FOLLOW]: {
    line: 'Follow for updates',
    sub: '@swingbyy',
    facts: '§5 · §6',
  },
  [CTA.EARLY_ACCESS]: {
    line: 'Calgary businesses — early access',
    sub: 'swingbyy.com',
    facts: '§5 · §1',
  },
};

/**
 * swingbyy.com — note the double y — is the ONLY domain we own (FACTS section 1).
 * The three near-miss spellings of it all belong to other companies; FACTS
 * section 1 lists them. Never render one, and never link to one.
 */
export const DOMAIN = 'swingbyy.com' as const;
export const HANDLE = '@swingbyy' as const;
