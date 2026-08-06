// Proof-of-work thumbnails must open the lightbox.
//
// The gap: BookingPhotos rendered each photo as a bare <Image> with no
// Pressable around it. Every other photo surface in the app (ProofOfWorkScreen,
// ApproveWorkScreen, ChatImageBubble, InvoiceScreen, RefundReviewScreen…)
// already opened the shared ImageViewer on tap, so this was the one place where
// a client looking at before/after evidence on BookingDetailsScreen could tap a
// photo and have nothing happen at all. The photos were 92x92 thumbnails — too
// small to actually see the work that was done, which is the whole point of
// proof of work.
//
// The ordering assertion is the part worth keeping. The viewer takes a flat
// array plus an index, while the thumbnails render grouped by phase, so the
// index each thumbnail hands over has to be computed against the SAME flattened
// order the eye reads. Tapping the first "After" photo must open the viewer on
// that photo, not on the first "Before" one.
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';

import BookingPhotos from '../components/BookingPhotos';
import { api } from '../services/api';

jest.mock('../services/api');

const BEFORE_A = 'https://cdn.test/before-a.jpg';
const BEFORE_B = 'https://cdn.test/before-b.jpg';
const AFTER_A = 'https://cdn.test/after-a.jpg';

const ROWS = [
  { id: 'p1', phase: 'before', url: BEFORE_A },
  { id: 'p2', phase: 'before', url: BEFORE_B },
  { id: 'p3', phase: 'after', url: AFTER_A },
];

function renderPhotos() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <ThemeProvider>
        <BookingPhotos bookingId="b-1" />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Unwrapped body — the real client's interceptor returns response.data.
  api.get.mockResolvedValue({ items: ROWS });
});

describe('BookingPhotos — tap to view', () => {
  it('renders every photo as something tappable, not a bare image', async () => {
    const { findAllByLabelText } = renderPhotos();

    const tappable = await findAllByLabelText(/tap to view full screen/i);
    expect(tappable).toHaveLength(ROWS.length);
  });

  it('opens the lightbox on the tapped photo, indexed across both phases', async () => {
    const { findAllByLabelText, queryByText } = renderPhotos();

    const tappable = await findAllByLabelText(/tap to view full screen/i);

    // The viewer's own "n / total" counter is the assertion, because it proves
    // both things at once: that the lightbox opened, and WHICH photo it landed
    // on. A "close button exists" check would pass even if every thumbnail
    // opened photo 1.
    expect(queryByText('3 / 3')).toBeNull();

    // The third thumbnail is the first "After" photo. If the index were
    // computed per-phase instead of across the flattened list it would resolve
    // to 0 here and open a "Before" photo — the counter would read "1 / 3".
    fireEvent.press(tappable[2]);

    expect(queryByText('3 / 3')).not.toBeNull();
    expect(queryByText('1 / 3')).toBeNull();
  });

  it('opens the first photo when the first thumbnail is tapped', async () => {
    const { findAllByLabelText, queryByText } = renderPhotos();

    const tappable = await findAllByLabelText(/tap to view full screen/i);
    fireEvent.press(tappable[0]);

    expect(queryByText('1 / 3')).not.toBeNull();
  });

  it('labels each thumbnail with its phase so the tap target is described', async () => {
    const { findAllByLabelText } = renderPhotos();

    const before = await findAllByLabelText(/^Before photo/i);
    const after = await findAllByLabelText(/^After photo/i);

    expect(before).toHaveLength(2);
    expect(after).toHaveLength(1);
  });
});


// PanResponder computes a gesture centroid before it ever calls our handlers,
// and that reads `touchHistory.touchBank`. RNTL's fireEvent does not synthesise
// one, so a bare `fireEvent(el, 'responderMove', {...})` dies inside React
// Native itself with "Cannot read properties of undefined (reading
// 'touchBank')" — a harness gap, not a component bug. This builds the shape
// PanResponder actually reads.
function touch(x, y) {
  return {
    nativeEvent: {
      locationX: x,
      locationY: y,
      pageX: x,
      pageY: y,
      touches: [{ identifier: 0, locationX: x, locationY: y, pageX: x, pageY: y }],
      changedTouches: [],
      identifier: 0,
    },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: 1,
      touchBank: [
        {
          touchActive: true,
          startPageX: x,
          startPageY: y,
          startTimeStamp: 0,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: 1,
          previousPageX: x,
          previousPageY: y,
          previousTimeStamp: 0,
        },
      ],
    },
  };
}

// ── Markup (provider-side) ───────────────────────────────────────────────────
//
// Kira's ruling: markup is BURNED IN and saved as a NEW photo, never replacing
// the original. These guard the two things that would quietly break that: the
// markup control appearing for clients, and the save path overwriting instead
// of appending.
describe('BookingPhotos — markup', () => {
  it('offers markup to the provider only', async () => {
    const client = renderPhotos();
    expect(await client.findAllByLabelText(/tap to view full screen/i)).toHaveLength(3);
    expect(client.queryAllByLabelText(/mark up this/i)).toHaveLength(0);

    const provider = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ThemeProvider>
          <BookingPhotos bookingId="b-1" canAttach />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(await provider.findAllByLabelText(/mark up this/i)).toHaveLength(3);
  });

  it('saves markup as a NEW photo in the same phase, leaving the original alone', async () => {
    const { uploadFile } = require('../services/api');
    uploadFile.mockResolvedValue({ url: 'https://cdn.test/markup.jpg', path: 'p/markup.jpg' });
    api.post.mockResolvedValue({ id: 'p4' });

    const { findAllByLabelText, getByLabelText } = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <ThemeProvider>
          <BookingPhotos bookingId="b-1" canAttach />
        </ThemeProvider>
      </SafeAreaProvider>,
    );

    // Third thumbnail is the "after" photo — its markup must land in "after".
    const markupButtons = await findAllByLabelText(/mark up this/i);
    fireEvent.press(markupButtons[2]);

    // Draw one stroke, otherwise Save stays disabled by design.
    const canvas = getByLabelText('Drawing area');
    fireEvent(canvas, 'responderGrant', touch(10, 10));
    fireEvent(canvas, 'responderMove', touch(80, 60));
    fireEvent(canvas, 'responderRelease', touch(80, 60));

    await act(async () => {
      fireEvent.press(getByLabelText('Save marked-up photo'));
    });

    const attachCalls = api.post.mock.calls.filter(([url]) => url === '/bookings/b-1/photos');
    expect(attachCalls).toHaveLength(1);

    const [, body] = attachCalls[0];
    expect(body.phase).toBe('after');
    expect(body.url).toBe('https://cdn.test/markup.jpg');

    // The giveaway that it appended rather than replaced: no delete, no PATCH
    // of an existing row, and the original URL is nowhere in the payload.
    expect(api.delete).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(AFTER_A);
  });
});
