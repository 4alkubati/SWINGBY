// Walkthrough M8 + M4 — the two dead ends the founder hit on the jobs surface.
//
// M8: the assign picker read `GET /employees/`, which lists INVITED staff only.
// The person who registered the business is never in that table, so a solo
// operator — the common case at launch — opened "Assign" and got the literal
// text "No active employees found." with no way forward. The job could not be
// assigned to anybody, including the owner, who was the one actually going.
//
// M4: the business side has linked Past → Invoice since CARD-24. The client —
// the party who actually paid — had no route to their own receipt from
// anywhere in the app.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import JobManagementScreen from '../screens/business/JobManagementScreen';
import MyJobsScreen from '../screens/client/MyJobsScreen';
import InvoiceScreen from '../screens/shared/InvoiceScreen';

jest.mock('../services/api');
// eslint-disable-next-line import/first
import { api } from '../services/api';

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), push: jest.fn(), pop: jest.fn(),
  replace: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true, getState: () => ({ routes: [], routeNames: [] }),
};

const OWNER_USER = { id: 'owner-1', role: 'business_owner', first_name: 'Ali', last_name: 'Owner' };
const CLIENT_USER = { id: 'client-1', role: 'client', first_name: 'Casey', last_name: 'Client' };
let mockUser = OWNER_USER;

jest.mock('../context/AuthContext', () => {
  const actual = jest.requireActual('../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser, token: 'test-token', isLoading: false,
      logout: jest.fn(), updateUser: jest.fn(),
    }),
  };
});

const wrap = (ui) => <SafeAreaProvider
  initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
>{ui}</SafeAreaProvider>;

const BOOKING = {
  id: 'b1',
  client_id: 'client-1',
  business_id: 'biz-1',
  employee_id: null,
  status: 'confirmed',
  service_category: 'Cleaning',
  businesses: { business_name: 'Test Cleaning Co.' },
  users: { first_name: 'Casey', last_name: 'Client' },
  assignee: {
    type: 'business', employee_id: null, name: 'Test Cleaning Co.',
    business_name: 'Test Cleaning Co.', jobs_completed: null,
    tenure_days: null, tenure_label: null, is_owner: false,
  },
};

// What the server returns for a business with NO invited staff: the owner,
// materialised, and nothing else. This list is never empty.
const SOLO_ROSTER = {
  items: [{
    type: 'employee', employee_id: 'emp-owner', name: 'Ali Owner',
    role_title: 'Owner', is_owner: true, is_you: true, is_assigned: false,
    business_name: 'Test Cleaning Co.', jobs_completed: 7,
    tenure_days: 400, tenure_label: '1 year',
  }],
  assigned_employee_id: null,
  can_assign: true,
};

beforeEach(() => {
  mockUser = OWNER_USER;
  jest.clearAllMocks();
});

// ─── M8 — the assign picker ──────────────────────────────────────────────────

describe('M8 — a business with no invited staff can still assign the job', () => {
  function mountDetail(booking = BOOKING, roster = SOLO_ROSTER) {
    api.get.mockImplementation((url) => {
      if (url.endsWith('/assignees')) return Promise.resolve(roster);
      return Promise.resolve(booking);
    });
    return render(wrap(
      <JobManagementScreen navigation={mockNavigation} route={{ params: { bookingId: 'b1' } }} />
    ));
  }

  it('never renders the "No active employees found." dead end', async () => {
    const screen = mountDetail();
    await waitFor(() => expect(screen.queryByText(/Who's going/)).toBeTruthy());

    fireEvent.press(screen.getByText('+ Assign'));

    // The exact string from the walkthrough must be gone.
    expect(screen.queryByText('No active employees found.')).toBeNull();
    // …and replaced by a roster the owner can actually act on.
    expect(screen.getByText('Ali Owner')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('reads the roster from the booking, not from GET /employees/', async () => {
    mountDetail();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/bookings/b1/assignees'));
    // `/employees/` lists invited staff only — it can never contain the owner,
    // which is the whole reason the picker dead-ended.
    expect(api.get).not.toHaveBeenCalledWith('/employees/');
  });

  it('assigns the owner to themselves', async () => {
    api.patch.mockResolvedValue({ message: 'Employee assigned', booking: BOOKING });
    const screen = mountDetail();
    await waitFor(() => expect(screen.queryByText(/Who's going/)).toBeTruthy());

    fireEvent.press(screen.getByText('+ Assign'));
    fireEvent.press(screen.getByText('Ali Owner'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      '/bookings/b1/assign-employee', { employee_id: 'emp-owner' },
    ));
  });

  it('falls back to "Assign to me" if the roster request itself fails', async () => {
    // .catch(() => null) in load(). Even then the one assignment that always
    // works must stay reachable — the sentinel the backend resolves server-side.
    api.patch.mockResolvedValue({});
    const screen = mountDetail(BOOKING, null);
    await waitFor(() => expect(screen.queryByText(/Who's going/)).toBeTruthy());

    fireEvent.press(screen.getByText('+ Assign'));
    fireEvent.press(screen.getByText('Assign to me'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      '/bookings/b1/assign-employee', { employee_id: 'owner' },
    ));
  });

  it('still offers assignment BEFORE the date handshake closes', async () => {
    const screen = mountDetail({ ...BOOKING, status: 'pending' });
    await waitFor(() => expect(screen.queryByText(/Who's going/)).toBeTruthy());
    expect(screen.getByText('+ Assign')).toBeTruthy();
  });

  it('withdraws assignment once the job is completed', async () => {
    const screen = mountDetail({ ...BOOKING, status: 'completed' });
    await waitFor(() => expect(screen.queryByText(/Assigned to|Who's going/)).toBeTruthy());
    expect(screen.queryByText('+ Assign')).toBeNull();
    expect(screen.queryByText('Reassign')).toBeNull();
  });
});

// ─── M8 — what the booking shows ─────────────────────────────────────────────

describe('M8 — the booking shows the business until a person is assigned', () => {
  function mountWithAssignee(assignee, employeeId) {
    api.get.mockImplementation((url) => {
      if (url.endsWith('/assignees')) return Promise.resolve(SOLO_ROSTER);
      return Promise.resolve({ ...BOOKING, employee_id: employeeId, assignee });
    });
    return render(wrap(
      <JobManagementScreen navigation={mockNavigation} route={{ params: { bookingId: 'b1' } }} />
    ));
  }

  it('names the business while nobody is assigned', async () => {
    const screen = mountWithAssignee(BOOKING.assignee, null);
    await waitFor(() => expect(screen.getByText('Test Cleaning Co.')).toBeTruthy());
    expect(screen.getByText(/Nobody assigned yet/)).toBeTruthy();
  });

  it('names the person, their job count and their tenure once assigned', async () => {
    const screen = mountWithAssignee({
      type: 'employee', employee_id: 'emp-1', name: 'Khalid Worker',
      role_title: 'Cleaner', is_owner: false, business_name: 'Test Cleaning Co.',
      jobs_completed: 42, tenure_days: 400, tenure_label: '1 year',
    }, 'emp-1');

    await waitFor(() => expect(screen.getByText('Khalid Worker')).toBeTruthy());
    expect(screen.getByText('Cleaner')).toBeTruthy();
    expect(screen.getByText('42 jobs completed · 1 year with Test Cleaning Co.')).toBeTruthy();
  });

  it('shows NOTHING rather than a fake zero when a figure is uncomputable', async () => {
    // The server sends null when it could not count. A "0 jobs completed"
    // here would be a fabricated credential, not a missing one — Kira has
    // rejected placeholder $0.00-style values before.
    const screen = mountWithAssignee({
      type: 'employee', employee_id: 'emp-1', name: 'Khalid Worker',
      role_title: 'Cleaner', is_owner: false, business_name: 'Test Cleaning Co.',
      jobs_completed: null, tenure_days: null, tenure_label: null,
    }, 'emp-1');

    await waitFor(() => expect(screen.getByText('Khalid Worker')).toBeTruthy());
    expect(screen.queryByText(/0 jobs/)).toBeNull();
    expect(screen.queryByText(/jobs completed/)).toBeNull();
  });

  it('distinguishes a GENUINE zero — "New to the team", not a bare numeral', async () => {
    const screen = mountWithAssignee({
      type: 'employee', employee_id: 'emp-1', name: 'Khalid Worker',
      role_title: 'Cleaner', is_owner: false, business_name: 'Test Cleaning Co.',
      jobs_completed: 0, tenure_days: 2, tenure_label: '2 days',
    }, 'emp-1');

    await waitFor(() => expect(screen.getByText('Khalid Worker')).toBeTruthy());
    expect(screen.getByText('New to the team · 2 days with Test Cleaning Co.')).toBeTruthy();
  });
});

// ─── M4 — the client's route to their own receipt ────────────────────────────

describe('M4 — invoices off the client Past tab', () => {
  const COMPLETED = {
    id: 'b-done', status: 'completed', client_id: 'client-1', business_id: 'biz-1',
    service_category: 'Cleaning', confirmed_date: '2026-07-20T10:00:00Z',
    businesses: { business_name: 'Test Cleaning Co.' },
    assignee: {
      type: 'employee', employee_id: 'emp-1', name: 'Khalid Worker',
      role_title: 'Cleaner', business_name: 'Test Cleaning Co.',
      jobs_completed: 42, tenure_label: '1 year',
    },
  };

  async function mountPastTab() {
    mockUser = CLIENT_USER;
    api.get.mockImplementation((url) => {
      if (url === '/bookings/') return Promise.resolve({ items: [COMPLETED] });
      return Promise.resolve({ items: [] });
    });
    const screen = render(wrap(<MyJobsScreen navigation={mockNavigation} />));
    await waitFor(() => expect(screen.getByText(/Past \(1\)/)).toBeTruthy());
    fireEvent.press(screen.getByText(/Past \(1\)/));
    return screen;
  }

  it('offers the receipt on a completed job', async () => {
    const screen = await mountPastTab();
    expect(screen.getByText('View invoice')).toBeTruthy();
  });

  it('routes to the same Invoice screen the business side uses', async () => {
    const screen = await mountPastTab();
    fireEvent.press(screen.getByText('View invoice'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Invoice', { bookingId: 'b-done' });
  });

  it('names the assigned person, with the company they work for', async () => {
    const screen = await mountPastTab();
    expect(screen.getByText('Khalid Worker')).toBeTruthy();
    expect(screen.getByText(/Test Cleaning Co\..*42 jobs completed/)).toBeTruthy();
  });
});

// ─── M4 — before/after photos ON the receipt ─────────────────────────────────

describe('M4 — the receipt carries the before/after record', () => {
  const INVOICE = {
    invoice_number: 'SWB-B1', issued_at: '2026-07-24T18:00:00Z',
    client: { name: 'Casey Client', email: 'c@x.dev' },
    business: { name: 'Test Cleaning Co.', category: 'Cleaning', license_status: 'verified' },
    employee: { name: 'Khalid Worker', role_title: 'Cleaner' },
    service: { category: 'Cleaning' },
    schedule: { confirmed_date: null, completed_at: '2026-07-24T18:00:00Z' },
    line_items: [{ label: 'Service', amount: 180 }, { label: 'Platform fee (10%)', amount: -18 }],
    totals: { paid_to_business: 162, total_charged: 180 },
    payment: { method: 'stripe_card', status: 'fully_released', processor_ref: 'pi_abc' },
    proof: {
      before: [{ id: '1', url: 'https://x.dev/b1.jpg', source: 'business' }],
      after: [
        { id: '2', url: 'https://x.dev/a1.jpg', source: 'business' },
        { id: '3', url: 'https://x.dev/a2.jpg', source: 'business' },
      ],
      client_supplied: [{ id: '4', url: 'https://x.dev/c1.jpg', source: 'client' }],
    },
  };

  function mountInvoice(invoice) {
    api.get.mockResolvedValue(invoice);
    return render(wrap(
      <InvoiceScreen navigation={mockNavigation} route={{ params: { bookingId: 'b-done' } }} />
    ));
  }

  it('shows the before/after sections with their counts', async () => {
    const screen = mountInvoice(INVOICE);
    await waitFor(() => expect(screen.getByText('Proof of work')).toBeTruthy());
    expect(screen.getByText('Before · 1')).toBeTruthy();
    expect(screen.getByText('After · 2')).toBeTruthy();
  });

  it('labels the client’s own job-post photos apart from the business record', async () => {
    // Same distinction proof_of_work.py enforces via booking_photos.source —
    // a client's photo must never read as the business's proof of the work.
    const screen = mountInvoice(INVOICE);
    await waitFor(() => expect(screen.getByText('Proof of work')).toBeTruthy());
    expect(screen.getByText('From the job post · 1')).toBeTruthy();
  });

  it('omits the section entirely when a job has no photos', async () => {
    // Not every job has proof. An empty frame reading "no photos" would be
    // noise on a receipt — the section simply does not exist.
    const screen = mountInvoice({
      ...INVOICE, proof: { before: [], after: [], client_supplied: [] },
    });
    await waitFor(() => expect(screen.getByText('Receipt')).toBeTruthy());
    expect(screen.queryByText('Proof of work')).toBeNull();
  });

  it('survives an older backend that sends no proof block at all', async () => {
    const { proof, ...withoutProof } = INVOICE;
    const screen = mountInvoice(withoutProof);
    await waitFor(() => expect(screen.getByText('Receipt')).toBeTruthy());
    expect(screen.queryByText('Proof of work')).toBeNull();
  });
});
