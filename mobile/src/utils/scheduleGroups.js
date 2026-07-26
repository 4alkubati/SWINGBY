// Day-grouping for the business Jobs → "Scheduled" tab (walkthrough audit D7).
//
// The Jobs tabs used to be Today / Upcoming / Needs action / Past. "Today" and
// "Upcoming" were two filters over the same one thing — a booking with a
// locked-in date — split at an arbitrary midnight. Kira's call on the
// 2026-07-24 walkthrough: one **Scheduled** list instead, spanning roughly the
// next three months, grouped by day, reading "Today", "Tomorrow", then dated
// headers. That makes "Today" the first section of the list a business owner
// lands on rather than a tab they have to pick, and it makes next week visible
// without switching anything.
//
// This module owns only the grouping. Which bucket a booking belongs to is
// still `utils/bookingBuckets.js` — the Dashboard's counts read from that same
// file, so the two screens can never disagree (CARD-24).
//
// Three deliberate decisions, all covered by tests:
//
//  1. **Empty days are never rendered.** Groups are built FROM the jobs, so a
//     day with nothing on it simply never creates a group. Sat → Wed with
//     nothing between yields two headers, not five.
//
//  2. **Undated jobs lead the list, under "Date not set".** A booking the
//     client already accepted but whose date handshake hasn't closed
//     (`status: 'confirmed'`, `confirmed_date: null` — see bookingBuckets.js)
//     cannot be filed under any day. Dropping it from Scheduled would hide the
//     single most urgent thing on the screen behind another tab, so it goes at
//     the TOP, above Today. It also still appears under Needs action: that tab
//     is a cross-cutting "blocked on you" queue (it also holds new leads, which
//     aren't bookings at all), so the overlap is by design. This is NOT the
//     B11 bug — that was one lead rendering in two *contradictory* states.
//
//  3. **Past the horizon, jobs fall into a trailing "Later" group.** Nothing is
//     ever dropped for being too far out; a job 5 months away is still one
//     scroll from the bottom rather than invisible.
//
// Overdue jobs (an `in_progress` booking whose date has already passed) merge
// into the Today group rather than opening their own stale-dated header —
// bookingBuckets already treats them as today's problem.

import { bucketBooking, jobDate, byJobDateAsc } from './bookingBuckets';

/** "Roughly 3 months" — the Scheduled horizon, in days. */
export const SCHEDULE_HORIZON_DAYS = 92;

/** Midnight, local time, on the calendar day `d` falls in. */
export function startOfLocalDay(d) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/**
 * Whole calendar days from `a` to `b`, local time. Rounded, so the 23- and
 * 25-hour days either side of a DST switch still count as one day.
 */
export function daysBetweenLocal(a, b) {
  return Math.round((startOfLocalDay(b) - startOfLocalDay(a)) / 86400000);
}

/**
 * Stable per-day key, local time. Deliberately NOT toISOString().slice(0, 10):
 * that is UTC, and an 8pm Calgary job would key to the following day.
 */
export function localDayKey(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** 'today' | 'tomorrow' | 'day' — which heading a dated group gets. */
export function dayGroupKind(date, now) {
  const delta = daysBetweenLocal(now, date);
  if (delta <= 0) return 'today'; // includes overdue
  if (delta === 1) return 'tomorrow';
  return 'day';
}

/**
 * Groups a business's bookings into the Scheduled list.
 *
 * Returns an ordered array of
 *   `{ key, kind, date, jobs }`
 * where `kind` is 'undated' | 'today' | 'tomorrow' | 'day' | 'later' and
 * `date` is local midnight of the group's day (null for undated/later).
 * The caller turns `kind` into a heading — this module stays string-free so it
 * carries no locale.
 *
 * Order: Date not set → today → ascending days → Later.
 * Past (completed/cancelled) bookings are excluded entirely; they live on the
 * Past tab.
 */
export function groupScheduledJobs(bookings, options = {}) {
  const now = options.now || new Date();
  const horizonDays = options.horizonDays ?? SCHEDULE_HORIZON_DAYS;

  const undated = [];
  const dated = [];
  const later = [];

  (bookings || []).forEach((booking) => {
    if (!booking) return;
    const bucket = bucketBooking(booking, now);
    if (bucket === 'past') return;
    if (bucket === 'needsAction') {
      undated.push(booking);
      return;
    }
    const d = jobDate(booking);
    // Defensive: bookingBuckets only returns today/upcoming when a date
    // exists, but never let a malformed row disappear off the screen.
    if (!d) {
      undated.push(booking);
      return;
    }
    if (daysBetweenLocal(now, d) > horizonDays) later.push(booking);
    else dated.push(booking);
  });

  const groups = [];

  if (undated.length > 0) {
    groups.push({
      key: 'undated',
      kind: 'undated',
      date: null,
      jobs: [...undated].sort(byJobDateAsc),
    });
  }

  // Sorting first means the Map's insertion order IS date order, and only days
  // that actually have a job ever get an entry — that is decision (1) above.
  const byDay = new Map();
  [...dated].sort(byJobDateAsc).forEach((booking) => {
    const d = jobDate(booking);
    const kind = dayGroupKind(d, now);
    // Overdue and today collapse into one 'today' group; without this an
    // in_progress job from last Tuesday would open its own header that also
    // said "Today".
    const key = kind === 'today' ? 'today' : localDayKey(d);
    if (!byDay.has(key)) {
      byDay.set(key, { key, kind, date: startOfLocalDay(kind === 'today' ? now : d), jobs: [] });
    }
    byDay.get(key).jobs.push(booking);
  });
  byDay.forEach((group) => groups.push(group));

  if (later.length > 0) {
    groups.push({
      key: 'later',
      kind: 'later',
      date: null,
      jobs: [...later].sort(byJobDateAsc),
    });
  }

  return groups;
}

/** Total jobs across grouped output — what the "Scheduled (n)" tab count shows. */
export function countScheduledJobs(groups) {
  return (groups || []).reduce((sum, g) => sum + g.jobs.length, 0);
}
