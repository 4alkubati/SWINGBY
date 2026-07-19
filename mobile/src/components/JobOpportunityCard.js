import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import Button from './Button';
import Avatar from './Avatar';
import SwImage from './SwImage';
import i18n from '../i18n';
import { colors, spacing, radius } from '../theme/tokens';

// Business "new opportunity" card. Highlighted (new) variant uses purple-tinted border.
// Buttons row: Send quote (primary, flex:1) + Pass (secondary, ~88px wide, both 44px tall).
export default function JobOpportunityCard({
  post,
  onSendQuote,
  onPass,
  highlighted = false,
  compact = false,
}) {
  const title = post.title || post.description || 'New opportunity';
  const category = post.category ? capitalize(post.category) : null;
  const distanceKm = post.distance_km != null ? Number(post.distance_km).toFixed(1) : null;
  const ageLabel = formatPostedAt(post.created_at || post.posted_at);
  const priceLabel = formatPrice(post);
  const client = clientLabel(post);

  const metaParts = [category, distanceKm ? `${distanceKm} km` : null, ageLabel]
    .filter(Boolean)
    .join(' · ');

  const photos = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [];
  const photoCount = photos.length;

  if (compact) {
    return (
      <View
        style={[styles.compactCard, highlighted && { borderColor: colors.accentMuted }]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={styles.compactTitle}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {title}
          </Text>
          {(client || metaParts) ? (
            <Text
              variant="caption"
              color="secondary"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {[client, metaParts].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {photoCount > 0 && (
          <View
            style={styles.compactPhotoBadge}
            accessibilityLabel={i18n.t('jobCard.photosLabel', { count: photoCount })}
          >
            <Feather name="camera" size={12} color={colors.textSecondary} />
            <Text variant="caption" color="secondary">{photoCount}</Text>
          </View>
        )}
        <Button
          variant="ghost"
          label="Quote →"
          onPress={onSendQuote}
          style={styles.quoteLink}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        highlighted && { borderColor: colors.accentMuted },
      ]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text
            style={styles.title}
            numberOfLines={2}
            maxFontSizeMultiplier={1.3}
          >
            {title}
          </Text>
          {metaParts ? (
            <Text
              variant="caption"
              color="secondary"
              style={{ marginTop: 4 }}
              maxFontSizeMultiplier={1.3}
            >
              {metaParts}
            </Text>
          ) : null}
        </View>
        {priceLabel ? (
          <Text style={styles.price} maxFontSizeMultiplier={1.3}>
            {priceLabel}
          </Text>
        ) : null}
      </View>

      {client ? (
        <View style={styles.clientRow}>
          <Avatar name={client} size="sm" source={post.users?.avatar_url} />
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {client}
            </Text>
            {post.address ? (
              <Text variant="caption" color="secondary" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {post.address}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {photoCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          {photos.map((url, i) => (
            <SwImage
              key={url || i}
              source={{ uri: url }}
              style={styles.photoThumb}
              accessibilityLabel={i18n.t('jobCard.photoAlt', { index: i + 1, count: photoCount })}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.buttonRow}>
        <Button
          variant="primary"
          label="Send quote"
          onPress={onSendQuote}
          style={{ flex: 1, paddingVertical: 12 }}
        />
        {onPass && (
          <Button
            variant="secondary"
            label="Pass"
            onPress={onPass}
            style={styles.passBtn}
          />
        )}
      </View>
    </View>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// First name + last initial only — full contact stays on-platform pre-booking.
function clientLabel(post) {
  const u = post.users || post.client || {};
  if (!u.first_name) return null;
  const lastInitial = u.last_name ? ` ${u.last_name[0]}.` : '';
  return `${u.first_name}${lastInitial}`;
}

function formatPrice(post) {
  if (post.budget_min && post.budget_max) return `$${post.budget_min}–${post.budget_max}`;
  if (post.budget) return `$${post.budget}`;
  return 'Open budget';
}

function formatPostedAt(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.max(1, Math.floor((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  price: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: colors.success,
    letterSpacing: -0.2,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoRow: {
    gap: spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  passBtn: {
    width: 88,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  compactCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  compactPhotoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  quoteLink: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
