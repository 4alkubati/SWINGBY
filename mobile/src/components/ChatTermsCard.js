// ChatTermsCard — scope of work agreed inside the thread (walkthrough M11).
//
// No handoff frame exists for this card, so it is built to the ONE that does:
// ChatQuoteCard (canvas 3a, design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md).
// Same 88%-wide bubble, same 18/6 tail, same header tile → eyebrow → divider →
// body → actions rhythm, same 44px buttons. A client who has accepted a quote
// already knows how to read this card.
//
// It is deliberately NOT a quote:
//   • purple-tinted border only while it is waiting on the viewer's action
//     (identical rule to the quote card);
//   • NO price, ever. Money lives in the quote card and the pay sheet
//     (PAYMENTS.md). A second place to state a total is a second place to be
//     wrong about what was charged.
//
// The agreed text is always readable, in every state — including after
// acceptance. Collapsing it to "Agreed ✓" would hide the only thing that
// matters when somebody later says "that is not what I agreed to".
import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// Matches ChatQuoteCard's local token: a shade stronger than
// tokens.colors.borderAccent, used only while the card wants an action.
const ACTION_BORDER = 'rgba(136,120,249,0.28)';
const TINT_SUCCESS = 'rgba(46,189,133,0.14)';
const TINT_DANGER = 'rgba(255,92,92,0.14)';

// Collapsed height for long scopes. Enough to read the gist, short enough that
// the card never swallows the thread.
const COLLAPSED_LINES = 8;

export function agreedAtLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Strip({ icon, tint, iconColor, title, titleColor, subtitle }) {
  return (
    <View style={[styles.strip, { backgroundColor: tint }]}>
      <Feather name={icon} size={15} strokeWidth={1.8} color={iconColor} />
      <View style={styles.stripText}>
        <Text
          variant="caption"
          numberOfLines={2}
          style={[styles.stripTitle, titleColor ? { color: titleColor } : null]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" numberOfLines={2} style={styles.stripSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ChatTermsCard({
  terms,
  isMine = false, // the viewer is the business that sent these terms
  busy = false,
  onAccept,
  onWithdraw,
  style,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!terms) return null;

  const status = terms.status || 'pending';
  const accepted = status === 'accepted';
  const withdrawn = status === 'withdrawn';
  // `verified` is recomputed server-side on every read from the stored text and
  // its fingerprint. False means the row changed underneath the agreement, so
  // the card must not keep presenting it as one.
  const broken = terms.verified === false;
  const canAccept = !!terms.can_accept && !broken;
  const awaiting = status === 'pending' && !canAccept;

  const body = terms.terms_text || '';
  const isLong = body.length > 320 || body.split('\n').length > COLLAPSED_LINES;

  return (
    <View
      style={[
        styles.bubble,
        isMine ? styles.bubbleMine : styles.bubbleTheirs,
        canAccept && styles.bubbleActionable,
        style,
      ]}
      accessibilityLabel={`Terms: ${terms.title || 'scope of work'}`}
    >
      {/* Header — tile · eyebrow · state icon */}
      <View style={styles.header}>
        <View style={[styles.tile, (isMine || accepted) && styles.tileNeutral]}>
          <Feather
            name="file-text"
            size={15}
            strokeWidth={1.8}
            color={isMine || accepted ? colors.textSecondary : colors.accentText}
          />
        </View>
        <Text variant="caption" style={styles.eyebrow} numberOfLines={1}>
          {accepted
            ? 'AGREED'
            : withdrawn
              ? 'WITHDRAWN'
              : isMine
                ? 'TERMS SENT'
                : 'TERMS TO AGREE'}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text variant="bodyMedium" style={styles.title} numberOfLines={2}>
        {terms.title}
      </Text>

      <Text
        variant="body"
        style={styles.body}
        numberOfLines={expanded || !isLong ? undefined : COLLAPSED_LINES}
      >
        {body}
      </Text>

      {isLong && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Read all of the terms'}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text variant="caption" style={styles.readAll}>
            {expanded ? 'Show less' : 'Read all'}
          </Text>
        </Pressable>
      )}

      {/* ── State ─────────────────────────────────────────────────────────── */}

      {broken && (
        <Strip
          icon="alert-triangle"
          tint={TINT_DANGER}
          iconColor={colors.danger}
          title="This record can't be verified"
          titleColor={colors.danger}
          subtitle="The wording no longer matches what was signed. Ask for it to be sent again."
        />
      )}

      {accepted && !broken && (
        <Strip
          icon="check"
          tint={TINT_SUCCESS}
          iconColor={colors.success}
          title={`Agreed by ${terms.accepted_name || 'the client'}`}
          subtitle={agreedAtLabel(terms.accepted_at)}
        />
      )}

      {withdrawn && !broken && (
        <Strip
          icon="x"
          tint={colors.surfaceAlt}
          iconColor={colors.textSecondary}
          title="Withdrawn before it was agreed"
          titleColor={colors.textSecondary}
        />
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}

      {canAccept && (
        <>
          {/* Say plainly what the tap does. An "agreement" nobody understood
              they were making is not worth having. */}
          <Text variant="caption" style={styles.note} numberOfLines={3}>
            Agreeing records your name, this exact wording and the time. It
            can't be edited afterwards by either of you.
          </Text>
          <Pressable
            onPress={busy ? undefined : onAccept}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="I agree to these terms"
            accessibilityState={{ disabled: !!busy }}
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              busy && styles.btnDisabled,
              pressed && !busy && styles.btnPressed,
            ]}
          >
            <Text variant="caption" style={styles.btnPrimaryLabel} numberOfLines={1}>
              I agree
            </Text>
          </Pressable>
        </>
      )}

      {awaiting && !broken && !withdrawn && (
        <>
          <Text variant="caption" style={styles.note} numberOfLines={2}>
            {isMine
              ? 'Waiting for the client to agree.'
              : 'Waiting on the client to agree.'}
          </Text>
          {isMine && !!onWithdraw && (
            <Pressable
              onPress={busy ? undefined : onWithdraw}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Withdraw these terms"
              accessibilityState={{ disabled: !!busy }}
              style={({ pressed }) => [
                styles.btn,
                styles.btnSecondary,
                busy && styles.btnDisabled,
                pressed && !busy && styles.btnPressed,
              ]}
            >
              <Text variant="caption" style={styles.btnSecondaryLabel} numberOfLines={1}>
                Withdraw
              </Text>
            </Pressable>
          )}
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
    borderColor: colors.border,
    padding: 15,
    gap: 11,
    marginBottom: spacing.sm,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 18,
  },
  // Purple-tinted border ONLY while it awaits the viewer's action — the same
  // rule the quote rows use (MESSAGES-AND-QUOTES.md §"Quotes list rows").
  bubbleActionable: { borderColor: ACTION_BORDER },

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

  divider: { height: 1, backgroundColor: colors.border },

  title: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  readAll: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.accentText,
  },

  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  stripText: { flex: 1, gap: 2 },
  stripTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  stripSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
  },

  note: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  btn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
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
});
