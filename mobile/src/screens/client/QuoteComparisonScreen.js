import {
  View, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import BusinessLogo from '../../components/BusinessLogo';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import PaySheet from '../../components/PaySheet';
import EmptyState from '../../components/EmptyState';
import { SkeletonCard } from '../../components/Skeleton';
import { RatingStarsDisplay } from '../../components/RatingStars';

import { api } from '../../services/api';
import {
  acceptQuoteAndPay,
  ACCEPT_CANCELLED,
  ACCEPT_CHECKOUT,
  ACCEPT_PAID,
} from '../../services/acceptAndPay';
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
// B9 — "ends on a screen reading 0 business quotes". This is no longer where a
// request lands (that's RequestSentScreen now), but it is still where "View
// job" goes seconds after posting, so the empty state has to read as waiting,
// not as failure.
// `targetBusinessName` is set when the client sent this to ONE business from
// its profile ("Book now"). Saying "nearby pros have been notified" there is
// simply false — nobody nearby was told anything, one company was asked
// directly — and it was the first thing the founder caught on the walkthrough.
function QuotesEmpty({ targetBusinessName }) {
  const targeted = !!targetBusinessName;
  return (
    <View style={styles.emptyContainer}>
      <EmptyState
        icon="clock"
        title={targeted ? 'Waiting on their reply' : 'Waiting on quotes'}
        body={
          targeted
            ? `${targetBusinessName} has your request. Most reply within a couple of hours — we’ll ping you the moment they do.`
            : 'Nearby pros have been notified. Most reply within a couple of hours — we’ll ping you the moment one does.'
        }
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
              <BusinessLogo uri={biz.logo_url} name={businessName} size={48} />
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
              {/* PAYMENTS.md §Path B: the CTA carries no figure. The quoted
                  price above it is the business's bid — the thing the client
                  is comparing — not a total. The total (bid + client-side
                  service fee) exists only inside the sheet. */}
              <Button
                variant={isRecommended ? 'primary' : 'secondary'}
                label={i18n.t('quotes.acceptAndPay')}
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

// The bespoke "Confirm booking" BottomSheet that used to live here is gone.
// It quoted "$204" in a note before any pay surface opened (the one thing
// PAYMENTS.md forbids), it had no breakdown, no escrow copy and no declined
// state, and it was a second payment surface to maintain. Both paths now open
// the one shared PaySheet.
//
// It was also a crash surface: BottomSheet's exit animation runs while the
// component returns null on the same tick that handleConfirm calls
// navigation.replace() — a Reanimated animation targeting a shadow node that
// React is detaching, on the screen Sentry caught deadlocking (SEN-2).

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function QuoteComparisonScreen({ navigation, route }) {
  // Original state — preserved in full
  const { postId, postTitle, targetBusinessName } = route.params || {};
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

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
  // PaySheet owns the busy/error UI: throwing from here shows the message
  // inside the sheet on the declined-chip and re-enables the CTA, exactly as
  // PAYMENTS.md §States describes. No try/catch, no second error surface.
  //
  // FOUNDER RULING 2026-07-25 — "the client should get charged the moment they
  // click accept". This used to accept the quote and then hand the client a
  // hosted Checkout URL through Linking.openURL, i.e. throw them into Chrome.
  // services/acceptAndPay.js now does accept-then-native-sheet in one call;
  // hosted Checkout survives only as the fallback for a build that cannot
  // present the native sheet.
  //
  // Survives across CTA taps so a declined card can be retried without a second
  // PATCH /interests/{id}/accept (which would 400 "Interest is not pending").
  // It is also how `handleSheetClose` knows a booking is on the hook.
  const acceptedRef = useRef(null);

  async function handleConfirm() {
    if (!selectedQuote) return;

    const result = await acceptQuoteAndPay({
      interestId: selectedQuote.id,
      accepted: acceptedRef.current,
      onAccepted: (accepted) => { acceptedRef.current = accepted; },
    });

    if (!alive.current) return;

    // Dismissing Stripe's sheet is not a failure and not an exit. Leave our
    // sheet open with the CTA live so paying is one tap away; if they walk away
    // from this one too, handleSheetClose is what makes that visible.
    if (result.outcome === ACCEPT_CANCELLED) return;

    setSheetVisible(false);
    acceptedRef.current = null;

    if (result.outcome === ACCEPT_PAID) {
      toast.show({ type: 'success', text1: i18n.t('quotes.paidAndBooked') });
    } else if (result.outcome === ACCEPT_CHECKOUT) {
      toast.show({
        type: 'info',
        text1: i18n.t('quotes.accepted'),
        text2: i18n.t('quotes.finishInBrowser'),
      });
    }

    // Landing is a separate tick from closing the sheet — a navigation
    // transition must not share a commit with a modal teardown (SEN-2).
    const name = selectedQuote.businesses?.business_name || 'Business';
    requestAnimationFrame(() => {
      if (!alive.current) return;
      navigation.replace('Chat', { bookingId: result.bookingId, otherPartyName: name });
    });
  }

  // Closing the sheet after the accept already ran leaves a real, unpaid
  // booking. The accept cannot be rolled back from here (the server has already
  // rejected the rival quotes and matched the post), so the requirement is that
  // it never happens QUIETLY: say what state they are in and land them on the
  // one screen where paying is a single tap.
  function handleSheetClose() {
    const pending = acceptedRef.current;
    setSheetVisible(false);
    if (!pending?.bookingId) return;

    acceptedRef.current = null;
    toast.show({
      type: 'warning',
      text1: i18n.t('quotes.notPaidYet'),
      text2: i18n.t('quotes.notPaidYetBody'),
    });
    requestAnimationFrame(() => {
      if (!alive.current) return;
      navigation.replace('BookingDetails', { bookingId: pending.bookingId });
    });
  }

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
    <View style={styles.container}>
      {/* ScreenHeader has no subtitle slot (design/SPEC-screen-header.md §12),
          so the job's postTitle — previously a caption line under the title —
          is dropped here. It still reaches the PaySheet summary below. */}
      <ScreenHeader
        title={
          loading
            ? 'Loading quotes…'
            : quotes.length === 0
              ? 'Your job'
              : `${quotes.length} ${quotes.length === 1 ? 'business' : 'businesses'} quoted`
        }
        onBack={() => navigation.goBack()}
      />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <QuoteSkeletons />
        </ScrollView>
      ) : loadError ? (
        <ErrorState onRetry={loadQuotes} />
      ) : quotes.length === 0 ? (
        <QuotesEmpty targetBusinessName={targetBusinessName} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          <Text variant="caption" color="secondary" style={styles.sortHint}>
            Sorted by best rating × price. Tap a name to view profile.
          </Text>

          {/* Pre-sheet copy states the rule instead of quoting a total. */}
          <Text variant="caption" color="secondary" style={styles.sortHint}>
            {i18n.t('quotes.payFirstNote')}
          </Text>

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

      {/* ── The one shared pay sheet — Path B ─────────────────────────────── */}
      <PaySheet
        visible={sheetVisible && !!selectedQuote}
        mode="pay"
        amount={Number(selectedQuote?.quoted_price) || 0}
        summary={[
          selectedQuote?.businesses?.business_name,
          postTitle,
        ].filter(Boolean).join(' · ')}
        interestId={selectedQuote?.id}
        onClose={handleSheetClose}
        onAddMethod={() => {
          setSheetVisible(false);
          navigation.navigate('PaymentMethod');
        }}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Sort hint
  sortHint: { textAlign: 'center', marginBottom: spacing.sm },

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

  // Empty / error
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
