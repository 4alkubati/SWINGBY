// T57 — CancellationFlowScreen
// Penalty preview + reason selection before cancelling a booking.
// Route params: { bookingId, scheduledDate (ISO string) }
import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import * as toast from '../../services/toast';
import * as haptics from '../../services/haptics';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';

const REASONS = [
  'Schedule conflict',
  'Found another provider',
  'No longer needed',
  'Other',
];

// ─── penalty calculation ──────────────────────────────────────────────────────
function computePenalty(scheduledDateISO, quotedPrice) {
  if (!scheduledDateISO || !quotedPrice) return { pct: 0.25, amount: 0 };
  const hoursUntil = (new Date(scheduledDateISO).getTime() - Date.now()) / 3600000;
  const pct = hoursUntil > 48 ? 0.25 : 0.50;
  return { pct, amount: parseFloat((quotedPrice * pct).toFixed(2)) };
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CancellationFlowScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId, scheduledDate, quotedPrice = 0 } = route.params ?? {};

  const { pct, amount } = useMemo(
    () => computePenalty(scheduledDate, quotedPrice),
    [scheduledDate, quotedPrice]
  );

  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finalReason = reason === 'Other' ? (otherText.trim() || 'Other') : reason;
  const canSubmit = !!reason && (reason !== 'Other' || otherText.trim().length > 0);

  const handleCancel = async () => {
    if (!canSubmit || submitting) return;
    await haptics.warningTap();
    setSubmitting(true);
    try {
      await api.patch(`/bookings/${bookingId}/cancel`, {
        reason: finalReason,
        penalty_amount: amount,
      });
      toast.show({ type: 'info', text1: 'Booking cancelled', text2: `A $${amount.toFixed(2)} fee applies.` });
      navigation.popToTop();
    } catch (err) {
      toast.show({ type: 'error', text1: 'Could not cancel', text2: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cancel Booking</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warning icon + headline */}
          <View style={styles.warningRow}>
            <View style={styles.warningIconWrap}>
              <Feather name="alert-triangle" size={28} color={colors.accent} />
            </View>
          </View>
          <Text style={styles.headline}>Cancel this booking?</Text>
          <Text style={styles.subheadline}>
            This action cannot be undone.
          </Text>

          {/* Penalty card — dominant focal point */}
          <View style={styles.penaltyCard}>
            <Text style={styles.penaltyLabel}>Cancellation Fee</Text>
            <Text style={styles.penaltyAmount}>${amount.toFixed(2)}</Text>
            <Text style={styles.penaltyDesc}>
              {(pct * 100).toFixed(0)}% of your ${parseFloat(quotedPrice).toFixed(2)} booking will be
              charged as a cancellation fee
              {pct >= 0.5 ? ' (within 48h of scheduled date)' : ''}.
            </Text>
            <View style={styles.penaltyTip}>
              <Feather name="info" size={13} color={colors.accent} />
              <Text style={styles.penaltyTipText}>
                {pct >= 0.5
                  ? 'Within 48h of your booking — 50% fee applies.'
                  : 'More than 48h away — 25% fee applies.'}
              </Text>
            </View>
          </View>

          {/* Reason */}
          <Text style={styles.sectionLabel}>Reason for cancellation *</Text>
          <View style={styles.reasonList}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonRow, reason === r && styles.reasonRowActive]}
                onPress={() => setReason(r)}
                activeOpacity={0.75}
              >
                <View style={[styles.radio, reason === r && styles.radioActive]}>
                  {reason === r && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Other text input */}
          {reason === 'Other' && (
            <TextInput
              style={styles.otherInput}
              placeholder="Please describe…"
              placeholderTextColor={colors.textSecondary}
              value={otherText}
              onChangeText={setOtherText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Confirm button — sticky bottom */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, (!canSubmit || submitting) && styles.confirmBtnDisabled]}
            onPress={handleCancel}
            disabled={!canSubmit || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={colors.textPrimary} />
              : (
                <Text style={styles.confirmBtnText}>
                  Cancel booking and pay ${amount.toFixed(2)} fee
                </Text>
              )
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <Text style={styles.backLinkText}>Keep my booking</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 22, paddingTop: 28, gap: 16 },

  warningRow: { alignItems: 'center' },
  warningIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.accent + '1A', // ~10% opacity
    borderWidth: 1,
    borderColor: colors.accent + '40', // ~25% opacity
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subheadline: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Penalty card — dominant focal
  penaltyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger + '40', // ~25% opacity
    borderRadius: 18,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
    gap: 6,
  },
  penaltyLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  penaltyAmount: {
    fontSize: 46,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -1.5,
    marginTop: spacing.xs,
  },
  penaltyDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  penaltyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.accent + '33', // ~20% opacity
  },
  penaltyTipText: { fontSize: 12, color: colors.accent, flex: 1, lineHeight: 17 },

  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  reasonList: { gap: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  reasonRowActive: {
    backgroundColor: colors.accent + '14', // ~8% opacity
    borderColor: colors.accent + '59', // ~35% opacity
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: { borderColor: colors.accent },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.accent,
  },
  reasonText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  reasonTextActive: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },

  otherInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    marginTop: 4,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },
  backLink: { alignItems: 'center', paddingVertical: spacing.sm + 2, minHeight: 44, justifyContent: 'center' },
  backLinkText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
});
