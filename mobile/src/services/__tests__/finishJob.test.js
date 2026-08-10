// One "I'm done" for the business — walkthrough item 2 (Kira, 2026-08-06):
// "Mark complete and Send proof to client are different actions in different
// places, and doing only one leaves the money frozen."
//
// The frozen state is real and specific: `POST /proof/submit` flips
// booking_proofs.status and nothing else, so no approval window opens, so the
// client's approve call 400s with "This job isn't marked done yet" and the
// escrow sits with no timer and no actor. These pin the ordering, both
// half-failures, and the fact that the two entry points cannot diverge.
import { finishJob, needsProofSubmit, FINISH_DONE, FINISH_DONE_NO_PROOF } from '../finishJob';

jest.mock('../api');
import { api } from '../api';

const submittable = (over = {}) => ({
  status: 'draft',
  counts: { before: 2, after: 2, can_submit: true },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockResolvedValue({});
  api.patch.mockResolvedValue({ approval_deadline_at: '2026-08-11T12:00:00Z' });
});

describe('needsProofSubmit', () => {
  it('yes for a draft that meets the photo minimum', () => {
    expect(needsProofSubmit(submittable())).toBe(true);
  });

  it('no when the server says it cannot be submitted', () => {
    // 2 before + 2 after is the server's rule (proof_of_work.counts), so this
    // never second-guesses it locally.
    expect(needsProofSubmit(submittable({ counts: { can_submit: false } }))).toBe(false);
  });

  it('no when it has already gone', () => {
    expect(needsProofSubmit(submittable({ status: 'submitted' }))).toBe(false);
    expect(needsProofSubmit(submittable({ status: 'approved' }))).toBe(false);
  });

  it('no proof at all is not a reason to submit one', () => {
    expect(needsProofSubmit(null)).toBe(false);
    expect(needsProofSubmit({})).toBe(false);
  });
});

describe('finishJob does both halves, in order', () => {
  it('sends the proof BEFORE completing', async () => {
    const calls = [];
    api.post.mockImplementation((p) => (calls.push(`POST ${p}`), Promise.resolve({})));
    api.patch.mockImplementation((p) => (calls.push(`PATCH ${p}`), Promise.resolve({})));

    await finishJob('bk-1', { proof: submittable() });

    // Completing is what tells the client to go and look. The photos have to
    // be on the record before they do.
    expect(calls).toEqual([
      'POST /bookings/bk-1/proof/submit',
      'PATCH /bookings/bk-1/complete',
    ]);
  });

  it('reports the deadline the business is now waiting on', async () => {
    const res = await finishJob('bk-1', { proof: submittable() });
    expect(res).toMatchObject({
      outcome: FINISH_DONE,
      proofSubmitted: true,
      approvalDeadlineAt: '2026-08-11T12:00:00Z',
    });
  });

  it('completes without proof rather than refusing to finish', async () => {
    // A job with no photos must still be finishable — otherwise the money is
    // frozen for the opposite reason.
    const res = await finishJob('bk-1', { proof: submittable({ counts: { can_submit: false } }) });

    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).toHaveBeenCalledWith('/bookings/bk-1/complete');
    expect(res.outcome).toBe(FINISH_DONE_NO_PROOF);
  });

  it('does not re-send proof that is already with the client', async () => {
    const res = await finishJob('bk-1', { proof: submittable({ status: 'submitted' }) });

    expect(api.post).not.toHaveBeenCalled();
    // Still DONE, not DONE_NO_PROOF: the client has the photos, they just went
    // earlier. This is the retry path after a half-failure.
    expect(res.outcome).toBe(FINISH_DONE);
    expect(res.proofSubmitted).toBe(false);
  });

  it('fetches the proof itself when the caller has none', async () => {
    // The stage tracker on JobManagementScreen has no proof loaded.
    api.get.mockResolvedValue(submittable());
    await finishJob('bk-1');

    expect(api.get).toHaveBeenCalledWith('/bookings/bk-1/proof');
    expect(api.post).toHaveBeenCalledWith('/bookings/bk-1/proof/submit');
  });

  it('still finishes when the proof lookup fails', async () => {
    // Not knowing whether photos exist is no reason to refuse to finish a job
    // and leave the money held.
    api.get.mockRejectedValue(new Error('offline'));
    const res = await finishJob('bk-1');

    expect(api.patch).toHaveBeenCalledWith('/bookings/bk-1/complete');
    expect(res.outcome).toBe(FINISH_DONE_NO_PROOF);
  });
});

describe('the two half-failures', () => {
  it('a failed proof send does NOT complete the job', async () => {
    api.post.mockRejectedValue(new Error('upload gone'));

    await expect(finishJob('bk-1', { proof: submittable() })).rejects.toThrow('upload gone');

    // Nothing happened and the client was told nothing, so tapping again is a
    // clean retry. Failing closed is safe here precisely BECAUSE not
    // completing yet freezes nothing.
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('proof sent + complete failed is never swallowed', async () => {
    api.patch.mockRejectedValue(new Error('booking is already completed'));

    let thrown;
    try {
      await finishJob('bk-1', { proof: submittable() });
    } catch (err) {
      thrown = err;
    }

    // THE frozen state: money held, no approval window, client cannot act.
    expect(thrown.proofSentButNotComplete).toBe(true);
    expect(thrown.name).toBe('ProofSentButNotCompleteError');
    expect(thrown.message).toContain('booking is already completed');
  });

  it('a plain completion failure is a plain error, not the frozen one', async () => {
    // Nothing was sent, so this must not tell a business their photos are with
    // a client who cannot act on them.
    api.patch.mockRejectedValue(new Error('no captured payment'));

    let thrown;
    try {
      await finishJob('bk-1', { proof: submittable({ counts: { can_submit: false } }) });
    } catch (err) {
      thrown = err;
    }

    expect(thrown.proofSentButNotComplete).toBeUndefined();
    expect(thrown.message).toBe('no captured payment');
  });

  it('prefers the server detail over the transport message', async () => {
    api.patch.mockRejectedValue({
      message: 'Request failed with status code 409',
      response: { data: { detail: 'Cannot complete: this booking has not been paid.' } },
    });

    let thrown;
    try {
      await finishJob('bk-1', { proof: submittable() });
    } catch (err) {
      thrown = err;
    }

    expect(thrown.message).toContain('has not been paid');
  });
});
