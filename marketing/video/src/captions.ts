import {CTA, type CtaKey} from './cta';

/**
 * THE CAPTION FILE. Every word that reaches a frame lives here and nowhere else.
 *
 * Rule, from Kira 2026-08-20 and FACTS.md's own: every caption is a CLAIM, and a
 * caption without a cited FACTS section does not render. `facts` is required by
 * the type, and assertCaption() throws at render time if it is empty — a missing
 * citation fails the render rather than shipping an uncited line.
 *
 * `python tools/claim_lint.py marketing/video` scans this file. marketing/video/
 * was added to the linter's PUBLIC_PREFIXES in the same commit that created this
 * project, so the section 4 (social proof) and section 5 (launch state) rules
 * apply here and not just the payment ones.
 *
 * WHY THERE IS NO PAYMENT OR ESCROW COPY ANYWHERE IN THIS FILE
 * ------------------------------------------------------------
 * FACTS section 2.5 is a standing freeze on the release model, and the staged
 * split claim it bans has been killed four separate times and keeps coming
 * back. reelkit/calgary-callbacks.json — the audited reel spec in the
 * brain — solves this by never mentioning money moving at all, and this file
 * follows it deliberately. If a future reel needs a money line, get it from
 * FACTS section 2 on the day, do not reconstruct it from memory, and expect
 * claim_lint to argue with you.
 *
 * The copy below is carried over from calgary-callbacks.json, which was already
 * claim-audited beat by beat. Reusing audited copy is cheaper than re-earning it.
 */

export type Caption = {
  /** Stable id, used by templates and by the manifest to bind a screen. */
  id: string;
  /** The lower-third line. Bold, short, readable on mute. */
  text: string;
  /** Optional second line, smaller. */
  sub?: string;
  /** REQUIRED. The FACTS.md section this claim stands on. */
  facts: string;
  /** Why this is safe to say — the audit note, for the next person. */
  note: string;
};

/** A caption with no citation is not a caption. Fail loudly, at render time. */
export const assertCaption = (c: Caption): Caption => {
  if (!c.facts || !c.facts.trim()) {
    throw new Error(
      `Caption "${c.id}" has no FACTS citation. Every caption is a claim; ` +
        `cite the section in FACTS.md or delete the line.`,
    );
  }
  return c;
};

export const CAPTIONS = {
  hook: {
    id: 'hook',
    text: 'Six cleaners.\nSix voicemails.',
    sub: 'One guy said maybe Tuesday.',
    facts: '§7',
    note:
      'Makes NO claim about the product: no speed, no supply, no outcome. It is a ' +
      'statement about phoning tradespeople in general. Deliberate — "we get you ' +
      'callbacks" is unsupportable with zero businesses live (§4).',
  },
  post: {
    id: 'post',
    text: "Say what's broken.",
    sub: "Pick a category. Four steps, that's it.",
    facts: '§1 · §3',
    note:
      '§1: clients post a job. "Four steps" is what the capture\'s own progress ' +
      'rail reads (CATEGORY / DETAILS / BUDGET / CONFIRM) — quoted, not invented.',
  },
  privacy: {
    id: 'privacy',
    text: 'Local pros see it.',
    sub: 'Not your name. Not your address. Not your budget.',
    facts: '§3.2',
    note:
      'The CORRECTED 2026-08-11 version. Says only what mask_service_post_row ' +
      'actually masks: name, address, budget. Says NOTHING about photos in either ' +
      'direction — photos ARE shown since 08-01, so "your photos stay private" is ' +
      'false and is not written here.',
  },
  quotes: {
    id: 'quotes',
    text: 'They send their own price.',
    sub: 'You never gave them a number to beat.',
    facts: '§3.2',
    note:
      'The business side of the same masking fact: budget is removed ' +
      'pre-acceptance, so a business quotes its own rate.',
  },
  status: {
    id: 'status',
    text: 'Booked. And you can see it.',
    sub: 'Confirmed. On the way. In progress. Done.',
    facts: '§3',
    note:
      'The four words are the app\'s own stepper labels, quoted. Deliberately NOT ' +
      'called tracking, ETA or live location — §3 and PR P1 forbid all three.',
  },
  payoff: {
    id: 'payoff',
    text: 'Easier than six phone calls.',
    facts: '§7',
    note: 'Carries no product claim at all — a callback to the hook. Tone only.',
  },
} as const satisfies Record<string, Caption>;

export type CaptionKey = keyof typeof CAPTIONS;

export const caption = (key: CaptionKey): Caption => assertCaption(CAPTIONS[key]);

/**
 * The city. FACTS section 1: Calgary first, and never imply multi-city coverage.
 */
export const CITY = 'Calgary' as const;

/** Default outro for reels that do not name one. FACTS section 5. */
export const DEFAULT_CTA: CtaKey = CTA.WAITLIST;
