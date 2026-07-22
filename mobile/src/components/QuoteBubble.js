// QuoteBubble — the demoted quote, collapsed above a booking chat.
//
// Owner direction (2026-07-21): "The quote should go to the bubble and the
// booking/booked should be the MAIN thing in chat." Once a quote is accepted
// the booking becomes the thread's identity (ChatBookingSummary is the primary
// content); the originating quote collapses into this small pill — like an
// Instagram message request — that taps open to re-reveal the quote context.
//
// Backend already does its half: accept_interest() re-parents the quote's
// messages onto the booking, and GET /messages/{booking_id} returns the quote
// context under `interest` (_quote_context_for_booking). So this is purely a
// client-side presentation of that context — no extra fetch. Rendered inline
// (not an overlay) so it never collides with the summary card or the keyboard.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import Inline from './Inline';
import Surface from './Surface';
import { colors, spacing, radius, shadows } from '../theme/tokens';

function statusLabel(status) {
  switch ((status || '').toLowerCase()) {
    case 'accepted': return 'Accepted';
    case 'rejected': return 'Declined';
    case 'pending':  return 'Pending';
    default:         return status || '';
  }
}

export default function QuoteBubble({ quote }) {
  const [open, setOpen] = useState(false);
  if (!quote) return null;

  const price = quote.quoted_price != null ? `$${quote.quoted_price}` : null;
  const title = quote.post_title || 'Quote';

  return (
    <View style={styles.wrap}>
      {/* Collapsed floating pill, right-aligned like a message-request chip */}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="View the original quote"
        style={({ pressed }) => [styles.bubble, pressed && styles.bubblePressed]}
      >
        <Feather name="tag" size={12} color={colors.accentText} />
        <Text variant="caption" style={styles.bubbleText} numberOfLines={1}>
          {price ? `Quote · ${price}` : 'Quote'}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={colors.accentText}
        />
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
          <Surface
            elevation="subtle"
            background="alt"
            rounded="card"
            padding="base"
            style={styles.panel}
          >
            <Text variant="caption" color="secondary" style={{ letterSpacing: 0.4 }}>
              ORIGINAL QUOTE
            </Text>
            <Text variant="bodyMedium" numberOfLines={2} style={{ marginTop: spacing.xs }}>
              {title}
            </Text>
            <Inline spacing="sm" align="center" style={{ marginTop: spacing.sm }}>
              {price ? (
                <Text variant="display3" style={{ color: colors.accentText }}>{price}</Text>
              ) : null}
              {quote.status ? (
                <View style={styles.statusChip}>
                  <Text variant="caption" style={styles.statusChipText}>
                    {statusLabel(quote.status)}
                  </Text>
                </View>
              ) : null}
            </Inline>
            <Inline spacing="sm" align="center" style={{ marginTop: spacing.md }}>
              <Feather name="corner-down-right" size={13} color={colors.textSecondary} />
              <Text variant="small" color="secondary" style={{ flex: 1 }}>
                The quote conversation continues in this chat — it became your
                booking when you accepted.
              </Text>
            </Inline>
          </Surface>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No outer padding: the parent (ChatScreen's pinned context block) owns the
  // horizontal inset and the spacing between blocks.
  wrap: {
    alignItems: 'flex-end',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    ...shadows.subtle,
  },
  bubblePressed: { opacity: 0.7 },
  bubbleText: {
    color: colors.accentText,
    fontWeight: '600',
    maxWidth: 160,
  },
  panel: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  statusChipText: {
    color: colors.accentText,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
