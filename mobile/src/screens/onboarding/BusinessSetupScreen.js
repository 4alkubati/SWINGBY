import { useState } from 'react';
import {
  ScrollView, KeyboardAvoidingView, Platform, View, StyleSheet,
  ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import HeaderGlow from '../../components/HeaderGlow';
import BusinessLogo from '../../components/BusinessLogo';
import GoogleReviewsConnect from '../../components/GoogleReviewsConnect';
import { api, uploadFile } from '../../services/api';
import { show as showToast } from '../../services/toast';
import { getStatus as getGoogleReviewsStatus } from '../../services/googleReviews';
import { CATEGORY_LABELS as CATEGORIES } from '../../constants/categories';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

const RADIUS_PRESETS = [10, 25, 50, 100];

export default function BusinessSetupScreen({ onComplete }) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Walkthrough M3 — the "Connect Google" step of business signup. It only
  // exists once the business row does (the backend resolves which business to
  // import into from the caller's own record, never from a posted id), so it
  // is a second step rather than another field above.
  const [step, setStep] = useState('details');
  const [importedCount, setImportedCount] = useState(0);

  // The logo is uploaded the moment it is picked, not on submit — the business
  // row does not exist yet, but POST /uploads/image only needs an authenticated
  // caller, so we can hold a real URL and hand it to POST /businesses/ as just
  // another field.
  //
  // Every failure path here is contained: a denied permission, a cancelled
  // picker or a failed upload sets a message next to the tile and touches
  // NOTHING else. The name, category, address, radius and description the user
  // already typed are never re-rendered from scratch and never cleared, and the
  // form stays submittable — a business with no logo is a complete signup, so a
  // broken upload must not be able to block one.
  async function handlePickLogo() {
    if (uploadingLogo) return;
    setLogoError('');

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      setLogoError('Allow photo access to add a logo. You can add one later.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
    const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    setUploadingLogo(true);
    try {
      const up = await uploadFile('/uploads/image', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName || `logo_${Date.now()}.${ext}`,
      });
      setLogoUrl(up.url);
    } catch (err) {
      // Keep whatever logo was already accepted rather than blanking the tile
      // because a REPLACEMENT failed.
      setLogoError(err?.message || 'Could not upload that image. Try another.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit() {
    setError('');
    if (!businessName.trim()) { setError('What\'s the name of your business?'); return; }
    if (!category) { setError('Pick the category that fits your work.'); return; }
    if (!address.trim()) { setError('Add your service address so clients nearby can find you.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        category,
        description: description.trim() || undefined,
        // Always send the address. When the Places autocomplete is active it
        // also sends lat/lng and those win server-side. When the key is absent
        // this screen falls back to a plain text field that never sets
        // coordinates — before, the address was dropped here and the business
        // was created with no pin, invisible on the map forever. The backend
        // geocodes this string as a fallback (app/api/businesses.py).
        address: address.trim() || undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        service_radius_km: radiusKm,
        // Omitted entirely when there is no logo, so a signup without one is
        // byte-for-byte the request it was before this field existed.
        logo_url: logoUrl || undefined,
      };
      await api.post('/businesses/', payload);
      showToast({ type: 'success', text1: 'Business created', text2: 'You can now receive jobs.' });

      // Only offer the Google step when the backend says the feature is live.
      // While Google's Business Profile approval is pending the flag is off,
      // and an extra screen whose only content is "coming soon" is a step that
      // costs a tap and gives nothing — so signup goes straight through, and
      // the coming-soon card lives on the owner's profile instead.
      let googleEnabled = false;
      try {
        googleEnabled = !!(await getGoogleReviewsStatus())?.enabled;
      } catch {
        googleEnabled = false;
      }
      if (googleEnabled) {
        setStep('google');
        return;
      }
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Could not save. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'google') {
    return (
      <SafeAreaView style={styles.safe}>
        <HeaderGlow width={480} height={280} offsetTop={-40} align="right" opacity={0.24} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400).delay(80)}>
            <Text style={styles.title}>Don&apos;t start at zero</Text>
            <Text style={styles.subtitle}>
              Already have reviews on Google? Connect the account that owns your
              Business Profile and we&apos;ll bring them across, marked as verified,
              so new clients see your track record from day one.
            </Text>
          </Animated.View>

          <View style={styles.field}>
            <GoogleReviewsConnect
              onImported={(result) => setImportedCount(result?.total ?? 0)}
            />
          </View>

          <View style={styles.submitWrap}>
            <Button
              label={importedCount > 0 ? 'Done' : 'Skip for now'}
              onPress={() => onComplete?.()}
            />
            <Text variant="caption" color="secondary" style={styles.skipHint}>
              You can connect Google any time from your business profile.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <HeaderGlow width={480} height={280} offsetTop={-40} align="right" opacity={0.24} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400).delay(80)}>
            <Text style={styles.title}>Set up your business</Text>
            <Text style={styles.subtitle}>
              A few details so clients near you can find your work.
            </Text>
          </Animated.View>

          <View style={styles.field}>
            <TextField
              label="Business name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Calgary Clean Co."
              autoCapitalize="words"
            />
          </View>

          {/* Logo — optional, and sits AFTER the name on purpose: the tile
              previews the monogram built from what has been typed, so an owner
              who skips this still sees the identity they are going to get
              rather than an empty hole. */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Logo (optional)</Text>
            <Pressable
              onPress={handlePickLogo}
              disabled={uploadingLogo}
              accessibilityRole="button"
              accessibilityLabel={logoUrl ? 'Change business logo' : 'Add a business logo'}
              accessibilityState={{ busy: uploadingLogo }}
              style={({ pressed }) => [styles.logoRow, pressed && styles.logoRowPressed]}
            >
              <View>
                <BusinessLogo
                  uri={logoUrl}
                  name={businessName || '?'}
                  size={56}
                />
                {uploadingLogo && (
                  <View style={styles.logoBusy}>
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  </View>
                )}
              </View>
              <View style={styles.logoCopy}>
                <Text style={styles.logoTitle}>
                  {uploadingLogo
                    ? 'Uploading…'
                    : logoUrl
                      ? 'Logo added — tap to replace'
                      : 'Add your logo'}
                </Text>
                <Text variant="caption" color="secondary">
                  {logoUrl
                    ? 'Clients see this on your profile and in search.'
                    : 'Optional. Without one we use your initials.'}
                </Text>
              </View>
              <Feather
                name={logoUrl ? 'refresh-cw' : 'plus'}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
            {!!logoError && <Text style={styles.logoError}>{logoError}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>What do you offer?</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={category === cat}
                  onPress={() => setCategory(cat)}
                  style={styles.chip}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <TextField
              label="Tell clients what makes you stand out (optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="10+ years of experience, fully insured, same-day service…"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Address — Places autocomplete if key present, fallback to text otherwise */}
          <View style={styles.field}>
            {GOOGLE_PLACES_KEY && Platform.OS !== 'web' ? (
              <View>
                <Text style={styles.fieldLabel}>Service address</Text>
                <GooglePlacesAutocomplete
                  placeholder="Where are you based?"
                  onPress={(data, details = null) => {
                    setAddress(data.description);
                    const loc = details?.geometry?.location;
                    if (loc) { setLat(loc.lat); setLng(loc.lng); }
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
                    // Do NOT pass `value` — the library's TextInput is
                    // internally controlled (value={stateText}) and its
                    // render spreads {...textInputProps} after that prop, so
                    // an external `value` silently wins and the field goes
                    // fully externally-controlled. On Android that fights the
                    // IME's composing-text span on every keystroke and makes
                    // the box untypable (iOS has no such mechanic, so it
                    // "worked" there). onChangeText alone mirrors the typed
                    // text into `address` without taking over control.
                    onChangeText: setAddress,
                    autoCapitalize: 'words',
                  }}
                  enablePoweredByContainer={false}
                  fetchDetails={true}
                  minLength={3}
                  keepResultsAfterBlur
                  // DQ-5 (Android address input unusable) — see matching
                  // comment in PostJobScreen.js StepDetails: the results
                  // FlatList is scrollable by default and nested inside this
                  // screen's ScrollView, which is the "VirtualizedList nested
                  // in ScrollView" anti-pattern that Android handles far worse
                  // than iOS. disableScroll gives all scrolling to the parent.
                  disableScroll
                />
              </View>
            ) : (
              <TextField
                label="Service address"
                value={address}
                onChangeText={setAddress}
                placeholder="123 Main St SW, Calgary"
                autoCapitalize="words"
              />
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>How far will you travel?</Text>
            <View style={styles.chipRow}>
              {RADIUS_PRESETS.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  selected={radiusKm === km}
                  onPress={() => setRadiusKm(km)}
                  style={styles.chip}
                />
              ))}
            </View>
          </View>

          {!!error && (
            <Text style={styles.error}>{error}</Text>
          )}

          <View style={styles.submitWrap}>
            <Button
              label={submitting ? 'Saving…' : 'Create business'}
              onPress={handleSubmit}
              disabled={submitting}
            />
            {submitting && <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm }} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  field: { marginTop: spacing.lg },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  logoRowPressed: { backgroundColor: colors.surfaceAlt },
  logoBusy: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoCopy: { flex: 1, gap: 2 },
  logoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.textPrimary,
  },
  logoError: {
    marginTop: spacing.sm,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.danger,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { marginRight: 0 },
  error: {
    marginTop: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.danger,
  },
  submitWrap: { marginTop: spacing.xl },
  skipHint: {
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 16,
  },
});
