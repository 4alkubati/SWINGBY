import {
  View, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';

import Text from '../components/Text';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Surface from '../components/Surface';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import BottomSheet from '../components/BottomSheet';
import { SkeletonCard } from '../components/Skeleton';
import { RatingStarsDisplay } from '../components/RatingStars';

import { api } from '../services/api';
import { colors, spacing, radius } from '../theme/tokens';

// ─── Skeleton list for loading state ─────────────────────────────────────────
function QuoteSkeletons() {
  return (
    <Stack spacing="sm" style={{ paddingHorizontal: spacing.base, paddingTop: spacing.base }}>
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </Stack>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIllustration}>{'( ⏳ )'}</Text>
      <Text variant="h1" style={styles.emptyTitle}>No quotes yet</Text>
      <Text variant="body" color="secondary" style={styles.emptyDesc}>
        Businesses in your area will respond shortly.{'\n'}Check back in a few minutes.
      </Text>
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ onRetry }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIllustration}>{'( ✕ )'}</Text>
      <Text variant="h1" style={styles.emptyTitle}>Could not load quotes</Text>
      <Text variant="body" color="secondary" style={styles.emptyDesc}>
        Something went wrong while fetching quotes.
      </Text>
      <Button
        label="Try again"
        variant="secondary"
        onPress={onRetry}
        style={styles.retryBtn}
      />
    </View>
  );
}

// ─── Animated quote card ──────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function QuoteListCard({ quote, isRecommended, onSelect, onViewProfile }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { stiffness: 300, damping: 20 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 300, damping: 20 });
  };

  const businessName = quote.business_name || 'Business';

  return (
    <Animated.View style={animatedStyle}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={null}
      >
        <Surface
          elevation="subtle"
          background={isRecommended ? 'alt' : 'default'}
          rounded="card"
          padding="base"
          style={[
            styles.quoteCard,
            isRecommended && styles.quoteCardRecommended,
          ]}
        >
          {/* Best value badge */}
          {isRecommended && (
            <View style={styles.bestBadge}>
              <Text variant="label" color="accent">Best value</Text>
            </View>
          )}

          <Inline spacing="md" align="center">
            {/* Avatar — tappable to view profile */}
            <Pressable onPress={onViewProfile} hitSlop={8}>
              <Avatar name={businessName} size="md" />
            </Pressable>

            {/* Business info */}
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Pressable onPress={onViewProfile}>
                <Text variant="smallMedium" numberOfLines={1}>
                  {businessName}
                </Text>
              </Pressable>

              <Inline spacing="xs" align="center">
                <RatingStarsDisplay rating={quote.avg_rating || 0} size={12} color={colors.warning} />
                <Text variant="caption" color="secondary">
                  {quote.avg_rating ? quote.avg_rating.toFixed(1) : '—'}
                </Text>
                {quote.job_count > 0 && (
                  <Text variant="caption" color="secondary">
                    · {quote.job_count} jobs
                  </Text>
                )}
                {quote.distance_km != null && (
                  <Text variant="caption" color="secondary">
                    · {Number(quote.distance_km).toFixed(1)} km
                  </Text>
                )}
              </Inline>
            </Stack>

            {/* Price + Select */}
            <Stack spacing="xs" align="flex-end">
              <Text variant="h1" color="accent">
                ${quote.quoted_price}
              </Text>
              <Button
                variant={isRecommended ? 'primary' : 'secondary'}
                label="Select"
                onPress={onSelect}
                style={styles.selectBtn}
              />
            </Stack>
          </Inline>
        </Surface>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ─── Confirm BottomSheet ──────────────────────────────────────────────────────
function ConfirmSheet({ visible, quote, onConfirm, onClose, confirming }) {
  if (!quote) return null;
  const businessName = quote.business_name || 'this business';

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.38]}>
      <Stack spacing="lg" style={styles.sheetInner}>
        <Stack spacing="sm">
          <Text variant="h1">Confirm booking</Text>
          <Text variant="body" color="secondary">
            You're about to book{' '}
            <Text variant="bodyMedium">{businessName}</Text>
            {' '}for{' '}
            <Text variant="bodyMedium" color="accent">${quote.quoted_price}</Text>.
          </Text>
        </Stack>

        <Inline spacing="sm">
          <Button
            variant="secondary"
            label="Cancel"
            onPress={onClose}
            disabled={confirming}
            style={{ flex: 1 }}
          />
          <Button
            variant="primary"
            label="Confirm"
            onPress={onConfirm}
            loading={confirming}
            disabled={confirming}
            style={{ flex: 1 }}
          />
        </Inline>
      </Stack>
    </BottomSheet>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function QuoteComparisonScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // Original state — preserved in full
  const { postId, postTitle } = route.params || {};
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);

  // ── Load quotes (original API logic preserved) ──────────────────────────────
  async function loadQuotes() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.get(`/interests/post/${postId}`);
      // sort: score = rating / price (higher is better) — original sort logic
      const sorted = (data || []).sort((a, b) => {
        const scoreA = (a.avg_rating || 0) / (a.quoted_price || 1);
        const scoreB = (b.avg_rating || 0) / (b.quoted_price || 1);
        return scoreB - scoreA;
      });
      setQuotes(sorted);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotes();
  }, [postId]);

  // ── Select handler — opens BottomSheet instead of Alert ────────────────────
  function handleSelectPress(quote) {
    setSelectedQuote(quote);
    setSheetVisible(true);
  }

  // ── Confirm booking (original API logic preserved) ─────────────────────────
  async function handleConfirm() {
    if (!selectedQuote) return;
    setConfirming(true);
    try {
      const booking = await api.patch(`/interests/${selectedQuote.id}/accept`);
      setSheetVisible(false);
      navigation.replace('ActiveBooking', {
        bookingId: booking?.booking_id || booking?.id,
      });
    } catch (err) {
      // Close sheet and surface error inline
      setSheetVisible(false);
      setLoadError(false); // keep quotes visible
      // Re-use a simple inline error — show as a caption under the list
      setConfirmError(err.message || 'Could not confirm booking. Try again.');
    } finally {
      setConfirming(false);
    }
  }

  // Inline confirm error
  const [confirmError, setConfirmError] = useState('');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text variant="h2" color="secondary">←</Text>
        </Pressable>
        <Stack spacing="xs" style={styles.headerCenter}>
          <Text variant="h1" style={styles.headerTitle}>
            {loading ? 'Loading quotes…' : `${quotes.length} ${quotes.length === 1 ? 'business' : 'businesses'} quoted`}
          </Text>
          {postTitle ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {postTitle}
            </Text>
          ) : null}
        </Stack>
        <View style={styles.headerRight} />
      </View>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <QuoteSkeletons />
        </ScrollView>
      ) : loadError ? (
        <ErrorState onRetry={loadQuotes} />
      ) : quotes.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          <Text variant="caption" color="secondary" style={styles.sortHint}>
            Sorted by best rating × price. Tap a name to view profile.
          </Text>

          {confirmError ? (
            <Surface
              elevation="none"
              background="alt"
              rounded="input"
              padding="sm"
              style={styles.confirmErrorBanner}
            >
              <Text variant="small" color="danger">{confirmError}</Text>
            </Surface>
          ) : null}

          <Stack spacing="sm">
            {quotes.map((quote, index) => (
              <QuoteListCard
                key={quote.id}
                quote={quote}
                isRecommended={index === 0}
                onSelect={() => handleSelectPress(quote)}
                onViewProfile={() =>
                  navigation.navigate('BusinessProfile', { businessId: quote.business_id })
                }
              />
            ))}
          </Stack>
        </ScrollView>
      )}

      {/* ── Confirm BottomSheet ───────────────────────────────────────────── */}
      <ConfirmSheet
        visible={sheetVisible}
        quote={selectedQuote}
        onConfirm={handleConfirm}
        onClose={() => setSheetVisible(false)}
        confirming={confirming}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { textAlign: 'center' },
  headerRight: { width: 36 },

  // Sort hint
  sortHint: { textAlign: 'center', marginBottom: spacing.sm },

  // Error banner
  confirmErrorBanner: { marginBottom: spacing.sm },

  // List
  listContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
  },

  // Quote card
  quoteCard: { overflow: 'hidden' },
  quoteCardRecommended: {
    borderColor: colors.accent,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minWidth: 80,
  },

  // Empty / error
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIllustration: {
    fontSize: 40,
    color: colors.textSecondary,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  emptyTitle: { textAlign: 'center' },
  emptyDesc: { textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: spacing.sm },

  // BottomSheet inner content
  sheetInner: {
    paddingTop: spacing.sm,
  },
});
