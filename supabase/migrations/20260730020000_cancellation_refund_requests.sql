-- Cancellation refunds become a REQUEST that an admin approves or declines,
-- instead of money leaving the moment someone taps Cancel.
--
-- Kira's ruling, 2026-07-30:
--   * post expiry  -> refund immediately (unchanged; expiry_sweep.py)
--   * job cancelled -> a refund request, approved or declined by SwingBy after
--     reviewing the before/after photos and the voice memo
--
-- Reusing `disputes` rather than adding a table: it already has the exact
-- lifecycle (open -> resolved | dismissed), the adjudicator (admin-only
-- PATCH /disputes/{id}/resolve), the audit trail and the client-facing list
-- screen. All it lacks is a value in the issue_type CHECK to tell a
-- cancellation refund apart from a quality complaint.
--
-- `status` needs no change: 'resolved' carries an approval and 'dismissed' a
-- decline, both already permitted by disputes_status_check.
--
-- Only cancellations with proof of work submitted become requests. With no proof
-- nobody has been to the property, there is nothing to review, and the ladder
-- settles it instantly — see bookings.py::cancel_booking.

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_issue_type_check;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_issue_type_check
  CHECK (
    issue_type = ANY (
      ARRAY[
        'no_show'::text,
        'poor_quality'::text,
        'damage'::text,
        'overcharge'::text,
        'safety'::text,
        'other'::text,
        -- New. Opened by cancel_booking, never by a user through POST /disputes/
        -- (create_dispute rejects it) — a client cannot manufacture a refund
        -- request for a booking they have not cancelled.
        'cancellation_refund'::text
      ]
    )
  );

COMMENT ON COLUMN disputes.issue_type IS
  'Complaint category. ''cancellation_refund'' is system-opened by '
  'cancel_booking when a job is cancelled after proof of work exists; the held '
  'escrow stays put until an admin resolves (approve) or dismisses (decline).';
