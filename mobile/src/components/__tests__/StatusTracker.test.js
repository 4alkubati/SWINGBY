// P1 — two controls for one action.
//
// The JOB STATUS stepper was tappable and hinted "Tap 'On the way' — On my
// way →", sitting three lines above a Live status card whose primary button
// performs that exact transition. A provider standing on a driveway had to work
// out which of two things to press, and pressing the wrong one had appended
// duplicate events before (the three "On the way" rows, 2026-07-29).
//
// The stepper is a progress indicator now. These tests pin that it still SHOWS
// everything it did, and no longer does anything.

import React from 'react';
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';

import { ThemeProvider } from '../../theme/ThemeProvider';
import StatusTracker from '../StatusTracker';
import { FLOW, STAGE_LABEL } from '../../utils/jobStages';

function renderTracker(events) {
  return render(
    <ThemeProvider>
      <StatusTracker events={events} />
    </ThemeProvider>,
  );
}

describe('StatusTracker', () => {
  it('shows every stage of the flow', () => {
    const { getByText } = renderTracker([]);
    for (const stage of FLOW) {
      expect(getByText(STAGE_LABEL[stage])).toBeTruthy();
    }
  });

  it('names what comes next without telling anyone to tap it', () => {
    const { getByText, queryByText } = renderTracker([{ event_type: 'en_route' }]);
    expect(getByText(/^Next: /)).toBeTruthy();
    expect(queryByText(/Tap "/)).toBeNull();
  });

  it('offers no buttons at all', () => {
    // The whole point: one control on the screen, and it is not this one.
    const { queryAllByRole } = renderTracker([{ event_type: 'en_route' }]);
    expect(queryAllByRole('button')).toHaveLength(0);
  });

  it('says nothing about a next step once the job is complete', () => {
    const done = FLOW.map((stage) => ({ event_type: stage }));
    const { queryByText } = renderTracker(done);
    expect(queryByText(/^Next: /)).toBeNull();
  });

  it('is not handed an advance callback by its only caller', () => {
    // A prop that is passed and ignored is how the duplicate control would come
    // back — silently, and looking wired.
    const screen = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'business', 'JobManagementScreen.js'),
      'utf8',
    );
    const usage = screen.slice(screen.indexOf('<StatusTracker'));
    const tag = usage.slice(0, usage.indexOf('/>') + 2);
    expect(tag).not.toMatch(/onAdvance/);
    expect(tag).toMatch(/events=\{events\}/);
  });
});
