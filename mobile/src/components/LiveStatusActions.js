import React from 'react';
import { View, Alert, StyleSheet } from 'react-native';

import Text from './Text';
import Stack from './Stack';
import Button from './Button';
import { spacing } from '../theme/tokens';
import { ACTION_LABEL, ACTION_CONFIRM, currentStage, nextStage } from '../utils/jobStages';

/**
 * The provider's "next step" button.
 *
 * CONTROLLED. It used to GET /bookings/{id}/events into its own state on
 * mount, while the timeline beside it polled the same endpoint into a second
 * copy and the tracker above it read `booking.status` — three views of one
 * booking that could not agree, and on 2026-07-29 didn't. The screen now
 * fetches once and passes `events` to all three.
 *
 * It also renders no heading of its own: it sits inside the screen's single
 * "Live status" card, above the timeline. Two cards both titled "Live status"
 * was the other half of that screen's mess.
 */
export default function LiveStatusActions({ events, onAdvance, busy = false }) {
  const lastType = currentStage(events);
  const nextType = nextStage(events);

  const confirmAndPost = (event_type) => {
    Alert.alert(
      ACTION_LABEL[event_type] || 'Confirm',
      ACTION_CONFIRM[event_type] || 'Confirm this update?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => onAdvance?.(event_type) },
      ],
    );
  };

  if (!nextType) {
    return (
      <Text variant="small" color="secondary">
        Job marked complete. The client has been notified.
      </Text>
    );
  }

  return (
    <Stack spacing="sm">
      <Text variant="small" color="secondary">
        {lastType
          ? `Last: ${lastType.replace('_', ' ')}`
          : 'Next step: tell the client you are on your way.'}
      </Text>
      <View style={styles.row}>
        <Button
          variant="primary"
          label={ACTION_LABEL[nextType]}
          loading={busy}
          disabled={busy}
          onPress={() => confirmAndPost(nextType)}
          style={{ flex: 1 }}
        />
      </View>
      {/* secondary actions (pause/resume/cancel) deferred — keep the primary path obvious */}
    </Stack>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
