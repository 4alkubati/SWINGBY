// What the business is told when they finish a job.
//
// HISTORY, because this file has now pinned two different contracts and the
// second only makes sense against the first.
//
// Walkthrough bug 3 (2026-08-08): the CTA was "Send for approval" and its toast
// said "Sent for approval — Payment releases when the client approves". Both
// halves were false. `POST /proof/submit` only flips booking_proofs.status; it
// never touches bookings.status, and the client has no route to an approve
// action until that is 'completed'. So nothing had been sent anywhere the
// client could see, and nothing was going to release. The fix then was to stop
// lying: "Proof saved — Mark the job complete to send it to the client."
//
// Walkthrough item 2 (2026-08-10): that copy was honest and the FLOW was still
// broken. Telling a tradesperson their next step is on another screen is how
// the money got frozen — they read "saved", thought "done", and left. There is
// one action now (services/finishJob.js): send the proof, then complete. So the
// toast may finally talk about approval and release, because by the time it
// shows, the client genuinely can approve and the 24h clock is genuinely
// running.
//
// The one assertion that survives both contracts unchanged: it must never say
// the money has already moved.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProofOfWorkScreen from '../ProofOfWorkScreen';
import i18n from '../../../i18n';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

jest.mock('../../../services/toast', () => ({
  ...jest.requireActual('../../../services/toast'),
  show: jest.fn(),
}));
import * as toast from '../../../services/toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function proof(overrides = {}) {
  return {
    status: 'draft',
    client_photos: [],
    before: [{ id: 'b1', url: 'https://cdn.test/b1.jpg' }, { id: 'b2', url: 'https://cdn.test/b2.jpg' }],
    after: [{ id: 'a1', url: 'https://cdn.test/a1.jpg' }, { id: 'a2', url: 'https://cdn.test/a2.jpg' }],
    voice_note: null,
    counts: { before: 2, after: 2, before_needed: 0, after_needed: 0, can_submit: true },
    ...overrides,
  };
}

function renderScreen(goBack = jest.fn()) {
  const utils = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProofOfWorkScreen
        navigation={{ goBack }}
        route={{ params: { bookingId: 'bk-1' } }}
      />
    </SafeAreaProvider>,
  );
  return { ...utils, goBack };
}

// The CTA confirms first — it moves money on a timer — so every path here goes
// through the alert's confirm button.
async function pressFinishAndConfirm(utils) {
  const cta = await waitFor(() => utils.getByLabelText(i18n.t('finish.ctaA11y')));
  fireEvent.press(cta);
  const [, body, buttons] = Alert.alert.mock.calls.at(-1);
  const confirm = buttons.find((b) => b.onPress);
  await act(async () => {
    await confirm.onPress();
  });
  return body;
}

describe('ProofOfWorkScreen — one "I\'m done"', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({});
    api.patch.mockResolvedValue({ approval_deadline_at: '2026-08-11T12:00:00Z' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('sends the proof AND marks the job done from one press', async () => {
    api.get.mockResolvedValue(proof());
    const utils = renderScreen();

    await pressFinishAndConfirm(utils);

    // The whole point: the business never has to know the second call exists.
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/bookings/bk-1/proof/submit'),
    );
    expect(api.patch).toHaveBeenCalledWith('/bookings/bk-1/complete');
  });

  it('names the 24 hours before it does anything', async () => {
    api.get.mockResolvedValue(proof());
    const utils = renderScreen();

    const body = await pressFinishAndConfirm(utils);
    expect(body).toMatch(/24 hours/);
  });

  it('no longer sends the business to another screen to finish', async () => {
    api.get.mockResolvedValue(proof());
    const { goBack, ...utils } = renderScreen();

    await pressFinishAndConfirm({ ...utils, goBack });
    await waitFor(() => expect(toast.show).toHaveBeenCalled());

    const call = toast.show.mock.calls[0][0];
    // The 2026-08-08 copy — true then, an instruction to go elsewhere now.
    expect(call.text2).not.toMatch(/mark.*complete/i);
    expect(call.text1).toBe(i18n.t('finish.doneToastTitle'));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
  });

  it('never says the money has already moved', async () => {
    // Survives from the original contract. Completing HOLDS the payment and
    // opens the window; the client approving, or the window closing, is what
    // pays. A toast claiming otherwise is the FINDING C family of lie.
    api.get.mockResolvedValue(proof());
    const utils = renderScreen();

    await pressFinishAndConfirm(utils);
    await waitFor(() => expect(toast.show).toHaveBeenCalled());

    const call = toast.show.mock.calls[0][0];
    expect(call.text2).not.toMatch(/paid|released|payment released/i);
    // What it may say, because it is now true: release is conditional.
    expect(call.text2).toMatch(/releases when they approve|in 24 hours/i);
  });

  it('finishes a job with no photos rather than refusing', async () => {
    // The CTA used to be disabled below 2 before + 2 after — the only control
    // that finishes a job, dead with no reason on screen.
    api.get.mockResolvedValue(
      proof({
        before: [],
        after: [],
        counts: { before: 0, after: 0, before_needed: 2, after_needed: 2, can_submit: false },
      }),
    );
    const utils = renderScreen();

    const body = await pressFinishAndConfirm(utils);

    // Says so plainly instead of silently refusing.
    expect(body).toMatch(/haven’t added before and after photos/i);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).toHaveBeenCalledWith('/bookings/bk-1/complete');
  });

  it('shouts when the photos went but the job did not finish', async () => {
    // The frozen-money state this change exists to prevent. It must never wear
    // generic error copy.
    api.get.mockResolvedValue(proof());
    api.patch.mockRejectedValue(new Error('network'));
    const utils = renderScreen();

    await pressFinishAndConfirm(utils);

    await waitFor(() => {
      const titles = Alert.alert.mock.calls.map((c) => c[0]);
      expect(titles).toContain(i18n.t('finish.halfDoneTitle'));
    });
  });
});
