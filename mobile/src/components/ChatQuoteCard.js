// ChatQuoteCard — the quote as a bubble in the message stream (canvas 3a).
//
// Spec: design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md §"The quote card (3a)".
// (QUOTE-IN-CHAT.md is SUPERSEDED — the bubble does not float over the thread;
// canvas 4a is rejected. This renders inline, in send order, like any message.)
//
// Four states, one component:
//   pending   — actionable card. Client: Decline / Accept & pay.
//               Business: QUOTE SENT eyebrow, status row, sender-side actions.
//   accepted  — collapses to a one-line record + View link.
//   expired   — one-line record + Re-request.
//   declined  — one-line record, no action ("You can keep chatting").
//
// NO DOLLAR FIGURE may appear on the Accept button or the note above it —
// the client-side service fee is added inside the PaySheet, so the total is
// only ever shown there (design/handoff-jet-pulse/PAYMENTS.md).
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing } from '../theme/tokens';
import i18n from '../i18n';
import Text from './Text';
import { TEXT_END } from '../services/rtl';

// Local token: the quote surface's actionable border is rgba(136,120,249,0.28),
// a shade stronger than tokens.colors.borderAccent (0.25) which marks merely
// "new" cards. Lane 4 owns theme/tokens.js — promote this there if it spreads.
const QUOTE_BORDER = 'rgba(136,120,249,0.28)';
const TINT_SUCCESS = 'rgba(46,189,133,0.14)';
const TINT_WARNING = 'rgba(246,178,59,0.14)';
const TINT_DANGER = 'rgba(255,92,92,0.14)';

export function formatMoney(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return `$${value}`;
  return `$${n.toLocaleString('en-CA', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// "in 22 h" / "in 3 d" / "expired". Quotes carry no expires_at of their own —
// callers derive it from the post (see MessagesScreen.quoteExpiry).
export function expiresLabel(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return i18n.t('quoteCard.expired');
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 1) return i18n.t('quoteCard.inMinutes', { n: Math.max(1, Math.floor(ms / 60000)) });
  if (hrs < 48) return i18n.t('quoteCard.inHours', { n: hrs });
  return i18n.t('quoteCard.inDays', { n: Math.floor(hrs / 24) });
}

function DetailRow({ label, value, valueColor }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text variant="caption" style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <Text
        variant="caption"
        numberOfLines={2}
        style={[styles.rowValue, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
    </View>
  );
}

function SecondaryButton({ label, onPress, disabled, style }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        styles.btnSecondary,
        style,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <Text variant="caption" style={styles.btnSecondaryLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─── Resolved record — one line, full width, no tail, neutral border ─────────

function ResolvedRecord({ icon, tint, iconColor, title, titleColor, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.record} accessibilityRole="summary">
      <View style={[styles.recordIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={15} strokeWidth={1.8} color={iconColor} />
      </View>
      <View style={styles.recordText}>
        <Text
          variant="caption"
          numberOfLines={1}
          style={[styles.recordTitle, titleColor ? { color: titleColor } : null]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" numberOfLines={1} style={styles.recordSubtitle}>{subtitle}</Text>
        )}
      </View>
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text variant="caption" style={styles.recordAction} numberOfLines={1}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export default function ChatQuoteCard({
  status = 'pending',        // pending | accepted | expired | declined
  side = 'client',           // whose eyes: 'client' (received) | 'business' (sent)
  price,
  service,
  when,
  expiresAt,
  statusNote,                // business pending: "Awaiting reply · 22 h left"
  paidTotal,                 // accepted record: what actually cleared
  busy = false,
  onAccept,
  onDecline,
  onView,
  onReRequest,
  onWithdraw,
  onEdit,
  canWithdraw = false,       // sent-quote mutations need an API that isn't live
  canEdit = false,
  style,
}) {
  const money = formatMoney(price);

  if (status === 'accepted') {
    return (
      <ResolvedRecord
        icon="check"
        tint={TINT_SUCCESS}
        iconColor={colors.success}
        /* D-W4 (walkthrough 2026-08-13) — "paid" must mean paid.
           This read `paidTotal ?? price`: when nothing had actually cleared,
           it silently fell back to the QUOTED amount and still rendered
           "Accepted · $180 paid". Screenshot 04 shows that claim sitting
           directly under the booking summary's own "pending payment · $180",
           on the same screen, about the same booking — and screenshot 11 is
           the business being refused completion because no payment exists.
           `paidTotal` is "what actually cleared" (see the prop comment above),
           so when it is absent the card states acceptance and nothing more. */
        title={
          paidTotal != null
            ? i18n.t('quoteCard.acceptedTitle', { amount: formatMoney(paidTotal) || '' })
            : i18n.t('quoteCard.acceptedTitleUnpaid', { amount: formatMoney(price) || '' })
        }
        subtitle={when ? i18n.t('quoteCard.acceptedWhen', { when }) : i18n.t('quoteCard.acceptedNow')}
        actionLabel={onView ? i18n.t('quoteCard.view') : null}
        onAction={onView}
      />
    );
  }

  if (status === 'expired') {
    return (
      <ResolvedRecord
        icon="clock"
        tint={TINT_WARNING}
        iconColor={colors.warning}
        title={i18n.t('quoteCard.expiredTitle', { amount: money || '' })}
        titleColor={colors.textSecondary}
        subtitle={i18n.t('quoteCard.expiredBody')}
        actionLabel={onReRequest ? i18n.t('quoteCard.reRequest') : null}
        onAction={onReRequest}
      />
    );
  }

  if (status === 'declined') {
    return (
      <ResolvedRecord
        icon="x"
        tint={TINT_DANGER}
        iconColor={colors.danger}
        title={i18n.t('quoteCard.declinedTitle', { amount: money || '' })}
        titleColor={colors.textSecondary}
        subtitle={i18n.t('quoteCard.declinedBody')}
      />
    );
  }

  // ── Pending ───────────────────────────────────────────────────────────────
  const isBusiness = side === 'business';
  const expires = expiresLabel(expiresAt);

  return (
    <View
      style={[
        styles.bubble,
        isBusiness ? styles.bubbleMine : styles.bubbleTheirs,
        style,
      ]}
    >
      {/* Header — tile · eyebrow · price */}
      <View style={styles.header}>
        <View style={[styles.tile, isBusiness && styles.tileNeutral]}>
          <Feather
            name="briefcase"
            size={15}
            strokeWidth={1.8}
            color={isBusiness ? colors.textSecondary : colors.accentText}
          />
        </View>
        <Text variant="caption" style={styles.eyebrow} numberOfLines={1}>
          {isBusiness ? i18n.t('quoteCard.eyebrowSent') : i18n.t('quoteCard.eyebrow')}
        </Text>
        {!!money && (
          <Text variant="caption" style={styles.price} numberOfLines={1}>{money}</Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.rows}>
        <DetailRow label={i18n.t('quoteCard.service')} value={service} />
        <DetailRow label={i18n.t('quoteCard.when')} value={when} />
        {isBusiness ? (
          <DetailRow
            label={i18n.t('quoteCard.statusLabel')}
            value={statusNote || (expires ? i18n.t('quoteCard.awaitingReply', { left: expires }) : null)}
            valueColor={colors.warning}
          />
        ) : (
          <DetailRow label={i18n.t('quoteCard.expires')} value={expires} valueColor={colors.warning} />
        )}
      </View>

      {/* D-W6 (walkthrough 2026-08-13) — do not draw a control that cannot act.
          Screenshot 05 showed BOTH buttons greyed with an apology underneath:
          "Changing a sent quote isn't available yet — message the client
          instead." Two things that look tappable, do nothing, and explain
          themselves after the fact. A disabled button is a promise the product
          does not keep, and the business still has to read the note to find out.
          Each button now renders only when it can actually run; when neither
          can, the note stands alone and says the true thing without pretending
          there was an action. */}
      {isBusiness ? (
        <>
          {(canWithdraw || canEdit) && (
            <View style={styles.actions}>
              {canWithdraw && (
                <SecondaryButton
                  label={i18n.t('quoteCard.withdraw')}
                  onPress={onWithdraw}
                  style={styles.btnFlex}
                />
              )}
              {canEdit && (
                <SecondaryButton
                  label={i18n.t('quoteCard.editQuote')}
                  onPress={onEdit}
                  style={styles.btnFlex}
                />
              )}
            </View>
          )}
          {(!canWithdraw || !canEdit) && (
            <Text variant="caption" style={styles.note} numberOfLines={2}>
              {i18n.t('quoteCard.sentLocked')}
            </Text>
          )}
        </>
      ) : (
        <>
          {/* No figure here — the total only exists inside the pay sheet. */}
          <Text variant="caption" style={styles.note} numberOfLines={2}>
            {i18n.t('quoteCard.payNote')}
          </Text>
          <View style={styles.actions}>
            <SecondaryButton
              label={i18n.t('quoteCard.decline')}
              onPress={onDecline}
              disabled={busy}
              style={styles.btnDecline}
            />
            <Pressable
              onPress={busy ? undefined : onAccept}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('quoteCard.acceptAndPay')}
              accessibilityState={{ disabled: busy }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                styles.btnFlex,
                busy && styles.btnDisabled,
                pressed && !busy && styles.btnPressed,
              ]}
            >
              <Text variant="caption" style={styles.btnPrimaryLabel} numberOfLines={1}>
                {i18n.t('quoteCard.acceptAndPay')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: '88%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    padding: 15,
    gap: 13,
    marginBottom: spacing.sm,
  },
  // From them → tail bottom-left, purple-tinted border (it wants an action).
  bubbleTheirs: {
    alignSelf: 'flex-start',
    borderColor: QUOTE_BORDER,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  // My own sent quote → tail bottom-right, neutral border (nothing to action).
  bubbleMine: {
    alignSelf: 'flex-end',
    borderColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 18,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNeutral: { backgroundColor: colors.surfaceAlt },
  eyebrow: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  price: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },

  divider: { height: 1, backgroundColor: colors.border },

  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowLabel: {
    width: 68,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  rowValue: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textPrimary,
    textAlign: TEXT_END,
  },

  note: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  btnFlex: { flex: 1 },
  btnDecline: { width: 92 },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // ── Resolved record ──
  record: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordText: { flex: 1, gap: 2 },
  recordTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  recordSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textTertiary,
  },
  recordAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.accentText,
  },
});
