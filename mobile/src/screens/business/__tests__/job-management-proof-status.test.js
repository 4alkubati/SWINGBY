// Walkthrough bug 8 — the business Progress tab never showed that proof had
// been submitted.
//
// Before this fix, the "Send proof to client" row and BookingPhotos' "Add
// Before/After photo" controls rendered identically whether or not the
// business had already tapped Send for approval on ProofOfWorkScreen — GET
// /bookings/{id}/proof (the same endpoint ProofOfWorkScreen itself reads) was
// never fetched here, so there was nothing to render a different state FROM.
// A business had no way to tell their submission went through short of
// re-opening ProofOfWorkScreen.
//
// This pins: draft → unchanged "Send proof to client" + attachable photos;
// submitted → a distinct "awaiting approval" row and locked Add controls;
// approved → a distinct "approved" row.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import JobManagementScreen from '../JobManagementScreen';

jest.mock('../../../services/api');
import { api } from '../../../services/api';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function booking(overrides = {}) {
  return {
    id: 'bk-1',
    status: 'in_progress',
    business_id: 'biz-1',
    client_id: 'cli-1',
    employee_id: null,
    total_amount: 120,
    users: { first_name: 'Jamie', last_name: 'Client' },
    businesses: { business_name: 'Test Cleaning Co.' },
    ...overrides,
  };
}

// Keys off the URL rather than call order — this screen fires /bookings/{id},
// /assignees, /proof and /events (plus BookingPhotos' own /photos) all on
// mount, and their relative order isn't something this test should have to
// pin down.
function mockApiFor({ proofStatus }) {
  api.get.mockImplementation((url) => {
    if (url.endsWith('/proof')) {
      return Promise.resolve({ status: proofStatus, counts: { before: 0, after: 0 } });
    }
    if (url.endsWith('/assignees')) {
      return Promise.resolve({ items: [] });
    }
    if (url.endsWith('/events')) {
      return Promise.resolve({ items: [] });
    }
    if (url.includes('/photos')) {
      return Promise.resolve({ items: [] });
    }
    if (url.endsWith('/bk-1')) {
      return Promise.resolve(booking());
    }
    return Promise.resolve({});
  });
}

function renderJobDetail() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <JobManagementScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
        route={{ params: { bookingId: 'bk-1' } }}
      />
    </SafeAreaProvider>,
  );
}

// The Progress tab renders this screen's proof-of-work region; Details (tab
// 0) is the default.
async function openProgressTab(utils) {
  const tab = await waitFor(() => utils.getByLabelText('Progress'));
  fireEvent.press(tab);
}

describe('JobManagementScreen Progress tab — proof submission state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('draft: still offers to send proof, and photo tiles stay addable', async () => {
    mockApiFor({ proofStatus: 'draft' });
    const utils = renderJobDetail();
    await openProgressTab(utils);

    expect(await utils.findByText('Send proof to client')).toBeTruthy();
    expect(utils.queryByText('Proof sent')).toBeNull();
    expect(utils.queryByText('Proof approved')).toBeNull();
    expect(await utils.findByLabelText('Add Before photo')).toBeTruthy();
  });

  it('submitted: shows an awaiting-approval state and locks new photos', async () => {
    mockApiFor({ proofStatus: 'submitted' });
    const utils = renderJobDetail();
    await openProgressTab(utils);

    expect(await utils.findByText('Proof sent')).toBeTruthy();
    expect(utils.getByText('Awaiting the client’s approval')).toBeTruthy();
    expect(utils.getByText('Awaiting approval')).toBeTruthy();
    expect(utils.queryByText('Send proof to client')).toBeNull();
    // BookingPhotos only renders its "Add" control when canAttach is true —
    // it must be false once proof is submitted, same rule ProofOfWorkScreen
    // enforces on its own Add tiles.
    expect(utils.queryByLabelText('Add Before photo')).toBeNull();
    expect(utils.queryByLabelText('Add After photo')).toBeNull();
  });

  it('approved: shows an approved state, still locked', async () => {
    mockApiFor({ proofStatus: 'approved' });
    const utils = renderJobDetail();
    await openProgressTab(utils);

    expect(await utils.findByText('Proof approved')).toBeTruthy();
    expect(utils.getByText('The client approved this work')).toBeTruthy();
    expect(utils.queryByLabelText('Add Before photo')).toBeNull();
  });
});
