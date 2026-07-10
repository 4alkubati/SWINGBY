import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// Segmented progress bar timeline used by the ActiveBooking status card.
// 4 bars @ 5px tall (pill radius). Done/current = accent; rest = border.
// Labels row underneath at 11px: done = textSecondary, current = accentText 600,
// future = textTertiary.

const STAGES = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Done' },
];

const ORDER = ['confirmed', 'on_the_way', 'in_progress', 'completed'];

function toIdx(status) {
  const i = ORDER.indexOf(status);
  return i === -1 ? -1 : i;
}

export default function BookingStatusTimeline({ currentStatus, timestamps }) {
  const isCancelled = currentStatus === 'cancelled';
  const currentIdx = isCancelled ? -1 : toIdx(currentStatus);

  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        {STAGES.map((_, i) => {
          const state =
            isCancelled
              ? 'cancelled'
              : i < currentIdx
              ? 'done'
              : i === currentIdx
              ? 'current'
              : 'future';

          return (
            <View
              key={STAGES[i].key}
              style={[
                styles.bar,
                state === 'done' && { backgroundColor: colors.accent },
                state === 'current' && { backgroundColor: colors.accent },
                state === 'future' && { backgroundColor: colors.border },
                state === 'cancelled' && { backgroundColor: colors.border },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.labelsRow}>
        {STAGES.map((stage, i) => {
          const state =
            isCancelled
              ? 'cancelled'
              : i < currentIdx
              ? 'done'
              : i === currentIdx
              ? 'current'
              : 'future';

          const color =
            state === 'current'
              ? colors.accentText
              : state === 'done'
              ? colors.textSecondary
              : state === 'cancelled'
              ? colors.textTertiary
              : colors.textTertiary;

          const weight = state === 'current' ? '600' : '500';
          const ts = timestamps?.[stage.key];

          return (
            <View key={stage.key} style={styles.labelCol}>
              <Text
                style={[styles.label, { color, fontWeight: weight }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {stage.label}
              </Text>
              {ts && state === 'done' ? (
                <Text
                  style={styles.timestamp}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  {ts}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  barsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 5,
    borderRadius: 999,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 11,
  },
  timestamp: {
    fontSize: 10,
    color: colors.textTertiary,
  },
});
