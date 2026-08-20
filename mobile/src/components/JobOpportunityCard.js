import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import Button from './Button';
import Avatar from './Avatar';
import SwImage from './SwImage';
import ImageViewer from './ImageViewer';
import i18n from '../i18n';
import { colors, spacing, radius } from '../theme/tokens';

// Business "new opportunity" card. Highlighted (new) variant uses purple-tinted border.
// Buttons row: Send quote (primary, flex:1) + Pass (secondary, ~88px wide, both 44px tall).
//
// F028 — this is the only surface a business ever sees a client's job post
// in detail (there is no separate "post detail" screen; open posts are
// cards here and on JobManagementScreen, quoted from a sheet). REPORT_TARGETS
// has carried SERVICE_POST since the moderation migration landed, but nothing
// ever rendered a control for it. `onReport`, when supplied, mirrors the same
// icon-button pattern ReviewCard already uses for REPORT_TARGETS.REVIEW.
export default function JobOpportunityCard({
  post,
  onSendQuote,
  onPass,
  onReport,
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

  // Since 2026-08-01 the backend RETURNS the photos pre-acceptance (privacy.py
  // L3, reversed by the product owner): a business cannot price a job it is not
  // allowed to look at. The client's name, exact address, coordinates and
  // budget are still masked — the business sees the work, not the person.
  //
  // Both paths are kept anyway. `photo_count` still rides along, and if a
  // future rule masks the URLs again this card degrades to the count badge
  // instead of silently showing nothing. Thumbnails are never faked from a
  // count — `photos` is only ever real URLs.
  const photos = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [];
  const photoCount = photos.length || Number(post.photo_count) || 0;
  const [viewerIndex, setViewerIndex] = useState(null);

  if (compact) {
    return (
      <View
        style={[styles.compactCard, highlighted && { borderColor: colors.accentMuted }]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={styles.compactTitle}
            numberOfLines={1}
          >
            {title}
          </Text>
          {(client || metaParts) ? (
            <Text
              variant="caption"
              color="secondary"
              numberOfLines={1}
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
        {onReport && (
          <Pressable
            onPress={() => onReport(post)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('moderation.reportPost')}
          >
            <Feather name="more-horizontal" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
        {/* The mock renders "Quote →". The arrow is drawn as a Feather icon,
            not a glyph — iconography is Feather-only (POLISH-TIPS §5). */}
        <Button
          variant="ghost"
          label="Quote"
          onPress={onSendQuote}
          style={styles.quoteLink}
          iconRight={<Feather name="arrow-right" size={15} strokeWidth={1.8} color={colors.accentText} />}
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
          >
            {title}
          </Text>
          {metaParts ? (
            <Text
              variant="caption"
              color="secondary"
              style={{ marginTop: 4 }}
            >
              {metaParts}
            </Text>
          ) : null}
        </View>
        {priceLabel ? (
          <Text style={styles.price}>
            {priceLabel}
          </Text>
        ) : null}
        {onReport && (
          <Pressable
            onPress={() => onReport(post)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('moderation.reportPost')}
            style={{ marginTop: 2 }}
          >
            <Feather name="more-horizontal" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {client ? (
        <View style={styles.clientRow}>
          <Avatar name={client} size="sm" source={post.users?.avatar_url} />
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium" numberOfLines={1}>
              {client}
            </Text>
            {/* Locality AND quadrant. The backend masks "3823 16 St SW,
                Calgary, AB" down to "Calgary, AB" — it keeps everything after
                the first comma, and in Canadian addressing the quadrant sits
                before it. So the one thing a business needs to judge the drive
                was the thing being dropped, and every job in the feed looked
                equally far away.

                `area` is emitted separately by privacy.py for exactly this, and
                it survives the case where the address masks to null (a
                free-typed address with no comma fails closed). So a job can
                legitimately show "SW" and nothing else. */}
            {(post.address || post.area) ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {[post.address, post.area].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Masked (pre-acceptance): we know how many photos there are but not
          what they show, so say the number. Un-masked: the thumbnails. */}
      {photos.length === 0 && photoCount > 0 && (
        <View
          style={styles.photoCountRow}
          accessibilityLabel={i18n.t('jobCard.photosLabel', { count: photoCount })}
        >
          <Feather name="camera" size={13} color={colors.textSecondary} />
          <Text variant="caption" color="secondary">
            {i18n.t('jobCard.photosLabel', { count: photoCount })}
          </Text>
        </View>
      )}

      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          {photos.map((url, i) => (
            <TouchableOpacity
              key={url || i}
              activeOpacity={0.8}
              onPress={() => setViewerIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('jobCard.photoAlt', { index: i + 1, count: photoCount })}
            >
              <SwImage
                source={{ uri: url }}
                style={styles.photoThumb}
                accessibilityLabel=""
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ImageViewer
        visible={viewerIndex !== null}
        images={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

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
  photoCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
