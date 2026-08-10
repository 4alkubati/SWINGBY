// finishJob.js — "a tradesperson thinks one thought: I finished."
//
// Kira, 2026-08-06 walkthrough, ranked #2 of the things that should be one
// click: *"Mark complete and Send proof to client are different actions in
// different places, and doing only one leaves the money frozen."*
//
// He is describing a real dead end, not an inconvenience:
//
//   * Send proof alone → `POST /bookings/{id}/proof/submit` flips
//     booking_proofs.status to 'submitted' and NOTHING else. It does not touch
//     bookings.status, so no approval window opens, so the client has nothing
//     to approve and `POST /bookings/{id}/approve` 400s with "This job isn't
//     marked done yet". The money sits held with no timer and no actor. The
//     business has done the thing they think finishes a job and is not paid.
//   * Mark complete alone → the window opens and the money moves in 24h, but
//     the client approves a job they were shown no evidence for.
//
// Neither screen could fix this on its own: the photos live on
// ProofOfWorkScreen and the stage tracker lives on JobManagementScreen. So the
// ordering lives here, once, the way acceptAndPay.js owns accept-then-charge —
// two screens hand-rolling "submit, then complete, then decide what a half
// failure means" is exactly how the two paths drift.
//
// THE ORDERING, AND WHY IT IS THIS WAY ROUND
//   1. submit proof  → the photos are on the record
//   2. complete      → opens the client's 24h window and notifies them
// Never the reverse. Completing is what tells the client to go and look; the
// photos have to be there before they do.
//
// WHAT EACH HALF FAILING MEANS
//   * Step 1 fails → step 2 does not run. Nothing happened, the client was
//     told nothing, and tapping again is a clean retry. Failing closed here is
//     safe precisely BECAUSE nothing is frozen by not completing yet.
//   * Step 2 fails → the proof is submitted and the job is not done. That IS
//     the frozen-money state this module exists to prevent, so it is never
//     swallowed: it throws ProofSentButNotCompleteError, and the retry is
//     clean because step 1 skips an already-submitted proof.

import { api } from './api';

/** Proof sent (or already sent) and the job is marked done. */
export const FINISH_DONE = 'done';
/** Job marked done. There was no submittable proof to send with it. */
export const FINISH_DONE_NO_PROOF = 'done_no_proof';

/**
 * The photos are on the record and the job is NOT marked done.
 *
 * The exact state Kira found: money held, no approval window, no way for the
 * client to act. Callers must render this, never swallow it — and must say
 * that tapping again finishes the job, because it does.
 */
export class ProofSentButNotCompleteError extends Error {
  constructor(message) {
    super(
      message ||
        'Your photos were sent, but the job could not be marked done. ' +
          'Your payment stays held until it is — try again.',
    );
    this.name = 'ProofSentButNotCompleteError';
    this.proofSentButNotComplete = true;
  }
}

/**
 * Is there proof worth sending with this completion?
 *
 * `proof` is the body of `GET /bookings/{id}/proof`. A proof already
 * 'submitted' or 'approved' needs no second send, and one that cannot meet the
 * photo minimum (`counts.can_submit`, the server's rule — 2 before + 2 after)
 * cannot be sent at all. Pure, so the decision is testable without a network.
 */
export function needsProofSubmit(proof) {
  if (!proof) return false;
  if (proof.status === 'submitted' || proof.status === 'approved') return false;
  return !!proof.counts?.can_submit;
}

/**
 * One "I'm done": send the proof if there is any, then mark the job complete.
 *
 * `proof` is optional — pass the already-loaded body if the caller has one
 * (ProofOfWorkScreen does), and this fetches it otherwise (the stage tracker
 * does not). A failed FETCH is not fatal: not knowing whether photos exist is
 * no reason to refuse to finish a job, so it completes without them rather
 * than trapping the business behind a lookup they cannot see or fix.
 *
 * Resolves `{ outcome, proofSubmitted, approvalDeadlineAt }`.
 */
export async function finishJob(bookingId, { proof } = {}) {
  let current = proof;
  if (current === undefined) {
    current = await api.get(`/bookings/${bookingId}/proof`).catch(() => null);
  }

  let proofSubmitted = false;
  if (needsProofSubmit(current)) {
    // Deliberately unguarded: if the photos cannot be sent, the caller retries
    // the whole action and nothing has been said to the client yet.
    await api.post(`/bookings/${bookingId}/proof/submit`);
    proofSubmitted = true;
  }

  let res;
  try {
    res = await api.patch(`/bookings/${bookingId}/complete`);
  } catch (err) {
    if (proofSubmitted) {
      throw new ProofSentButNotCompleteError(
        err?.response?.data?.detail || err?.message,
      );
    }
    throw err;
  }

  const alreadySent =
    current?.status === 'submitted' || current?.status === 'approved';

  return {
    outcome: proofSubmitted || alreadySent ? FINISH_DONE : FINISH_DONE_NO_PROOF,
    proofSubmitted,
    // The business's own countdown: what the client has left to approve before
    // the money releases automatically. Null when there was no escrow to gate
    // (a cash job, or one already settled) — see approvals.start_approval_window.
    approvalDeadlineAt: res?.approval_deadline_at || null,
  };
}
