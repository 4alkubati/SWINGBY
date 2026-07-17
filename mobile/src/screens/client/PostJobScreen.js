import {
  View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Stack from '../../components/Stack';
import Surface from '../../components/Surface';
import Chip from '../../components/Chip';
import Inline from '../../components/Inline';

import { api, uploadFile } from '../../services/api';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';
import { CATEGORY_LABELS as CATEGORIES } from '../../constants/categories';

// UBER-6 — off-taxonomy jobs (e.g. massage) file under "General" instead of
// getting shoehorned into a trades category. This is deliberately NOT added
// to constants/categories.js — that file is the canonical 8-category list
// shared with CategoryScroll and BusinessSetupScreen (browse filters + the
// business-side category a business can register under). "General" is a
// client-post-only escape hatch, so it lives here, local to the picker.
const OTHER_CATEGORY = 'General';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

const MAX_PHOTOS = 5;

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const STEPS = ['Category', 'Details', 'Budget', 'Confirm'];
const TOTAL_STEPS = STEPS.length;

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function StepLabels({ step }) {
  return (
    <Inline justify="space-between" style={styles.stepLabels}>
      {STEPS.map((label, i) => (
        <Text
          key={label}
          variant="label"
          color={i <= step ? 'accent' : 'secondary'}
          style={i <= step ? styles.stepLabelActive : undefined}
        >
          {label}
        </Text>
      ))}
    </Inline>
  );
}

// ─── Animated step panel ──────────────────────────────────────────────────────
function StepPanel({ children, direction }) {
  const translateX = useSharedValue(direction * 300);
  const opacity = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  useState(() => {
    translateX.value = withSpring(0, { stiffness: 260, damping: 26 });
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  });

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Photo picker strip ───────────────────────────────────────────────────────
function PhotoPicker({ photos, setPhotos, uploading, setUploading }) {
  async function handlePickPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photos permission required',
        'Allow SwingBy to access your photos so you can attach images to your job post.',
        [{ text: 'OK' }],
      );
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    const uploaded = [];

    for (const asset of result.assets) {
      try {
        const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
        const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        const data = await uploadFile('/uploads/image', {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `photo_${Date.now()}.${ext}`,
        });
        uploaded.push({ uri: asset.uri, url: data.url, path: data.path });
      } catch {
        // skip photos that fail — toast is shown by uploadFile
      }
    }

    setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    setUploading(false);
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Stack spacing="sm">
      <Text variant="label" color="secondary" style={styles.photoSectionLabel}>
        Photos <Text variant="label" color="secondary" style={styles.optional}>(optional)</Text>
      </Text>

      {/* Thumbnails */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbScroll}
          contentContainerStyle={styles.thumbScrollContent}
        >
          {photos.map((photo, i) => (
            <View key={photo.url || i} style={styles.thumbWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              <TouchableOpacity
                style={styles.thumbRemove}
                onPress={() => removePhoto(i)}
                hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                accessibilityLabel={`Remove photo ${i + 1}`}
              >
                <View style={styles.thumbRemoveInner}>
                  <Feather name="x" size={11} color={colors.textPrimary} strokeWidth={2} />
                </View>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add button */}
      {photos.length < MAX_PHOTOS && (
        <TouchableOpacity
          style={styles.photoBox}
          onPress={handlePickPhotos}
          disabled={uploading}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Upload photos"
        >
          {uploading ? (
            <Stack spacing="sm" style={styles.photoBoxContent}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text variant="caption" color="secondary">Uploading…</Text>
            </Stack>
          ) : (
            <Stack spacing="xs" style={styles.photoBoxContent}>
              <Feather name="camera" size={22} color={colors.accentText} strokeWidth={1.8} />
              <Text variant="label" color="accent">
                {photos.length > 0 ? `Add more (${photos.length}/${MAX_PHOTOS})` : 'Upload photos'}
              </Text>
              <Text variant="caption" color="secondary" style={styles.photoHint}>
                Businesses see this before quoting
              </Text>
            </Stack>
          )}
        </TouchableOpacity>
      )}
    </Stack>
  );
}

// ─── Step 0: Category ────────────────────────────────────────────────────────
function StepCategory({ category, setCategory }) {
  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">What type of job?</Text>
          <Text variant="body" color="secondary">
            Pick the category that best describes your task.
          </Text>
        </Stack>
        <Inline wrap spacing="sm">
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(cat === category ? '' : cat)}
            />
          ))}
          {/* UBER-6 — explicit escape hatch for off-taxonomy jobs. Submits
              category "General" so they stay visible/findable to all
              businesses instead of getting shoehorned into a trade. */}
          <Chip
            key={OTHER_CATEGORY}
            label={i18n.t('postJob.categoryOther')}
            selected={category === OTHER_CATEGORY}
            onPress={() => setCategory(category === OTHER_CATEGORY ? '' : OTHER_CATEGORY)}
          />
        </Inline>
      </Stack>
    </StepPanel>
  );
}

// ─── Step 1: Details ─────────────────────────────────────────────────────────
function StepDetails({
  description, setDescription, address, setAddress, descError,
  setAddressLat, setAddressLng,
  photos, setPhotos, photoUploading, setPhotoUploading,
}) {
  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Describe the job</Text>
          <Text variant="body" color="secondary">
            The more detail you add, the better quotes you'll receive.
          </Text>
        </Stack>

        <Stack spacing="base">
          <TextField
            label="What do you need? *"
            value={description}
            onChangeText={setDescription}
            multiline
            error={descError}
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="e.g. Deep clean of 2-bedroom apartment, fix leaking pipe, move furniture…"
          />

          {/* Address autocomplete */}
          {GOOGLE_PLACES_KEY && Platform.OS !== 'web' ? (
            <View style={styles.placesWrapper}>
              <Text variant="caption" color="secondary" style={styles.placesLabel}>
                Address (where's the job?)
              </Text>
              <GooglePlacesAutocomplete
                placeholder="123 Main St SW, Calgary"
                onPress={(data, details = null) => {
                  setAddress(data.description);
                  const loc = details?.geometry?.location;
                  if (loc) {
                    setAddressLat(loc.lat);
                    setAddressLng(loc.lng);
                  }
                }}
                query={{ key: GOOGLE_PLACES_KEY, language: 'en', components: 'country:ca' }}
                styles={{
                  textInput: {
                    fontFamily: 'Inter_400Regular',
                    fontSize: 16,
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.input,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.md,
                    height: 52,
                  },
                  listView: { borderRadius: radius.card, marginTop: 4 },
                  row: { backgroundColor: colors.surface },
                  description: { color: colors.textPrimary, fontFamily: 'Inter_400Regular' },
                  separator: { backgroundColor: colors.border },
                }}
                textInputProps={{
                  value: address,
                  onChangeText: setAddress,
                  autoCapitalize: 'words',
                }}
                enablePoweredByContainer={false}
                fetchDetails={true}
                minLength={3}
                keepResultsAfterBlur
              />
            </View>
          ) : (
            <TextField
              label="Address (where's the job?)"
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St SW, Calgary"
              autoCapitalize="words"
            />
          )}

          {/* Photo upload */}
          <PhotoPicker
            photos={photos}
            setPhotos={setPhotos}
            uploading={photoUploading}
            setUploading={setPhotoUploading}
          />
        </Stack>
      </Stack>
    </StepPanel>
  );
}

// ─── Step 2: Budget ──────────────────────────────────────────────────────────
function StepBudget({ budget, setBudget, date, setDate, time, setTime }) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTime, setPickerTime] = useState(new Date());

  function onTimeChange(_, selected) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) setPickerTime(selected);
  }

  function confirmTime() {
    setTime(formatTime(pickerTime));
    setShowTimePicker(false);
  }

  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Budget &amp; timing</Text>
          <Text variant="body" color="secondary">
            Optional — helps businesses tailor their quote.
          </Text>
        </Stack>
        <Stack spacing="base">
          <TextField
            label="Budget *"
            value={budget}
            onChangeText={setBudget}
            keyboardType="numeric"
            placeholder="e.g. 150"
          />
          <Inline spacing="sm" align="flex-start">
            <TextField
              label="Preferred date"
              value={date}
              onChangeText={setDate}
              placeholder="Jul 5"
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[styles.timeTrigger, { flex: 1 }]}
              accessibilityLabel="Select preferred time"
              accessibilityRole="button"
            >
              <Text variant="caption" color="secondary" style={styles.timeLabel}>
                Preferred time
              </Text>
              <Text variant="body" color={time ? 'primary' : 'secondary'}>
                {time || '10:00 AM'}
              </Text>
            </TouchableOpacity>
          </Inline>
        </Stack>
      </Stack>

      {Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerToolbar}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text variant="body" color="secondary">Cancel</Text>
                </TouchableOpacity>
                <Text variant="label">Preferred time</Text>
                <TouchableOpacity onPress={confirmTime}>
                  <Text variant="body" color="accent" style={{ fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerTime}
                mode="time"
                display="spinner"
                onChange={onTimeChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showTimePicker && (
          <DateTimePicker
            value={pickerTime}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )
      )}
    </StepPanel>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────
function StepConfirm({ category, description, address, budget, date, time, photos, onSubmit, submitting }) {
  const rows = [
    { label: 'Category', value: category || 'General' },
    { label: 'Description', value: description || '—' },
    { label: 'Address', value: address || '—' },
    { label: 'Budget', value: budget ? `$${budget}` : '—' },
    { label: 'Date', value: date || '—' },
    { label: 'Time', value: time || '—' },
  ];

  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">Ready to post?</Text>
          <Text variant="body" color="secondary">
            Review your details below — local businesses will see this and send quotes.
          </Text>
        </Stack>

        <Surface elevation="subtle" background="alt" rounded="card" padding="base">
          <Stack spacing="md">
            {rows.map(({ label, value }) => (
              <Inline key={label} justify="space-between" align="flex-start">
                <Text variant="label" color="secondary" style={{ flexShrink: 0, marginRight: spacing.sm }}>
                  {label}
                </Text>
                <Text
                  variant="small"
                  color="primary"
                  style={{ flex: 1, textAlign: 'right' }}
                  numberOfLines={3}
                >
                  {value}
                </Text>
              </Inline>
            ))}
          </Stack>
        </Surface>

        {/* Photo thumbnails summary */}
        {photos.length > 0 && (
          <Stack spacing="sm">
            <Text variant="label" color="secondary">
              Photos ({photos.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.confirmThumbRow}
            >
              {photos.map((photo, i) => (
                <Image
                  key={photo.url || i}
                  source={{ uri: photo.uri }}
                  style={styles.confirmThumb}
                />
              ))}
            </ScrollView>
          </Stack>
        )}

        <Button
          label="Post job → get quotes"
          loading={submitting}
          disabled={submitting}
          onPress={onSubmit}
          style={styles.postBtn}
        />

        <Text variant="caption" color="secondary" style={styles.hint}>
          Local businesses will respond with quotes. You pick the best one.
        </Text>
      </Stack>
    </StepPanel>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PostJobScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [addressLat, setAddressLat] = useState(null);
  const [addressLng, setAddressLng] = useState(null);
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [descError, setDescError] = useState('');

  function goForward() {
    if (step === 1) {
      if (!description.trim() || description.trim().length < 10) {
        setDescError('Describe your job in at least 10 characters.');
        return;
      }
      // Address is required for businesses to find the job. If picked from
      // Google Places autocomplete, lat/lng are set — skip the length check.
      const hasCoords = addressLat != null && addressLng != null;
      if (!hasCoords && address.trim().length > 0 && address.trim().length < 5) {
        setDescError('Enter a full address (at least 5 characters).');
        return;
      }
    }
    setDescError('');
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!description.trim() || description.trim().length < 10) {
      setDescError('Describe your job in at least 10 characters.');
      setStep(1);
      return;
    }
    const parsedBudget = parseFloat(budget);
    if (!parsedBudget || parsedBudget <= 0) {
      setDescError('Enter a budget amount greater than $0.');
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: description.trim(),
        description: description.trim(),
        category: category || 'General',
        budget: parsedBudget,
        address: address.trim() || undefined,
        lat: addressLat ?? undefined,
        lng: addressLng ?? undefined,
        image_urls: photos.map((p) => p.url),
      };

      const data = await api.post('/service-posts/', payload);
      const post = data?.post || data;

      // Reset form
      setDescription('');
      setCategory('');
      setAddress('');
      setAddressLat(null);
      setAddressLng(null);
      setBudget('');
      setDate('');
      setTime('');
      setPhotos([]);
      setStep(0);

      navigation.navigate('QuoteComparison', {
        postId: post.id,
        postTitle: post.title,
      });
    } catch (err) {
      setDescError(err.message || 'Could not post job. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;
  const isFirstStep = step === 0;

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Stack spacing="sm" style={styles.progressSection}>
          <StepLabels step={step} />
          <ProgressBar step={step} />
        </Stack>

        <View style={styles.stepContent}>
          {step === 0 && (
            <StepCategory key="cat" category={category} setCategory={setCategory} />
          )}
          {step === 1 && (
            <StepDetails
              key="det"
              description={description}
              setDescription={setDescription}
              address={address}
              setAddress={setAddress}
              setAddressLat={setAddressLat}
              setAddressLng={setAddressLng}
              descError={descError}
              photos={photos}
              setPhotos={setPhotos}
              photoUploading={photoUploading}
              setPhotoUploading={setPhotoUploading}
            />
          )}
          {step === 2 && (
            <StepBudget
              key="bud"
              budget={budget}
              setBudget={setBudget}
              date={date}
              setDate={setDate}
              time={time}
              setTime={setTime}
            />
          )}
          {step === 3 && (
            <StepConfirm
              key="con"
              category={category}
              description={description}
              address={address}
              budget={budget}
              date={date}
              time={time}
              photos={photos}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
        </View>

        {!isLastStep && (
          <Inline justify="space-between" style={styles.navRow}>
            {!isFirstStep ? (
              <Button
                variant="ghost"
                label="Back"
                onPress={goBack}
                style={styles.navBtn}
              />
            ) : (
              <View style={styles.navBtn} />
            )}
            <Button
              label={step === TOTAL_STEPS - 2 ? 'Review' : 'Next'}
              onPress={goForward}
              disabled={photoUploading}
              style={styles.navBtn}
            />
          </Inline>
        )}

        {isLastStep && (
          <Button
            variant="ghost"
            label="Edit details"
            onPress={goBack}
            style={styles.backOnConfirm}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },

  // Progress
  progressSection: { marginBottom: spacing.xs },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  stepLabels: { paddingHorizontal: spacing.xs },
  stepLabelActive: {},

  // Step content
  stepContent: { flex: 1, minHeight: 320 },

  // Navigation
  navRow: { marginTop: spacing.sm },
  navBtn: { flex: 1, maxWidth: 160 },
  backOnConfirm: { alignSelf: 'center', marginTop: spacing.sm },

  // Confirm step
  postBtn: { marginTop: spacing.xs },
  hint: { textAlign: 'center' },
  confirmThumbRow: { gap: spacing.sm },
  confirmThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },

  // Google Places wrapper
  placesWrapper: { gap: spacing.xs },
  placesLabel: { marginBottom: spacing.xs },

  // Time picker trigger
  timeTrigger: {
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingTop: 22,
    paddingBottom: 8,
    minHeight: 52,
    justifyContent: 'flex-end',
  },
  timeLabel: {
    position: 'absolute',
    top: 8,
    left: spacing.base,
    fontSize: 11,
  },

  // Time picker modal (iOS)
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingBottom: spacing.xl,
  },
  pickerToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  // Photo picker
  photoSectionLabel: { textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 },
  optional: { fontWeight: '400', fontSize: 10 },

  thumbScroll: { flexGrow: 0 },
  thumbScrollContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  thumbWrapper: { position: 'relative' },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
  },
  thumbRemoveInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },

  photoBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentMuted,
    borderRadius: radius.input,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    backgroundColor: `${colors.accentMuted}40`,
  },
  photoBoxContent: { alignItems: 'center' },
  photoHint: { textAlign: 'center', marginTop: spacing.xs },
});
