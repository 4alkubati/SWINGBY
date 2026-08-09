// Walkthrough bug 7 — the "Mark complete" confirmation lied about money.
//
// jobStages.ACTION_CONFIRM.completed used to read "This may release final
// payment." It never has: bookings.py's /complete route holds payment and
// opens a 24h client-approval window (see approvals.release + the
// businessWaitingBody copy shown right after this same tap succeeds in
// JobManagementScreen.handleAdvance). A business reading "may release" before
// confirming had no reason to expect the 24h wait they were about to start.
//
// This pins the corrected confirmation body, read from i18n at tap time
// (jobStages.confirmComplete) rather than a frozen module-level string.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LiveStatusActions from '../LiveStatusActions';
import i18n from '../../i18n';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderActions(props) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <LiveStatusActions {...props} />
    </SafeAreaProvider>,
  );
}

describe('LiveStatusActions — "Mark complete" confirmation', () => {
  let alertSpy;

  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('does not claim payment may release, and says what actually happens', () => {
    // Last posted stage is 'started', so the next action offered is
    // 'completed' — the "Mark complete" button.
    const events = [
      { event_type: 'en_route' },
      { event_type: 'arrived' },
      { event_type: 'started' },
    ];
    const { getByText } = renderActions({ events, onAdvance: jest.fn() });

    fireEvent.press(getByText('Mark complete'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, body] = alertSpy.mock.calls[0];
    expect(title).toBe('Mark complete');
    expect(body).not.toMatch(/may release final payment/i);
    expect(body).toBe(i18n.t('jobStages.confirmComplete'));
    expect(body).toMatch(/holds payment/i);
    expect(body).toMatch(/24-hour/i);
  });

  it('leaves the other stages’ confirmations untouched', () => {
    const { getByText } = renderActions({ events: [], onAdvance: jest.fn() });

    fireEvent.press(getByText('On my way'));

    expect(alertSpy).toHaveBeenCalledWith(
      'On my way',
      'Tell the client you are on your way?',
      expect.any(Array),
    );
  });
});
