// T55 — ReferralScreen (UX polish pass)
import React from 'react';
import {
  View, Pressable, ScrollView, Share,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../../context/AuthContext';
import { show as showToast } from '../../services/toast';
import { buttonTap } from '../../services/haptics';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import Button from '../../components/Button';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuth();

  const referralCode = (user?.id ?? 'SWINGBY1').slice(0, 8).toUpperCase();

  // Spring scale values for copy button micro-interaction
  const copyScale = useSharedValue(1);
  const copyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: copyScale.value }],
  }));

  const handleCopyPressIn = () => {
    copyScale.value = withSpring(0.97, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handleCopyPressOut = () => {
    copyScale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  async function handleCopy() {
    buttonTap();
    try {
      await Clipboard.setStringAsync(referralCode);
      showToast({ type: 'success', text1: 'Copied' });
    } catch {
      showToast({ type: 'error', text1: 'Could not copy code' });
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on SwingBy! Code: ${referralCode} — https://swingbyy.com`,
        title: 'SwingBy Referral',
      });
    } catch { /* user cancelled */ }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <Inline
        justify="space-between"
        style={{
          paddingHorizontal: spacing.base,
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

        <Text variant="h2">Referrals</Text>

        {/* Spacer to balance header */}
        <View style={{ width: 40, height: 40 }} />
      </Inline>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Glow orb — decorative */}
        <View
          style={{
            position: 'absolute',
            top: -40,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: colors.accentMuted,
          }}
          pointerEvents="none"
        />

        {/* Hero section */}
        <Stack spacing="md" align="center" style={{ paddingBottom: spacing.sm }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: colors.accentMuted,
              borderWidth: 1,
              borderColor: colors.borderAccent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="gift" size={30} color={colors.accentText} strokeWidth={1.8} />
          </View>

          <Text
            variant="display3"
            style={{ textAlign: 'center', lineHeight: 32 }}
          >
            Share SwingBy, get $10 credit
          </Text>

          <Text
            variant="body"
            color="secondary"
            style={{ textAlign: 'center', maxWidth: 300 }}
          >
            When your friend completes their first booking, you both get $10 off your next job.
          </Text>
        </Stack>

        {/* Referral code card — focal point */}
        <Surface
          elevation="subtle"
          padding="lg"
          style={{
            alignItems: 'center',
            borderColor: colors.accentMuted,
            gap: spacing.md,
          }}
        >
          <Text variant="label" color="secondary">
            Your Referral Code
          </Text>

          <AnimatedPressable
            onPressIn={handleCopyPressIn}
            onPressOut={handleCopyPressOut}
            onPress={handleCopy}
            style={[
              {
                alignItems: 'center',
                gap: spacing.sm,
              },
              copyAnimatedStyle,
            ]}
          >
            <Text variant="display2" style={{ letterSpacing: 4 }}>
              {referralCode}
            </Text>

            <Inline
              spacing="xs"
              style={{
                backgroundColor: colors.accentMuted,
                borderWidth: 1,
                borderColor: colors.accentMuted,
                borderRadius: radius.chip,
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs,
              }}
            >
              <Feather name="copy" size={14} color={colors.accent} />
              <Text variant="smallMedium" color="accent">
                Tap to copy
              </Text>
            </Inline>
          </AnimatedPressable>
        </Surface>

        {/* How it works */}
        <Surface elevation="subtle" padding="base" style={{ gap: spacing.md }}>
          <Text variant="label" color="secondary">
            How it works
          </Text>

          {[
            'Share your code with a friend',
            'They sign up and complete a booking',
            'You both get $10 credit automatically',
          ].map((text, i) => (
            <Inline key={i} spacing="md">
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.accentMuted,
                  borderWidth: 1,
                  borderColor: colors.accentMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Text
                  variant="caption"
                  style={{ color: colors.accent, fontWeight: '700' }}
                >
                  {i + 1}
                </Text>
              </View>
              <Text variant="small" style={{ flex: 1 }}>
                {text}
              </Text>
            </Inline>
          ))}
        </Surface>

        {/* Stats card */}
        <Surface
          elevation="subtle"
          padding={0}
          style={{
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <Stack
            spacing="xs"
            align="center"
            style={{ flex: 1, paddingVertical: spacing.base + 2 }}
          >
            <Text variant="h1">0</Text>
            <Text variant="caption" color="secondary">
              Friends joined
            </Text>
          </Stack>

          <View
            style={{ width: 1, backgroundColor: colors.border }}
          />

          <Stack
            spacing="xs"
            align="center"
            style={{ flex: 1, paddingVertical: spacing.base + 2 }}
          >
            <Text variant="h1">$0</Text>
            <Text variant="caption" color="secondary">
              Earned
            </Text>
          </Stack>
        </Surface>

        {/* Share CTA */}
        <Button
          variant="primary"
          label="Share my code"
          onPress={handleShare}
          icon={<Feather name="share-2" size={18} color={colors.textPrimary} />}
          style={{ marginTop: spacing.xs, minHeight: 54 }}
        />
      </ScrollView>
    </View>
  );
}
