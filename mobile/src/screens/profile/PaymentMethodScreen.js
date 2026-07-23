// PaymentMethodScreen — how money moves on SwingBy today.
//
// This screen used to be a Stripe stub: a "COMING SOON" badge, a decorative
// fake credit card, and an "Add card" button whose only behaviour was a
// "Coming soon" toast. There is no payment-method endpoint on the backend
// (no saved cards, no SetupIntent), so nothing on it was ever real.
//
// It is no longer linked from the client Profile menu. It stays registered
// because the business "Account" section still links here, so instead of a
// half-built feature it now states the shipped payment model plainly:
// the client is charged when the job is confirmed, SwingBy holds the money,
// and the business is paid out after completion. Cash / e-transfer jobs are
// recorded, not charged.
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';

const STEPS = [
  {
    icon: 'lock',
    title: 'Payment is taken up front',
    body: 'When you accept a quote, the full amount is charged and held by SwingBy — not sent to the business yet.',
  },
  {
    icon: 'check-circle',
    title: 'Released when the job is done',
    body: 'Half is released once the booking is confirmed and the rest on completion. SwingBy keeps a 10% platform fee.',
  },
  {
    icon: 'shield',
    title: 'Cancelled or disputed jobs',
    body: 'Cancellations are refunded against the cancellation policy, and a dispute pauses the release until it is settled.',
  },
];

export default function PaymentMethodScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          SwingBy handles the money for every booking made in the app, so you
          never have to chase a payment or hold a card on file.
        </Text>

        <View style={styles.card}>
          {STEPS.map((step, i) => (
            <View
              key={step.icon}
              style={[styles.stepRow, i > 0 && styles.stepRowDivider]}
            >
              <View style={styles.stepIcon}>
                <Feather name={step.icon} size={18} color={colors.accentText} />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Agreed a job in cash or by e-transfer? Mark it as paid on the booking
          and SwingBy records it — no fee is taken on off-platform payments.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.base,
    paddingBottom: spacing.xl,
  },

  intro: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 21,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
  },
  stepRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: { flex: 1, gap: spacing.xs },
  stepTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  stepBody: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 19,
  },

  footer: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
