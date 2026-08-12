// WalletScreen — D5. Where a business takes its money out.
//
// Kira, 2026-08-04: "a business needs to take the money out, and they can in an
// instant." This is that surface: available balance, Stripe Connect onboarding,
// and the cash-out button.
//
// WHAT IT IS ALLOWED TO SAY
// -------------------------
// Every figure here comes from `GET /businesses/me/payouts`, which derives it
// from the payments ledger — capture-backed rows only, so FINDING C's phantom
// releases contribute nothing. The screen does no money math of its own, on
// purpose: `M10` was a pay sheet that priced itself on the device and was only
// accidentally right.
//
// It also never promises a rail it has not been given. `instant_available`
// predicts what a cash-out WOULD use; the payout row's own `method` is what it
// DID use, and the history list renders that value alone. A payout row with no
// method (it failed before Stripe accepted it) prints no rail at all rather
// than defaulting to a reassuring word.
//
// DESIGN (design/DESIGN-SYSTEM.md, binding)
// -----------------------------------------
// Cards surface/#0F1115 + 1px border/#1F232B + radius.card/20. Buttons come
// from <Button> (12px radius, 52px tall, never pills). Money is
// colors.success/#2EBD85. Feather icons only, zero emoji. Exactly ONE purple
// CTA on screen at a time — it is "Set up payouts" while onboarding is
// outstanding and "Cash out" once it is done, never both.
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import { SkeletonBox } from '../../components/Skeleton';
import { api, extractMessage } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';
import i18n from '../../i18n';

// ─── Money formatting ─────────────────────────────────────────────────────────
// Integer cents in, dollars out. The server is authoritative on cents; this is
// presentation only and must never round in a direction that changes a total.
function formatCents(cents) {
  const value = (Number(cents) || 0) / 100;
  return (
    '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Payout status → label + colour ───────────────────────────────────────────
// Mirrors Stripe's own vocabulary, which is what the API stores. `pending` and
// `in_transit` are deliberately different words: one is "we have not sent it
// yet", the other is "it is on its way and you are waiting on a bank".
const STATUS_TONE = {
  paid: colors.success,
  in_transit: colors.warning,
  pending: colors.textSecondary,
  failed: colors.danger,
  canceled: colors.textSecondary,
};

function statusLabel(status) {
  return i18n.t(`wallet.status.${status}`, {
    defaultValue: i18n.t('wallet.status.pending'),
  });
}

// ─── Balance hero ─────────────────────────────────────────────────────────────
function BalanceHero({ loading, wallet }) {
  if (loading) {
    return (
      <View style={styles.hero}>
        <SkeletonBox width={200} height={48} borderRadius={14} />
        <SkeletonBox width={140} height={16} borderRadius={8} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <Text variant="caption" style={styles.heroEyebrow}>
        {i18n.t('wallet.availableLabel')}
      </Text>
      <Text style={styles.heroAmount} accessibilityRole="header">
        {formatCents(wallet?.available_cents)}
      </Text>
      {/* Says WHICH number this is. A bare figure on a money screen is the
          thing the walkthrough kept flagging — "THIS WEEK" counted unpaid
          bookings and nobody could tell. */}
      <Text variant="small" color="secondary" style={styles.heroCaption}>
        {i18n.t('wallet.availableCaption')}
      </Text>
    </View>
  );
}

// ─── Ledger breakdown ─────────────────────────────────────────────────────────
// Both halves of the balance, so an owner who disagrees with the headline can
// see which side is wrong instead of filing a support ticket that says "the
// number is off".
function LedgerRows({ wallet }) {
  return (
    <View style={styles.card}>
      <View style={styles.ledgerRow}>
        <Text variant="small" color="secondary">{i18n.t('wallet.lifetimeEarned')}</Text>
        <Text variant="smallMedium" style={styles.mono}>
          {formatCents(wallet?.lifetime_earned_cents)}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.ledgerRow}>
        <Text variant="small" color="secondary">{i18n.t('wallet.alreadyPaidOut')}</Text>
        <Text variant="smallMedium" style={styles.mono}>
          {formatCents(wallet?.paid_out_cents)}
        </Text>
      </View>
    </View>
  );
}

// ─── Connect / onboarding card ────────────────────────────────────────────────
// One card, five states. The copy for each is keyed off the server's `state`
// field rather than re-derived from booleans here — the device deciding what
// "ready" means is how two screens end up disagreeing about the same account.
function AccountCard({ account, onSetup, onManage, busy }) {
  const state = account?.state || 'none';

  if (state === 'ready') {
    const instant = !!account?.instant_available;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBubble, { backgroundColor: colors.successTint }]}>
            <Feather name="check-circle" size={18} color={colors.success} strokeWidth={1.8} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text variant="smallMedium">{i18n.t('wallet.accountReadyTitle')}</Text>
            {/* Names the rail this business will actually get, and names the
                card behind it when there is one. No "instant" on a standard
                path — that is a lie with a 1-3 business-day tail. */}
            <Text variant="caption" color="secondary" style={styles.cardHeaderSub}>
              {instant
                ? account?.instant_source_last4
                  ? i18n.t('wallet.railInstantCard', { last4: account.instant_source_last4 })
                  : i18n.t('wallet.railInstant')
                : i18n.t('wallet.railStandard')}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('wallet.managePayoutMethod')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        >
          <Text variant="smallMedium" style={{ color: colors.accentText }}>
            {i18n.t('wallet.managePayoutMethod')}
          </Text>
          <Feather name="external-link" size={16} color={colors.accentText} strokeWidth={1.8} />
        </Pressable>
      </View>
    );
  }

  const copy = {
    none: {
      icon: 'credit-card',
      tint: colors.accentTint,
      color: colors.accentText,
      title: i18n.t('wallet.setupTitle'),
      body: i18n.t('wallet.setupBody'),
      cta: i18n.t('wallet.setupCta'),
    },
    incomplete: {
      icon: 'clock',
      tint: colors.warningTint,
      color: colors.warning,
      title: i18n.t('wallet.incompleteTitle'),
      body: i18n.t('wallet.incompleteBody'),
      cta: i18n.t('wallet.incompleteCta'),
    },
    pending: {
      icon: 'clock',
      tint: colors.warningTint,
      color: colors.warning,
      title: i18n.t('wallet.pendingTitle'),
      body: i18n.t('wallet.pendingBody'),
      cta: i18n.t('wallet.pendingCta'),
    },
    restricted: {
      icon: 'alert-triangle',
      tint: colors.dangerTint,
      color: colors.danger,
      title: i18n.t('wallet.restrictedTitle'),
      body: i18n.t('wallet.restrictedBody'),
      cta: i18n.t('wallet.restrictedCta'),
    },
  }[state] || {
    icon: 'credit-card',
    tint: colors.accentTint,
    color: colors.accentText,
    title: i18n.t('wallet.setupTitle'),
    body: i18n.t('wallet.setupBody'),
    cta: i18n.t('wallet.setupCta'),
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBubble, { backgroundColor: copy.tint }]}>
          <Feather name={copy.icon} size={18} color={copy.color} strokeWidth={1.8} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text variant="smallMedium">{copy.title}</Text>
          <Text variant="caption" color="secondary" style={styles.cardHeaderSub}>
            {copy.body}
          </Text>
        </View>
      </View>

      {/* Stripe's own reason, verbatim, when it has paused the account. A
          generic "something went wrong" here is a dead end — this is the only
          text that tells the owner what to actually go and fix. */}
      {!!account?.disabled_reason && (
        <Text variant="caption" color="secondary" style={styles.reasonText}>
          {i18n.t('wallet.stripeReason', { reason: account.disabled_reason })}
        </Text>
      )}

      <Button
        variant="primary"
        label={copy.cta}
        onPress={onSetup}
        loading={busy}
        style={{ marginTop: spacing.base }}
      />
    </View>
  );
}

// ─── One payout row ───────────────────────────────────────────────────────────
function PayoutRow({ payout, last }) {
  const arrival = formatDate(payout.arrival_date) || formatDate(payout.created_at);
  const tone = STATUS_TONE[payout.status] || colors.textSecondary;

  return (
    <View style={[styles.payoutRow, !last && styles.payoutRowBorder]}>
      <View style={styles.payoutMain}>
        <Text variant="smallMedium" style={styles.mono}>
          {formatCents(payout.amount_cents)}
        </Text>
        <Text variant="caption" color="secondary">
          {/* A payout that failed before Stripe accepted it has no rail, so it
              prints none. Defaulting to "standard" would invent a fact. */}
          {[payout.method ? i18n.t(`wallet.method.${payout.method}`) : null, arrival]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {!!payout.failure_reason && payout.status === 'failed' && (
          <Text variant="caption" style={{ color: colors.danger }}>
            {payout.failure_reason}
          </Text>
        )}
      </View>
      <Text variant="caption" style={{ color: tone }}>
        {statusLabel(payout.status)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WalletScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/businesses/me/payouts');
      setWallet(data);
      setError(null);
    } catch (e) {
      setError(extractMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-read whenever the screen regains focus. This is the RETURN half of
  // Stripe's onboarding handshake: the browser tab has no way to call back into
  // the app (Stripe account links require an https return_url and reject a
  // custom scheme), so the app re-reads status when it comes forward again —
  // whichever way the tab was dismissed, and without depending on the
  // swingbyy.com return page existing.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const account = wallet?.account || { state: 'none' };
  const payouts = wallet?.payouts || [];
  const canCashOut =
    account.state === 'ready' && (wallet?.available_cents || 0) > 0 && !cashingOut;

  // ── Onboarding ─────────────────────────────────────────────────────────────
  const handleSetup = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.post('/businesses/me/payout-account');
      if (res?.onboarding_url) {
        await WebBrowser.openBrowserAsync(res.onboarding_url);
        // Dismissal is not success — Stripe may have been abandoned halfway.
        // Re-read rather than assume; the server is the only thing that knows.
        await load();
      }
    } catch (e) {
      Alert.alert(i18n.t('wallet.setupFailedTitle'), extractMessage(e));
    } finally {
      setBusy(false);
    }
  }, [load]);

  const handleManage = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.post('/businesses/me/payout-account/login');
      if (res?.url) {
        await WebBrowser.openBrowserAsync(res.url);
        await load();
      }
    } catch (e) {
      Alert.alert(i18n.t('wallet.manageFailedTitle'), extractMessage(e));
    } finally {
      setBusy(false);
    }
  }, [load]);

  // ── Cash out ───────────────────────────────────────────────────────────────
  // Confirmed first. It moves real money and there is no undo, and the confirm
  // body names the rail so nobody taps "instant" expecting same-day when the
  // account only has a bank account behind it.
  const doCashOut = useCallback(async () => {
    setCashingOut(true);
    try {
      const res = await api.post('/businesses/me/payouts');
      // Report the rail the SERVER used, never the one we predicted.
      const body =
        res?.method === 'instant'
          ? i18n.t('wallet.cashOutDoneInstant', { amount: formatCents(res.amount_cents) })
          : i18n.t('wallet.cashOutDoneStandard', { amount: formatCents(res?.amount_cents) });
      Alert.alert(i18n.t('wallet.cashOutDoneTitle'), body);
      await load();
    } catch (e) {
      Alert.alert(i18n.t('wallet.cashOutFailedTitle'), extractMessage(e));
    } finally {
      setCashingOut(false);
    }
  }, [load]);

  const handleCashOut = useCallback(() => {
    const amount = formatCents(wallet?.available_cents);
    Alert.alert(
      i18n.t('wallet.cashOutConfirmTitle'),
      account.instant_available
        ? i18n.t('wallet.cashOutConfirmInstant', { amount })
        : i18n.t('wallet.cashOutConfirmStandard', { amount }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        { text: i18n.t('wallet.cashOutCta'), onPress: doCashOut },
      ],
    );
  }, [wallet, account, doCashOut]);

  return (
    <View style={styles.container}>
      <ScreenHeader title={i18n.t('wallet.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* Error state is styled, not a bare string (POLISH-TIPS §10.5). */}
        {error && !loading ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBubble, { backgroundColor: colors.dangerTint }]}>
                <Feather name="alert-circle" size={18} color={colors.danger} strokeWidth={1.8} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text variant="smallMedium">{i18n.t('wallet.errorTitle')}</Text>
                <Text variant="caption" color="secondary" style={styles.cardHeaderSub}>
                  {error}
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              label={i18n.t('common.retry')}
              onPress={() => { setLoading(true); load(); }}
              style={{ marginTop: spacing.base }}
            />
          </View>
        ) : (
          <>
            <BalanceHero loading={loading} wallet={wallet} />

            {!loading && (
              <>
                {/* Cash out. Purple only when it is THE action on this screen —
                    while onboarding is outstanding the purple lives on the
                    setup CTA below and this drops to secondary, so there is
                    never more than one primary (README §2). */}
                <View style={styles.ctaWrap}>
                  <Button
                    variant={account.state === 'ready' ? 'primary' : 'secondary'}
                    label={i18n.t('wallet.cashOutCta')}
                    onPress={handleCashOut}
                    disabled={!canCashOut}
                    loading={cashingOut}
                  />
                  {account.state === 'ready' && (wallet?.available_cents || 0) <= 0 && (
                    <Text variant="caption" color="secondary" style={styles.ctaHint}>
                      {i18n.t('wallet.nothingToCashOut')}
                    </Text>
                  )}
                </View>

                <AccountCard
                  account={account}
                  onSetup={handleSetup}
                  onManage={handleManage}
                  busy={busy}
                />

                <LedgerRows wallet={wallet} />

                {/* History */}
                <Text variant="smallMedium" style={styles.sectionTitle}>
                  {i18n.t('wallet.historyTitle')}
                </Text>
                {payouts.length === 0 ? (
                  <EmptyState
                    icon="send"
                    title={i18n.t('wallet.emptyTitle')}
                    body={i18n.t('wallet.emptyBody')}
                  />
                ) : (
                  <View style={styles.card}>
                    {payouts.map((p, i) => (
                      <PayoutRow key={p.id || i} payout={p} last={i === payouts.length - 1} />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.base },

  // Hero
  hero: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm },
  heroEyebrow: {
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heroAmount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.5,
    color: colors.success,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  heroCaption: { marginTop: spacing.xs, textAlign: 'center' },

  ctaWrap: { gap: spacing.sm },
  ctaHint: { textAlign: 'center' },

  // Cards — surface + 1px border + 20 radius (DESIGN-SYSTEM non-negotiables).
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardHeaderText: { flex: 1, gap: 2 },
  cardHeaderSub: { lineHeight: 18 },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonText: { marginTop: spacing.md, lineHeight: 18 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
    minHeight: 44,
  },
  linkRowPressed: { opacity: 0.7 },

  // Ledger
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  divider: { height: 1, backgroundColor: colors.border },
  mono: { fontVariant: ['tabular-nums'] },

  sectionTitle: { marginTop: spacing.sm },

  // History
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  payoutRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  payoutMain: { flex: 1, gap: 2 },
});
