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
import { render, fireEvent } from '@testing-library/react-native';
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
