import {
  View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(date) {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// GAP-AUDIT-2026-07-18 #64 — the wizard has no title field, so the create
// payload used to send the full description as the title verbatim. Derive a
// short one instead: first 60 chars of the (whitespace-collapsed) description,
// with an ellipsis if it was truncated.
function deriveTitle(text) {
  const collapsed = text.trim().replace(/\s+/g, ' ');
  if (collapsed.length <= 60) return collapsed;
  return `${collapsed.slice(0, 60).trimEnd()}…`;
}

// Combine the picked day and the picked time into one ISO-8601 instant for the
// backend's plain-string preferred_date column.
//
// Both arguments are Date objects straight from the platform picker, so there
// is no parsing here and nothing to get wrong. That is the point. This used to
// take two free-text strings and run `new Date("Jul 5 2:30 PM")`, which V8
// resolves to the year *2001* because the string carries no year — so a client
// who typed the field's own placeholder booked a job 25 years in the past, and
// anything a person would actually type ("Saturday", "tomorrow", "July 5th")
// failed to parse and was dropped without a word. Across 35 production posts
// the column was never once populated.
//
// When no time was chosen we anchor to local noon rather than midnight: noon
// survives conversion to UTC in every timezone without the calendar date
// rolling to the day before or after, which midnight does not.
// Exported for src/__tests__/post-job-date.test.js — the noon anchoring is the
// whole reason the picked day survives the UTC conversion, so it gets asserted.
export function derivePreferredDate(dateObj, timeObj) {
  if (!dateObj) return undefined;
  const combined = new Date(dateObj);
  if (timeObj) {
    combined.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);
  } else {
    combined.setHours(12, 0, 0, 0);
  }
  return combined.toISOString();
}

// Two wizards share this screen:
//  * open marketplace post — client picks a category (step 0), job goes to
//    every matching business.
//  * targeted "Book now" — reached from a business profile with a businessId
//    param. NO category step (category is derived server-side from the target
//    business), the job goes to THAT business only.
const STEPS_OPEN = ['Category', 'Details', 'Budget', 'Confirm'];
const STEPS_TARGETED = ['Details', 'Budget', 'Confirm'];

// CARD-12 — Rebook. Pre-fills the open-marketplace wizard with the prior job's
// category/address/budget and a description naming the business, saving the
// client the re-typing. It still posts OPENLY — it does not guarantee only that
// business sees the post.
//
// LANE C note: the primitive that was missing when this was written now exists
// (service_posts.target_business_id + the `targeted` path below), so rebook
// COULD be switched to a targeted post. Deliberately left alone here to keep
// this change scoped to "Book now"; switching it is a CARD-12 follow-up and a
// real behaviour change (the client would stop receiving competing quotes).
function RebookBanner({ businessName }) {
  if (!businessName) return null;
  return (
    <Surface elevation="subtle" background="alt" rounded="card" padding="base" style={styles.rebookBanner}>
      <Inline spacing="sm" align="center">
        <Feather name="refresh-cw" size={16} color={colors.accentText} />
        <Text variant="small" style={{ flex: 1 }}>
          {i18n.t('rebook.bannerTitle', { business: businessName })}
        </Text>
      </Inline>
    </Surface>
  );
}

// ─── Targeted "Book now" banner ───────────────────────────────────────────────
// Shown on the direct-to-business flow (reached from a business profile). Makes
// it unmistakable the quote request goes to ONE business, not the marketplace.
function TargetBanner({ businessName }) {
  if (!businessName) return null;
  return (
    <Surface elevation="subtle" background="alt" rounded="card" padding="base" style={styles.rebookBanner}>
      <Inline spacing="sm" align="center">
        <Feather name="send" size={16} color={colors.accentText} />
        <Text variant="small" style={{ flex: 1 }}>
          Requesting a quote from <Text variant="smallMedium">{businessName}</Text>. They'll reply with a price and time.
        </Text>
      </Inline>
    </Surface>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  const pct = ((step + 1) / total) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

function StepLabels({ step, steps }) {
  return (
    <Inline justify="space-between" style={styles.stepLabels}>
      {steps.map((label, i) => (
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
  setAddressLat, setAddressLng, placesRef,
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
                ref={placesRef}
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
                  // Do NOT pass `value` here — the library's own textInput is
                  // controlled internally (value={stateText}) and its render
                  // spreads {...textInputProps} AFTER that, so an external
                  // `value` silently wins and the field becomes externally
                  // controlled. On Android, forcing the native EditText's
                  // controlled value back on every keystroke fights the IME's
                  // composing-text/predictive-suggestion span and makes the
                  // box effectively untypable (works fine on iOS, which has no
                  // such composing-text mechanic). onChangeText alone is
                  // enough to mirror the typed text into `address`; resetting
                  // the field programmatically goes through the exposed ref
                  // (placesRef.current.setAddressText) instead of `value`.
                  onChangeText: setAddress,
                  autoCapitalize: 'words',
                }}
                enablePoweredByContainer={false}
                fetchDetails={true}
                minLength={3}
                keepResultsAfterBlur
                // DQ-5 (Android address input unusable): the library's own
                // results dropdown is a FlatList with scrollEnabled=true by
                // default — nested inside this screen's own ScrollView, that's
                // the classic "VirtualizedList nested in a ScrollView with the
                // same orientation" case, which Android's stricter nested-scroll
                // gesture arbitration turns into broken touch/typing on the
                // field (iOS tolerates the nesting far better). disableScroll
                // hands all scrolling to the parent ScrollView so the two never
                // fight for the touch responder; individual suggestion rows
                // stay tappable (that's a separate concern from list-scrolling).
                disableScroll
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerTime, setPickerTime] = useState(() => time || new Date());
  const [pickerDate, setPickerDate] = useState(() => date || new Date());

  function onTimeChange(event, selected) {
    if (Platform.OS === 'android') {
      // Android picker is a one-shot dialog: hide it always, and commit the
      // chosen value inside onChange when the user taps OK (event.type === 'set').
      // 'dismissed' just closes without changing the value.
      setShowTimePicker(false);
      if (event?.type === 'set' && selected) {
        setPickerTime(selected);
        setTime(selected);
      }
      return;
    }
    // iOS inline spinner: keep the draft until the user taps Done (confirmTime).
    if (selected) setPickerTime(selected);
  }

  function confirmTime() {
    setTime(pickerTime);
    setShowTimePicker(false);
  }

  // Same two-platform dance as the time picker above.
  function onDateChange(event, selected) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event?.type === 'set' && selected) {
        setPickerDate(selected);
        setDate(selected);
      }
      return;
    }
    if (selected) setPickerDate(selected);
  }

  function confirmDate() {
    setDate(pickerDate);
    setShowDatePicker(false);
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
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.timeTrigger, { flex: 1 }]}
              accessibilityLabel="Select preferred date"
              accessibilityRole="button"
            >
              <Text variant="caption" color="secondary" style={styles.timeLabel}>
                Preferred date
              </Text>
              <Text variant="body" color={date ? 'primary' : 'secondary'}>
                {date ? formatDate(date) : 'Any day'}
              </Text>
            </TouchableOpacity>
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
                {time ? formatTime(time) : 'Any time'}
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

      {/* minimumDate stops a client requesting a day that has already been —
          the old free-text field happily accepted anything at all. */}
      {Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="slide"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerToolbar}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text variant="body" color="secondary">Cancel</Text>
                </TouchableOpacity>
                <Text variant="label">Preferred date</Text>
                <TouchableOpacity onPress={confirmDate}>
                  <Text variant="body" color="accent" style={{ fontWeight: '600' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={onDateChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )
      )}
    </StepPanel>
  );
}

// ─── Step 3: Confirm ─────────────────────────────────────────────────────────
function StepConfirm({ category, description, address, budget, date, time, photos, onSubmit, submitting, targetBusinessName }) {
  const rows = [
    // On the targeted "Book now" flow the client never picked a category (it's
    // derived from the business server-side), so show the business instead.
    targetBusinessName
      ? { label: 'Business', value: targetBusinessName }
      : { label: 'Category', value: category || 'General' },
    { label: 'Description', value: description || '—' },
    { label: 'Address', value: address || '—' },
    { label: 'Budget', value: budget ? `$${budget}` : '—' },
    { label: 'Date', value: date ? formatDate(date) : 'Any day' },
    { label: 'Time', value: time ? formatTime(time) : 'Any time' },
  ];

  return (
    <StepPanel direction={1}>
      <Stack spacing="lg">
        <Stack spacing="sm">
          <Text variant="display3">
            {targetBusinessName ? 'Ready to send?' : 'Ready to post?'}
          </Text>
          <Text variant="body" color="secondary">
            {targetBusinessName
              ? `Review your details below — ${targetBusinessName} will see this and reply with a quote.`
              : 'Review your details below — local businesses will see this and send quotes.'}
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
          label={targetBusinessName ? 'Send request → get a quote' : 'Post job → get quotes'}
          loading={submitting}
          disabled={submitting}
          onPress={onSubmit}
          style={styles.postBtn}
        />

        <Text variant="caption" color="secondary" style={styles.hint}>
          {targetBusinessName
            ? `${targetBusinessName} will reply with a price and time. You confirm before anything is charged.`
            : 'Local businesses will respond with quotes. You pick the best one.'}
        </Text>
      </Stack>
    </StepPanel>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PostJobScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  // CARD-12 — Rebook prefill. Set by BookingDetailsScreen / MyJobsScreen when
  // the client taps "Rebook" on a completed booking (route.params only —
  // this screen is also reached with no params from the normal Post Job flow).
  //
  // LANE C — targeted "Book now". Set by BusinessProfileScreen's sticky "Book
  // now" bar. When `businessId` is present, this is a direct quote request to
  // ONE business: the category step is dropped (category is derived server-side
  // from the business) and the post targets only that business.
  const {
    rebookBusinessId,
    rebookBusinessName,
    rebookCategory,
    rebookAddress,
    rebookBudget,
    businessId: targetBusinessId,
    businessName: targetBusinessName,
  } = route.params || {};

  const targeted = !!targetBusinessId;
  const STEPS = targeted ? STEPS_TARGETED : STEPS_OPEN;
  const TOTAL_STEPS = STEPS.length;

  const [description, setDescription] = useState(
    rebookBusinessName
      ? i18n.t('rebook.descriptionTemplate', { business: rebookBusinessName })
      : ''
  );
  const [category, setCategory] = useState(rebookCategory || '');
  const [address, setAddress] = useState(rebookAddress || '');
  const [addressLat, setAddressLat] = useState(null);
  const [addressLng, setAddressLng] = useState(null);
  const [budget, setBudget] = useState(
    rebookBudget != null && rebookBudget !== '' ? String(rebookBudget) : ''
  );
  // Date objects (or null), never strings — see derivePreferredDate.
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [descError, setDescError] = useState('');
  const placesRef = useRef(null);

  // Map the current numeric step to a stable key so validation / rendering
  // never depend on which wizard (open vs targeted) is active — the targeted
  // wizard has no 'category' step, so a bare index would mean different things.
  const stepKey = STEPS[step] ? STEPS[step].toLowerCase() : 'confirm';

  // Push the rebook address into the Places autocomplete field's own
  // internal state via its imperative ref — its textInput is NOT driven by
  // an external `value` prop (see the comment in StepDetails below), so
  // setting `address` state alone would not update the visible text.
  useEffect(() => {
    if (rebookAddress) {
      placesRef.current?.setAddressText?.(rebookAddress);
    }
    // Intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goForward() {
    if (stepKey === 'details') {
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
    const detailsStep = STEPS.indexOf('Details');
    const budgetStep = STEPS.indexOf('Budget');
    if (!description.trim() || description.trim().length < 10) {
      setDescError('Describe your job in at least 10 characters.');
      setStep(detailsStep);
      return;
    }
    const parsedBudget = parseFloat(budget);
    if (!parsedBudget || parsedBudget <= 0) {
      setDescError('Enter a budget amount greater than $0.');
      setStep(budgetStep);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: deriveTitle(description),
        description: description.trim(),
        budget: parsedBudget,
        address: address.trim() || undefined,
        lat: addressLat ?? undefined,
        lng: addressLng ?? undefined,
        image_urls: photos.map((p) => p.url),
        preferred_date: derivePreferredDate(date, time),
      };
      // Targeted "Book now": the backend derives category from the target
      // business, so we send only target_business_id — no category step ran.
      // Open post: category is client-picked (default General escape hatch).
      if (targeted) {
        payload.target_business_id = targetBusinessId;
      } else {
        payload.category = category || 'General';
      }

      const data = await api.post('/service-posts/', payload);
      const post = data?.post || data;

      // Reset form
      setDescription('');
      setCategory('');
      setAddress('');
      // The Places field is (deliberately) not driven by `value` anymore —
      // see the comment in StepDetails — so clearing `address` alone won't
      // clear the visible text. Reset via the library's own imperative API.
      placesRef.current?.setAddressText('');
      setAddressLat(null);
      setAddressLng(null);
      setBudget('');
      setDate(null);
      setTime(null);
      setPhotos([]);
      setStep(0);

      // Both flows land on the post's quote inbox. On the targeted flow this is
      // the closest thing to "land in the quote chat with that business" that
      // is actually reachable: a message thread hangs off an INTEREST (see
      // backend/app/api/messages.py `_get_interest_thread`), and the target
      // business hasn't quoted yet, so no thread exists to open. QuoteComparison
      // is the waiting room — the moment the business replies, its quote appears
      // here and taps straight through to the chat.
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
        <RebookBanner businessName={rebookBusinessName} />
        <TargetBanner businessName={targetBusinessName} />

        <Stack spacing="sm" style={styles.progressSection}>
          <StepLabels step={step} steps={STEPS} />
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </Stack>

        <View style={styles.stepContent}>
          {stepKey === 'category' && (
            <StepCategory key="cat" category={category} setCategory={setCategory} />
          )}
          {stepKey === 'details' && (
            <StepDetails
              key="det"
              description={description}
              setDescription={setDescription}
              address={address}
              setAddress={setAddress}
              setAddressLat={setAddressLat}
              setAddressLng={setAddressLng}
              placesRef={placesRef}
              descError={descError}
              photos={photos}
              setPhotos={setPhotos}
              photoUploading={photoUploading}
              setPhotoUploading={setPhotoUploading}
            />
          )}
          {stepKey === 'budget' && (
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
          {stepKey === 'confirm' && (
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
              targetBusinessName={targetBusinessName}
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

  // Rebook banner (CARD-12)
  rebookBanner: { marginBottom: spacing.sm },

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
