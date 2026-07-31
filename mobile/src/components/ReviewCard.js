import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import Inline from './Inline';
import Surface from './Surface';
import { RatingStarsDisplay } from './RatingStars';
import i18n from '../i18n';
import { colors, spacing } from '../theme/tokens';

/**
 * A review, rendered once.
 *
 * There were two ReviewCards, one per screen, and they disagreed about where
 * the reviewer's name lives — because the two endpoints disagree. The public
 * business payload nests the reviewer (`users.first_name`); the owner-only
 * analytics payload flattens it (`client_first_name`). BusinessProfileScreen's
 * copy read `review.reviewer`, a key neither response has ever had, so every
 * card on that screen quietly rendered "Client" until someone noticed.
 *
 * That is the payload-drift bug class CLAUDE.md warns about, and a second copy
 * of a component is how it hides. One definition, one place that knows every
 * shape the name can arrive in:
 *
 *   `reviewerName()` — the whole contract, exported so it can be tested.
 *
 * `variant` preserves the two existing looks exactly, rather than making a
 * design decision under cover of a refactor:
 *   'plain'    — profile: name + stars, comment below.
 *   'detailed' — analytics: initial avatar, name over relative date, stars.
 */
export function reviewerName(review) {
  return (
    review?.users?.first_name ||
    review?.client_first_name ||
    'Client'
  );
}

export default function ReviewCard({
  review,
  variant = 'plain',
  dateLabel,
  commentLines,
  onReport,
}) {
  const name = reviewerName(review);
  const rating = review?.rating || 0;
  // Guideline 1.2(b). Only the 'plain' (public profile) variant gets a report
  // control: 'detailed' is the owner's own analytics view of reviews left FOR
  // them, and a business reporting its own bad reviews is not what the flag
  // mechanism is for. Rendered only when a handler is supplied, so no existing
  // caller changes shape.
  const canReport = variant === 'plain' && typeof onReport === 'function' && review?.id;

  if (variant === 'detailed') {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0].toUpperCase()}</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.name}>{name}</Text>
            {!!dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
          </View>
          <RatingStarsDisplay rating={rating} size={12} />
        </View>
        {review?.comment ? (
          <Text style={styles.comment} numberOfLines={commentLines}>
            {review.comment}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Surface elevation="subtle" style={styles.plainCard}>
      <Inline justify="space-between" style={{ marginBottom: spacing.sm }}>
        <Text variant="smallMedium">{name}</Text>
        <Inline spacing="sm" align="center">
          <RatingStarsDisplay rating={rating} size={12} color={colors.warning} />
          {canReport ? (
            <Pressable
              onPress={() => onReport(review)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('moderation.reportReview')}
            >
              <Feather name="more-horizontal" size={16} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </Inline>
      </Inline>
      {review?.comment ? (
        <Text
          variant="small"
          color="secondary"
          style={{ lineHeight: 20 }}
          numberOfLines={commentLines}
        >
          {review.comment}
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  // 'plain' — was BusinessProfileScreen.styles.reviewCard, verbatim; the rest
  // of the card is Surface's own padding and radius.
  plainCard: { marginBottom: 0 },

  // 'detailed' — was BusinessAnalyticsScreen.styles.review*
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: colors.accentText },
  meta: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  date: { fontSize: 11, color: colors.textSecondary },
  comment: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
  },
});
