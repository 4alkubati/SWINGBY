// jobs-scheduled-tab.test.js — walkthrough audit D7.
//
// "Business jobs tabs: Today / Upcoming / Needs action / Past. Want Scheduled
// first, spanning ~3 months, grouped by day (Today, Tomorrow, then dated)."
//
// What is pinned here is the SHAPE of that list, because the shape is where the
// judgement calls are and they are all invisible from the happy path:
//
//   * a day with no jobs must not render a header,
//   * a job whose date isn't confirmed yet must still be reachable,
//   * an overdue job must not open a second header that also says "Today",
//   * a job past the ~3-month horizon must not be silently dropped,
//   * old `filter: 'today'` deep links must still land somewhere.

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import {
  groupScheduledJobs,
  countScheduledJobs,
  daysBetweenLocal,
  localDayKey,
  SCHEDULE_HORIZON_DAYS,
} from '../../../utils/scheduleGroups';

jest.mock('../../../services/api');

// eslint-disable-next-line import/first
import api from '../../../services/api';
// eslint-disable-next-line import/first
import JobManagementScreen from '../JobManagementScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), replace: jest.fn(),
  setOptions: jest.fn(), setParams: jest.fn(),
  addListener: jest.fn(() => jest.fn()), canGoBack: () => true,
};

function Providers({ children }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

// A fixed reference clock. Deliberately mid-afternoon and mid-month so no
// assertion below can accidentally straddle a midnight or a month boundary.
const NOW = new Date(2026, 6, 26, 14, 0, 0); // Sun 26 Jul 2026, local

/** A dated, locked-in job — the only status that ever carries confirmed_date. */
function scheduled(id, date, extra = {}) {
  return {
    id,
    status: 'in_progress',
    confirmed_date: date.toISOString(),
    total_amount: 120,
    client_name: `Client ${id}`,
    ...extra,
  };
}

/** An accepted booking whose date handshake hasn't closed — no confirmed_date. */
function undatedJob(id, extra = {}) {
  return {
    id,
    status: 'confirmed',
    confirmed_date: null,
    employee_id: null,
    client_name: `Client ${id}`,
    ...extra,
  };
}

function at(daysFromNow, hour = 10) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe('groupScheduledJobs — day boundaries', () => {
  it('labels the first three bands Today, Tomorrow, then a dated day', () => {
    const groups = groupScheduledJobs(
      [scheduled('a', at(0)), scheduled('b', at(1)), scheduled('c', at(4))],
      { now: NOW }
    );

    expect(groups.map((g) => g.kind)).toEqual(['today', 'tomorrow', 'day']);
    expect(groups.map((g) => g.jobs.map((j) => j.id))).toEqual([['a'], ['b'], ['c']]);
    // The dated band knows its own calendar day, so the screen can format it.
    expect(localDayKey(groups[2].date)).toBe('2026-07-30');
  });

  it('splits at local midnight, not at a rolling 24 hours', () => {
    // 11pm tonight and 1am tomorrow are two hours apart but two different days.
    const groups = groupScheduledJobs(
      [scheduled('late', at(0, 23)), scheduled('early', at(1, 1))],
      { now: NOW }
    );
    expect(groups.map((g) => g.kind)).toEqual(['today', 'tomorrow']);
  });

  it('renders no header for a day that has nothing on it', () => {
    // Jobs on day 0 and day 5. The four days in between are empty and must
    // not produce four empty bands.
    const groups = groupScheduledJobs(
      [scheduled('a', at(0)), scheduled('b', at(5))],
      { now: NOW }
    );
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.kind)).toEqual(['today', 'day']);
  });

  it('puts several jobs on the same day into one band, time-ascending', () => {
    const groups = groupScheduledJobs(
      [scheduled('pm', at(3, 16)), scheduled('am', at(3, 8)), scheduled('noon', at(3, 12))],
      { now: NOW }
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].jobs.map((j) => j.id)).toEqual(['am', 'noon', 'pm']);
  });

  it('folds an overdue job into Today rather than opening a stale header', () => {
    const groups = groupScheduledJobs(
      [scheduled('overdue', at(-3)), scheduled('today', at(0))],
      { now: NOW }
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('today');
    expect(groups[0].jobs.map((j) => j.id)).toEqual(['overdue', 'today']);
  });
});

describe('groupScheduledJobs — jobs with no confirmed date', () => {
  it('leads the list with a Date-not-set band, above Today', () => {
    const groups = groupScheduledJobs(
      [scheduled('dated', at(0)), undatedJob('nodate')],
      { now: NOW }
    );
    expect(groups.map((g) => g.kind)).toEqual(['undated', 'today']);
    expect(groups[0].jobs.map((j) => j.id)).toEqual(['nodate']);
  });

  it('never files a merely-PROPOSED date under a day', () => {
    // proposed_date_1 is the business's suggestion; the client has not agreed,
    // so it must not read as a scheduled Tuesday.
    const groups = groupScheduledJobs(
      [undatedJob('proposed', { employee_id: 'e1', proposed_date_1: at(2).toISOString() })],
      { now: NOW }
    );
    expect(groups.map((g) => g.kind)).toEqual(['undated']);
  });

  it('counts undated jobs in the Scheduled tab total', () => {
    const groups = groupScheduledJobs(
      [undatedJob('n1'), undatedJob('n2'), scheduled('d1', at(1))],
      { now: NOW }
    );
    expect(countScheduledJobs(groups)).toBe(3);
  });
});

describe('groupScheduledJobs — the ~3 month horizon', () => {
  it('keeps a job inside the horizon in its own dated band', () => {
    const groups = groupScheduledJobs(
      [scheduled('near', at(SCHEDULE_HORIZON_DAYS))],
      { now: NOW }
    );
    expect(groups.map((g) => g.kind)).toEqual(['day']);
  });

  it('drops a job past the horizon into a trailing Later band, not off the list', () => {
    const groups = groupScheduledJobs(
      [scheduled('far', at(SCHEDULE_HORIZON_DAYS + 1)), scheduled('soon', at(1))],
      { now: NOW }
    );
    expect(groups.map((g) => g.kind)).toEqual(['tomorrow', 'later']);
    expect(groups[1].jobs.map((j) => j.id)).toEqual(['far']);
    // Nothing is lost for being far out.
    expect(countScheduledJobs(groups)).toBe(2);
  });
});

describe('groupScheduledJobs — what Scheduled excludes', () => {
  it('leaves completed and cancelled jobs to the Past tab', () => {
    const groups = groupScheduledJobs(
      [
        { id: 'done', status: 'completed', confirmed_date: at(-2).toISOString() },
        { id: 'dead', status: 'cancelled', confirmed_date: at(-1).toISOString() },
        scheduled('live', at(0)),
      ],
      { now: NOW }
    );
    expect(countScheduledJobs(groups)).toBe(1);
    expect(groups[0].jobs[0].id).toBe('live');
  });

  it('survives an empty or missing booking list', () => {
    expect(groupScheduledJobs([], { now: NOW })).toEqual([]);
    expect(groupScheduledJobs(undefined, { now: NOW })).toEqual([]);
    expect(groupScheduledJobs([null, undefined], { now: NOW })).toEqual([]);
  });
});

describe('daysBetweenLocal', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(daysBetweenLocal(new Date(2026, 6, 26, 23, 30), new Date(2026, 6, 27, 0, 30))).toBe(1);
    expect(daysBetweenLocal(new Date(2026, 6, 26, 0, 30), new Date(2026, 6, 26, 23, 30))).toBe(0);
  });

  it('still counts one day across a DST switch', () => {
    // 8 Mar 2026 is the North American spring-forward Sunday: a 23-hour day.
    expect(daysBetweenLocal(new Date(2026, 2, 7, 12), new Date(2026, 2, 8, 12))).toBe(1);
    expect(daysBetweenLocal(new Date(2026, 2, 8, 12), new Date(2026, 2, 9, 12))).toBe(1);
  });
});

describe('Jobs list screen — Scheduled is the tab you land on', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const now = new Date();
    const todayAt = new Date(now); todayAt.setHours(23, 0, 0, 0);
    const tomorrowAt = new Date(now); tomorrowAt.setDate(tomorrowAt.getDate() + 1);
    tomorrowAt.setHours(9, 0, 0, 0);

    api.get.mockImplementation((path) => {
      if (path === '/bookings/') {
        return Promise.resolve({
          items: [
            scheduled('t1', todayAt, { client_name: 'Dana Today' }),
            scheduled('t2', tomorrowAt, { client_name: 'Reza Tomorrow' }),
            undatedJob('u1', { client_name: 'Priya Undated' }),
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
  });

  it('defaults to Scheduled and shows Today / Tomorrow bands, undated first', async () => {
    const { getByText, queryByText } = render(
      <Providers>
        <JobManagementScreen navigation={mockNavigation} route={{ params: {} }} />
      </Providers>
    );

    await waitFor(() => expect(getByText('Dana Today')).toBeTruthy());

    expect(getByText('Date not set')).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Tomorrow')).toBeTruthy();
    expect(getByText('Reza Tomorrow')).toBeTruthy();
    expect(getByText('Priya Undated')).toBeTruthy();

    // The Scheduled tab is first and carries the total.
    expect(getByText('Scheduled (3)')).toBeTruthy();
    // Today / Upcoming are no longer tabs — they are bands inside Scheduled.
    expect(queryByText(/^Today \(/)).toBeNull();
    expect(queryByText(/^Upcoming \(/)).toBeNull();
  });

  it('still honours an old filter: "today" deep link by landing on Scheduled', async () => {
    const { getByText } = render(
      <Providers>
        <JobManagementScreen
          navigation={mockNavigation}
          route={{ params: { filter: 'today' } }}
        />
      </Providers>
    );

    await waitFor(() => expect(getByText('Dana Today')).toBeTruthy());
    // Not a crash, not a blank tab — the Scheduled list, whose first dated
    // band is Today.
    expect(getByText('Today')).toBeTruthy();
  });
});
