// AutoBidPreviewSheet — the mandatory dry run before auto-bidding goes live.
//
// Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §4 ("Dry-run
// sheet"). Same sheet chrome as the pay sheet: radius 24 24 0 0, grab handle,
// dim rgba(4,5,7,0.68).
//
// This is a gate, not a preview. Auto-bidding cannot be switched on for the
// first time without passing through here — enforced again in the API and by a
// CHECK constraint on business_auto_bid_rules, so a client-side bypass buys
// nothing.
//
// Props:
//   visible    boolean
//   loading    boolean — dry run in flight
//   error      string | null
//   result     { considered, matched, would_bid_cents, rows[] } from
//              POST /businesses/me/auto-bid/dry-run
//   activating boolean — "Turn auto-bidding on" in flight
//   onRetry    () => void
//   onClose    () => void
//   onActivate () => void
import React from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import i18n from '../i18n';
import { colors, radius } from '../theme/tokens';

const SCRIM = 'rgba(4,5,7,0.68)';
const OK_TINT = 'rgba(46,189,133,0.14)';
const SKIP_TINT = 'rgba(255,92,92,0.14)';

function money(cents) {
  const value = Number(cents || 0) / 100;
  return `$${value.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
}

function StatCard({ value, label, valueColor }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MatchRow({ row, isLast }) {
  const matched = !!row.matched;
  const where = [row.title, row.area, row.distance_km != null ? `${row.distance_km} km` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.matchRow, !isLast && styles.matchRowDivider]}>
      <View style={[styles.statusTile, { backgroundColor: matched ? OK_TINT : SKIP_TINT }]}>
        <Feather
          name={matched ? 'check' : 'x'}
          size={14}
          color={matched ? colors.success : colors.danger}
        />
      </View>

      <Text
        style={[styles.matchText, !matched && { color: colors.textTertiary }]}
        numberOfLines={1}
      >
        {matched ? where : `${row.title} · ${row.reason || 'Skipped'}`}
      </Text>

      {matched ? (
        <Text style={styles.matchAmount}>{money(row.bid_cents)}</Text>
      ) : (
        <Text style={styles.matchSkipped}>Skipped</Text>
      )}
    </View>
  );
}

export default function AutoBidPreviewSheet({
  visible,
  loading = false,
  error = null,
  result = null,
  activating = false,
  onRetry,
  onClose,
  onActivate,
}) {
  const insets = useSafeAreaInsets();
  const rows = result?.rows || [];
  const canActivate = !!result && !loading && !activating;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={activating ? undefined : onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={activating ? undefined : onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      />

      <View style={[styles.panel, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.handle} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Last week, these rules</Text>
          <Text style={styles.subtitle}>Nothing was sent — this is a dry run.</Text>
        </View>

        {loading && (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.stateBody}>Replaying the last 7 days…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.stateBlock}>
            <View style={styles.stateCircle}>
              <Feather name="alert-circle" size={24} color={colors.textSecondary} />
            </View>
            <Text style={styles.stateTitle}>Couldn't run the preview</Text>
            <Text style={styles.stateBody}>{error}</Text>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>{i18n.t('common.retry')}</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && result && (
          <>
            <View style={styles.statRow}>
              <StatCard
                value={String(result.matched ?? 0)}
                label={`of ${result.considered ?? 0} jobs matched`}
              />
              <StatCard
                value={money(result.would_bid_cents)}
                label="would have been bid"
                valueColor={colors.success}
              />
            </View>

            {rows.length === 0 ? (
              <View style={styles.stateBlock}>
                <View style={styles.stateCircle}>
                  <Feather name="inbox" size={24} color={colors.textSecondary} />
                </View>
                <Text style={styles.stateTitle}>Nothing to replay</Text>
                <Text style={styles.stateBody}>
                  No jobs were posted near you in the last 7 days. You can still turn
                  auto-bidding on — it will bid on the next one that fits.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.matchList} showsVerticalScrollIndicator={false}>
                {rows.map((row, i) => (
                  <MatchRow
                    key={row.post_id || i}
                    row={row}
                    isLast={i === rows.length - 1}
                  />
                ))}
              </ScrollView>
            )}

            <View style={styles.warning}>
              <Feather
                name="info"
                size={13}
                color={colors.textSecondary}
                style={{ marginTop: 2 }}
              />
              <Text style={styles.warningText}>
                Auto-bids are real quotes. Clients see them exactly like ones you write —
                you can withdraw within 5 minutes.
              </Text>
            </View>
          </>
        )}

        <Pressable
          onPress={onActivate}
          disabled={!canActivate}
          style={({ pressed }) => [
            styles.cta,
            !canActivate && { opacity: 0.4 },
            pressed && canActivate && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Turn auto-bidding on"
          accessibilityState={{ disabled: !canActivate, busy: activating }}
        >
          {activating ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.ctaLabel}>Turn auto-bidding on</Text>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM },
  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
    maxHeight: '86%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },

  titleBlock: { gap: 4 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: { fontSize: 13, color: colors.textSecondary },

  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  statValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    letterSpacing: -0.7,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { fontSize: 12, color: colors.textSecondary },

  matchList: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    maxHeight: 220,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  matchRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statusTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchText: { flex: 1, fontSize: 12.5, color: colors.textSecondary },
  matchAmount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13.5,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  matchSkipped: { fontSize: 12.5, fontWeight: '600', color: colors.textTertiary },

  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningText: { flex: 1, fontSize: 11.5, lineHeight: 18, color: colors.textSecondary },

  stateBlock: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 8 },
  stateCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary },
  stateBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  secondaryBtn: {
    marginTop: 8,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  cta: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary },
});
