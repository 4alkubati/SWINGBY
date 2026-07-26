// dashboard-quoted-opportunities.test.js — walkthrough audit B10.
//
// "Opportunity still shows under 'New Opportunities' after a quote was sent.
// Stale cache / no invalidation."
//
// The Jobs screen got this fix as B11/B12 (5c279ce). The Dashboard never did:
// it renders "New opportunities" straight off `GET /service-posts/`, which
// knows nothing about who has quoted, so a post the business had already
// quoted kept offering "Send quote" — a button the API answers with "You
// already expressed interest in this post".
//
// Three things are pinned:
//   1. an already-quoted post never reaches the feed on load,
//   2. sending a quote collapses the card immediately, without waiting on a
//      refetch (that is the "no invalidation" half),
//   3. the module-level warm cache the Dashboard repaints from does not
//      resurrect the collapsed card on the next mount (the "stale cache" half).
//
// Note on isolation: DashboardScreen keeps a module-level stale-while-refetch
// cache that no test can reach, and jest.resetModules() is not an option here
// (re-requiring the screen gives it a second React instance and every render
// dies in useContext). So every test below uses its OWN post ids — nothing
// one test leaves in that cache can be mistaken for another test's post.

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../../../theme/ThemeProvider';

jest.mock('../../../services/api');

jest.mock('../../../context/AuthContext', () => {
  const actual = jest.requireActual('../../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: { id: 'u2', role: 'business_owner', first_name: 'Biz' },
      token: 'test-token',
      isLoading: false,
      logout: jest.fn(),
      updateUser: jest.fn(),
    }),
  };
});

// Stands in for the real quote sheet so a test can complete a quote without
// driving the sheet's own form. It reports success exactly the way the real
// one does: onQuoted(interest, note).
jest.mock('../../../components/SendQuoteSheet', () => {
  const MockReact = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return function MockSendQuoteSheet({ visible, post, onQuoted }) {
    if (!visible) return null;
    return MockReact.createElement(
      TouchableOpacity,
      {
        testID: 'mock-confirm-quote',
        onPress: () => onQuoted?.({ id: 'int-new', post_id: post?.id }, null),
      },
      MockReact.createElement(Text, null, 'Confirm the quote')
    );
  };
});

// eslint-disable-next-line import/first
import api from '../../../services/api';
// eslint-disable-next-line import/first
import DashboardScreen from '../DashboardScreen';

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

function post(id, title) {
  return { id, title, status: 'open', budget: 180 };
}

/** Wire the api mock, then mount the Dashboard. */
function mountDashboard({ posts = [], interests = [], interestsFails = false } = {}) {
  api.get.mockImplementation((path) => {
    if (path === '/service-posts/') return Promise.resolve({ items: posts });
    if (path === '/interests/mine') {
      return interestsFails
        ? Promise.reject(new Error('interests unavailable'))
        : Promise.resolve({ items: interests });
    }
    return Promise.resolve({ items: [] });
  });
  return render(
    <Providers>
      <DashboardScreen navigation={mockNavigation} />
    </Providers>
  );
}

describe('Dashboard — New opportunities and posts already quoted', () => {
  it('shows an open post the business has not quoted', async () => {
    const p = post('b10-a1', 'Deep clean — 3BR house');
    const { getByText } = mountDashboard({ posts: [p] });
    await waitFor(() => expect(getByText(p.title)).toBeTruthy());
  });

  it('hides a post this business already sent a quote on', async () => {
    const open = post('b10-a2', 'Gutter clear — bungalow');
    const quoted = post('b10-q2', 'Move-out clean — 1BR');
    const { getByText, queryByText } = mountDashboard({
      posts: [open, quoted],
      interests: [{ id: 'int-1', post_id: quoted.id, status: 'pending' }],
    });

    await waitFor(() => expect(getByText(open.title)).toBeTruthy());
    expect(queryByText(quoted.title)).toBeNull();
  });

  it('filters a quoted post out regardless of the interest status', async () => {
    // A rejected quote is still a quote: the API's uniqueness rule is on
    // (post, business), not on the status, so re-quoting still fails.
    const quoted = post('b10-q3', 'Fence repair — back lane');
    const { getByText, queryByText } = mountDashboard({
      posts: [quoted],
      interests: [{ id: 'int-1', post_id: quoted.id, status: 'rejected' }],
    });

    await waitFor(() => expect(getByText('No open jobs right now')).toBeTruthy());
    expect(queryByText(quoted.title)).toBeNull();
  });

  it('reads the post id off the embedded post when post_id is absent', async () => {
    const quoted = post('b10-q4', 'Window wash — 2 storey');
    const { getByText, queryByText } = mountDashboard({
      posts: [quoted],
      interests: [{ id: 'int-1', service_posts: { id: quoted.id }, status: 'pending' }],
    });

    await waitFor(() => expect(getByText('No open jobs right now')).toBeTruthy());
    expect(queryByText(quoted.title)).toBeNull();
  });

  it('still lists the post if /interests/mine fails — no fetch, no filter', async () => {
    // Losing the interests call must not blank the opportunities feed; it only
    // costs the filter. Better a re-quote error than an empty dashboard.
    const p = post('b10-a6', 'Snow clearing — corner lot');
    const { getByText } = mountDashboard({ posts: [p], interestsFails: true });
    await waitFor(() => expect(getByText(p.title)).toBeTruthy());
  });
});

describe('Dashboard — sending a quote collapses the card', () => {
  it('removes the opportunity immediately, before any refetch lands', async () => {
    // /interests/mine keeps returning [] for the whole test, so the card can
    // only disappear because of the optimistic path — not because a refetch
    // told it to.
    const p = post('b10-a7', 'Garage tidy — single bay');
    const { getByText, queryByText } = mountDashboard({ posts: [p], interests: [] });

    await waitFor(() => expect(getByText(p.title)).toBeTruthy());

    fireEvent.press(getByText('Send quote'));
    fireEvent.press(getByText('Confirm the quote'));

    await waitFor(() => expect(queryByText(p.title)).toBeNull());
    expect(getByText('No open jobs right now')).toBeTruthy();
  });

  it('does not resurrect the card when the screen remounts off the warm cache', async () => {
    // The audit called this "stale cache": the Dashboard repaints instantly
    // from its last payload on reopen. That repaint must already know the post
    // was quoted. The server is still behind here — /interests/mine stays
    // empty for the whole test — so only the cached set can keep it hidden.
    const p = post('b10-a8', 'Sod removal — front yard');

    const first = mountDashboard({ posts: [p], interests: [] });
    await waitFor(() => expect(first.getByText(p.title)).toBeTruthy());
    fireEvent.press(first.getByText('Send quote'));
    fireEvent.press(first.getByText('Confirm the quote'));
    await waitFor(() => expect(first.queryByText(p.title)).toBeNull());
    first.unmount();

    const second = mountDashboard({ posts: [p], interests: [] });
    await waitFor(() => expect(second.getByText('No open jobs right now')).toBeTruthy());
    expect(second.queryByText(p.title)).toBeNull();
  });
});
