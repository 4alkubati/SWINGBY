import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api } from '../services/api';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import { colors, spacing, radius } from '../theme/tokens';

const POLL_MS = 8000;

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

export default function LiveStatusTimeline({ bookingId, pollMs = POLL_MS }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('loading');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}/events`);
      if (!mounted.current) return;
      setEvents(res.items || []);
      setStatus('ready');
    } catch {
      if (!mounted.current) return;
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, [bookingId]);

  useEffect(() => {
    mounted.current = true;
    load();
    const id = setInterval(load, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load, pollMs]);

  if (status === 'loading') {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline justify="center" spacing="sm">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text variant="small" color="secondary">Loading status…</Text>
        </Inline>
      </Surface>
    );
  }

  if (status === 'error') {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Text variant="small" color="secondary">Could not load live status.</Text>
      </Surface>
    );
  }

  if (!events.length) {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Stack spacing="xs">
          <Text variant="bodyMedium">Live status</Text>
          <Text variant="small" color="secondary">
            Updates will appear here when the provider starts the job.
          </Text>
        </Stack>
      </Surface>
    );
  }

  return (
    <Surface elevation="subtle" rounded="card" padding="base">
      <Stack spacing="sm">
        <Text variant="bodyMedium">Live status</Text>
        {events.map((ev, i) => {
          const meta = COPY[ev.event_type] || {
            icon: 'circle',
            // Never the bare enum: an unknown event type still gets read by a
            // human, so spell it like words.
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
              <Stack spacing={2} style={styles.body}>
                <Text variant="smallMedium">{meta.title}</Text>
                <Text variant="caption" color="secondary">
                  {formatTime(ev.created_at)}
                  {ev.note ? ` · ${humaniseNote(ev.note)}` : ''}
                </Text>
              </Stack>
            </View>
          );
        })}
      </Stack>
    </Surface>
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
