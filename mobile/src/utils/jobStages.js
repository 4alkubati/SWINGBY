// The stages a job moves through, defined once.
//
// This existed in three places with two different vocabularies, which is what
// let the business booking screen contradict itself on 2026-07-29: the
// timeline showed three "On the way" rows while the action card above it still
// offered "On my way" as the next step.
//
// The cause was the split vocabulary. StatusTracker had its own three-step
// list keyed on BOOKING STATUS (`on_the_way`, `in_progress`, `completed`) and
// read `booking.status` to place itself — but `on_the_way` is not a booking
// status at all, and its advance action posted an `en_route` EVENT. So the
// tracker never moved, stayed tappable, and appended a duplicate event every
// time it was tapped. Meanwhile LiveStatusActions kept a fourth stage
// (`arrived`) the tracker had never heard of, and liveLocation.js kept a
// hand-copied "mirrors LiveStatusActions.FLOW" list.
//
// One list, one source of truth: booking_events. Everything that renders or
// advances a stage imports from here.

/** The four stage events a provider posts, in order. */
export const FLOW = ['en_route', 'arrived', 'started', 'completed'];

/** Provider-facing label for the button that ENTERS each stage. */
export const ACTION_LABEL = {
  en_route: 'On my way',
  arrived: 'I have arrived',
  started: 'Start job',
  completed: 'Mark complete',
};

/** Confirmation prompt for entering each stage. */
export const ACTION_CONFIRM = {
  en_route: 'Tell the client you are on your way?',
  arrived: 'Confirm you have arrived?',
  started: 'Start the job now? The client will be notified.',
  completed: 'Mark the job complete? This may release final payment.',
};

/** Short label for the stage itself, as it reads on the tracker. */
export const STAGE_LABEL = {
  en_route: 'On the way',
  arrived: 'Arrived',
  started: 'Started',
  completed: 'Done',
};

/**
 * The stage a booking is currently on, from its event list.
 *
 * Takes `items` from GET /bookings/{id}/events (oldest first, as that endpoint
 * returns it). Returns an event type from FLOW, or null when the job has not
 * started moving yet.
 */
export function currentStage(events) {
  let last = null;
  for (const ev of events || []) {
    if (FLOW.includes(ev?.event_type)) last = ev.event_type;
  }
  return last;
}

/** The stage that comes after the current one, or null when complete. */
export function nextStage(events) {
  const last = currentStage(events);
  if (!last) return FLOW[0];
  const idx = FLOW.indexOf(last);
  if (idx === -1 || idx === FLOW.length - 1) return null;
  return FLOW[idx + 1];
}

/** 0-based index of the current stage; -1 before the job starts moving. */
export function stageIndex(events) {
  return FLOW.indexOf(currentStage(events));
}
