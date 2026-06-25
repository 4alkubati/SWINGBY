import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Alert, StyleSheet } from 'react-native';

import { api } from '../services/api';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import Button from './Button';
import { colors, spacing } from '../theme/tokens';

const FLOW = ['en_route', 'arrived', 'started', 'completed'];

const NEXT_LABEL = {
  en_route: 'On my way',
  arrived: 'I have arrived',
  started: 'Start job',
  completed: 'Mark complete',
};

const NEXT_CONFIRM = {
  en_route: 'Tell the client you are on your way?',
  arrived: 'Confirm you have arrived?',
  started: 'Start the job now? The client will be notified.',
  completed: 'Mark the job complete? This may release final payment.',
};

function lastFlowEvent(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (FLOW.includes(events[i].event_type)) return events[i].event_type;
  }
  return null;
}

function nextEventAfter(lastType) {
  if (!lastType) return FLOW[0];
  const idx = FLOW.indexOf(lastType);
  if (idx === -1 || idx === FLOW.length - 1) return null;
  return FLOW[idx + 1];
}

export default function LiveStatusActions({ bookingId, onEventPosted }) {
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}/events`);
      if (!mounted.current) return;
      setEvents(res.items || []);
      setLoadErr(false);
    } catch {
      if (!mounted.current) return;
      setLoadErr(true);
    }
  }, [bookingId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const lastType = lastFlowEvent(events);
  const nextType = nextEventAfter(lastType);

  const postEvent = async (event_type) => {
    setBusy(true);
    try {
      await api.post(`/bookings/${bookingId}/events`, { event_type });
      await refresh();
      onEventPosted?.(event_type);
    } catch (err) {
      Alert.alert('Could not post update', err?.message || 'Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const confirmAndPost = (event_type) => {
    Alert.alert(
      NEXT_LABEL[event_type] || 'Confirm',
      NEXT_CONFIRM[event_type] || 'Confirm this update?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => postEvent(event_type) },
      ],
    );
  };

  if (loadErr && !events.length) {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Stack spacing="sm">
          <Text variant="bodyMedium">Live status</Text>
          <Text variant="small" color="secondary">
            Could not load status.
          </Text>
          <Button
            variant="secondary"
            label="Retry"
            loading={busy}
            onPress={refresh}
          />
        </Stack>
      </Surface>
    );
  }

  if (!nextType) {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Stack spacing="xs">
          <Text variant="bodyMedium">Live status</Text>
          <Text variant="small" color="secondary">
            Job marked complete. The client has been notified.
          </Text>
        </Stack>
      </Surface>
    );
  }

  return (
    <Surface elevation="subtle" rounded="card" padding="base">
      <Stack spacing="sm">
        <Text variant="bodyMedium">Live status</Text>
        <Text variant="small" color="secondary">
          {lastType
            ? `Last: ${lastType.replace('_', ' ')}`
            : 'Next step: tell the client you are on your way.'}
        </Text>
        <View style={styles.row}>
          <Button
            variant="primary"
            label={NEXT_LABEL[nextType]}
            loading={busy}
            onPress={() => confirmAndPost(nextType)}
            style={{ flex: 1 }}
          />
        </View>
        {/* secondary actions (pause/resume/cancel) deferred — keep the primary path obvious */}
      </Stack>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
