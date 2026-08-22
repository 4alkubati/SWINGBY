// LiveLocationSharing.js — WALKTHROUGH M7, the provider's half.
//
// Drop this ONE line into the business Status tab (JobManagementScreen), next
// to <LiveStatusActions />:
//
//     <LiveLocationSharing bookingId={booking.id} bookingStatus={booking.status} />
//
// It owns everything: the permission prompt, the foreground watcher, the push
// loop, the teardown, and — the point of it being a component rather than a
// hook — the VISIBLE NOTICE.
//
// NO SILENT TRACKING
// ------------------
// The provider's position is never sent without this banner being on screen
// saying so, in words, with a Stop button that works immediately. That is the
// whole reason the sharing logic ships as a component: a hook could have been
// wired in with the same single line and would have tracked invisibly. Sharing
// starts only in the en-route window the provider themselves opened by tapping
// "On my way", and the banner states when it will end.
//
// It renders NOTHING outside that window, so it costs the Status tab no space
// on a job that is not in motion.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api } from '../services/api';
import {
  startSharing,
  stopSharing,
  isEnRoute,
  PUSH_INTERVAL_MS,
} from '../services/liveLocation';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import Button from './Button';
import PulseDot from './PulseDot';
import { colors, spacing, radius } from '../theme/tokens';

// How often we re-check the booking's own timeline. The provider usually taps
// "I have arrived" on this very screen, and the server stops the feed on the
// next push anyway — this is the belt to that braces, so the banner does not
// linger after the window shuts.
const WINDOW_POLL_MS = 15000;

export default function LiveLocationSharing({ bookingId, bookingStatus }) {
  const [enRoute, setEnRoute] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [problem, setProblem] = useState(null); // 'permission' | 'network' | 'unavailable'
  const [optedOut, setOptedOut] = useState(false);

  const teardownRef = useRef(null);
  const mounted = useRef(true);

  // ── Is the window open? ────────────────────────────────────────────────────
  const checkWindow = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await api.get(`/bookings/${bookingId}/events`);
      if (!mounted.current) return;
      setEnRoute(isEnRoute(res?.items || [], bookingStatus));
    } catch {
      // Fail CLOSED: if we cannot confirm the provider is en route, we do not
      // start broadcasting their position.
      if (mounted.current) setEnRoute(false);
    }
  }, [bookingId, bookingStatus]);

  useEffect(() => {
    mounted.current = true;
    checkWindow();
    const id = setInterval(checkWindow, WINDOW_POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [checkWindow]);

  // ── Start / stop the watcher ───────────────────────────────────────────────
  const teardown = useCallback(() => {
    const fn = teardownRef.current;
    teardownRef.current = null;
    try {
      fn?.();
    } catch {
      /* already gone */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!bookingId || !enRoute || optedOut) {
      teardown();
      setSharing(false);
      return undefined;
    }

    (async () => {
      const stop = await startSharing(bookingId, ({ sharing: on, error }) => {
        if (!mounted.current) return;
        setSharing(!!on);
        setProblem(error || null);
        if (!on) teardown();
      });
      if (cancelled) {
        stop?.();
        return;
      }
      teardownRef.current = stop;
    })();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [bookingId, enRoute, optedOut, teardown]);

  // Belt and braces: whatever unmounts this screen also drops the stored fix,
  // so closing the app mid-drive does not leave a position visible.
  useEffect(
    () => () => {
      teardown();
    },
    [teardown],
  );

  const handleStop = async () => {
    setOptedOut(true);
    teardown();
    setSharing(false);
    await stopSharing(bookingId);
  };

  if (!enRoute) return null;

  // ── Opted out ──────────────────────────────────────────────────────────────
  if (optedOut) {
    return (
      <Surface elevation="subtle">
        <Inline spacing="sm" align="center">
          <Feather name="eye-off" size={16} color={colors.textSecondary} />
          <Stack spacing={2} style={{ flex: 1 }}>
            <Text variant="smallMedium">Location sharing off</Text>
            <Text variant="caption" color="secondary">
              The client can still see your status updates, just not where you are.
            </Text>
          </Stack>
          <Button
            variant="ghost"
            label="Resume"
            onPress={() => {
              setProblem(null);
              setOptedOut(false);
            }}
          />
        </Inline>
      </Surface>
    );
  }

  // ── Permission refused ─────────────────────────────────────────────────────
  if (problem === 'permission') {
    return (
      <Surface elevation="subtle">
        <Stack spacing="sm">
          <Inline spacing="sm" align="center">
            <Feather name="alert-circle" size={16} color={colors.warning} />
            <Text variant="smallMedium" style={{ flex: 1 }}>
              Location permission is off
            </Text>
          </Inline>
          <Text variant="caption" color="secondary">
            The client can see your status updates but not your position on the
            map. Turn location on for SwingByy to show them where you are.
          </Text>
          <Button
            variant="secondary"
            label="Open settings"
            onPress={() => Linking.openSettings?.()}
          />
        </Stack>
      </Surface>
    );
  }

  // ── Sharing (or trying to) ─────────────────────────────────────────────────
  return (
    <Surface elevation="subtle" style={styles.liveCard}>
      <Stack spacing="sm">
        <Inline spacing="sm" align="center">
          <PulseDot size={8} color={colors.success} />
          <Text variant="smallMedium" style={{ flex: 1 }}>
            {sharing
              ? 'Sharing your live location with the client'
              : 'Starting location sharing…'}
          </Text>
        </Inline>

        <Text variant="caption" color="secondary">
          Only this client, only while you're on the way. It stops by itself the
          moment you tap “I have arrived”, and whenever you close the app —
          SwingByy never tracks you in the background.
        </Text>

        {problem === 'network' && (
          <Inline spacing="xs" align="center">
            <Feather name="wifi-off" size={13} color={colors.textSecondary} />
            <Text variant="caption" color="secondary">
              Poor connection — your last position may be a little behind.
            </Text>
          </Inline>
        )}

        {problem === 'unavailable' && (
          <Text variant="caption" color="secondary">
            Live location isn't available on this device. Your status updates
            still reach the client.
          </Text>
        )}

        <Button variant="ghost" label="Stop sharing" onPress={handleStop} />
      </Stack>
    </Surface>
  );
}

// Exported for tests: the cadence claim in the copy above should not drift from
// the transport.
export const __PUSH_INTERVAL_MS = PUSH_INTERVAL_MS;

const styles = StyleSheet.create({
  liveCard: {
    borderColor: colors.borderAccent,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
  },
});
