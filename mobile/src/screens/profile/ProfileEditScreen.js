// T50 — ProfileEditScreen (UX polish pass)
import React, { useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../context/AuthContext';
import { api, uploadFile } from '../../services/api';
import i18n from '../../i18n';
import { show as showToast } from '../../services/toast';
import { buttonTap } from '../../services/haptics';

import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import TextField from '../../components/TextField';

import { colors, spacing, radius, motion } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Avatar spring micro-interaction
  const avatarScale = useSharedValue(1);
  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const handleAvatarPressIn = () => {
    avatarScale.value = withSpring(0.95, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handleAvatarPressOut = () => {
    avatarScale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  // G11 (GAP-AUDIT #11) — POST /uploads/image + users.avatar_url both existed
  // on the backend with no mobile caller; this screen showed a "coming soon"
  // toast instead of wiring them together.
  const handleAvatarPress = async () => {
    if (uploadingPhoto) return;
    await buttonTap();

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(i18n.t('common.error'), i18n.t('profile.photoPermission'));
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

    setUploadingPhoto(true);
    try {
      const up = await uploadFile('/uploads/image', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName || `avatar_${Date.now()}.${ext}`,
      });

      const updated = await api.patch('/auth/me', { avatar_url: up.url });
      updateUser(updated.user);
      setAvatarUrl(up.url);
      showToast({ type: 'success', text1: i18n.t('profile.photoUpdated') });
    } catch (err) {
      showToast({ type: 'error', text1: i18n.t('profile.photoUploadError'), text2: err?.message || '' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  async function handleSave() {
    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();

    if (!trimFirst || trimFirst.length > 80) {
      showToast({ type: 'error', text1: 'First name must be 1–80 characters' });
      return;
    }
    if (!trimLast || trimLast.length > 80) {
      showToast({ type: 'error', text1: 'Last name must be 1–80 characters' });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.patch('/auth/me', {
        first_name: trimFirst,
        last_name: trimLast,
        phone: phone.trim() || null,
      });
      // PATCH /auth/me returns {message, user} — spreading the envelope
      // directly into the user object left name/phone edits invisible until
      // re-login. Unwrap .user (same fix as the avatar-save path above).
      updateUser(updated.user);
      showToast({ type: 'success', text1: 'Profile updated' });
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', text1: 'Could not save changes', text2: err.message });
    } finally {
      setSaving(false);
    }
  }

  const fullName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.md,
        }}
      >
        {/* 38px bordered circle, per the frame. No bottom hairline under the
            header — the mock has none, and the first thing below it is the
            avatar block, not a list. */}
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Feather name="arrow-left" size={19} strokeWidth={1.8} color={colors.textPrimary} />
        </Pressable>

        <Text variant="h2" accessibilityRole="header">Edit profile</Text>
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Stack spacing="lg">

          {/* ── Avatar section ── */}
          <Stack spacing="sm" style={{ alignItems: 'center' }}>
            <AnimatedPressable
              onPressIn={handleAvatarPressIn}
              onPressOut={handleAvatarPressOut}
              onPress={handleAvatarPress}
              style={[
                { position: 'relative' },
                avatarAnimatedStyle,
              ]}
            >
              <Avatar
                name={fullName || '?'}
                source={avatarUrl}
                size={88}
              />
              {/* Uploading spinner overlay */}
              {uploadingPhoto && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: radius.pill,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                </View>
              )}
              {/* Camera badge overlay */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accentBtn,
                  borderWidth: 3,
                  borderColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="camera" size={12} strokeWidth={2} color={colors.textPrimary} />
              </View>
            </AnimatedPressable>

            <Text
              variant="smallMedium"
              style={{ fontSize: 13, color: colors.accentText }}
            >
              {uploadingPhoto ? i18n.t('profile.photoUploading') : 'Change photo'}
            </Text>

            {/* No rating row here on purpose. `avg_rating` is a column on
                `businesses`, never on `users`, and neither GET /auth/me nor
                PATCH /auth/me (whose safe_fields allowlist is id, first_name,
                last_name, email, phone, role, avatar_url, created_at) attaches
                it — so the old `user?.avg_rating != null` gate was dead code
                that could never render for anyone. A business owner's rating
                belongs on the business profile, sourced from GET /businesses/me. */}
          </Stack>

          {/* ── Editable fields ── */}
          <Stack spacing="base">

              <TextField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={80}
              />

              <TextField
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={80}
              />

              <TextField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
                placeholder="+1 (403) 555-0142"
              />

              {/* Email — read-only. Same 52px geometry as a real field so the
                  column has one left edge and one height, with a "Locked"
                  marker instead of an input caret. */}
              <Stack spacing="xs">
                <Text variant="label" color="secondary" style={{ marginBottom: 7 }}>
                  Email
                </Text>
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.input,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: spacing.base,
                    height: 52,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    variant="small"
                    color="secondary"
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 15 }}
                  >
                    {user?.email ?? '—'}
                  </Text>
                  <Feather name="lock" size={13} strokeWidth={1.8} color={colors.textTertiary} />
                  <Text variant="caption" style={{ color: colors.textTertiary }}>Locked</Text>
                </View>
                <Text variant="caption" color="secondary">
                  {i18n.t('profile.emailLocked')}
                </Text>
              </Stack>

            </Stack>

        </Stack>
      </ScrollView>

      {/* ── Sticky save CTA ── */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.base,
          backgroundColor: colors.bg,
        }}
      >
        <Button
          variant="primary"
          label="Save changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
