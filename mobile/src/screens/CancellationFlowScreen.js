// T57 — CancellationFlowScreen
// Penalty preview + reason selection before cancelling a booking.
// Route params: { bookingId, scheduledDate (ISO string) }
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
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
import { api } from '../services/api';
import * as toast from '../services/toast';
import * as haptics from '../services/haptics';

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
          <Feather name="arrow-left" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cancel Booking</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Warning icon + headline */}
          <View style={styles.warningRow}>
            <View style={styles.warningIconWrap}>
              <Feather name="alert-triangle" size={28} color="#FF5C00" />
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
              <Feather name="info" size={13} color="#60a5fa" />
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
              placeholderTextColor="#3a424c"
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
              ? <ActivityIndicator color="#ffffff" />
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
  container: { flex: 1, backgroundColor: '#07080a' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },

  scroll: { paddingHorizontal: 22, paddingTop: 28, gap: 16 },

  warningRow: { alignItems: 'center' },
  warningIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 12,
  },
  subheadline: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },

  // Penalty card — dominant focal
  penaltyCard: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 18,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
    gap: 6,
  },
  penaltyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  penaltyAmount: {
    fontSize: 46,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -1.5,
    marginTop: 4,
  },
  penaltyDesc: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  penaltyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.20)',
  },
  penaltyTipText: { fontSize: 12, color: '#60a5fa', flex: 1, lineHeight: 17 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  reasonList: { gap: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  reasonRowActive: {
    backgroundColor: 'rgba(255,92,0,0.08)',
    borderColor: 'rgba(255,92,0,0.35)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2a2e33',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: { borderColor: '#FF5C00' },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#FF5C00',
  },
  reasonText: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  reasonTextActive: { color: '#ffffff', fontWeight: '600' },

  otherInput: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#f0ede8',
    minHeight: 80,
    marginTop: 4,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1d1f',
    backgroundColor: '#07080a',
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    shadowColor: 'rgba(239,68,68,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  backLink: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  backLinkText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
});
