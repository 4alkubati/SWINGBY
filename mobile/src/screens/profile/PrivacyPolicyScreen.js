// T52 — PrivacyPolicyScreen (UX polish pass)
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';

const LAST_UPDATED = 'June 2026';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `When you use SwingBy, we collect information you provide directly to us, such as when you create an account, post a job, send a message, or contact support.\n\n` +
      `This includes: name, email address, phone number, location data (for matching you with nearby service providers), payment information (processed securely via our payment partner), and photos you upload as part of a job post or proof of work.\n\n` +
      `We also automatically collect certain usage data, including device identifiers, app interaction logs, and IP address.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use the information we collect to:\n\n` +
      `• Operate and improve the SwingBy platform\n` +
      `• Match clients with service providers in their area\n` +
      `• Process payments and protect both parties through escrow\n` +
      `• Send you booking confirmations, status updates, and service notifications\n` +
      `• Respond to your questions and support requests\n` +
      `• Detect and prevent fraud or abuse\n\n` +
      `We do not sell your personal information to third parties. We may share limited data with service providers who help us operate the platform (e.g., payment processors, push notification services).`,
  },
  {
    title: '3. Your Rights & Data Retention',
    body: `You have the right to access, correct, or delete your personal data at any time. You can export your data directly from Settings → Export my data. To delete your account and all associated data, go to Settings → Delete my account.\n\n` +
      `We retain your data for as long as your account is active, or as required by applicable law. Upon account deletion, we purge personally identifiable information within 30 days, except where retention is legally required.\n\n` +
      `For privacy questions or requests, contact us at: privacy@swingbyy.com\n\n` +
      `This policy may be updated periodically. We will notify you of material changes through the app.`,
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
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
          hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>

        <Text variant="h2">Privacy Policy</Text>

        {/* spacer to balance the back button */}
        <View style={{ width: 40 }} />
      </Inline>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack spacing="xs">
          <Text variant="display3">Privacy Policy</Text>
          <Text variant="caption" color="secondary">Last updated: {LAST_UPDATED}</Text>
        </Stack>

        <Text variant="body" color="secondary">
          SwingBy ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information when you use our app.
        </Text>

        {SECTIONS.map((section, i) => (
          <Surface key={i} elevation="subtle" rounded="card" padding="base">
            <Stack spacing="sm">
              <Text variant="bodyMedium">{section.title}</Text>
              <Text variant="body">{section.body}</Text>
            </Stack>
          </Surface>
        ))}

        {/* Contact card */}
        <Surface
          elevation="subtle"
          background="alt"
          rounded="card"
          padding="base"
          style={{ alignItems: 'center', borderColor: colors.borderAccent }}
        >
          <Feather name="mail" size={16} strokeWidth={1.8} color={colors.accentText} style={{ marginBottom: spacing.xs }} />
          <Text variant="bodyMedium" style={{ marginBottom: spacing.xs }}>Questions?</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
            Email us at{' '}
            <Text variant="small" style={{ color: colors.accentText }}>privacy@swingbyy.com</Text>
            {' '}or{' '}
            <Text variant="small" style={{ color: colors.accentText }}>4alkubati@gmail.com</Text>
          </Text>
        </Surface>
      </ScrollView>
    </View>
  );
}
