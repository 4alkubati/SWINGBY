// GoogleReviewsConnect.js — the owner-facing "bring your Google reviews
// across" card (walkthrough M3). Used in the business signup flow
// (BusinessSetupScreen) and on the owner's own profile (BusinessProfileScreen).
//
// BUILT DARK — THE COMING-SOON STATE IS THE DEFAULT ONE
// ----------------------------------------------------
// Google gates the Business Profile API behind a manual approval SwingBy has
// not been granted, so the backend ships with GOOGLE_REVIEWS_ENABLED off and
// every write path answers 503. This component branches on ONE thing —
// `status.enabled` from GET /google-reviews/status — and when it is false it
// renders a calm, iconed "coming soon" card with NO pressable control. There
// is deliberately no button that could 503, and no half-rendered state: until
// the flag flips, this is a sentence, not a feature.
//
// States, in the order an owner meets them:
//   loading      → skeleton
//   coming soon  → flag off. Text only.
//   disconnected → "Connect Google" (secondary — the screen's purple CTA
//                  belongs to its own primary action, POLISH-TIPS purple
//                  scarcity)
//   picking      → connected, choose which of your locations
//   connected    → count + average, re-import, disconnect
//
// Design: Jet x Pulse (design/DESIGN-SYSTEM.md). Feather icons only, zero
// emoji, cards are Surface, buttons never pills.

import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, radius } from '../theme/tokens';
import Text from './Text';
import Button from './Button';
import Surface from './Surface';
import Stack from './Stack';
import Inline from './Inline';
import { SkeletonBox } from './Skeleton';
import * as googleReviews from '../services/googleReviews';
import { show as showToast } from '../services/toast';

function confirm(title, message, onConfirm) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: onConfirm },
  ]);
}

// ─── Location row ─────────────────────────────────────────────────────────────
function LocationRow({ location, selected, busy, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Import reviews from ${location.title}`}
      style={({ pressed }) => [
        styles.locationRow,
        selected && styles.locationRowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.locationText}>
        <Text variant="smallMedium" numberOfLines={1}>{location.title}</Text>
        {location.address ? (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {location.address}
          </Text>
        ) : null}
      </View>
      <Feather
        name={selected ? 'check-circle' : 'download'}
        size={16}
        color={selected ? colors.success : colors.textSecondary}
      />
    </Pressable>
  );
}

/**
 * @param {object}   props
 * @param {Function} props.onImported  called after a successful import, with
 *                                     the import result — lets the host screen
 *                                     refresh its review list.
 * @param {boolean}  props.compact     drop the explanatory caption (profile
 *                                     view, where the section header carries it)
 */
export default function GoogleReviewsConnect({ onImported, compact = false, style }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await googleReviews.getStatus();
      setStatus(next);
      return next;
    } catch {
      // A business that does not exist yet (404) or a transient failure both
      // land here. Treat it as "nothing to offer" rather than showing an error
      // block in the middle of a signup flow.
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleConnect() {
    setError('');
    setBusy(true);
    try {
      const result = await googleReviews.connectGoogleBusiness();
      setLocations(result?.locations || []);
      await refresh();
      if (!result?.locations?.length) {
        setError(
          'That Google account does not manage any business locations. '
          + 'Try connecting the account that owns your Business Profile.',
        );
      }
    } catch (err) {
      if (err?.code !== 'cancelled') {
        setError(err?.message || 'Could not connect to Google. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePickLocations() {
    setError('');
    setBusy(true);
    try {
      const result = await googleReviews.listLocations();
      setLocations(result?.locations || []);
    } catch (err) {
      setError(err?.message || 'Could not load your Google locations.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(location) {
    setError('');
    setBusy(true);
    try {
      const result = await googleReviews.importReviews(location.name);
      await refresh();
      setLocations([]);
      const added = result?.imported ?? 0;
      showToast({
        type: 'success',
        text1: added > 0 ? `${added} Google reviews imported` : 'Your reviews are up to date',
        text2: added > 0
          ? 'They show on your profile marked as verified Google reviews.'
          : 'Nothing new since your last import.',
      });
      onImported?.(result);
    } catch (err) {
      setError(err?.message || 'Could not import those reviews. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    confirm(
      'Disconnect Google?',
      'Your imported Google reviews will be removed from your SwingBy profile. '
      + 'Reviews left on SwingBy are not affected.',
      async () => {
        setBusy(true);
        try {
          await googleReviews.disconnect();
          setLocations([]);
          await refresh();
          onImported?.({ imported: 0, disconnected: true });
        } catch (err) {
          setError(err?.message || 'Could not disconnect. Try again.');
        } finally {
          setBusy(false);
        }
      },
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Surface style={[styles.card, style]}>
        <Stack spacing="sm">
          <SkeletonBox width={150} height={16} />
          <SkeletonBox width="90%" height={12} />
          <SkeletonBox width="100%" height={44} borderRadius={radius.button} />
        </Stack>
      </Surface>
    );
  }

  // Status unavailable (no business yet, or the call failed) — render nothing
  // rather than an error card the owner can do nothing about.
  if (!status) return null;

  // ── Coming soon (the shipped state) ────────────────────────────────────────
  if (!status.enabled) {
    return (
      <Surface style={[styles.card, style]}>
        <Inline spacing="md" align="flex-start">
          <View style={styles.iconWrap}>
            <Feather name="clock" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.cardBody}>
            <Text variant="smallMedium">Bring your Google reviews across</Text>
            <Text variant="caption" color="secondary" style={styles.caption}>
              {status.message
                || 'Coming soon — we are waiting on Google to approve SwingBy’s access.'}
            </Text>
          </View>
        </Inline>
      </Surface>
    );
  }

  const connected = !!status.connected;
  const importedCount = status.imported_count || 0;

  return (
    <Surface style={[styles.card, style]}>
      <Inline spacing="md" align="flex-start">
        <View style={styles.iconWrap}>
          <Feather
            name={connected ? 'check-circle' : 'star'}
            size={16}
            color={connected ? colors.success : colors.textSecondary}
          />
        </View>
        <View style={styles.cardBody}>
          <Text variant="smallMedium">
            {connected ? 'Google Business Profile connected' : 'Bring your Google reviews across'}
          </Text>
          {!compact || connected ? (
            <Text variant="caption" color="secondary" style={styles.caption}>
              {connected
                ? [
                  status.google_account_email,
                  importedCount > 0
                    ? `${importedCount} review${importedCount === 1 ? '' : 's'} imported`
                    : 'No reviews imported yet',
                ].filter(Boolean).join(' · ')
                : 'Connect the Google account that owns your Business Profile and we’ll '
                  + 'import your real reviews, marked as verified. Nothing is copied from '
                  + 'anywhere else, and every review comes across — not just the good ones.'}
            </Text>
          ) : null}
        </View>
      </Inline>

      {locations.length > 0 ? (
        <View style={styles.locationList}>
          <Text variant="caption" color="secondary" style={styles.locationHint}>
            Choose which location to import from.
          </Text>
          <Stack spacing="xs">
            {locations.map((loc) => (
              <LocationRow
                key={loc.name}
                location={loc}
                busy={busy}
                selected={status.selected_location === loc.name}
                onPress={() => handleImport(loc)}
              />
            ))}
          </Stack>
        </View>
      ) : null}

      {!!error && <Text variant="caption" color="danger" style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {connected ? (
          <Inline spacing="sm">
            <Button
              variant="secondary"
              label={busy ? 'Working…' : 'Update reviews'}
              onPress={handlePickLocations}
              disabled={busy}
              loading={busy}
              style={styles.flexBtn}
            />
            <Button
              variant="ghost"
              label="Disconnect"
              onPress={handleDisconnect}
              disabled={busy}
            />
          </Inline>
        ) : (
          <Button
            variant="secondary"
            label={busy ? 'Connecting…' : 'Connect Google'}
            onPress={handleConnect}
            disabled={busy}
            loading={busy}
            icon={<Feather name="link" size={16} color={colors.textSecondary} />}
          />
        )}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.base },
  cardBody: { flex: 1, gap: 2 },
  caption: { lineHeight: 17 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationList: { marginTop: spacing.base, gap: spacing.sm },
  locationHint: { marginBottom: spacing.xs },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  locationRowSelected: { borderColor: colors.success },
  locationText: { flex: 1, gap: 2 },
  rowPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },

  error: { marginTop: spacing.md, lineHeight: 16 },
  actions: { marginTop: spacing.base },
  flexBtn: { flex: 1 },
});
