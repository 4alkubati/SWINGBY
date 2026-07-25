// PaySheet — the ONE payment surface for both client payment paths.
//
// Spec: design/handoff-jet-pulse/PAYMENTS.md (section 2a "Two ways to pay" in
// SwingBy All Screens.dc.html). Two entry points, one sheet:
//
//   mode="hold"  Path A — client posts a job.   Title "Hold payment", CTA "Confirm & hold $X"
//   mode="pay"   Path B — client accepts a quote. Title "Pay quote",   CTA "Confirm & pay $X"
//
// HARD RULE (PAYMENTS.md §The rule): no dollar figure appears on any button,
// note or bubble BEFORE this sheet opens. Entry CTAs read "Post job & pay" and
// "Accept & pay" with no figure. The client-side service fee is added HERE.
//
// HARD RULE (PAYMENTS.md §Release/refunds): amounts, fees and refunds are
// server-authoritative. This file NEVER adds two numbers together. It renders
// the line items the server hands back and the total the server hands back. If
// the fee endpoint is not deployed, it renders the single server-held figure
// for the job and no invented fee row — see fetchPayQuote below.
//
// Deliberately built on react-native's own <Modal> rather than the repo's
// Reanimated <BottomSheet>: this sheet opens during a screen transition (post →
// success, accept → chat) and a Reanimated commit landing inside React's own
// commit for the same shadow tree is what deadlocked ShadowTree::mount in
// production (Sentry SEN-2 / walkthrough B8). Platform-default slide only.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import { api } from '../services/api';
import i18n from '../i18n';
import { colors, radius, spacing } from '../theme/tokens';

// Local token — the sheet scrim from PAYMENTS.md ("rgba(4,5,7,0.68)"). Not in
// theme/tokens.js because Lane 4 owns that file this session; promote it to
// `colors.scrim` when the lanes merge.
const SCRIM = 'rgba(4,5,7,0.68)';

// ─── Money formatting ────────────────────────────────────────────────────────
// Formats ONE server-supplied number. Never sums, never derives.
export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
}

// CTA / headline form — "$189" not "$189.00" (matches the mock).
export function formatMoneyShort(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

// ─── Server quote ────────────────────────────────────────────────────────────
// Shape returned to the sheet and to onConfirm:
//   { summary, lines: [{ key, label, value }], total, totalLabel,
//     method, provisional }
//
// `provisional: true` means the pricing endpoint was not reachable and the
// sheet is showing the single amount the server already holds for this job
// (the client's own budget on Path A, the business's quoted_price on Path B)
// with no fee line. It is still a server-held number — it is just not a
// server-computed TOTAL. Callers may use it to decide whether to hard-block.
function isMissingEndpoint(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('405') ||
    msg.includes('method not allowed') ||
    msg.includes('not implemented')
  );
}

function normaliseQuote(res, fallbackSummary, mode) {
  const lines = Array.isArray(res.lines)
    ? res.lines
        .filter((l) => l && l.value != null)
        .map((l, i) => ({
          key: l.key || `line-${i}`,
          label: l.label || '',
          value: l.value,
        }))
    : [];

  return {
    summary: res.summary || fallbackSummary || '',
    lines,
    total: res.total,
    totalLabel:
      res.total_label ||
      (mode === 'hold'
        ? i18n.t('pay.onHoldToday')
        : i18n.t('pay.total')),
    method: res.method || null,
    provisional: false,
  };
}

/**
 * Ask the server what this costs.
 *
 * Tries POST /payments/quote first — that is where a real client-side service
 * fee will live. When that endpoint is not deployed the sheet falls back to the
 * one figure the server already holds for this job and shows a single line. No
 * arithmetic happens on the device in either branch.
 *
 * @param {'hold'|'pay'} mode
 * @param {number} amount    server-held amount (post budget / quoted_price)
 * @param {string} [bookingId]
 * @param {string} [interestId]
 * @param {string} [summary] "Deep clean · Sat, Jul 11"
 */
export async function fetchPayQuote({ mode, amount, bookingId, interestId, summary }) {
  try {
    const res = await api.post('/payments/quote', {
      mode,
      amount,
      booking_id: bookingId || undefined,
      interest_id: interestId || undefined,
    });
    if (res && res.total != null) return normaliseQuote(res, summary, mode);
  } catch (err) {
    // A genuine failure (network, 500, auth) must surface — only a
    // not-yet-deployed endpoint falls through to the single-line render.
    if (!isMissingEndpoint(err)) throw err;
  }

  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(i18n.t('pay.noAmount'));
  }

  return {
    summary: summary || '',
    lines: [
      {
        key: 'subtotal',
        label: mode === 'hold' ? i18n.t('pay.jobTotal') : i18n.t('pay.quote'),
        value: n,
      },
    ],
    total: n,
    totalLabel: mode === 'hold' ? i18n.t('pay.onHoldToday') : i18n.t('pay.total'),
    method: null,
    provisional: true,
  };
}

// ─── Pieces ──────────────────────────────────────────────────────────────────
function GrabHandle() {
  return <View style={styles.grab} />;
}

function AmountRow({ label, value }) {
  return (
    <View style={styles.amountRow}>
      <Text variant="small" color="secondary" style={styles.amountLabel}>
        {label}
      </Text>
      <Text style={styles.amountValue}>{formatMoney(value)}</Text>
    </View>
  );
}

function BreakdownSkeleton() {
  return (
    <View style={styles.breakdown}>
      <View style={[styles.skelLine, { width: '58%' }]} />
      <View style={[styles.skelLine, { width: '42%' }]} />
      <View style={styles.divider} />
      <View style={[styles.skelLine, { width: '70%', height: 22 }]} />
    </View>
  );
}

// PAY WITH — selection is an accent BORDER, never a checkmark (PAYMENTS.md §3).
function PaymentMethodRow({ method, declined, onAddMethod }) {
  if (!method) {
    return (
      <Pressable
        onPress={onAddMethod}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('pay.addMethod')}
        style={({ pressed }) => [styles.addMethod, pressed && styles.pressed]}
      >
        <Feather name="plus" size={16} color={colors.accentText} strokeWidth={1.8} />
        <Text style={styles.addMethodText}>{i18n.t('pay.addMethod')}</Text>
      </Pressable>
    );
  }

  const brand = (method.brand || 'CARD').toUpperCase();
  return (
    <View style={[styles.methodCard, declined && styles.methodCardDeclined]}>
      <View style={styles.brandTile}>
        <Text style={styles.brandText} numberOfLines={1}>
          {brand.slice(0, 4)}
        </Text>
      </View>
      <View style={styles.methodInfo}>
        <Text variant="smallMedium" numberOfLines={1}>
          •••• {method.last4 || '••••'}
        </Text>
        <Text style={styles.methodExpiry}>
          {method.exp_month && method.exp_year
            ? i18n.t('pay.expires', {
                date: `${String(method.exp_month).padStart(2, '0')}/${String(method.exp_year).slice(-2)}`,
              })
            : i18n.t('pay.savedCard')}
        </Text>
      </View>
      <Pressable
        onPress={onAddMethod}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('pay.change')}
      >
        <Text style={styles.changeLink}>{i18n.t('pay.change')}</Text>
      </Pressable>
    </View>
  );
}

// ─── PaySheet ────────────────────────────────────────────────────────────────
/**
 * @param {boolean}  visible
 * @param {'hold'|'pay'} mode
 * @param {number}   amount     server-held amount for this job
 * @param {string}   summary    "Deep clean · Sat, Jul 11"
 * @param {object}   [method]   { brand, last4, exp_month, exp_year } or null
 * @param {string}   [bookingId]
 * @param {string}   [interestId]
 * @param {Function} onClose
 * @param {Function} onConfirm  async (quote) => void. Throw to show the error
 *                              inline and re-enable the CTA. Resolve to close.
 * @param {Function} [onAddMethod]
 */
export default function PaySheet({
  visible,
  mode = 'hold',
  amount,
  summary,
  method = null,
  bookingId,
  interestId,
  onClose,
  onConfirm,
  onAddMethod,
}) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  // Guards every setState against a sheet that has been dismissed mid-request.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const q = await fetchPayQuote({ mode, amount, bookingId, interestId, summary });
      if (!alive.current) return;
      setQuote(q);
    } catch (err) {
      if (!alive.current) return;
      setLoadError(err?.message || i18n.t('pay.quoteError'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [mode, amount, bookingId, interestId, summary]);

  // Fetch on open; wipe transient state on close so a reopen is never showing
  // a previous attempt's decline.
  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setError('');
      setStale(false);
      return;
    }
    setQuote(null);
    load();
  }, [visible, load]);

  const canConfirm = !!quote && !!method && !busy && !loading;

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError('');
    setStale(false);
    try {
      // Never charge a stale amount (PAYMENTS.md §States). Re-price immediately
      // before charging; if the total moved under the client, stop and show the
      // new figure instead of taking the old one.
      const fresh = await fetchPayQuote({ mode, amount, bookingId, interestId, summary });
      if (!alive.current) return;
      if (quote && fresh.total !== quote.total) {
        setQuote(fresh);
        setStale(true);
        setBusy(false);
        return;
      }
      await onConfirm?.(fresh);
      if (alive.current) setBusy(false);
    } catch (err) {
      if (!alive.current) return;
      setError(err?.message || i18n.t('pay.declined'));
      setBusy(false);
    }
  }

  const title = mode === 'hold' ? i18n.t('pay.titleHold') : i18n.t('pay.titlePay');
  const ctaVerb = mode === 'hold' ? i18n.t('pay.ctaHold') : i18n.t('pay.ctaPay');
  const ctaLabel = quote ? `${ctaVerb} ${formatMoneyShort(quote.total)}` : ctaVerb;

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.cancel')}
        />

        <View style={styles.panel}>
          <GrabHandle />

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {/* 1 · Title block */}
            <View style={styles.titleBlock}>
              <Text style={styles.title}>{title}</Text>
              {!!(quote?.summary || summary) && (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {quote?.summary || summary}
                </Text>
              )}
            </View>

            {/* 2 · Breakdown card — loading / error / ready */}
            {loading && <BreakdownSkeleton />}

            {!loading && !!loadError && (
              <View style={styles.breakdown}>
                <Text variant="small" color="secondary">{loadError}</Text>
                <Pressable
                  onPress={load}
                  accessibilityRole="button"
                  accessibilityLabel={i18n.t('common.retry')}
                  style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
                >
                  <Feather name="refresh-cw" size={14} color={colors.accentText} strokeWidth={1.8} />
                  <Text style={styles.retryText}>{i18n.t('common.retry')}</Text>
                </Pressable>
              </View>
            )}

            {!loading && !loadError && !!quote && (
              <View style={styles.breakdown}>
                {quote.lines.map((line) => (
                  <AmountRow key={line.key} label={line.label} value={line.value} />
                ))}
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{quote.totalLabel}</Text>
                  <Text style={styles.totalValue}>{formatMoney(quote.total)}</Text>
                </View>
              </View>
            )}

            {/* 3 · PAY WITH */}
            <View style={styles.section}>
              <Text variant="label" color="secondary" style={styles.sectionLabel}>
                {i18n.t('pay.payWith')}
              </Text>
              <PaymentMethodRow
                method={method}
                declined={!!error}
                onAddMethod={onAddMethod}
              />
            </View>

            {/* Amount moved under them */}
            {stale && (
              <View style={styles.warnChip}>
                <Feather name="alert-circle" size={13} color={colors.warning} strokeWidth={1.8} />
                <Text style={styles.warnText}>{i18n.t('pay.amountChanged')}</Text>
              </View>
            )}

            {/* Declined / charge error */}
            {!!error && (
              <View style={styles.errorChip}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* 4 · Escrow caption */}
            <View style={styles.escrowRow}>
              <Feather
                name="lock"
                size={13}
                color={colors.textSecondary}
                strokeWidth={1.8}
                style={styles.lockIcon}
              />
              <Text style={styles.escrowText}>{i18n.t('pay.escrow')}</Text>
            </View>

            {/* 5 · CTA */}
            <Pressable
              disabled={!canConfirm}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
              accessibilityState={{ disabled: !canConfirm, busy }}
              style={({ pressed }) => [
                styles.cta,
                !canConfirm && styles.ctaDisabled,
                pressed && canConfirm && styles.ctaPressed,
              ]}
            >
              {busy ? (
                <View style={styles.ctaBusy}>
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                  <Text style={styles.ctaText}>
                    {mode === 'hold' ? i18n.t('pay.holding') : i18n.t('pay.paying')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              )}
            </Pressable>

            {!method && (
              <Text style={styles.noMethodHint}>{i18n.t('pay.noMethodHint')}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: SCRIM },

  // Panel: #0F1115, top border, radius 24/24/0/0, padding 12 20 32, gap 16.
  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 24,
  },
  grab: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  body: {
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.base,
  },

  titleBlock: { gap: spacing.xs },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Breakdown card — #161A21, radius 16, padding 14, gap 9.
  breakdown: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    gap: 9,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  amountLabel: { flexShrink: 1 },
  amountValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  divider: { height: 1, backgroundColor: colors.border },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  totalValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  skelLine: {
    height: 14,
    borderRadius: radius.chip,
    backgroundColor: colors.border,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  retryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.accentText,
  },

  section: { gap: spacing.sm },
  sectionLabel: { letterSpacing: 1.2, fontSize: 11 },

  // Selected method — accent border, not a checkmark.
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  methodCardDeclined: { borderColor: colors.danger },
  brandTile: {
    width: 38,
    height: 26,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
  },
  methodInfo: { flex: 1, gap: 2 },
  methodExpiry: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  changeLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.accentText,
  },

  // No card on file — dashed row that pushes PaymentMethodScreen.
  addMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentMuted,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
  },
  addMethodText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: colors.accentText,
  },

  warnChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(246,178,59,0.14)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  warnText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.warning,
  },
  errorChip: {
    backgroundColor: 'rgba(255,92,92,0.14)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },

  escrowRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lockIcon: { marginTop: 2 },
  escrowText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  cta: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  ctaBusy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.textPrimary,
  },
  noMethodHint: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  pressed: { opacity: 0.9 },
});
