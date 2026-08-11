// F105 — InvoiceScreen used to render `totals.total_charged` as a bold
// success-green "Total charged" fact with no check against
// `payment.capture_backed` — the flag backend/app/api/invoices.py computes
// specifically "so an invoice must not imply money was collected when no
// charge exists behind it." Mirrors the same gate ActiveBookingScreen already
// applies to its own "Total" row.
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

const wrap = (ui) => <SafeAreaProvider
  initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
>{ui}</SafeAreaProvider>;

const BASE_INVOICE = {
  invoice_number: 'SWB-B1', issued_at: '2026-07-24T18:00:00Z',
  client: { name: 'Casey Client', email: 'c@x.dev' },
  business: { name: 'Test Cleaning Co.', category: 'Cleaning', license_status: 'verified' },
  employee: { name: 'Khalid Worker', role_title: 'Cleaner' },
  service: { category: 'Cleaning' },
  schedule: { confirmed_date: null, completed_at: '2026-07-24T18:00:00Z' },
  line_items: [{ label: 'Service', amount: 180 }, { label: 'Platform fee (10%)', amount: -18 }],
  totals: { paid_to_business: 162, total_charged: 180 },
};

function mountInvoice(invoice) {
  api.get.mockResolvedValue(invoice);
  return render(wrap(
    <InvoiceScreen navigation={mockNavigation} route={{ params: { bookingId: 'b-done' } }} />
  ));
}

describe('F105 — invoice total only claims money was collected when capture_backed', () => {
  it('shows "Total charged" when a real capture backs the figure', async () => {
    const screen = mountInvoice({
      ...BASE_INVOICE,
      payment: { method: 'stripe_card', status: 'fully_released', capture_backed: true },
    });
    await waitFor(() => expect(screen.getByText('Total charged')).toBeTruthy());
    expect(screen.queryByText('Total (not yet captured)')).toBeNull();
  });

  it('does not claim "Total charged" when no capture backs the row', async () => {
    // e.g. a 'fully_released' ledger row with no Stripe PaymentIntent behind
    // it — the exact phantom-payout shape CLAUDE.md documents.
    const screen = mountInvoice({
      ...BASE_INVOICE,
      payment: { method: 'stripe_card', status: 'fully_released', capture_backed: false },
    });
    await waitFor(() => expect(screen.getByText('Total (not yet captured)')).toBeTruthy());
    expect(screen.queryByText('Total charged')).toBeNull();
  });

  it('treats a missing capture_backed field (older backend) as unverified, not verified', async () => {
    const screen = mountInvoice({
      ...BASE_INVOICE,
      payment: { method: 'stripe_card', status: 'fully_released' },
    });
    await waitFor(() => expect(screen.getByText('Total (not yet captured)')).toBeTruthy());
  });
});
