/**
 * M11 — "Share photos / agree to terms inside the message thread."
 *
 * The walkthrough complaint was that the thread is text-only. These tests are
 * the proof that it no longer is: a typed message row from the API has to come
 * out as a photo bubble and as an agreement card, and the agreement's "I agree"
 * must be reachable by the client and NOT offered to anyone else.
 *
 * ChatScreen is rendered directly (the `MessageThread` route re-exports it),
 * with the two contexts it reads stubbed, so this stays a render/behaviour
 * test rather than an integration test of auth.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../services/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  uploadFile: jest.fn(),
}));
import { api } from '../../../services/api';

// `mock`-prefixed so the jest.mock factory below is allowed to close over it
// (jest guards against uninitialised out-of-scope variables otherwise).
const mockAuth = { user: { id: 'client-1', role: 'client' } };
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('../../../context/UnreadContext', () => ({
  useUnread: () => ({ mark: jest.fn() }),
}));

import ChatScreen from '../ChatScreen';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const BOOKING_ID = '22222222-2222-2222-2222-222222222222';

const IMAGE_MESSAGE = {
  id: 'msg-image',
  sender_id: 'owner-1',
  message_type: 'image',
  content: 'Photo',
  attachment_url: 'https://cdn.example/posts/owner-1/pipe.jpg',
  attachment_width: 1200,
  attachment_height: 900,
  sent_at: '2026-07-25T12:00:00Z',
  read_at: '2026-07-25T12:00:01Z',
};

function termsMessage(terms) {
  return {
    id: 'msg-terms',
    sender_id: 'owner-1',
    message_type: 'terms',
    content: 'Scope of work: Hallway repaint',
    sent_at: '2026-07-25T12:05:00Z',
    read_at: '2026-07-25T12:05:01Z',
    terms: {
      id: 'terms-1',
      message_id: 'msg-terms',
      title: 'Hallway repaint',
      terms_text: 'Two coats. We move the furniture. No drywall repair.',
      status: 'pending',
      proposed_by: 'owner-1',
      verified: true,
      can_accept: true,
      ...terms,
    },
  };
}

function mockThread(items) {
  api.get.mockImplementation((path) => {
    if (path.startsWith('/bookings/')) {
      return Promise.resolve({ id: BOOKING_ID, business_id: 'biz-1', confirmed_date: null });
    }
    // The API returns newest-first; the screen reverses for display.
    return Promise.resolve({ items: [...items].reverse(), next_before: null });
  });
}

function renderThread() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ChatScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() }}
        route={{ params: { bookingId: BOOKING_ID, otherPartyName: 'Test Cleaning' } }}
      />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockAuth.user = { id: 'client-1', role: 'client' };
  jest.clearAllMocks();
});

describe('photos in the thread', () => {
  it('renders an image message as a photo bubble, not as text', async () => {
    mockThread([IMAGE_MESSAGE]);
    renderThread();

    expect(await screen.findByLabelText('Photo they sent')).toBeTruthy();
    // The server-side default caption is a list-preview label, never drawn as
    // if the sender had typed it.
    expect(screen.queryByText('Photo')).toBeNull();
  });

  it('offers a photo button on the composer', async () => {
    mockThread([]);
    renderThread();

    expect(await screen.findByLabelText('Send a photo')).toBeTruthy();
  });
});

describe('terms in the thread', () => {
  it('renders a terms message as an agreement card the client can accept', async () => {
    mockThread([termsMessage()]);
    renderThread();

    expect(await screen.findByText('Hallway repaint')).toBeTruthy();
    expect(screen.getByText(/Two coats\./)).toBeTruthy();
    expect(screen.getByText('TERMS TO AGREE')).toBeTruthy();
    expect(screen.getByLabelText('I agree to these terms')).toBeTruthy();
  });

  it('confirms before recording an agreement — one tap can never sign it', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockThread([termsMessage()]);
    renderThread();

    fireEvent.press(await screen.findByLabelText('I agree to these terms'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(api.post).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows who agreed once it is accepted, and stops offering the button', async () => {
    mockThread([
      termsMessage({
        status: 'accepted',
        can_accept: false,
        accepted_by: 'client-1',
        accepted_at: '2026-07-25T13:00:00Z',
        accepted_name: 'Jane Client',
      }),
    ]);
    renderThread();

    expect(await screen.findByText(/Agreed by Jane Client/)).toBeTruthy();
    expect(screen.queryByLabelText('I agree to these terms')).toBeNull();
    // The agreed wording stays readable forever — that is the whole point.
    expect(screen.getByText(/No drywall repair\./)).toBeTruthy();
  });

  it('refuses to present an unverifiable record as an agreement', async () => {
    mockThread([
      termsMessage({
        status: 'accepted',
        can_accept: false,
        verified: false,
        accepted_name: 'Jane Client',
      }),
    ]);
    renderThread();

    expect(await screen.findByText("This record can't be verified")).toBeTruthy();
    expect(screen.queryByLabelText('I agree to these terms')).toBeNull();
  });

  it('only the business gets the send-terms button', async () => {
    mockThread([]);
    renderThread();
    await screen.findByLabelText('Send a photo');
    expect(screen.queryByLabelText('Send terms to agree')).toBeNull();

    screen.unmount();
    mockAuth.user = { id: 'owner-1', role: 'business_owner' };
    mockThread([]);
    renderThread();
    expect(await screen.findByLabelText('Send terms to agree')).toBeTruthy();
  });
});
