// How a booking-event timestamp is rendered in a timeline.
//
// SB-0010 — the timeline mixed two clocks with nothing to separate them.
// "Date confirmed / Time set at posting: Sun, Aug 16, 10:13 PM / Logged 1:19 AM"
// then On the way 1:21 AM, Pro arrived 1:21 AM, Job complete 1:28 AM. The
// scheduled service time carries a full date; the Logged rows carried a
// bare wall-clock time. Read top to bottom, the job appears to have been
// confirmed four hours AFTER it finished.
//
// It is a low-severity presentation bug right up until it isn't: this is the
// screen a client reads during a dispute, and "the timeline says you confirmed
// it after the job was done" is an argument nobody should have to answer.
//
// The rule: a Logged time shows its DATE whenever that date is not already
// obvious from the row above it. Same day as the previous event, or today with
// no previous event, means the time alone is unambiguous and the date is noise.

/** True when two ISO timestamps fall on the same local calendar day. */
export function isSameLocalDay(aIso, bIso) {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The "Logged …" value for one event row.
 *
 * @param iso      this event's created_at
 * @param prevIso  the previous row's created_at, or null for the first row
 * @param now      injectable clock, for tests
 */
export function formatLoggedAt(iso, prevIso = null, now = new Date()) {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';

  const time = when.toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Same day as the row above → the date is already established.
  if (prevIso && isSameLocalDay(iso, prevIso)) return time;
  // First row, and it happened today → "today" is the reader's default anyway.
  if (!prevIso && isSameLocalDay(iso, now.toISOString())) return time;

  const date = when.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
  return `${date}, ${time}`;
}
