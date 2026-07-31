// T57 — BookingDetailsScreen (UX polish pass)
// Uber-style worker card + job details + action buttons.
// Route params: { bookingId }
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  ScrollView,
  Pressable,
  Platform,
  Alert,
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
import i18n from '../../i18n';
import * as toast from '../../services/toast';
import * as haptics from '../../services/haptics';
import BookingStatusTimeline from '../../components/BookingStatusTimeline';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import PaySheet, { CHECKOUT_METHOD } from '../../components/PaySheet';
import BookingPhotos from '../../components/BookingPhotos';
import ProviderLiveLocation from '../../components/ProviderLiveLocation';
import { RatingStarsDisplay } from '../../components/RatingStars';
import { SkeletonBox } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import Avatar from '../../components/Avatar';
import BusinessLogo from '../../components/BusinessLogo';
import Button from '../../components/Button';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';
import { TEXT_END } from '../../services/rtl';

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

// ─── B16 — humanise booking_events ────────────────────────────────────────────
// The screen printed the raw column value (`date_confirmed`) and, inside the
// note, a raw ISO instant (`2026-07-25T20:30:00+00:00`) straight at the client.
// Every event_type the backend will accept is listed in
// backend/app/api/booking_events.py `_ALLOWED_EVENT_TYPES`; all nine are
// covered here, and anything a future backend adds falls back to a neutral
// sentence instead of a snake_case enum.
const EVENT_COPY = {
  dates_proposed:  { icon: 'calendar',      key: 'booking.eventDatesProposed' },
  date_confirmed:  { icon: 'check-circle',  key: 'booking.eventDateConfirmed' },
  en_route:        { icon: 'navigation',    key: 'booking.eventEnRoute' },
  arrived:         { icon: 'map-pin',       key: 'booking.eventArrived' },
  started:         { icon: 'play-circle',   key: 'booking.eventStarted' },
  paused:          { icon: 'pause-circle',  key: 'booking.eventPaused' },
  resumed:         { icon: 'play-circle',   key: 'booking.eventResumed' },
  completed:       { icon: 'check-circle',  key: 'booking.eventCompleted' },
  cancelled_event: { icon: 'x-circle',      key: 'booking.eventCancelled' },
};

const ISO_IN_TEXT = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g;

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return `${d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

// The backend writes notes like "Time set at posting: 2026-07-25T20:30:00+00:00".
// Rewrite any ISO instant inside a note into the reader's local wall clock.
export function humaniseNote(note) {
  if (!note) return '';
  return note.replace(ISO_IN_TEXT, (m) => formatDateTime(m));
}

export function eventTitle(eventType) {
  const meta = EVENT_COPY[eventType];
  return meta ? i18n.t(meta.key) : i18n.t('booking.eventGeneric');
}

export function eventIcon(eventType) {
  return EVENT_COPY[eventType]?.icon || 'circle';
}

// ─── B15 — the progress bar must be earned, not elapsed ───────────────────────
// "On the way" / "In progress" were lighting up on bookings where nothing had
// happened, because the bar was driven by bookings.status — a column that
// ConfirmDateCard alone flips to 'in_progress' the moment a DATE is confirmed
// (components/ConfirmDateCard.js:103), long before anyone is in progress.
//
// booking_events is the trust spine (see the module docstring in
// backend/app/api/booking_events.py): the provider physically taps On my way /
// Arrived / Start / Complete and an immutable row is appended. Only those rows
// may advance the bar. Nothing else — not the clock, not a scheduled date, not
// a status column written by a side effect.
const STAGE_FOR_EVENT = {
  en_route: 'on_the_way',
  arrived: 'on_the_way',
  started: 'in_progress',
  paused: 'in_progress',
  resumed: 'in_progress',
  completed: 'completed',
};
const STAGE_ORDER = ['confirmed', 'on_the_way', 'in_progress', 'completed'];

export function stageFromEvents(events, bookingStatus) {
  if (bookingStatus === 'cancelled') return 'cancelled';
  // 'completed' is a terminal fact the bookings row also carries honestly
  // (PATCH /bookings/{id}/complete writes it), so it is trusted directly.
  if (bookingStatus === 'completed') return 'completed';

  let best = 0; // 'confirmed' — the booking exists, that much is true
  for (const ev of events || []) {
    if (ev?.event_type === 'cancelled_event') return 'cancelled';
    const stage = STAGE_FOR_EVENT[ev?.event_type];
    if (!stage) continue;
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx > best) best = idx;
  }
  return STAGE_ORDER[best];
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
    case 'pending_payment':    return 'PENDING';
    case 'pending':            return 'PENDING';
    case 'failed':             return 'PAYMENT FAILED';
    // Never shout a raw column value with underscores at the user.
    default:                   return (status || 'pending').replace(/_/g, ' ').toUpperCase();
  }
}

// ── Has money actually been taken for this booking? ──────────────────────────
//
// A successful Stripe capture writes payments.status = 'held' — see the capture
// webhook in backend/app/api/payments_stripe.py, and verified against the live
// database: the one production payments row with a real PaymentIntent behind it
// sits at 'held'. Nothing anywhere writes 'paid_full'.
//
// This screen tested `status !== 'paid_full'` to decide whether to offer "Pay
// with card". Since nothing ever writes that value, the test could never be
// false: the button survived a successful payment and a second tap opened a
// SECOND Stripe checkout — a real double charge.
//
// (Several comments in this repo attribute the rename to a "migration 0001".
// No such migration exists in supabase_migrations.schema_migrations and no such
// file is in the tree. The behaviour below is keyed to what the backend
// observably writes, not to that story.)
//
// Deliberately an ALLOWLIST of "still owes money", not a blocklist of paid
// states. Polarity matters: with a blocklist, any status nobody thought of
// (a future rename, a state this build predates, a failed fetch) falls through
// to "show the pay button" and risks charging twice. With an allowlist the
// same unknown falls through to "don't offer to pay", which at worst sends the
// client to cash / e-transfer. Never charge twice to save a tap.
const AWAITING_PAYMENT = new Set([
  'pending_payment', // what the backend writes today
  'pending',         // older rows / older backends
  'failed',          // capture failed — paying again is the correct action
]);

export function isAwaitingPayment(payment) {
  // No payments row in hand (404, or the parallel fetch failed) means we do not
  // KNOW whether money was taken. Stay silent rather than risk a double charge.
  if (!payment) return false;
  return AWAITING_PAYMENT.has((payment.status || '').toLowerCase());
}

// Money has been captured — held in escrow, partly released, fully released, or
// settled off-platform. The older names are kept because rows written by an
// earlier backend may still carry them; backend/app/services/escrow.py accepts
// both sets for exactly the same reason.
const CAPTURED = new Set([
  'held', 'partial_released', 'fully_released', 'paid_off_platform',
  'paid_full', 'partial', // older rows / older backends
]);

export function hasBeenCharged(payment) {
  return CAPTURED.has((payment?.status || '').toLowerCase());
}

// ─── Escrow milestones (read-only) ─────────────────────────────────────────────
// GAP-AUDIT #10 — payments.escrow_held / released_to_business are tracked by
// the backend (interests.py accept → 50% released; bookings.py complete_booking
// → remaining released) but no screen ever surfaced them. Pure display, zero
// writes to any payment endpoint.
function EscrowMilestones({ payment }) {
  if (!payment) return null;

  const totalCharged = parseFloat(payment.total_charged ?? 0);
  const releasedToBusiness = parseFloat(payment.released_to_business ?? 0);
  const escrowHeld = parseFloat(payment.escrow_held ?? 0);
  const payStatus = (payment.status || '').toLowerCase();

  // AUDIT L5 — `total_charged > 0` is not "the money arrived". The column is
  // populated when the booking is priced, so this ticked "Funds held" on
  // bookings that were never paid. hasBeenCharged() is defined 10 lines up and
  // checks the payment STATUS against the captured set — use the helper that
  // already exists rather than a second, looser definition of "paid".
  const fundsHeld = hasBeenCharged(payment);
  const halfReleased = releasedToBusiness > 0 || ['partial', 'fully_released'].includes(payStatus);
  const fullyReleased = payStatus === 'fully_released' && escrowHeld === 0;

  const steps = [
    { key: 'held', label: i18n.t('escrow.fundsHeld'), done: fundsHeld },
    { key: 'half', label: i18n.t('escrow.halfReleased'), done: halfReleased },
    { key: 'full', label: i18n.t('escrow.fullReleased'), done: fullyReleased },
  ];

  return (
    <Surface elevation="subtle">
      <Stack spacing="sm">
        <Inline spacing="xs" align="center">
          <Feather name="lock" size={14} color={colors.textSecondary} strokeWidth={1.8} />
          <Text variant="label" color="secondary" accessibilityRole="header">
            {i18n.t('escrow.title')}
          </Text>
        </Inline>

        {steps.map((step, i) => (
          <Inline key={step.key} spacing="sm" align="center">
            <Feather
              name={step.done ? 'check-circle' : 'circle'}
              size={16}
              color={step.done ? colors.success : colors.textSecondary}
              strokeWidth={1.8}
            />
            <Text
              variant="small"
              color={step.done ? 'primary' : 'secondary'}
              style={{ flex: 1 }}
            >
              {step.label}
            </Text>
            {i === 1 && halfReleased && (
              <Text variant="caption" color="secondary">
                ${releasedToBusiness.toFixed(2)}
              </Text>
            )}
            {i === 2 && fullyReleased && (
              <Text variant="caption" color="secondary">
                ${totalCharged.toFixed(2)}
              </Text>
            )}
          </Inline>
        ))}
      </Stack>
    </Surface>
  );
}

// ─── Live status (humanised) ─────────────────────────────────────────────────
// components/LiveStatusTimeline.js is the shared component this replaced on
// this screen. It is untouched — another lane owns shared components this
// session, and JobManagementScreen still renders it — but it is the source of
// B16 (its COPY map has no entry for date_confirmed / dates_proposed, so it
// falls through to `title: ev.event_type`, and it appends ev.note verbatim).
// The same fix belongs there next.
function LiveStatusCard({ events, status, onRetry }) {
  if (status === 'loading') {
    return (
      <Surface elevation="subtle">
        <Inline justify="center" spacing="sm">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text variant="small" color="secondary">{i18n.t('common.loading')}</Text>
        </Inline>
      </Surface>
    );
  }

  if (status === 'error') {
    return (
      <Surface elevation="subtle">
        <Stack spacing="sm">
          <Text variant="small" color="secondary">{i18n.t('booking.liveStatusError')}</Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('common.retry')}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="smallMedium" color={colors.accentText}>{i18n.t('common.retry')}</Text>
          </Pressable>
        </Stack>
      </Surface>
    );
  }

  return (
    <Surface elevation="subtle">
      <Stack spacing="sm">
        <Text variant="label" color="secondary" accessibilityRole="header">
          {i18n.t('booking.liveStatus')}
        </Text>

        {!events.length ? (
          <Text variant="small" color="secondary">
            {i18n.t('booking.liveStatusEmpty')}
          </Text>
        ) : (
          events.map((ev, i) => (
            <Inline
              key={ev.id || `${ev.event_type}-${i}`}
              spacing="sm"
              align="flex-start"
              style={{ paddingVertical: spacing.xs }}
            >
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                backgroundColor: colors.accentMuted,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather
                  name={eventIcon(ev.event_type)}
                  size={14}
                  color={colors.accentText}
                  strokeWidth={1.8}
                />
              </View>
              <Stack spacing={2} style={{ flex: 1 }}>
                <Text variant="smallMedium">{eventTitle(ev.event_type)}</Text>
                <Text variant="caption" color="secondary">
                  {formatTime(ev.created_at)}
                  {ev.note ? ` · ${humaniseNote(ev.note)}` : ''}
                </Text>
              </Stack>
            </Inline>
          ))
        )}
      </Stack>
    </Surface>
  );
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

  // B15 / B16 — the live timeline is fetched here so the progress bar and the
  // event list are driven by the same rows, and neither can disagree with the
  // other or with reality.
  const [events, setEvents] = useState([]);
  const [eventsStatus, setEventsStatus] = useState('loading');

  const fetchEvents = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await api.get(`/bookings/${bookingId}/events`);
      setEvents(Array.isArray(res?.items) ? res.items : []);
      setEventsStatus('ready');
    } catch {
      setEventsStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, [bookingId]);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) { setStatus('deleted'); return; }
    setStatus('loading');
    try {
      // bookings.payment_status only tracks escrow release (held|partial_released|fully_released).
      // Whether the client has actually been charged lives on the payments row —
      // a successful Stripe capture writes payments.status = 'held' (NOT the
      // retired 'paid_full'; see isAwaitingPayment above). Fetch it in parallel
      // and use it to gate the "Pay with card" button.
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
          // M8: with nobody assigned the card IS the business, so it should
          // wear the business's face — a logo tile, not a person circle.
          is_business: !empUser,
        },
        business_name: biz?.business_name ?? null,
        business_logo: biz?.logo_url ?? null,
        category: bookingData.service_posts?.title || bookingData.service_category || null,
        scheduled_at: bookingData.confirmed_date || bookingData.proposed_date_1 || null,
        address: bookingData.service_posts?.address ?? null,
        // The job's real coordinates. The flatten dropped these, which left the
        // live-location map with a single point and therefore nothing to scale
        // against — on a device without Play Services that came out as a dot at
        // dead centre no matter where the provider actually was.
        job_lat:
          typeof bookingData.service_posts?.lat === 'number'
            ? bookingData.service_posts.lat
            : null,
        job_lng:
          typeof bookingData.service_posts?.lng === 'number'
            ? bookingData.service_posts.lng
            : null,
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

  // Poll the event feed on the same 8s cadence the shared timeline used.
  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 8000);
    return () => clearInterval(id);
  }, [fetchEvents]);

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

  // Releasing the money is irreversible and it is someone else's payday, so it
  // confirms first — and the confirm names the amount, because "approve" on its
  // own does not tell the client what they are agreeing to part with.
  const [approving, setApproving] = useState(false);
  const handleApproveWork = () => {
    const held = booking?.payment_state?.amount_held;
    Alert.alert(
      i18n.t('approval.confirmTitle'),
      held
        ? i18n.t('approval.confirmBodyAmount', { amount: `$${Number(held).toFixed(2)}` })
        : i18n.t('approval.confirmBody'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('approval.approveShort'),
          onPress: async () => {
            if (approving) return;
            setApproving(true);
            try {
              await api.post(`/bookings/${bookingId}/approve`);
              haptics.buttonTap?.();
              toast.show({ type: 'success', text1: i18n.t('approval.released') });
              fetchBooking();
            } catch (err) {
              toast.show({
                type: 'error',
                text1: i18n.t('approval.failed'),
                text2: err?.response?.data?.detail || '',
              });
            } finally {
              setApproving(false);
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    navigation.navigate('CancellationFlow', {
      bookingId,
      scheduledDate: booking?.scheduled_at,
    });
  };

  // CARD-12 — Rebook. `booking.service_category` is the raw bookings-table
  // column (set at booking creation from the accepted post's category — see
  // interests.py accept_interest); `booking.category` above is overwritten
  // with the job's post title for display, so we read the raw column here
  // instead so the chip picker on PostJobScreen can actually match a
  // CATEGORY_LABELS entry. `booking.total_amount` is the real bookings-table
  // price column (the Price row on this screen reads quoted_price/price,
  // which aren't columns on this table — pre-existing, not touched here).
  const handleRebook = () => {
    navigation.navigate('PostJob', {
      rebookBusinessId: booking?.business_id,
      rebookBusinessName: companyName || booking?.business_name,
      rebookCategory: booking?.service_category,
      rebookAddress: booking?.address,
      rebookBudget: booking?.total_amount,
    });
  };

  const [offPayVisible, setOffPayVisible] = useState(false);
  const [offPayInFlight, setOffPayInFlight] = useState(false);
  // D5 — one primary CTA plus an overflow menu.
  const [moreVisible, setMoreVisible] = useState(false);
  // M9 — the SwingBy-branded pay sheet in front of the existing mechanism.
  const [payVisible, setPayVisible] = useState(false);

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

  // Runs from inside PaySheet: it owns the spinner, the declined chip and the
  // re-enable, so this throws rather than toasting (PAYMENTS.md §States).
  const handlePay = async () => {
    let res;
    try {
      res = await api.post(`/payments/stripe/checkout/${bookingId}`, {});
    } catch (err) {
      const msg = err?.message ?? '';
      // The 503 path surfaces as the detail string ("Stripe is not configured…"),
      // not a status code, after the axios interceptor unwrap.
      if (msg.toLowerCase().includes('stripe is not configured') || msg.includes('STRIPE_SECRET_KEY')) {
        throw new Error('Payments are not switched on yet. Nothing was charged.');
      }
      throw new Error(msg || 'Could not start the payment. Try again.');
    }
    if (!res?.url) throw new Error('Could not start the payment. Try again.');
    await Linking.openURL(res.url);
    setPayVisible(false);
    // The capture lands via the Stripe webhook, so re-read on return.
    fetchBooking();
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
  // Both sides now. This was clients-only because CancellationFlow lived in
  // ClientNavigator and its copy quoted the client's fee — pointing a business at
  // it would have described the wrong party's money, so the button was hidden
  // rather than made to lie.
  //
  // Resolved 2026-07-30: the flow reads the actor from the session and shows the
  // provider its own half of the ladder (client refunded in full, penalty against
  // the business, goodwill credit to the client), and it is registered in
  // BusinessNavigator. The backend always permitted it — cancel_booking derives
  // the actor from the caller's role and refuses only completed/cancelled.
  // `in_progress` HAS to be here, and `on_the_way` never did.
  //
  // 'on_the_way' is not a bookings.status — nothing in the backend ever writes
  // it (it is a booking_events.event_type), so that entry matched nothing and
  // this list effectively read `status === 'confirmed'`.
  //
  // Which broke the cancellation ladder outright. `confirm-date` sets
  // `confirmed_date` and `status: 'in_progress'` in the SAME update
  // (bookings.py), so a booking is only ever `confirmed` while it has no agreed
  // date. Cancel therefore only appeared during the one window where
  // `classify_cancellation_timing()` returns 'no_date' — the single free
  // outcome. Every timed rung of the published ToS ladder (>48h 100%, ≤48h 75/25,
  // after the date 50/50) was unreachable, so a business could never be
  // compensated for a late client cancellation no matter what the Terms said.
  //
  // `in_progress` does not mean someone is mid-job here; it means the date is
  // agreed. Cancelling that is exactly what the ladder is for. The backend
  // already allows it — cancel_booking only refuses 'completed' and 'cancelled'.
  const canCancel = ['confirmed', 'in_progress'].includes(booking?.status);

  // B15 — earned, not elapsed.
  const timelineStage = stageFromEvents(events, booking?.status);

  const owesMoney =
    user?.role === 'client' && isAwaitingPayment(payment) && booking?.status !== 'cancelled';
  const isCompleted = booking?.status === 'completed';

  // The pro says the job is done and the client's money is still held: their
  // approval is what releases it (services/approvals.py). Until 2026-07-31 the
  // business released the money itself, so there was nothing for the client to
  // do here — now there is, it has a 24-hour deadline, and it is the single
  // most important thing on this screen.
  const awaitingApproval =
    user?.role === 'client' &&
    isCompleted &&
    booking?.payment_state?.state === 'held' &&
    !!booking?.approval_deadline_at;

  // D5 — ONE primary CTA. Everything else moves behind the overflow. The old
  // stacked column (Pay with card / Message / Cancel booking / Report a
  // problem) took roughly a quarter of the viewport and covered the content it
  // was about.
  const primaryAction = owesMoney
    ? { label: i18n.t('booking.payNow'), icon: 'credit-card', onPress: () => setPayVisible(true) }
    : awaitingApproval
      ? {
          label: i18n.t('approval.approveCta'),
          icon: 'check-circle',
          onPress: handleApproveWork,
        }
      : { label: i18n.t('booking.message'), icon: 'message-circle', onPress: handleMessage };

  const overflowActions = [
    owesMoney && { key: 'message', label: i18n.t('booking.message'), icon: 'message-circle', onPress: handleMessage },
    // ApproveWorkScreen was registered in ClientNavigator with nothing
    // navigating to it, so the client had no way to see the provider's
    // before/after photos and voice note, or to release the held payment.
    // The screen handles "proof not submitted yet" and "already approved"
    // itself, so this only needs the job to be done.
    isCompleted && {
      key: 'approve', label: i18n.t('booking.reviewRelease'), icon: 'check-circle',
      onPress: () => navigation.navigate('ApproveWork', { bookingId }),
    },
    user?.role === 'client' && isCompleted && { key: 'rebook', label: i18n.t('rebook.button'), icon: 'refresh-cw', onPress: handleRebook },
    isCompleted && { key: 'receipt', label: i18n.t('booking.viewReceipt'), icon: 'file-text', onPress: () => navigation.navigate('Invoice', { bookingId }) },
    isCompleted && isAwaitingPayment(payment) && { key: 'offplatform', label: i18n.t('booking.markPaidOffPlatform'), icon: 'dollar-sign', onPress: () => setOffPayVisible(true) },
    canCancel && { key: 'cancel', label: i18n.t('booking.cancelBooking'), icon: 'x-circle', onPress: handleCancel },
    (isCompleted || booking?.status === 'confirmed' || booking?.status === 'in_progress') && {
      key: 'dispute', label: i18n.t('booking.reportProblem'), icon: 'alert-triangle', onPress: () => navigation.navigate('DisputeFlow', { bookingId }),
    },
  ].filter(Boolean);

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
        {/* Confirm-date handshake — two-sided: either party proposes times in
            the chat, the other accepts (UBER-3 + HANDSHAKE-2WAY) */}
        <ConfirmDateCard bookingId={bookingId} booking={booking} onConfirmed={fetchBooking} />

        {/* Status timeline card */}
        <Surface
          elevation="subtle"
          padding={0}
          style={{ paddingVertical: spacing.base, paddingHorizontal: spacing.sm }}
        >
          <BookingStatusTimeline currentStatus={timelineStage} />
        </Surface>

        {/* M7 — where the provider actually IS while en route. Renders itself
            away entirely outside the en-route window (the backend re-derives
            that window on every poll, so this cannot be left on by a stale
            client). Client-only: the provider reading their own dot back here
            belongs on the business Status tab, not on the customer's screen. */}
        {user?.role === 'client' && (
          <ProviderLiveLocation
            bookingId={bookingId}
            providerName={workerName}
            destination={
              booking?.job_lat != null && booking?.job_lng != null
                ? { lat: booking.job_lat, lng: booking.job_lng }
                : null
            }
          />
        )}

        {/* Live Job Status — real-time provider events, humanised (B16) */}
        <LiveStatusCard events={events} status={eventsStatus} onRetry={fetchEvents} />

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
                {worker.is_business ? (
                  <BusinessLogo uri={booking?.business_logo} name={workerName} size={64} />
                ) : (
                  <Avatar size="lg" name={workerName} source={worker.avatar_url ?? worker.photo_url} />
                )}
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
              <Text variant="bodyMedium" style={{ textAlign: TEXT_END }}>
                {booking?.category ?? booking?.service_type ?? '—'}
              </Text>
            </DetailRow>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Scheduled row */}
            <DetailRow icon="calendar" label="Scheduled">
              <Text variant="bodyMedium" style={{ textAlign: TEXT_END }}>
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
                style={{ textAlign: TEXT_END, color: colors.accentText, textDecorationLine: 'underline' }}
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

        {/* Escrow milestones — read-only (GAP-AUDIT #10) */}
        <EscrowMilestones payment={payment} />

        {/* Spacer for the (now single-row) bottom bar */}
        <View style={{ height: 96 }} />
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
        {/* D5 — one primary CTA plus an overflow. The pay CTA still appears
            ONLY while the booking genuinely owes money (isAwaitingPayment):
            a captured payment reads 'held', and the retired 'paid_full' test
            used to leave the button up after a successful charge, so a second
            tap opened a SECOND Stripe checkout. That guard is unchanged. */}
        <Inline spacing="sm" align="center">
          <Button
            variant="primary"
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            icon={<Feather name={primaryAction.icon} size={18} color={colors.textPrimary} />}
            style={{ flex: 1, minHeight: 52 }}
          />
          {overflowActions.length > 0 && (
            <Pressable
              onPress={() => setMoreVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('booking.moreActionsA11y')}
              style={({ pressed }) => [{
                width: 52, height: 52, borderRadius: radius.button,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.9 }]}
            >
              <Feather name="more-horizontal" size={20} color={colors.textSecondary} strokeWidth={1.8} />
            </Pressable>
          )}
        </Inline>
      </View>

      {/* D5 — overflow menu */}
      {moreVisible && (
        <Pressable
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(4,5,7,0.68)', justifyContent: 'flex-end',
          }}
          onPress={() => setMoreVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.surface,
              borderTopWidth: 1, borderColor: colors.border,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          >
            <View style={{
              alignSelf: 'center', width: 38, height: 4,
              borderRadius: radius.pill, backgroundColor: colors.border,
              marginBottom: spacing.md,
            }} />
            {overflowActions.map((action, i) => (
              <Pressable
                key={action.key}
                onPress={() => { setMoreVisible(false); action.onPress(); }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  minHeight: 52,
                  paddingHorizontal: spacing.lg - 4,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }, pressed && { backgroundColor: colors.surfaceAlt }]}
              >
                <Feather
                  name={action.icon}
                  size={18}
                  color={action.key === 'dispute' || action.key === 'cancel'
                    ? colors.danger
                    : colors.textSecondary}
                  strokeWidth={1.8}
                />
                <Text
                  variant="smallMedium"
                  color={action.key === 'dispute' || action.key === 'cancel' ? 'danger' : 'primary'}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      )}

      {/* M9 — SwingBy-branded pay sheet in front of the existing mechanism */}
      <PaySheet
        visible={payVisible}
        mode="pay"
        amount={parseFloat(booking?.total_amount ?? booking?.quoted_price ?? booking?.price ?? 0) || 0}
        summary={[booking?.category, formatDate(booking?.scheduled_at)].filter(Boolean).join(' · ')}
        bookingId={bookingId}
        method={CHECKOUT_METHOD}
        onClose={() => setPayVisible(false)}
        onAddMethod={() => {
          setPayVisible(false);
          navigation.navigate('PaymentMethod');
        }}
        onConfirm={handlePay}
      />

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
