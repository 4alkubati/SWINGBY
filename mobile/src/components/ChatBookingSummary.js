// ChatBookingSummary — the PRIMARY content of a booking chat thread.
//
// Owner direction (2026-07-21): "the booking/booked should be the MAIN thing
// in chat." Once a quote is accepted the thread's identity is the BOOKING, so
// this card sits above the message list and carries the real booking state —
// confirmed date/time, address, status, service, payment — and taps through
// to the full BookingDetails screen. The demoted quote lives in the small
// floating bubble (QuoteBubble), not here.
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

function paymentLabel(status) {
  switch ((status || '').toLowerCase()) {
    case 'fully_released':    return 'Paid';
    case 'partial_released':  return 'In progress';
    case 'held':              return 'Held in escrow';
    case 'refunded':          return 'Refunded';
    case 'paid_off_platform': return 'Paid (off-platform)';
    default:                  return status ? status.replace(/_/g, ' ') : 'Pending';
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
          <StatusPill status={booking.status || 'confirmed'} />
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
