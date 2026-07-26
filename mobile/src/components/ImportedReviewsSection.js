// ImportedReviewsSection.js — reviews a business brought across from its own
// Google Business Profile, shown so a client can never mistake one for a
// review left on SwingBy (walkthrough M3).
//
// THE LABEL IS THE FEATURE. An imported review is real, but it is evidence of a
// different thing than a SwingBy review: nobody here escrowed a payment,
// completed a job, or was verified by us. Three separate cues carry that, and
// all three are deliberate:
//   1. its own section, with its own heading and a plain-English caption;
//   2. a per-card "Google · Verified" pill — so a screenshot of one card,
//      out of context, still says where it came from;
//   3. a different surface (`alt`) from native review cards.
// The average shown here is the imported average only. It is never blended
// into the business's SwingBy rating — see the backend module docstring.
//
// Design: Jet x Pulse (design/DESIGN-SYSTEM.md). Feather icons only, zero
// emoji. No purple — that is reserved for the screen's one primary CTA, and a
// provenance label is not a call to action.

import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, radius } from '../theme/tokens';
import Text from './Text';
import Surface from './Surface';
import Stack from './Stack';
import Inline from './Inline';
import { RatingStarsDisplay } from './RatingStars';

function formatReviewDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** The provenance pill. Small, quiet, and present on every imported card. */
export function ImportedBadge({ style }) {
  return (
    <View style={[styles.badge, style]}>
      <Feather name="shield" size={11} color={colors.textSecondary} />
      <Text variant="caption" color="secondary">Google · Verified</Text>
    </View>
  );
}

export function ImportedReviewCard({ review }) {
  const when = formatReviewDate(review?.reviewed_at);

  return (
    <Surface background="alt" elevation="subtle" style={styles.card}>
      <Inline justify="space-between" style={styles.cardHead}>
        <Text variant="smallMedium" numberOfLines={1} style={styles.author}>
          {review?.author_name || 'Google user'}
        </Text>
        <RatingStarsDisplay rating={review?.rating || 0} size={12} color={colors.warning} />
      </Inline>

      {review?.comment ? (
        <Text variant="small" color="secondary" style={styles.comment}>
          {review.comment}
        </Text>
      ) : null}

      <Inline justify="space-between" style={styles.cardFoot}>
        <ImportedBadge />
        {/* Text's colorMap has no 'tertiary' key — pass the token itself. */}
        {when ? <Text variant="caption" color={colors.textTertiary}>{when}</Text> : null}
      </Inline>
    </Surface>
  );
}

/**
 * The whole section. Renders nothing at all when there is nothing to show —
 * an empty "Google reviews" heading would imply a business had bad ones and
 * hid them, which is the opposite of what this is for.
 *
 * @param {{reviews: Array<object>, summary: {count: number, average_rating: number|null}}} props
 */
export default function ImportedReviewsSection({ reviews, summary, style }) {
  const rows = Array.isArray(reviews) ? reviews : [];
  if (rows.length === 0) return null;

  const average = summary?.average_rating;

  return (
    <View style={style}>
      <View style={styles.header}>
        <Inline justify="space-between" style={styles.headerRow}>
          <Text variant="label" color="secondary">Verified Google reviews</Text>
          {typeof average === 'number' ? (
            <Inline spacing="xs">
              <Feather name="star" size={12} color={colors.warning} />
              <Text variant="caption" color="secondary">
                {average.toFixed(1)} · {rows.length}
              </Text>
            </Inline>
          ) : null}
        </Inline>
        <Text variant="caption" color={colors.textTertiary} style={styles.caption}>
          Imported from this business&apos;s own Google Business Profile. These are
          not SwingBy jobs and are not counted in its SwingBy rating.
        </Text>
      </View>

      <Stack spacing="sm">
        {rows.map((review) => (
          <ImportedReviewCard key={review.id || review.external_review_id} review={review} />
        ))}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  headerRow: { marginBottom: spacing.xs },
  caption: { lineHeight: 16 },

  card: { padding: spacing.base },
  cardHead: { marginBottom: spacing.sm },
  author: { flexShrink: 1, marginRight: spacing.sm },
  comment: { lineHeight: 20 },
  cardFoot: { marginTop: spacing.md },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
});
