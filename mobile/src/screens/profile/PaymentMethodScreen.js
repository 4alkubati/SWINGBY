// PaymentMethodScreen — how money moves on SwingBy today.
//
// This screen used to be a Stripe stub: a "COMING SOON" badge, a decorative
// fake credit card, and an "Add card" button whose only behaviour was a
// "Coming soon" toast. There is no payment-method MANAGEMENT endpoint on the
// backend, so nothing on it was ever real.
//
// It is no longer linked from the client Profile menu. It stays registered
// because the business "Account" section still links here, so instead of a
// half-built feature it now states the shipped payment model plainly:
// the client is charged when the job is confirmed, SwingBy holds the money,
// and the business is paid out after completion. Cash / e-transfer jobs are
// recorded, not charged.
//
// IT IS ALSO THE CARD-RETENTION DISCLOSURE. The payment sheet creates its
// PaymentIntent with `setup_future_usage='off_session'`
// (backend/app/services/stripe_payment_sheet.py), so Stripe keeps the card on
// the client's customer record and no Stripe checkbox asks them first — which
// means the telling is ours to do. This screen used to say the exact opposite,
// that they "never have to hold a card on file", while the backend was about
// to start doing precisely that. If card retention is ever turned off, the
// "Your card is saved for next time" step goes with it.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { show as showToast } from '../../services/toast';
import {
  listCards,
  addCard,
  removeCard,
  describeCard,
  isExpired,
} from '../../services/cards';
import {
  isNativePaySupported,
  PaymentCancelledError,
  NativePayUnavailableError,
} from '../../services/nativePay';

const STEPS = [
  {
    icon: 'lock',
    title: 'Payment is taken up front',
    body: 'When you accept a quote, the full amount is charged and held by Swingbyy — not sent to the business yet.',
  },
  {
    icon: 'credit-card',
    title: 'Your card is saved for next time',
    body: 'The card you pay with is stored securely by Stripe, so booking again takes one tap instead of retyping it. Swingbyy never sees your card number. Add or remove cards below, any time.',
  },
  {
    icon: 'check-circle',
    title: 'Released when the job is done',
    // This said "half is released once the booking is confirmed and the rest on
    // completion" — the staged 50/50 split that does not exist in the code and
    // had already been pulled from the store listing and five marketing files.
    // escrow.py is the authority: the money is released when the client
    // approves, or automatically 24h after the business marks the work done.
    body: 'The money is released when you approve the finished work — or automatically 24 hours after the business marks it done. Swingbyy keeps a 10% platform fee.',
  },
  {
    icon: 'shield',
    title: 'Cancelled or disputed jobs',
    body: 'Cancellations are refunded against the cancellation policy, and a dispute pauses the release until it is settled.',
  },
];

export default function PaymentMethodScreen({ navigation }) {
  const { user } = useAuth();

  // `null` = not loaded. Never rendered as "no cards", which would tell someone
  // their saved card is gone when the list simply has not arrived.
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    try {
      setCards(await listCards());
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (busy) return;
    setBusy(true);
    try {
      await addCard({ email: user?.email });
      showToast({ type: 'success', text1: 'Card saved' });
      await load();
    } catch (err) {
      // Dismissing the sheet is an answer, not a failure.
      if (err instanceof PaymentCancelledError) return;
      showToast({
        type: 'error',
        text1: 'Could not save that card',
        text2:
          err instanceof NativePayUnavailableError
            ? 'Card management needs the full app build.'
            : err?.message,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(card) {
    Alert.alert(
      'Remove card?',
      `${describeCard(card)} will be removed. Any booking already paid for is unaffected.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(card.id);
            try {
              await removeCard(card.id);
              await load();
            } catch (err) {
              showToast({
                type: 'error',
                text1: 'Could not remove that card',
                text2: err?.message,
              });
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payments" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Swingbyy handles the money for every booking made in the app, so you
          never have to chase a payment or settle up on the doorstep.
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

        {/* ── Saved cards ──────────────────────────────────────────────
            This section is the whole of M2. Before it, the card Stripe kept
            after a payment was invisible: no list, no add, no delete — the
            copy above told people to contact support to remove one. */}
        <Text style={styles.sectionLabel}>YOUR CARDS</Text>
        <View style={styles.card}>
          {cards === null ? (
            <View style={styles.cardsLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : cards.length === 0 ? (
            <Text style={styles.emptyCards}>
              No saved cards. You can add one now, or just pay with a card when
              you accept a quote — it is saved either way.
            </Text>
          ) : (
            cards.map((c, i) => (
              <View
                key={c.id}
                style={[styles.stepRow, i > 0 && styles.stepRowDivider]}
              >
                <View style={styles.stepIcon}>
                  <Feather name="credit-card" size={18} color={colors.accentText} />
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{describeCard(c)}</Text>
                  <Text
                    style={[
                      styles.stepBody,
                      isExpired(c) && { color: colors.danger },
                    ]}
                  >
                    {isExpired(c)
                      ? `Expired ${c.exp_month}/${c.exp_year}`
                      : `Expires ${c.exp_month}/${c.exp_year}`}
                    {c.is_default ? ' · used by default' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(c)}
                  disabled={removing === c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${describeCard(c)}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {removing === c.id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Feather name="trash-2" size={18} color={colors.danger} />
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {isNativePaySupported() ? (
          <Button
            label="Add a card"
            variant="secondary"
            onPress={handleAdd}
            loading={busy}
            disabled={busy}
          />
        ) : (
          // Expo Go and any build without the Stripe native module. Saying so
          // beats a button that throws when tapped.
          <Text style={styles.footer}>
            Adding a card needs the full app build. You can still pay when you
            accept a quote.
          </Text>
        )}

        <Text style={styles.footer}>
          Agreed a job in cash or by e-transfer? Mark it as paid on the booking
          and Swingbyy records it — no fee is taken on off-platform payments.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

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

  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardsLoading: { padding: spacing.lg, alignItems: 'center' },
  emptyCards: {
    padding: spacing.base,
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
