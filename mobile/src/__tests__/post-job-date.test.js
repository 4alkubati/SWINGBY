// Preferred-date regression suite.
//
// The bug: PostJobScreen collected the preferred date as FREE TEXT (a field
// whose own placeholder was "Jul 5") and ran it through `new Date(str)`.
// A bare month-day string has no year, so it resolved to the year 2001 —
// a client who typed the placeholder booked a job 25 years in the past.
// Anything conversational ("Saturday", "tomorrow") failed to parse and was
// dropped silently. Across 35 production posts preferred_date was never once
// populated.
//
// The fix: a native DateTimePicker. State holds Date objects, never strings,
// so derivePreferredDate only has to combine them — there is nothing to parse
// and nothing to get wrong.

import fs from 'fs';
import path from 'path';
import { derivePreferredDate } from '../screens/client/PostJobScreen';

const SCREEN = path.join(__dirname, '..', 'screens', 'client', 'PostJobScreen.js');

describe('the old free-text date parser is gone', () => {
  it('demonstrates why it had to go: a bare "Jul 5" lands in 2001', () => {
    // This is what the removed code did. Kept as executable evidence.
    expect(new Date('Jul 5').getFullYear()).toBe(2001);
    // ...and a conversational answer produced an unusable date.
    expect(Number.isNaN(new Date('Saturday').getTime())).toBe(true);
  });

  it('PostJobScreen no longer builds the preferred date from typed text', () => {
    const src = fs.readFileSync(SCREEN, 'utf8');
    // The picker must be wired up.
    expect(src).toMatch(/from '@react-native-community\/datetimepicker'/);
    // mode="date" picker present, with a floor of today.
    expect(src).toMatch(/minimumDate=\{new Date\(\)\}/);
    // No live code may reconstruct a Date from a free-text field again.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/new Date\(\s*dateText/);
    expect(codeOnly).not.toMatch(/placeholder="Jul 5"/);
  });
});

describe('derivePreferredDate', () => {
  it('returns undefined when the client picked no date (the field is optional)', () => {
    expect(derivePreferredDate(null, null)).toBeUndefined();
    expect(derivePreferredDate(undefined, new Date())).toBeUndefined();
  });

  it('anchors to LOCAL NOON when no time was chosen', () => {
    const picked = new Date(2026, 6, 25); // 25 Jul 2026, local midnight
    const iso = derivePreferredDate(picked, null);
    const back = new Date(iso);
    expect(back.getHours()).toBe(12);
    expect(back.getMinutes()).toBe(0);
    // The day the client tapped is the day that gets sent.
    expect(back.getDate()).toBe(25);
    expect(back.getMonth()).toBe(6);
    expect(back.getFullYear()).toBe(2026);
  });

  it('uses the chosen time when the client picked one', () => {
    const picked = new Date(2026, 6, 25);
    const time = new Date(2026, 0, 1, 9, 30);
    const back = new Date(derivePreferredDate(picked, time));
    expect(back.getHours()).toBe(9);
    expect(back.getMinutes()).toBe(30);
    expect(back.getDate()).toBe(25);
  });

  it('never produces a year-2001 date, whatever is picked', () => {
    const picked = new Date(2026, 6, 25);
    expect(new Date(derivePreferredDate(picked, null)).getFullYear()).toBe(2026);
  });

  it('noon keeps the calendar day intact in UTC; midnight does not', () => {
    // Why noon and not midnight: the picked day is sent as an ISO instant, and
    // anything read back in UTC must still be the day the client tapped.
    // Midnight has zero slack — any timezone east of UTC rolls it forward and
    // any timezone west rolls it back. Noon has 12h of slack either way, which
    // covers every offset SwingBy operates in (Calgary is UTC-7/-6).
    // Simulated by offsetting the instant rather than changing the process TZ.
    for (let offsetHours = -11; offsetHours <= 11; offsetHours += 1) {
      const localNoon = new Date(Date.UTC(2026, 6, 25, 12 - offsetHours, 0, 0));
      expect(localNoon.getUTCDate()).toBe(25);
      expect(localNoon.getUTCMonth()).toBe(6);
    }

    // The same sweep anchored at midnight breaks for every non-zero offset.
    const midnightBreaks = [];
    for (let offsetHours = -11; offsetHours <= 11; offsetHours += 1) {
      const localMidnight = new Date(Date.UTC(2026, 6, 25, 0 - offsetHours, 0, 0));
      if (localMidnight.getUTCDate() !== 25) midnightBreaks.push(offsetHours);
    }
    expect(midnightBreaks.length).toBeGreaterThan(0);
  });
});
