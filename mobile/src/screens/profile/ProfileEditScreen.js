// T50 — ProfileEditScreen (UX polish pass)
import React, { useState } from 'react';
import {
  View, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { show as showToast } from '../../services/toast';
import { buttonTap } from '../../services/haptics';
import { RatingStarsDisplay } from '../../components/RatingStars';

import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import TextField from '../../components/TextField';

import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

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

  const handleAvatarPress = () => {
    buttonTap();
    showToast({ type: 'info', text1: 'Photo upload coming soon' });
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
      updateUser(updated);
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
          justifyContent: 'space-between',
          paddingHorizontal: spacing.base,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>

        <Text variant="h2">Edit Profile</Text>

        {/* spacer to keep title centered */}
        <View style={{ width: 40 }} />
      </View>

      {/* ── Scrollable body ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.lg,
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
                size="xl"
                style={shadows.subtle}
              />
              {/* Camera badge overlay */}
              <View
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceAlt,
                  borderWidth: 2,
                  borderColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...shadows.subtle,
                }}
              >
                <Feather name="camera" size={13} color={colors.textPrimary} />
              </View>
            </AnimatedPressable>

            <Text variant="caption" color="secondary">Tap to change photo</Text>

            {/* Rating row (if available) */}
            {user?.avg_rating != null && (
              <Inline spacing="sm">
                <RatingStarsDisplay rating={user.avg_rating} size={16} />
                <Text variant="small" color="secondary">
                  {user.avg_rating.toFixed(1)} avg rating
                </Text>
              </Inline>
            )}
          </Stack>

          {/* ── Editable fields ── */}
          <Surface elevation="subtle" padding="base">
            <Stack spacing="base">

              <TextField
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={80}
              />

              <TextField
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                returnKeyType="next"
                maxLength={80}
              />

              {/* Email — read-only */}
              <Stack spacing="xs">
                <View
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.input,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.md,
                    opacity: 0.75,
                    minHeight: 52,
                    justifyContent: 'center',
                  }}
                >
                  <Inline spacing="sm">
                    <Feather name="lock" size={15} color={colors.textSecondary} />
                    <Text
                      variant="body"
                      color="secondary"
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {user?.email ?? '—'}
                    </Text>
                  </Inline>
                </View>
                <Text variant="caption" color="secondary" style={{ marginLeft: spacing.xs }}>
                  Email — contact support to change
                </Text>
              </Stack>

              <TextField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
              />

            </Stack>
          </Surface>

        </Stack>
      </ScrollView>

      {/* ── Sticky save CTA ── */}
      <View
        style={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.base,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Button
          variant="primary"
          label="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
