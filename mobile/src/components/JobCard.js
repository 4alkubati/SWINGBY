import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', color: colors.accentText, bg: colors.accentMuted },
  on_the_way: { label: 'On the way', color: colors.accentText, bg: colors.accentMuted },
  in_progress: { label: 'In Progress', color: colors.warning, bg: 'rgba(246,178,59,0.15)' },
  completed: { label: 'Done', color: colors.success, bg: 'rgba(46,189,133,0.15)' },
  cancelled: { label: 'Cancelled', color: colors.textTertiary, bg: colors.surfaceAlt },
};

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function JobCard({ booking, onPress }) {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
  const clientName = booking.client_name || booking.client_id || 'Client';
  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
      })
    : '—';
  const time = booking.scheduled_time || '';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${clientName}, ${status.label}`}
    >
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(clientName)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {clientName}
      </Text>
      <Text
        style={styles.meta}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {booking.service_type || 'Service'}
      </Text>
      <Text style={styles.date} maxFontSizeMultiplier={1.3}>
        {date}
        {time ? ` · ${time}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.base - 2,
    width: 168,
    gap: 6,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: colors.accentText,
    letterSpacing: -0.2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  date: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});
