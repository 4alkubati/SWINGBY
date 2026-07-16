// T57 — BookingDetailsScreen (UX polish pass)
// Uber-style worker card + job details + action buttons.
// Route params: { bookingId }
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Linking, Share } from 'react-native';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import * as toast from '../../services/toast';
import * as haptics from '../../services/haptics';
import BookingStatusTimeline from '../../components/BookingStatusTimeline';
import LiveStatusTimeline from '../../components/LiveStatusTimeline';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import BookingPhotos from '../../components/BookingPhotos';
import { RatingStarsDisplay } from '../../components/RatingStars';
import { SkeletonBox } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

// ─── AnimatedPressable helper ─────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ScalePressable({ onPress, style, children, ...props }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.98, {
          stiffness: motion.spring.stiffness,
          damping: motion.spring.damping,
        });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, {
          stiffness: motion.spring.stiffness,
          damping: motion.spring.damping,
        });
      }}
      onPress={onPress}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function paymentPillStyle(status) {
  // Purple text uses accentText for AA contrast on dark. Held/partial = live-state purple; fully_released = success green.
  switch ((status || '').toLowerCase()) {
    case 'fully_released':   return { bg: colors.success + '24', border: colors.success + '4D', text: colors.success };
    case 'partial_released': return { bg: colors.accent + '24',  border: colors.borderAccent,   text: colors.accentText };
    case 'held':             return { bg: colors.accent + '24',  border: colors.borderAccent,   text: colors.accentText };
    case 'refunded':         return { bg: colors.danger + '24',  border: colors.danger + '4D',  text: colors.danger };
    default:                 return { bg: colors.surfaceAlt,     border: colors.border,         text: colors.textSecondary };
  }
}

function clientDisplayName(booking) {
  const u = booking?.users ?? {};
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Client';
}

function paymentPillLabel(status) {
  switch ((status || '').toLowerCase()) {
    case 'fully_released':     return 'PAID';
    case 'partial_released':   return 'IN PROGRESS';
    case 'held':               return 'HELD';
    case 'refunded':           return 'REFUNDED';
    case 'paid_off_platform':  return 'PAID (OFF-PLATFORM)';
    default:                   return (status || 'pending').toUpperCase();
  }
}

// ─── Skeleton layout ──────────────────────────────────────────────────────────
function BookingSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg - spacing.sm }}
      showsVerticalScrollIndicator={false}
    >
      <SkeletonBox width="100%" height={60} borderRadius={radius.input} />
      <SkeletonBox width="100%" height={130} borderRadius={radius.card} />
      <SkeletonBox width="100%" height={180} borderRadius={radius.card} />
    </ScrollView>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────
function ScreenHeader({ navigation, onShare }) {
  return (
    <Inline
      justify="space-between"
      style={{
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="arrow-left" size={22} color={colors.textPrimary} accessible={false} />
      </Pressable>

      <Text variant="bodyMedium" accessibilityRole="header" maxFontSizeMultiplier={1.4}>Booking Details</Text>

      <Pressable
        onPress={onShare}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Share booking link"
        style={{
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="share-2" size={18} color={colors.textSecondary} accessible={false} />
      </Pressable>
    </Inline>
  );
}

// ─── Detail row with spring press ─────────────────────────────────────────────
function DetailRow({ icon, label, children, onPress }) {
  const content = (
    <Inline
      spacing="sm"
      style={{ paddingVertical: spacing.sm + 2 }}
    >
      <Feather name={icon} size={15} color={colors.textSecondary} strokeWidth={1.8} />
      <Text variant="small" color="secondary" style={{ width: 72 }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {children}
      </View>
    </Inline>
  );

  if (onPress) {
    return (
      <ScalePressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </ScalePressable>
    );
  }

  return content;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function BookingDetailsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookingId } = route.params ?? {};
  const isProviderView = user?.role === 'business_owner' || user?.role === 'employee';

  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error | deleted

  const fetchBooking = useCallback(async () => {
    if (!bookingId) { setStatus('deleted'); return; }
    setStatus('loading');
    try {
      // bookings.payment_status only tracks escrow release (held|partial_released|fully_released).
      // The client-paid-Stripe-in-full signal lives on payments.status = 'paid_full', so we
      // fetch the payments row in parallel and use it to gate the "Pay with card" button.
      const [bookingData, paymentData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get(`/payments/${bookingId}`).catch(() => null),
      ]);
      // Flatten the nested joins into the flat fields this screen renders.
      const empUser = bookingData?.employees?.users;
      const biz = bookingData?.businesses;
      setBooking(bookingData && {
        ...bookingData,
        worker: {
          name: empUser
            ? [empUser.first_name, empUser.last_name].filter(Boolean).join(' ')
            : biz?.business_name,
          role_title: bookingData.employees?.role_title,
          avatar_url: bookingData.employees?.avatar_url,
          avg_rating: biz?.avg_rating,
          review_count: biz?.review_count,
        },
        business_name: biz?.business_name ?? null,
        category: bookingData.service_posts?.title || bookingData.service_category || null,
        scheduled_at: bookingData.confirmed_date || bookingData.proposed_date_1 || null,
        address: bookingData.service_posts?.address ?? null,
      });
      setPayment(paymentData);
      setStatus('ready');
    } catch (err) {
      // api.js interceptor rejects with the FastAPI detail string only — no status code.
      if (err.message?.toLowerCase().includes('not found')) {
        setStatus('deleted');
      } else {
        setStatus('error');
      }
    }
  }, [bookingId]);

  useEffect(() => { fetchBooking(); }, [fetchBooking]);

  const handleShare = async () => {
    const link = `swingby://booking/${bookingId}`;
    try {
      await Clipboard.setStringAsync(link);
      toast.show({ type: 'success', text1: 'Link copied', text2: link });
    } catch {
      toast.show({ type: 'error', text1: 'Could not copy link' });
    }
  };

  const openInMaps = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${encoded}`)
    );
  };

  const handleMessage = () => {
    navigation.navigate('MessageThread', { bookingId });
  };

  const handleCancel = () => {
    navigation.navigate('CancellationFlow', {
      bookingId,
      scheduledDate: booking?.scheduled_at,
    });
  };

  const [payInFlight, setPayInFlight] = useState(false);
  const [offPayVisible, setOffPayVisible] = useState(false);
  const [offPayInFlight, setOffPayInFlight] = useState(false);

  async function submitOffPlatform(method) {
    if (offPayInFlight) return;
    setOffPayInFlight(true);
    try {
      await api.post(`/bookings/${bookingId}/mark-paid-offplatform`, { method });
      setOffPayVisible(false);
      toast.show({ type: 'success', text1: 'Payment recorded' });
      await fetchBooking();
    } catch (err) {
      toast.show({ type: 'error', text1: 'Could not mark paid', text2: err?.message || '' });
    } finally {
      setOffPayInFlight(false);
    }
  }

  const handlePay = async () => {
    if (payInFlight) return;
    setPayInFlight(true);
    try {
      const res = await api.post(`/payments/stripe/checkout/${bookingId}`, {});
      if (res?.url) {
        await Linking.openURL(res.url);
      } else {
        toast.show({ type: 'error', text1: 'Could not start checkout' });
      }
    } catch (err) {
      const msg = err?.message ?? '';
      // The 503 path surfaces as the detail string ("Stripe is not configured…"),
      // not a status code, after the axios interceptor unwrap.
      if (msg.toLowerCase().includes('stripe is not configured') || msg.includes('STRIPE_SECRET_KEY')) {
        toast.show({
          type: 'error',
          text1: 'Payments not enabled yet',
          text2: 'Stripe sandbox is being configured.',
        });
      } else {
        toast.show({ type: 'error', text1: 'Checkout failed', text2: msg });
      }
    } finally {
      setPayInFlight(false);
    }
  };

  // ── Loading state ──
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ScreenHeader navigation={navigation} onShare={handleShare} />
        <BookingSkeleton />
      </View>
    );
  }

  // ── Deleted state ──
  if (status === 'deleted') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ScreenHeader navigation={navigation} onShare={handleShare} />
        <EmptyState
          icon="trash-2"
          title="Booking no longer exists"
          body="This booking may have been cancelled or removed."
        />
      </View>
    );
  }

  // ── Error state ──
  if (status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <ScreenHeader navigation={navigation} onShare={handleShare} />
        <EmptyState
          icon="wifi-off"
          title="Could not load booking"
          body="Check your connection and try again."
          action={{ label: 'Retry', onPress: fetchBooking }}
        />
      </View>
    );
  }

  // ── Ready ──
  const worker = booking?.worker ?? booking?.employee ?? {};
  const workerName = worker.name ?? worker.full_name ?? 'Worker';
  const workerRole = worker.role_title ?? 'Service Provider';
  const companyName = booking?.business_name ?? worker.company_name ?? '';
  const workerRating = parseFloat(worker.avg_rating ?? worker.rating ?? 0);
  const workerJobs = worker.job_count ?? worker.review_count ?? 0;

  const payPill = paymentPillStyle(booking?.payment_status);
  const canCancel = ['confirmed', 'on_the_way'].includes(booking?.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <ScreenHeader navigation={navigation} onShare={handleShare} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.base,
          gap: spacing.md,
          paddingBottom: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Confirm-date handshake — pinned when the business has proposed dates
            and the client hasn't confirmed one yet (UBER-3) */}
        <ConfirmDateCard bookingId={bookingId} booking={booking} onConfirmed={fetchBooking} />

        {/* Status timeline card */}
        <Surface
          elevation="subtle"
          padding={0}
          style={{ paddingVertical: spacing.base, paddingHorizontal: spacing.sm }}
        >
          <BookingStatusTimeline currentStatus={booking?.status ?? 'confirmed'} />
        </Surface>

        {/* Live Job Status — real-time provider events */}
        <LiveStatusTimeline bookingId={bookingId} />

        {/* Before / After photos — proof of work */}
        <BookingPhotos bookingId={bookingId} />

        {/* Client card — provider view: who the customer is + one-tap message */}
        {isProviderView && (
          <Surface elevation="subtle">
            <Inline spacing="base" align="center">
              <View style={shadows.subtle}>
                <Avatar
                  size="lg"
                  name={clientDisplayName(booking)}
                  source={booking?.users?.avatar_url}
                />
              </View>
              <Stack spacing="xs" style={{ flex: 1 }}>
                <Text variant="label" color="secondary">CLIENT</Text>
                <Text variant="bodyMedium">{clientDisplayName(booking)}</Text>
                {!!booking?.address && (
                  <Text variant="small" color="secondary" numberOfLines={1}>
                    {booking.address}
                  </Text>
                )}
              </Stack>
              <ScalePressable
                onPress={handleMessage}
                accessibilityRole="button"
                accessibilityLabel={`Message ${clientDisplayName(booking)}`}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: colors.accentMuted,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Feather name="message-circle" size={20} color={colors.accentText} />
              </ScalePressable>
            </Inline>
          </Surface>
        )}

        {/* Worker card */}
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={`View profile of ${workerName}`}
        >
          <Surface elevation="subtle">
            <Inline spacing="base" align="center">
              {/* Avatar with shadow wrap */}
              <View style={shadows.subtle}>
                <Avatar size="lg" name={workerName} source={worker.avatar_url ?? worker.photo_url} />
              </View>

              {/* Worker info */}
              <Stack spacing="xs" style={{ flex: 1 }}>
                <Text variant="bodyMedium">{workerName}</Text>
                <Text variant="small" color="secondary">{workerRole}</Text>

                {!!companyName && (
                  <ScalePressable
                    onPress={() =>
                      navigation.navigate('BusinessProfile', { businessId: booking?.business_id })
                    }
                    accessibilityRole="link"
                    accessibilityLabel={`View ${companyName} business profile`}
                  >
                    <Text variant="smallMedium" color="accent">{companyName}</Text>
                  </ScalePressable>
                )}

                <Inline spacing="sm" style={{ marginTop: spacing.xs }}>
                  <RatingStarsDisplay rating={workerRating} size={13} />
                  <Text variant="caption" color="secondary">{workerJobs} jobs</Text>
                </Inline>
              </Stack>
            </Inline>
          </Surface>
        </ScalePressable>

        {/* Job details card */}
        <Surface elevation="subtle">
          <Stack spacing={0}>
            <Text
              variant="label"
              color="secondary"
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}
              style={{ marginBottom: spacing.md }}
            >
              Job Details
            </Text>

            {/* Service row */}
            <DetailRow icon="briefcase" label="Service">
              <Text variant="bodyMedium" style={{ textAlign: 'right' }}>
                {booking?.category ?? booking?.service_type ?? '—'}
              </Text>
            </DetailRow>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Scheduled row */}
            <DetailRow icon="calendar" label="Scheduled">
              <Text variant="bodyMedium" style={{ textAlign: 'right' }}>
                {formatDate(booking?.scheduled_at)}{' '}
                {formatTime(booking?.scheduled_at)}
              </Text>
            </DetailRow>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Address row — tappable */}
            <DetailRow
              icon="map-pin"
              label="Address"
              onPress={() => openInMaps(booking?.address)}
            >
              <Text
                variant="small"
                numberOfLines={2}
                style={{ textAlign: 'right', color: colors.accentText, textDecorationLine: 'underline' }}
              >
                {booking?.address ?? '—'}
              </Text>
            </DetailRow>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Price row */}
            <DetailRow icon="dollar-sign" label="Price">
              <Inline spacing="sm" align="center" justify="flex-end">
                <Text variant="display3" maxFontSizeMultiplier={1.4} style={{ color: colors.success, fontVariant: ['tabular-nums'] }}>
                  ${parseFloat(booking?.quoted_price ?? booking?.price ?? 0).toFixed(2)}
                </Text>
                <View
                  style={{
                    borderRadius: radius.chip,
                    borderWidth: 1,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs - 1,
                    backgroundColor: payPill.bg,
                    borderColor: payPill.border,
                  }}
                >
                  <Text
                    variant="caption"
                    style={{ color: payPill.text, fontWeight: '700', letterSpacing: 0.8 }}
                  >
                    {paymentPillLabel(booking?.payment_status)}
                  </Text>
                </View>
              </Inline>
            </DetailRow>
          </Stack>
        </Surface>

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action buttons — bottom thumb-reach zone */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.base,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.sm + 2,
        }}
      >
        {user?.role === 'client' && (payment?.status !== 'paid_full' && payment?.status !== 'paid_off_platform' && booking?.status !== 'cancelled') && (
          <Button
            variant="primary"
            label={payInFlight ? 'Opening checkout…' : 'Pay with card'}
            onPress={handlePay}
            disabled={payInFlight}
            icon={<Feather name="credit-card" size={18} color={colors.textPrimary} />}
          />
        )}

        {/* D2.3 — off-platform mark-as-paid (only after completion, only if unpaid) */}
        {booking?.status === 'completed'
          && payment?.status !== 'paid_full'
          && payment?.status !== 'paid_off_platform' && (
          <Button
            variant="secondary"
            label="Mark as paid (cash / e-transfer)"
            onPress={() => setOffPayVisible(true)}
            icon={<Feather name="dollar-sign" size={18} color={colors.textPrimary} />}
          />
        )}

        {/* D2.2 — view receipt after completion */}
        {booking?.status === 'completed' && (
          <Button
            variant="ghost"
            label="View receipt"
            onPress={() => navigation.navigate('Invoice', { bookingId })}
            icon={<Feather name="file-text" size={18} color={colors.textPrimary} />}
          />
        )}

        <Button
          variant={payment?.status === 'paid_full' ? 'primary' : 'ghost'}
          label="Message"
          onPress={handleMessage}
          icon={<Feather name="message-circle" size={18} color={colors.textPrimary} />}
        />

        {canCancel && (
          <Button
            variant="ghost"
            label="Cancel booking"
            onPress={handleCancel}
            style={{ minHeight: 44 }}
          />
        )}

        {(booking?.status === 'completed' || booking?.status === 'confirmed' || booking?.status === 'in_progress') && (
          <Button
            variant="ghost"
            label="Report a problem"
            onPress={() => navigation.navigate('DisputeFlow', { bookingId })}
            icon={<Feather name="alert-triangle" size={18} color={colors.textPrimary} />}
            style={{ minHeight: 44 }}
          />
        )}
      </View>

      {/* D2.3 — off-platform pay modal */}
      {offPayVisible && (
        <Pressable
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
          }}
          onPress={() => setOffPayVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.bg, borderTopLeftRadius: radius.card,
              borderTopRightRadius: radius.card, padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg, gap: spacing.md,
            }}
          >
            <Text variant="h1">How was it paid?</Text>
            <Text variant="body" color="secondary">
              Recording only — SwingBy doesn't touch the money.
            </Text>
            <Button
              label="Cash"
              onPress={() => submitOffPlatform('cash')}
              disabled={offPayInFlight}
              loading={offPayInFlight}
            />
            <Button
              variant="secondary"
              label="E-transfer"
              onPress={() => submitOffPlatform('e_transfer')}
              disabled={offPayInFlight}
            />
            <Button
              variant="ghost"
              label="Other"
              onPress={() => submitOffPlatform('other')}
              disabled={offPayInFlight}
            />
            <Button
              variant="ghost"
              label="Cancel"
              onPress={() => setOffPayVisible(false)}
              disabled={offPayInFlight}
            />
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}
