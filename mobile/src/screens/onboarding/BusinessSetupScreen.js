import { useState } from 'react';
import {
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, View, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import HeaderGlow from '../../components/HeaderGlow';
import { api } from '../../services/api';
import { show as showToast } from '../../services/toast';

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

const CATEGORIES = [
  'Cleaning', 'Plumbing', 'Electrical',
  'Landscaping', 'Painting', 'Carpentry', 'Moving', 'Handyman',
];

const RADIUS_PRESETS = [10, 25, 50, 100];

export default function BusinessSetupScreen({ onComplete }) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        service_radius_km: radiusKm,
      };
      await api.post('/businesses/', payload);
      showToast({ type: 'success', text1: 'Business created', text2: 'You can now receive jobs.' });
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Could not save. Try again.');
    } finally {
      setSubmitting(false);
    }
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { marginRight: 0 },
  error: {
    marginTop: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.danger,
  },
  submitWrap: { marginTop: spacing.xl },
});
