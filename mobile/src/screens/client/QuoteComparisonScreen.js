import {
  View, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import BottomSheet from '../../components/BottomSheet';
import EmptyState from '../../components/EmptyState';
import { SkeletonCard } from '../../components/Skeleton';
import { RatingStarsDisplay } from '../../components/RatingStars';

import { api } from '../../services/api';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
import { colors, spacing, radius } from '../../theme/tokens';

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
function QuotesEmpty() {
  return (
    <View style={styles.emptyContainer}>
      <EmptyState
        icon="clock"
        title="No quotes yet"
        body={"Businesses in your area will respond shortly.\nCheck back in a few minutes."}
      />
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ onRetry }) {
  return (
    <View style={styles.emptyContainer}>
      <EmptyState
        icon="alert-triangle"
        title="Could not load quotes"
        body="Something went wrong while fetching quotes."
        action={{ label: 'Try again', onPress: onRetry }}
      />
    </View>
  );
}

// ─── Animated quote card ──────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function QuoteListCard({ quote, isRecommended, onSelect, onViewProfile, onMessage, onDecline, declining }) {
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

  // The interests API nests business info under `businesses`
  const biz = quote.businesses || {};
  const businessName = biz.business_name || 'Business';
  const rating = biz.avg_rating || 0;
  const reviewCount = biz.review_count || 0;

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
                <RatingStarsDisplay rating={rating} size={12} color={colors.warning} />
                <Text variant="caption" color="secondary">
                  {rating ? rating.toFixed(1) : '—'}
                </Text>
                {reviewCount > 0 && (
                  <Text variant="caption" color="secondary">
                    · {reviewCount} review{reviewCount > 1 ? 's' : ''}
                  </Text>
                )}
              </Inline>
            </Stack>

            {/* Price + Select */}
            <Stack spacing="xs" align="flex-end">
              <Text variant="h1" style={styles.priceValue}>
                ${quote.quoted_price}
              </Text>
              <Button
                variant={isRecommended ? 'primary' : 'secondary'}
                label="Select"
                onPress={onSelect}
                style={styles.selectBtn}
              />
              {onMessage && (
                <Button
                  variant="ghost"
                  label="Message"
                  onPress={onMessage}
                  style={styles.selectBtn}
                />
              )}
              {onDecline && (
                <Button
                  variant="ghost"
                  label={i18n.t('quotes.decline')}
                  onPress={onDecline}
                  loading={declining}
                  disabled={declining}
                  style={[styles.selectBtn, styles.declineBtn]}
                />
              )}
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
  const businessName = quote.businesses?.business_name || 'this business';

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.38]}>
      <Stack spacing="lg" style={styles.sheetInner}>
        <Stack spacing="sm">
          <Text variant="h1">Confirm booking</Text>
          <Text variant="body" color="secondary">
            You're about to book{' '}
            <Text variant="bodyMedium">{businessName}</Text>
            {' '}for{' '}
            <Text variant="bodyMedium" style={styles.priceInline}>${quote.quoted_price}</Text>.
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

  // Decline state — tracks which quote id is mid-flight so its button can spin
  const [decliningId, setDecliningId] = useState(null);

  // ── Load quotes (original API logic preserved) ──────────────────────────────
  async function loadQuotes() {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.get(`/interests/post/${postId}`);
      // sort: score = rating / price (higher is better); rating nests under businesses
      const sorted = (data || []).sort((a, b) => {
        const scoreA = (a.businesses?.avg_rating || 0) / (a.quoted_price || 1);
        const scoreB = (b.businesses?.avg_rating || 0) / (b.quoted_price || 1);
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
  // CARD-20 (D2, 2026-07-19) — booking-entry flow. Land the client straight
  // in the chat for this booking instead of the ActiveBooking summary: if the
  // originating post carried a time, the backend already stamped
  // booking.confirmed_date at creation and the chat opens as the confirmed
  // "booking chat" (ConfirmDateCard shows the confirmed banner). If not, the
  // same chat opens as the "disappearing" pre-confirm chat — a banner asks
  // for a time and the propose/accept handshake (ConfirmDateCard) runs right
  // there; once a date is confirmed the banner drops and it's the booking chat.
  async function handleConfirm() {
    if (!selectedQuote) return;
    setConfirming(true);
    try {
      // Response shape: { message, booking, payment }
      const res = await api.patch(`/interests/${selectedQuote.id}/accept`);
      const bookingId = res?.booking?.id;
      setSheetVisible(false);
      if (bookingId) {
        navigation.replace('Chat', {
          bookingId,
          otherPartyName: selectedQuote.businesses?.business_name || 'Business',
        });
      } else {
        // Booking was created but id missing — land on My Jobs so it's visible
        navigation.navigate('ClientTabs', { screen: 'My Jobs' });
      }
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

  // ── Decline a quote — G1 (GAP-AUDIT #1). PATCH /interests/{id}/reject exists
  // on the backend but had no mobile caller; businesses' pending quotes hung
  // forever. Optimistic removal, restored at its original index on failure.
  async function handleDecline(quote) {
    if (decliningId) return;
    const previousQuotes = quotes;
    const index = quotes.findIndex((q) => q.id === quote.id);
    setDecliningId(quote.id);
    setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    try {
      await api.patch(`/interests/${quote.id}/reject`);
      toast.show({ type: 'success', text1: i18n.t('quotes.declined') });
    } catch (err) {
      // Error-safe restore — put the quote back where it was.
      setQuotes((prev) => {
        const restored = [...prev];
        restored.splice(Math.max(0, index), 0, quote);
        return restored;
      });
      toast.show({
        type: 'error',
        text1: i18n.t('quotes.declineError'),
        text2: err?.message || '',
      });
      // fall back to the untouched original list in case of index drift
      if (index === -1) setQuotes(previousQuotes);
    } finally {
      setDecliningId(null);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn} accessibilityLabel="Back" accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={colors.textSecondary} strokeWidth={1.8} />
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
        <QuotesEmpty />
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
                onMessage={() =>
                  navigation.navigate('Chat', {
                    interestId: quote.id,
                    otherPartyName: quote.businesses?.business_name || 'Business',
                  })
                }
                onDecline={() => handleDecline(quote)}
                declining={decliningId === quote.id}
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
    borderColor: colors.borderAccent,
  },
  bestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
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
  declineBtn: {
    borderWidth: 1,
    borderColor: colors.danger + '4D',
  },

  // Price
  priceValue: {
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  priceInline: {
    color: colors.success,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // Empty / error
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  // BottomSheet inner content
  sheetInner: {
    paddingTop: spacing.sm,
  },
});
