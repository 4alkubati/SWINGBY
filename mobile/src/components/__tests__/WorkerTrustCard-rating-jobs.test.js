// WorkerTrustCard-rating-jobs.test.js — walkthrough bug 5 leftover.
//
// d89ae42 fixed the name/role/company phantom fields on this card but left
// `rating` (read from the phantom `booking.avg_rating`) and `job_count` (not
// a column anywhere) flagged as out of scope. This pins the fix:
//
//   - rating reads the real nested `businesses.avg_rating`, and only once
//     `businesses.review_count` confirms a review is actually behind it —
//     avg_rating defaults to 0 in the DB until the first review recomputes
//     it, so an unrated business must render no rating at all rather than a
//     permanent "0.0 stars" (same bug class as the $0.00 price).
//   - job_count reads the server-derived `assignee.jobs_completed`
//     (bookings.py::_completed_job_counts / _attach_assignee), including a
//     real 0 for a brand-new employee — and renders nothing when it is
//     genuinely unknown (null), never a fabricated 0.
import React from 'react';
import { render } from '@testing-library/react-native';

import WorkerTrustCard from '../WorkerTrustCard';

const BASE = {
  status: 'in_progress',
  assignee: {
    type: 'employee',
    name: 'Dana Reid',
    role_title: 'Lead Cleaner',
    business_name: 'Test Cleaning Co.',
  },
};

describe('WorkerTrustCard — rating', () => {
  it('shows the real rating from businesses.avg_rating when there are reviews behind it', () => {
    const booking = {
      ...BASE,
      businesses: { business_name: 'Test Cleaning Co.', avg_rating: 4.8, review_count: 12 },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('4.8')).not.toBeNull();
  });

  it('never renders a fabricated "0.0" for a business with zero reviews', () => {
    const booking = {
      ...BASE,
      // The DB default: avg_rating = 0, review_count = 0, nobody has reviewed
      // this business yet.
      businesses: { business_name: 'Test Cleaning Co.', avg_rating: 0, review_count: 0 },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('0.0')).toBeNull();
  });

  it('does not read the phantom flat booking.avg_rating field', () => {
    const booking = {
      ...BASE,
      avg_rating: 4.2, // flat field the API never sends — must be ignored
      businesses: { business_name: 'Test Cleaning Co.', review_count: 0 },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('4.2')).toBeNull();
  });
});

describe('WorkerTrustCard — completed job count', () => {
  it('shows the real count from assignee.jobs_completed', () => {
    const booking = {
      ...BASE,
      businesses: { business_name: 'Test Cleaning Co.' },
      assignee: { ...BASE.assignee, jobs_completed: 6 },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('6 jobs')).not.toBeNull();
  });

  it('shows a real zero for a brand-new employee rather than hiding it', () => {
    const booking = {
      ...BASE,
      businesses: { business_name: 'Test Cleaning Co.' },
      assignee: { ...BASE.assignee, jobs_completed: 0 },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('0 jobs')).not.toBeNull();
  });

  it('renders nothing when the count is genuinely unknown, not a fabricated 0', () => {
    const booking = {
      ...BASE,
      businesses: { business_name: 'Test Cleaning Co.' },
      assignee: { ...BASE.assignee, jobs_completed: null },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText(/jobs$/)).toBeNull();
  });

  it('does not read the phantom flat booking.job_count field', () => {
    const booking = {
      ...BASE,
      job_count: 9, // not a column anywhere — must be ignored
      businesses: { business_name: 'Test Cleaning Co.' },
      assignee: { ...BASE.assignee, jobs_completed: null },
    };
    const { queryByText } = render(<WorkerTrustCard booking={booking} onViewBusiness={() => {}} />);
    expect(queryByText('9 jobs')).toBeNull();
  });
});
