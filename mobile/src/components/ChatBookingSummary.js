// ChatBookingSummary — the PRIMARY content of a booking chat thread.
//
// Owner direction (2026-07-21): "the booking/booked should be the MAIN thing
// in chat." Once a quote is accepted the thread's identity is the BOOKING, so
// this card sits above the message list and carries the real booking state —
// confirmed date/time, address, status, service, payment — and taps through
// to the full BookingDetails screen. The demoted quote sits directly below
// this card, rendered by ChatScreen's renderQuoteCard() as a ChatQuoteCard in
// its collapsed `status="accepted"` record (F131, 2026-08-11): a separate
// QuoteBubble component was built the same week as this file for that same
// role, but ChatQuoteCard grew its own accepted/expired/declined resolved-
// record states two days later and that's what actually shipped — QuoteBubble
// was never wired to anything and has been deleted.
//
// Fed by bookingMeta (GET /bookings/{id}) which ChatScreen already fetches.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import Surface from './Surface';
import Inline from './Inline';
import StatusPill from './StatusPill';
import { colors, spacing } from '../theme/tokens';

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch { return null; }
}

function formatTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

// SB-0001 — this card read "pending payment · $180" directly above an accepted
// quote card reading "$180 paid", for one booking on one screen.
//
// Two things were wrong and only one of them is here.
//
// 1. THE LABEL (fixed here). `pending_payment` had no case, so it fell to the
//    old default, which was `status.replace(/_/g, ' ')` — the raw database
//    enum, lowercased, shown to a user. That is where the odd "pending payment"
//    came from, and the same default would have shown any future enum value
//    the same way. A user must never be shown a column value; the default now
//    returns a neutral label and unknown states stop leaking through.
//
// 2. THE STATE (not fixed here, and deliberately so). The booking's
//    payment_status is mirrored to 'held' at accept time by
//    backend/app/api/interests.py, but that mirror is BEST-EFFORT: it is
//    skipped when the capture is not backed, and its failure is a logged
//    warning rather than an error. So a booking whose money really did move can
//    still be sitting on the insert-time 'pending_payment'. Making that write
//    mandatory would mean failing an accept — after the card has been charged —
//    because a mirror column did not update, which is worse. It needs the
//    e2e smoke run against a live backend to say which case the screenshot was.
function paymentLabel(status) {
  switch ((status || '').toLowerCase()) {
    case 'fully_released':    return 'Paid';
    case 'partial_released':  return 'In progress';
    case 'held':              return 'Held in escrow';
    case 'refunded':          return 'Refunded';
    case 'paid_off_platform': return 'Paid (off-platform)';
    case 'pending_payment':   return 'Payment pending';
    case 'awaiting_approval': return 'Awaiting your approval';
    case 'failed':            return 'Payment failed';
    default:                  return 'Pending';
  }
}

function Row({ icon, children, muted }) {
  return (
    <Inline spacing="sm" align="center">
      <Feather name={icon} size={13} color={muted ? colors.textTertiary : colors.textSecondary} />
      <Text
        variant="small"
        color={muted ? 'secondary' : 'primary'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {children}
      </Text>
    </Inline>
  );
}

export default function ChatBookingSummary({ booking, onPress }) {
  if (!booking) return null;

  const service =
    booking.service_posts?.title
    || booking.service_category
    || booking.businesses?.category
    || 'Service booking';

  const address = booking.service_posts?.address;
  const date = formatDate(booking.confirmed_date);
  const time = formatTime(booking.confirmed_date);
  const amount = booking.total_amount != null ? `$${booking.total_amount}` : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open booking details"
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Surface elevation="subtle" background="alt" rounded="card" padding="base">
        {/* Title + status */}
        <Inline spacing="sm" align="center" justify="space-between">
          <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
            {service}
          </Text>
          {/* D-W4 (walkthrough 2026-08-13). This was `booking.status ||
              'confirmed'` — a missing status rendered as CONFIRMED, which is
              the most reassuring value it could have invented. A booking whose
              state we could not read is not a confirmed booking. Render the
              pill only when there is a real status; the money row below already
              carries the fact that matters. */}
          {!!booking.status && <StatusPill status={booking.status} />}
        </Inline>

        <View style={styles.rows}>
          <Row icon="calendar" muted={!date}>
            {date ? `${date}${time ? ` · ${time}` : ''}` : 'Time not set yet'}
          </Row>
          {!!address && <Row icon="map-pin">{address}</Row>}
          <Row icon="credit-card">
            {[paymentLabel(booking.payment_status), amount].filter(Boolean).join(' · ')}
          </Row>
        </View>

        {/* Tap-through affordance */}
        <Inline spacing="xs" align="center" style={styles.footer}>
          <Text variant="caption" style={{ color: colors.accentText, fontWeight: '600' }}>
            View booking details
          </Text>
          <Feather name="chevron-right" size={13} color={colors.accentText} />
        </Inline>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
