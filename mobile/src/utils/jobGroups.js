// CARD-24 — single source of truth for how a business's bookings/leads/quotes
// get grouped into Today / Upcoming / Needs action / Past. Shared by
// DashboardScreen and JobManagementScreen's Jobs-tab list so the two screens
// can never disagree about what "needs action" means or what counts as today.
//
// Every input here is data already returned by endpoints the app calls
// elsewhere (GET /bookings/, GET /service-posts/, GET /interests/mine) — this
// module does no fetching of its own, just grouping/derivation, so it adds no
// new network calls and no N+1s.

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// bookings.confirmed_date is a plain ISO-8601 string column (not date/timestamptz
// per docs/swingby_database_schema.md) — set once via PATCH /confirm-date.
// Its presence is exactly "this job is scheduled."
export function bookingDate(booking) {
  const raw = booking?.confirmed_date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {object} params
 * @param {Array} params.bookings - GET /bookings/ items (business_owner shape)
 * @param {Array} params.posts - GET /service-posts/ items (open, business-filtered)
 * @param {Array} params.quotes - GET /interests/mine items
 * @param {Date} [params.now] - injectable for tests
 */
export function groupBusinessJobs({ bookings = [], posts = [], quotes = [], now = new Date() } = {}) {
  const activeBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'in_progress'
  );

  const scheduled = activeBookings.filter((b) => !!bookingDate(b));

  const today = scheduled
    .filter((b) => isSameDay(bookingDate(b), now))
    .sort((a, b) => bookingDate(a) - bookingDate(b));

  const upcoming = scheduled
    .filter((b) => {
      const d = bookingDate(b);
      return d > now && !isSameDay(d, now);
    })
    .sort((a, b) => bookingDate(a) - bookingDate(b));

  // Needs action: no date confirmed yet OR no employee assigned yet (even if
  // the date IS confirmed — an unstaffed job is still something to act on).
  // This intentionally can overlap with today/upcoming: a job can be both
  // "happening today" and "still needs a worker assigned."
  const awaitingSchedule = activeBookings.filter(
    (b) => !bookingDate(b) || !b.employee_id
  );

  const quotedPostIds = new Set(
    quotes.map((q) => q.post_id || q.service_posts?.id).filter(Boolean)
  );
  const newLeads = posts.filter(
    (p) => p.status === 'open' && !quotedPostIds.has(p.id)
  );
  const pendingQuotes = quotes.filter((q) => q.status === 'pending');

  // Past = the deal is closed, one way or another. Completed jobs get an
  // invoice; cancelled ones don't, but they shouldn't vanish from history.
  const past = bookings
    .filter((b) => b.status === 'completed' || b.status === 'cancelled')
    .sort((a, b) => {
      const at = new Date(a.completed_at || a.confirmed_date || a.created_at || 0);
      const bt = new Date(b.completed_at || b.confirmed_date || b.created_at || 0);
      return bt - at;
    });

  const nextJob = [...today, ...upcoming][0] || null;

  return {
    today,
    upcoming,
    past,
    needsAction: {
      leads: newLeads,
      quotes: pendingQuotes,
      awaitingSchedule,
      total: newLeads.length + pendingQuotes.length + awaitingSchedule.length,
    },
    nextJob,
  };
}
