import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import i18n from '../i18n';
import { colors, spacing } from '../theme/tokens';

// AUDIT B16 — the two entries below (`dates_proposed`, `date_confirmed`) were
// missing, so this timeline printed the raw enum `date_confirmed` straight to a
// business owner's screen. The client-side copy of this renderer was fixed and
// its comment said "the same fix belongs there next"; it never happened, and
// this component is still mounted on the business booking screen
// (JobManagementScreen). Same bug, different screen — the recurring shape of
// every defect found in this audit.
const COPY = {
  dates_proposed: { icon: 'calendar', title: 'Times proposed' },
  date_confirmed: { icon: 'check-circle', title: 'Time confirmed' },
  en_route: { icon: 'navigation', title: 'On the way' },
  arrived: { icon: 'map-pin', title: 'Provider arrived' },
  started: { icon: 'play-circle', title: 'Job started' },
  paused: { icon: 'pause-circle', title: 'Job paused' },
  resumed: { icon: 'play-circle', title: 'Job resumed' },
  completed: { icon: 'check-circle', title: 'Job complete' },
  cancelled_event: { icon: 'x-circle', title: 'Cancelled' },
};

// Bug 10 — a 'completed' row can be two different real events. Client
// approval of proof also inserts its own event_type: 'completed' row
// (backend/app/api/proof_of_work.py::approve_proof), on top of the
// 'completed' row the business's own "mark done" already wrote
// (backend/app/services/approvals.py::start_approval_window). Both carry the
// identical event_type, so COPY alone would label them both "Job complete".
// The note text is the only signal left that tells them apart — approve_proof
// always writes "payment released" into it, and no "mark done" note does.
function isPaymentReleaseNote(note) {
  return /payment released/i.test(note || '');
}

// Notes are written by the backend and routinely embed a raw ISO timestamp
// (`2026-07-25T20:30:00+00:00`). Appending one verbatim next to a friendly
// time is the other half of B16.
const ISO_IN_TEXT = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g;

function humaniseNote(note) {
  if (!note) return '';
  return String(note).replace(ISO_IN_TEXT, (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  });
}

/** Turn `cancelled_event` into `Cancelled event` rather than showing the enum. */
function humaniseEventType(t) {
  return String(t || '')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-CA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * The event timeline.
 *
 * CONTROLLED, and headless. It used to poll GET /bookings/{id}/events into its
 * own state while LiveStatusActions fetched the same endpoint into a second
 * copy, and both drew a card headed "Live status" — so the business booking
 * screen showed that heading twice, over two views that could disagree. The
 * screen owns the fetch and the polling now, and owns the single heading; this
 * renders rows.
 *
 * `status` is the caller's load state: 'loading' | 'ready' | 'error'.
 */
export default function LiveStatusTimeline({ events = [], status = 'ready' }) {
  if (status === 'loading') {
    return (
      <Inline justify="center" spacing="sm">
        <ActivityIndicator size="small" color={colors.accent} />
        <Text variant="small" color="secondary">Loading status…</Text>
      </Inline>
    );
  }

  if (status === 'error' && !events.length) {
    return (
      <Text variant="small" color="secondary">Could not load live status.</Text>
    );
  }

  if (!events.length) {
    return (
      <Text variant="small" color="secondary">
        Updates will appear here when the job starts moving.
      </Text>
    );
  }

  return (
      <Stack spacing="sm">
        {events.map((ev, i) => {
          const meta = (ev.event_type === 'completed' && isPaymentReleaseNote(ev.note))
            ? { icon: 'dollar-sign', title: i18n.t('booking.eventPaymentReleased') }
            : COPY[ev.event_type] || {
              icon: 'circle',
              // Never the bare enum: an unknown event type still gets read by
              // a human, so spell it like words. This also covers the real
              // 'payment_released' event_type approvals.release() writes —
              // "payment released" is already the right shape without a COPY
              // entry.
              title: humaniseEventType(ev.event_type),
            };
          const last = i === events.length - 1;
          return (
            <View key={ev.id || `${ev.event_type}-${i}`} style={styles.row}>
              <View style={styles.iconCol}>
                <View style={styles.iconCircle}>
                  <Feather name={meta.icon} size={14} color={colors.accent} />
                </View>
                {!last && <View style={styles.connector} />}
              </View>
              {/* P3 — the note (often the appointment itself) and the time
                  this update was logged used to share one line, unlabelled.
                  Same fix as the client timeline in BookingDetailsScreen. */}
              <Stack spacing={2} style={styles.body}>
                <Text variant="smallMedium">{meta.title}</Text>
                {ev.note ? (
                  <Text variant="caption">{humaniseNote(ev.note)}</Text>
                ) : null}
                <Text variant="caption" color="secondary">
                  {i18n.t('booking.eventLoggedAt', { time: formatTime(ev.created_at) })}
                </Text>
              </Stack>
            </View>
          );
        })}
      </Stack>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCol: {
    alignItems: 'center',
    width: 28,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 14,
    backgroundColor: colors.border,
    marginTop: 2,
    borderRadius: 1,
  },
  body: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
