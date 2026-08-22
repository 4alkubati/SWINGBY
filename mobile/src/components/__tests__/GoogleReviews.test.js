// GoogleReviews.test.js — LANE D / walkthrough M3.
//
// The two things worth proving on the client side while Google's Business
// Profile approval is still pending:
//
//   1. THE FLAG-OFF PATH IS CLEAN. This is the state the app actually ships
//      in, so it is the state most likely to reach a real user. It must render
//      an explanatory card with NO pressable control — not a spinner, not an
//      error, and above all not a "Connect Google" button that would 503.
//   2. AN IMPORTED REVIEW ALWAYS LOOKS IMPORTED. A client must never mistake a
//      Google review for one left on a SwingBy job. The provenance label is
//      the feature, so it gets a test rather than a code comment.
//
// The `googleReviews` service is mocked at the module boundary — no network,
// and nothing here stands in for a real Google response beyond the two fields
// the labelling reads. There are deliberately no realistic-looking fake review
// fixtures in this file; see test_google_reviews.py for why fabricated review
// data has no place in this feature.

import { render, waitFor } from '@testing-library/react-native';

import GoogleReviewsConnect from '../GoogleReviewsConnect';
import ImportedReviewsSection from '../ImportedReviewsSection';
import * as googleReviews from '../../services/googleReviews';

jest.mock('../../services/googleReviews');

describe('GoogleReviewsConnect — flag off (the shipped state)', () => {
  beforeEach(() => {
    googleReviews.getStatus.mockResolvedValue({
      enabled: false,
      connected: false,
      status: 'coming_soon',
      imported_count: 0,
      imported_average_rating: null,
      message: 'Coming soon — we are waiting on Google to approve access.',
    });
  });

  it('explains itself instead of offering a button that would fail', async () => {
    const { getByText, queryByLabelText, queryByText } = render(<GoogleReviewsConnect />);

    await waitFor(() => expect(getByText('Bring your Google reviews across')).toBeTruthy());
    expect(getByText(/Coming soon/i)).toBeTruthy();

    // The whole point of building dark: no control exists to be pressed.
    expect(queryByText('Connect Google')).toBeNull();
    expect(queryByText('Update reviews')).toBeNull();
    expect(queryByText('Disconnect')).toBeNull();
    expect(queryByLabelText('Connect Google')).toBeNull();
  });

  it('never calls a gated endpoint while the flag is off', async () => {
    render(<GoogleReviewsConnect />);
    await waitFor(() => expect(googleReviews.getStatus).toHaveBeenCalled());

    expect(googleReviews.connectGoogleBusiness).not.toHaveBeenCalled();
    expect(googleReviews.listLocations).not.toHaveBeenCalled();
    expect(googleReviews.importReviews).not.toHaveBeenCalled();
  });
});

describe('GoogleReviewsConnect — status unavailable', () => {
  it('renders nothing rather than an error the owner cannot act on', async () => {
    // 404 is the ordinary case here: the owner has no business row yet.
    googleReviews.getStatus.mockRejectedValue(new Error('Not found'));

    const { toJSON } = render(<GoogleReviewsConnect />);
    await waitFor(() => expect(toJSON()).toBeNull());
  });
});

describe('GoogleReviewsConnect — flag on, not yet connected', () => {
  it('offers exactly one connect control', async () => {
    googleReviews.getStatus.mockResolvedValue({
      enabled: true,
      connected: false,
      status: 'not_connected',
      imported_count: 0,
      imported_average_rating: null,
    });

    const { getByText, queryByText } = render(<GoogleReviewsConnect />);

    await waitFor(() => expect(getByText('Connect Google')).toBeTruthy());
    // Disconnect must not appear before there is anything to disconnect.
    expect(queryByText('Disconnect')).toBeNull();
  });
});

describe('ImportedReviewsSection — provenance is always visible', () => {
  const rows = [
    {
      id: 'ir-1',
      source: 'google',
      external_review_id: 'ext-1',
      author_name: 'A. Reviewer',
      rating: 5,
      comment: 'Left on Google, not on SwingByy.',
      verified: true,
    },
    {
      id: 'ir-2',
      source: 'google',
      external_review_id: 'ext-2',
      author_name: 'Google user',
      rating: 2,
      comment: 'Also imported.',
      verified: true,
    },
  ];

  it('labels the section and every individual card', () => {
    const { getByText, getAllByText } = render(
      <ImportedReviewsSection reviews={rows} summary={{ count: 2, average_rating: 3.5 }} />,
    );

    expect(getByText('Verified Google reviews')).toBeTruthy();
    // One pill per card, so a card screenshotted alone still says where it
    // came from.
    expect(getAllByText('Google · Verified')).toHaveLength(2);
    // And the caption states the part a client actually needs to know.
    expect(getByText(/not counted in its SwingByy rating/i)).toBeTruthy();
  });

  it('shows the imported average separately from the SwingByy rating', () => {
    const { getByText } = render(
      <ImportedReviewsSection reviews={rows} summary={{ count: 2, average_rating: 3.5 }} />,
    );
    expect(getByText('3.5 · 2')).toBeTruthy();
  });

  it('renders nothing when there is nothing imported', () => {
    const { toJSON } = render(
      <ImportedReviewsSection reviews={[]} summary={{ count: 0, average_rating: null }} />,
    );
    // An empty "Verified Google reviews" heading would imply a business had
    // bad ones and hid them.
    expect(toJSON()).toBeNull();
  });

  it('survives a missing summary without dropping the labels', () => {
    const { getAllByText } = render(<ImportedReviewsSection reviews={rows} summary={null} />);
    expect(getAllByText('Google · Verified')).toHaveLength(2);
  });
});
