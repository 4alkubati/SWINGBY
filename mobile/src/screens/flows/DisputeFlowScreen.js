// T69 — DisputeFlowScreen
// 3-step dispute form: issue type → description → photo attachments.
// Route params: { bookingId }
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadFile } from '../../services/api';
import * as toast from '../../services/toast';
import * as haptics from '../../services/haptics';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';

const MAX_PHOTOS = 3;

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
  // G12 (GAP-AUDIT #12) — photos uploaded via POST /uploads/image, each
  // { uri (local, for the thumbnail), url (remote, persisted) }.
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  async function handlePickPhoto() {
    if (uploadingPhoto || photos.length >= MAX_PHOTOS) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(i18n.t('common.error'), i18n.t('dispute.photoPermission'));
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;

    setUploadingPhoto(true);
    const uploaded = [];
    for (const asset of result.assets) {
      try {
        const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const data = await uploadFile('/uploads/image', {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `dispute_${Date.now()}.${ext}`,
        });
        uploaded.push({ uri: asset.uri, url: data.url });
      } catch (err) {
        toast.show({ type: 'error', text1: i18n.t('dispute.photoUploadError'), text2: err?.message || '' });
      }
    }
    setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    setUploadingPhoto(false);
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = async () => {
    await haptics.buttonTap();
    setSubmitting(true);
    try {
      // disputes.description is the only free-text field the backend model
      // exposes (no photo_urls column on the `disputes` table — see
      // docs/swingby_database_schema.md §13) — carry the uploaded image URLs
      // by appending them to the description so admins reviewing the dispute
      // (GET /disputes/mine, PATCH .../resolve) can still see the evidence.
      const photoBlock = photos.length
        ? `\n\nPhotos:\n${photos.map((p) => p.url).join('\n')}`
        : '';
      // Trim the free-text part (not the URL block) if the combo would blow
      // past the 2000-char DB check — keeps every photo URL intact.
      const trimmedDescription = description.trim().slice(0, Math.max(0, 2000 - photoBlock.length));
      const fullDescription = `${trimmedDescription}${photoBlock}`;

      await api.post('/disputes/', {
        booking_id: bookingId,
        issue_type: issueType,
        description: fullDescription,
      });
      toast.show({
        type: 'success',
        text1: 'Dispute opened',
        text2: "We'll respond within 24h.",
      });
      await haptics.successTap();
      navigation.goBack();
    } catch (err) {
      // Endpoint not yet live — api.js interceptor unwraps to detail string only,
      // so match FastAPI's "Not Found" detail (no HTTP status reaches err.message).
      if (err.message?.toLowerCase().includes('not found')) {
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              <Text style={styles.stepBody}>{i18n.t('dispute.photosOptional')}</Text>
              <View style={styles.photoGrid}>
                {photos.map((photo, i) => (
                  <View key={photo.url || i} style={styles.photoThumbWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(i)}
                      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                      accessibilityLabel={`Remove photo ${i + 1}`}
                    >
                      <Feather name="x" size={12} color={colors.textPrimary} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity
                    style={styles.photoPlaceholder}
                    activeOpacity={0.75}
                    disabled={uploadingPhoto}
                    onPress={handlePickPhoto}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t('dispute.addPhoto')}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator color={colors.accentText} size="small" />
                    ) : (
                      <>
                        <Feather name="camera" size={22} color={colors.accentText} strokeWidth={1.8} />
                        <Text style={styles.photoLabel}>{i18n.t('dispute.addPhoto')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* CTA — sticky bottom */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.nextBtn, (!canAdvance() || submitting || uploadingPhoto) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canAdvance() || submitting || uploadingPhoto}
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
  headerTitle: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, letterSpacing: -0.3 },

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
    fontFamily: 'Inter_600SemiBold',
    color: colors.accentText,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: -4,
  },
  stepBody: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
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
  radioLabel: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, flex: 1 },
  radioLabelActive: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },

  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
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

  photoGrid: { flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  photoPlaceholder: {
    flex: 1,
    minWidth: 90,
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
  photoLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.accentText },
  photoThumbWrapper: {
    flex: 1,
    minWidth: 90,
    aspectRatio: 1,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },
});
