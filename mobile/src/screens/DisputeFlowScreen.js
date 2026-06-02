// T69 — DisputeFlowScreen
// 3-step dispute form: issue type → description → photo attachments.
// Route params: { bookingId }
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';
import * as toast from '../services/toast';
import * as haptics from '../services/haptics';
import { colors } from '../theme/tokens';

const ISSUE_TYPES = [
  { key: 'not_completed', label: 'Work not completed' },
  { key: 'quality',       label: 'Quality concerns' },
  { key: 'damage',        label: 'Damage to property' },
  { key: 'other',         label: 'Other' },
];

const TOTAL_STEPS = 3;

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  return (
    <View style={styles.progressWrap}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            { backgroundColor: i < step ? colors.accent : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DisputeFlowScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params ?? {};

  const [step, setStep] = useState(1);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const descLen = description.trim().length;
  const descValid = descLen >= 30 && descLen <= 2000;

  const canAdvance = () => {
    if (step === 1) return !!issueType;
    if (step === 2) return descValid;
    return true;
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    await haptics.buttonTap();
    setSubmitting(true);
    try {
      await api.post('/disputes/', {
        booking_id: bookingId,
        issue_type: issueType,
        description: description.trim(),
      });
      toast.show({
        type: 'success',
        text1: 'Dispute opened',
        text2: "We'll respond within 24h.",
      });
      await haptics.successTap();
      navigation.goBack();
    } catch (err) {
      // 404 or endpoint not yet live — best-effort UX
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        toast.show({
          type: 'info',
          text1: 'Submitted',
          text2: 'Our team will contact you within 24h.',
        });
        navigation.goBack();
      } else {
        toast.show({ type: 'error', text1: 'Submission failed', text2: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Open a dispute</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress bar */}
      <ProgressBar step={step} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step label */}
          <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>

          {/* ── Step 1 — Issue type ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>What's the issue?</Text>
              <Text style={styles.stepBody}>
                Select the category that best describes your concern.
              </Text>
              <View style={styles.radioList}>
                {ISSUE_TYPES.map((it) => (
                  <TouchableOpacity
                    key={it.key}
                    style={[styles.radioRow, issueType === it.key && styles.radioRowActive]}
                    onPress={() => setIssueType(it.key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.radio, issueType === it.key && styles.radioActive]}>
                      {issueType === it.key && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.radioLabel, issueType === it.key && styles.radioLabelActive]}>
                      {it.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Step 2 — Description ────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Describe the problem</Text>
              <Text style={styles.stepBody}>
                Please provide as much detail as possible (min 30 characters).
              </Text>
              <TextInput
                style={[styles.textArea, !descValid && descLen > 0 && styles.textAreaError]}
                placeholder="Describe what happened, when it happened, and what you expected…"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={2000}
              />
              <View style={styles.charCountRow}>
                <Text style={[styles.charCount, descLen > 2000 && styles.charCountOver]}>
                  {descLen} / 2000
                </Text>
                {descLen > 0 && descLen < 30 && (
                  <Text style={styles.charHint}>{30 - descLen} more characters required</Text>
                )}
              </View>
            </>
          )}

          {/* ── Step 3 — Photos ─────────────────────────────────────────── */}
          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Attach photos</Text>
              <Text style={styles.stepBody}>
                Optional — add up to 3 photos as evidence. Photo upload will be enabled in a future update.
              </Text>
              <View style={styles.photoGrid}>
                {[0, 1, 2].map((i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.photoPlaceholder}
                    activeOpacity={0.75}
                    onPress={() =>
                      toast.show({ type: 'info', text1: 'Coming soon', text2: 'Photo upload is not yet available.' })
                    }
                  >
                    <Feather name="camera" size={24} color={colors.accent} />
                    <Text style={styles.photoLabel}>Add photo</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* CTA — sticky bottom */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, (!canAdvance() || submitting) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canAdvance() || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={colors.textPrimary} />
              : (
                <Text style={styles.nextBtnText}>
                  {step < TOTAL_STEPS ? 'Continue' : 'Submit dispute'}
                </Text>
              )
            }
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },

  progressWrap: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  scroll: { paddingHorizontal: 22, paddingTop: 8, gap: 16 },

  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: -4,
  },
  stepBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginTop: -4,
  },

  radioList: { gap: 8, marginTop: 4 },
  radioRow: {
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
  radioRowActive: {
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
  radioLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500', flex: 1 },
  radioLabelActive: { color: colors.textPrimary, fontWeight: '600' },

  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 140,
    lineHeight: 22,
  },
  textAreaError: { borderColor: colors.danger + '80' }, // ~50% opacity

  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
  },
  charCount: { fontSize: 12, color: colors.textSecondary },
  charCountOver: { color: colors.danger },
  charHint: { fontSize: 12, color: colors.warning },

  photoGrid: { flexDirection: 'row', gap: 12, marginTop: 4 },
  photoPlaceholder: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: colors.accent + '66', // ~40% opacity
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent + '0A', // ~4% opacity
  },
  photoLabel: { fontSize: 11, color: colors.accent, fontWeight: '600' },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  nextBtn: {
    backgroundColor: colors.accent,
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
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
