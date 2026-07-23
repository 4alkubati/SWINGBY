// T53 — TermsOfServiceScreen (UX polish pass)
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
    title: '1. Use of the Platform',
    body: `By creating an account on SwingBy, you agree to use the platform only for lawful purposes. You must be at least 18 years old to create an account.\n\n` +
      `Clients ("users") may post service requests and accept quotes from service providers. Service providers ("businesses") may submit quotes and complete booked jobs through the platform.\n\n` +
      `You agree not to: misrepresent your identity or credentials, post fraudulent job listings or quotes, attempt to circumvent the platform's payment system, or engage in harassment or abusive behaviour toward other users.\n\n` +
      `SwingBy reserves the right to suspend or terminate accounts that violate these terms.`,
  },
  {
    title: '2. Payments, Escrow & Refunds',
    body: `All payments on SwingBy are processed through our payment partner. When a client accepts a quote, payment is held in escrow until the job is marked complete by the service provider and photo proof is submitted.\n\n` +
      `Payment is automatically released to the service provider upon job completion. In cases of dispute, SwingBy may hold payment pending investigation.\n\n` +
      `Cancellations by the client are subject to a ladder measured against the confirmed date: more than 48 hours before, you are refunded in full; within 48 hours, 75% is refunded and 25% goes to the business; if the confirmed time has already passed, 50% is refunded. If no date has been confirmed yet, you are refunded in full.\n\n` +
      `If the business cancels, you are refunded in full regardless of timing, and a goodwill credit is applied to your account for late or no-show cancellations.\n\n` +
      `If a dispute arises after work has started, SwingBy will review submitted evidence (photos, messages) and make a final determination.\n\n` +
      `SwingBy charges a platform fee on each completed transaction. This fee is disclosed at the time of booking.`,
  },
  {
    title: '3. Disclaimers & Limitation of Liability',
    body: `SwingBy is a marketplace that connects clients with independent service providers. We do not employ service providers, and we are not responsible for the quality, safety, legality, or completion of services performed.\n\n` +
      `We verify business licenses where indicated by a "Verified" badge, but verification does not constitute an endorsement or guarantee of service quality.\n\n` +
      `To the maximum extent permitted by law, SwingBy's liability for any claim arising from your use of the platform is limited to the amount you paid for the relevant transaction.\n\n` +
      `These terms are governed by the laws of Alberta, Canada. For questions, contact legal@swingbyy.com`,
  },
];

export default function TermsOfServiceScreen() {
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

        <Text variant="h2">Terms of Service</Text>

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
          <Text variant="display3">Terms of Service</Text>
          <Text variant="caption" color="secondary">Last updated: {LAST_UPDATED}</Text>
        </Stack>

        <Text variant="body" color="secondary">
          Please read these Terms of Service carefully before using SwingBy. By accessing or using our platform, you agree to be bound by these terms.
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
          <Feather name="file-text" size={16} strokeWidth={1.8} color={colors.accentText} style={{ marginBottom: spacing.xs }} />
          <Text variant="bodyMedium" style={{ marginBottom: spacing.xs }}>Legal questions?</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
            Email{' '}
            <Text variant="small" style={{ color: colors.accentText }}>legal@swingbyy.com</Text>
            {' '}or{' '}
            <Text variant="small" style={{ color: colors.accentText }}>4alkubati@gmail.com</Text>
          </Text>
        </Surface>
      </ScrollView>
    </View>
  );
}
