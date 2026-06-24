import {
  View, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';
import BookingStatusTimeline from '../components/BookingStatusTimeline';
import Text from '../components/Text';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import Surface from '../components/Surface';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import Badge from '../components/Badge';
import { SkeletonBox } from '../components/Skeleton';
import { RatingStarsDisplay } from '../components/RatingStars';
import { colors, spacing, radius, motion } from '../theme/tokens';

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function ActiveBookingSkeleton() {
  return (
    <Stack spacing="base" style={styles.content}>
      {/* Worker card skeleton */}
      <SkeletonBox height={180} borderRadius={radius.card} style={styles.hPad} />
      {/* Timeline skeleton */}
      <SkeletonBox height={80} borderRadius={radius.card} style={styles.hPad} />
      {/* ETA card skeleton */}
      <SkeletonBox height={90} borderRadius={radius.card} style={styles.hPad} />
      {/* Details card skeleton */}
      <SkeletonBox height={160} borderRadius={radius.card} style={styles.hPad} />
    </Stack>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function NoActiveBooking({ onBrowse }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Feather name="calendar" size={32} color={colors.accent} />
      </View>
      <Text variant="h1" style={styles.emptyTitle}>No active booking</Text>
      <Text variant="small" color="secondary" style={styles.emptyBody}>
        You don't have an active booking right now. Browse services to get started.
      </Text>
      <Button
        label="Browse services"
        onPress={onBrowse}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function BookingError({ onRetry }) {
  return (
    <View style={styles.centered}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.danger + '1A', borderColor: colors.danger + '33' }]}>
        <Feather name="alert-circle" size={32} color={colors.danger} />
      </View>
      <Text variant="h1" style={styles.emptyTitle}>Something went wrong</Text>
      <Text variant="small" color="secondary" style={styles.emptyBody}>
        We couldn't load your booking. Please try again.
      </Text>
      <Button
        label="Retry"
        onPress={onRetry}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

// ─── Animated card wrapper ────────────────────────────────────────────────────
function SpringCard({ delay = 0, style, children }) {
  const translateY = useSharedValue(18);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withSpring(0, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    }));
    opacity.value = withDelay(delay, withSpring(1, {
      stiffness: 120,
      damping: 20,
    }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animStyle, style]}>{children}</Animated.View>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────
function DetailRow({ label, value, accent }) {
  return (
    <Inline justify="space-between" style={styles.detailRow}>
      <Text variant="small" color="secondary">{label}</Text>
      <Text
        variant="smallMedium"
        color={accent ? 'accent' : 'primary'}
        style={{ textAlign: 'right', flex: 1, marginLeft: spacing.md }}
      >
        {value}
      </Text>
    </Inline>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ActiveBookingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await api.get(`/bookings/${bookingId}`);
      setBooking(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  const date = booking?.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

  const isConfirmed = booking?.status === 'confirmed' || booking?.status === 'in_progress';

  const workerName = booking?.employee_name || booking?.business_name || 'Your provider';
  const companyName = booking?.business_name || '';
  const rating = booking?.avg_rating;
  const jobCount = booking?.job_count;

  // ─── Status label map ────────────────────────────────────────────────────────
  const STATUS_BADGE = {
    confirmed:   { label: 'Confirmed',   color: 'accent' },
    on_the_way:  { label: 'On the way',  color: 'warning' },
    in_progress: { label: 'In progress', color: 'warning' },
    completed:   { label: 'Done',        color: 'success' },
    cancelled:   { label: 'Cancelled',   color: 'danger' },
  };

  // ─── ETA text ────────────────────────────────────────────────────────────────
  const etaText =
    booking?.status === 'confirmed'    ? 'Awaiting confirmation from provider' :
    booking?.status === 'on_the_way'   ? 'Provider is on the way' :
    booking?.status === 'in_progress'  ? 'Service in progress' :
    booking?.status === 'completed'    ? 'Service completed' :
    booking?.status === 'cancelled'    ? 'Booking cancelled' :
    'Checking status...';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Inline justify="space-between" style={styles.header}>
        <Button
          variant="ghost"
          label=""
          icon={<Feather name="arrow-left" size={20} color={colors.textSecondary} />}
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
        />
        <Text variant="bodyMedium">Your booking</Text>
        <View style={{ width: 44 }} />
      </Inline>

      {/* ── Loading ── */}
      {loading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: spacing.base, paddingBottom: spacing.xl }}
        >
          <ActiveBookingSkeleton />
        </ScrollView>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <BookingError onRetry={() => { setLoading(true); load(); }} />
      )}

      {/* ── Empty (no booking) ── */}
      {!loading && !error && !booking && (
        <NoActiveBooking onBrowse={() => navigation.navigate('Home')} />
      )}

      {/* ── Content ── */}
      {!loading && !error && booking && (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={colors.accent}
              />
            }
          >
            {/* ── Worker info card ── */}
            <SpringCard delay={0} style={styles.hPad}>
              <Surface elevation="subtle" style={styles.workerCard}>
                <Stack spacing="md" align="center">
                  <Avatar name={workerName} size="lg" />

                  {/* Status badge */}
                  {booking.status && (() => {
                    const sb = STATUS_BADGE[booking.status];
                    return (
                      <Badge
                        count={999}
                        color={sb?.color || 'accent'}
                        style={styles.statusBadge}
                      >
                        <Text variant="label" color={sb?.color || 'accent'}>
                          {sb?.label || booking.status}
                        </Text>
                      </Badge>
                    );
                  })()}

                  <Stack spacing="xs" align="center">
                    <Text variant="display3">{workerName}</Text>
                    {booking.employee_role ? (
                      <Text variant="small" color="secondary">{booking.employee_role}</Text>
                    ) : null}
                    {companyName ? (
                      <Button
                        variant="ghost"
                        label={companyName + '  →'}
                        onPress={() =>
                          navigation.navigate('BusinessProfile', { businessId: booking.business_id })
                        }
                        style={styles.companyBtn}
                      />
                    ) : null}
                  </Stack>

                  {/* Rating + jobs */}
                  {(rating != null || jobCount != null) && (
                    <Inline spacing="lg">
                      {rating != null && (
                        <Inline spacing="xs">
                          <RatingStarsDisplay rating={Number(rating)} size={13} color={colors.accent} />
                          <Text variant="smallMedium">{Number(rating).toFixed(1)}</Text>
                        </Inline>
                      )}
                      {jobCount != null && (
                        <Text variant="small" color="secondary">{jobCount} jobs</Text>
                      )}
                    </Inline>
                  )}
                </Stack>
              </Surface>
            </SpringCard>

            {/* ── Status timeline ── */}
            <SpringCard delay={60} style={styles.hPad}>
              <Surface elevation="subtle" style={styles.timelineSurface}>
                <Text variant="label" color="secondary" style={{ marginBottom: spacing.md }}>
                  Booking status
                </Text>
                <BookingStatusTimeline currentStatus={booking.status} />
              </Surface>
            </SpringCard>

            {/* ── ETA card ── */}
            <SpringCard delay={120} style={styles.hPad}>
              <Surface elevation="subtle" background="alt" style={styles.etaCard}>
                <Inline spacing="md">
                  <View style={styles.etaIcon}>
                    <Feather name="clock" size={18} color={colors.accent} />
                  </View>
                  <Stack spacing={2} style={{ flex: 1 }}>
                    <Text variant="label" color="secondary">Status update</Text>
                    <Text variant="smallMedium">{etaText}</Text>
                    {booking.scheduled_time && (
                      <Text variant="caption" color="secondary">
                        Scheduled at {booking.scheduled_time}
                      </Text>
                    )}
                  </Stack>
                </Inline>
              </Surface>
            </SpringCard>

            {/* ── Job details card ── */}
            <SpringCard delay={180} style={styles.hPad}>
              <Surface elevation="subtle">
                <Stack spacing="sm">
                  <Text variant="label" color="secondary">Job details</Text>

                  {booking.service_type && (
                    <DetailRow label="Service" value={booking.service_type} />
                  )}
                  {date && <DetailRow label="Date" value={date} />}
                  {booking.scheduled_time && (
                    <DetailRow label="Time" value={booking.scheduled_time} />
                  )}
                  {booking.address && (
                    <DetailRow label="Address" value={booking.address} />
                  )}
                  {booking.total_amount && (
                    <DetailRow label="Price" value={`$${booking.total_amount}`} accent />
                  )}
                </Stack>
              </Surface>
            </SpringCard>

            {/* ── Cancel booking (subdued) ── */}
            {(booking.status === 'confirmed') && (
              <SpringCard delay={220} style={styles.hPad}>
                <Button
                  variant="secondary"
                  label="Cancel booking"
                  onPress={() => navigation.navigate('CancellationFlow', { bookingId: booking.id })}
                  style={styles.cancelBtn}
                />
              </SpringCard>
            )}
          </ScrollView>

          {/* ── Chat shortcut bar ── */}
          {isConfirmed && (
            <View style={[styles.chatBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
              <Button
                variant="secondary"
                label="Open chat"
                icon={<Feather name="message-circle" size={18} color={colors.accent} />}
                onPress={() =>
                  navigation.navigate('Chat', {
                    bookingId: booking.id,
                    otherPartyName: booking.business_name || 'Provider',
                  })
                }
                style={styles.chatBtn}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  header:       { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  iconBtn:      { paddingVertical: 0, paddingHorizontal: 0, width: 44, justifyContent: 'center' },
  content:      { gap: spacing.md, paddingTop: spacing.base },
  hPad:         { marginHorizontal: spacing.lg },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon:    {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:   { marginTop: spacing.lg, textAlign: 'center' },
  emptyBody:    { marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 },

  // Worker card
  workerCard:   { alignItems: 'center', gap: spacing.md },
  statusBadge:  {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, backgroundColor: colors.accentMuted,
    alignItems: 'center', minWidth: 0,
  },
  companyBtn:   { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },

  // Timeline
  timelineSurface: { paddingVertical: spacing.base },

  // ETA card
  etaCard:      { paddingVertical: spacing.md },
  etaIcon:      {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  // Detail row
  detailRow:    {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Cancel
  cancelBtn:    { borderColor: colors.danger + '4D' },

  // Chat bar
  chatBar:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  chatBtn:      { borderColor: colors.accent + '59' },
});
