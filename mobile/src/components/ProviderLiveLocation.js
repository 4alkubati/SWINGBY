// ProviderLiveLocation.js — WALKTHROUGH M7, the client's half.
//
// "On my way" already reached this screen as a word in the timeline. This is
// the map the audit actually asked for: where the provider is, right now, while
// they are en route — and, just as importantly, an honest statement of HOW OLD
// that position is, because a dot with no timestamp is a promise the app cannot
// keep the moment the provider's phone loses signal.
//
// It renders NOTHING unless the backend says the feed is open. The client is
// never shown a stale marker from a job that finished, and never shown a "live"
// pin for a provider who is standing in their kitchen: GET
// /bookings/{id}/location re-derives the en-route window server-side on every
// poll and returns `sharing: false` with no coordinates the instant it closes.
//
// Maps: mirrors NearbyMapScreen — real react-native-maps when it can draw, the
// app's own MapCanvas surface when it cannot (the walkthrough device has no
// Play Services). No new native module either way.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import {
  fetchProviderLocation,
  lastUpdatedLabel,
  CLIENT_POLL_MS,
} from '../services/liveLocation';
import { MapCanvas, MapDot } from './MapPreviewCard';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import PulseDot from './PulseDot';
import { colors, spacing, radius } from '../theme/tokens';

// react-native-maps — already in package.json (v1.20.1). Same lazy require +
// null fallback as NearbyMapScreen, so a build without Play Services or a Maps
// key degrades to the designed canvas instead of crashing the booking screen.
let MapView, Marker, PROVIDER_GOOGLE;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  MapView = null;
  Marker = null;
  PROVIDER_GOOGLE = null;
}

const MAP_HEIGHT = 190;
// Roughly a 1.5 km box — close enough to read "which street" without the pin
// filling the frame the moment they turn a corner.
const REGION_DELTA = 0.014;

export default function ProviderLiveLocation({ bookingId, providerName }) {
  const [state, setState] = useState(null);
  const mounted = useRef(true);

  const poll = useCallback(async () => {
    if (!bookingId) return;
    const res = await fetchProviderLocation(bookingId);
    if (!mounted.current) return;
    // A null is a failed request, not proof the feed closed — keep the last
    // known state and let the age label tell the truth about how old it is.
    if (res) setState(res);
  }, [bookingId]);

  useEffect(() => {
    mounted.current = true;
    poll();
    const id = setInterval(poll, CLIENT_POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [poll]);

  // Not en route, job started/finished/cancelled, or nothing fetched yet.
  if (!state || !state.sharing) {
    // The one closed state worth showing: the provider IS on the way, the
    // server said so, but no fix has landed. Silence here reads as "the feature
    // is broken"; this reads as what it is.
    if (state?.reason === 'no_fix_yet') {
      return (
        <Surface elevation="subtle">
          <Inline spacing="sm" align="center">
            <Feather name="navigation" size={15} color={colors.accentText} />
            <Text variant="small" color="secondary" style={{ flex: 1 }}>
              {providerName ? `${providerName} is on the way` : 'On the way'} —
              waiting for their location.
            </Text>
          </Inline>
        </Surface>
      );
    }
    return null;
  }

  const loc = state.location;
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
    return null;
  }

  const stale = !!loc.is_stale;
  const label = lastUpdatedLabel(loc.age_seconds);

  return (
    <Surface elevation="subtle" padding={0} style={styles.card}>
      <View style={styles.mapWrap}>
        {MapView ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            pointerEvents="none"
            region={{
              latitude: loc.lat,
              longitude: loc.lng,
              latitudeDelta: REGION_DELTA,
              longitudeDelta: REGION_DELTA,
            }}
            liteMode
          >
            <Marker
              coordinate={{ latitude: loc.lat, longitude: loc.lng }}
              title={providerName || 'Your provider'}
              description={label}
            />
          </MapView>
        ) : (
          // A single point has no extent to project against, so it sits at the
          // centre of the canvas. The dot pulses only while the fix is fresh —
          // animating a stale position would be the app lying about movement it
          // cannot see.
          <MapCanvas style={StyleSheet.absoluteFill}>
            <MapDot x={50} y={50} live={!stale} size={16} />
          </MapCanvas>
        )}

        <View style={styles.badge} pointerEvents="none">
          {stale ? (
            <Feather name="clock" size={9} color={colors.textSecondary} />
          ) : (
            <PulseDot size={7} color={colors.success} />
          )}
          <Text
            style={[styles.badgeText, stale && { color: colors.textSecondary }]}
            maxFontSizeMultiplier={1.2}
          >
            {stale ? 'Last seen' : 'Live'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Stack spacing={2} style={{ flex: 1 }}>
          <Text variant="smallMedium">
            {providerName ? `${providerName} is on the way` : 'Your provider is on the way'}
          </Text>
          <Text variant="caption" color="secondary">
            {label}
            {stale ? ' · their phone may have lost signal' : ''}
          </Text>
        </Stack>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: 0,
  },
  mapWrap: {
    height: MAP_HEIGHT,
    backgroundColor: colors.mapBgMid,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.overlayScrim,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
});
