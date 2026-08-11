import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, Rect, LinearGradient, Stop } from 'react-native-svg';

import { api } from '../../services/api';
import i18n from '../../i18n';
import BookingStatusTimeline from '../../components/BookingStatusTimeline';
// AUDIT B15 — the progress bar must be EARNED, not elapsed. Reuse the exact
// helper BookingDetailsScreen already proved, rather than writing a second
// definition of "what stage is this job in".
import { stageFromEvents } from './BookingDetailsScreen';
import { MapCanvas, MapPin, MapRoute } from '../../components/MapPreviewCard';
import {
  MapView,
  Marker,
  MAP_PROVIDER,
  darkMapProps,
  DARK_MAP_STYLE,
  fitRegion,
} from '../../services/maps';
import { projectToBox, distanceKm, formatDistance } from '../../utils/mapProjection';
import { fetchProviderLocation, CLIENT_POLL_MS } from '../../services/liveLocation';
import PulseDot from '../../components/PulseDot';
import Text from '../../components/Text';
import CallContactSheet from '../../components/CallContactSheet';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import { SkeletonBox } from '../../components/Skeleton';
import * as haptics from '../../services/haptics';
import { colors, spacing, radius, motion, shadows } from '../../theme/tokens';
import { TEXT_END } from '../../services/rtl';

// Map hero height per handoff spec.
const HERO_HEIGHT = 264;

function ActiveBookingSkeleton() {
  return (
    <Stack spacing="base" style={styles.content}>
      <SkeletonBox height={HERO_HEIGHT} borderRadius={0} />
      <SkeletonBox height={220} borderRadius={22} style={styles.hPad} />
      <SkeletonBox height={160} borderRadius={20} style={styles.hPad} />
    </Stack>
  );
}

function NoActiveBooking({ onBrowse }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Feather name="calendar" size={30} color={colors.accentText} />
      </View>
      <Text
        variant="h1"
        style={{ marginTop: spacing.lg, textAlign: 'center' }}
      >
        No active booking
      </Text>
      <Text
        variant="small"
        color="secondary"
        style={{ marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }}
      >
        You don't have an active booking right now. Browse services to get started.
      </Text>
      <Button
        label="Browse services"
        onPress={onBrowse}
        style={{ marginTop: spacing.lg, alignSelf: 'center' }}
      />
    </View>
  );
}

function BookingError({ onRetry }) {
  return (
    <View style={styles.centered}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.danger + '1A' },
        ]}
      >
        <Feather name="alert-circle" size={30} color={colors.danger} />
      </View>
      <Text
        variant="h1"
        style={{ marginTop: spacing.lg, textAlign: 'center' }}
      >
        Something went wrong
      </Text>
      <Text
        variant="small"
        color="secondary"
        style={{ marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 }}
      >
        We couldn't load your booking. Please try again.
      </Text>
      <Button
        label="Retry"
        onPress={onRetry}
        style={{ marginTop: spacing.lg, alignSelf: 'center' }}
      />
    </View>
  );
}

function SpringCard({ delay = 0, style, children }) {
  const translateY = useSharedValue(18);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      }),
    );
    opacity.value = withDelay(delay, withSpring(1, { stiffness: 120, damping: 20 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
}

function DetailRow({ label, value, valueStyle, last }) {
  return (
    <View
      style={[
        styles.detailRow,
        last && { borderBottomWidth: 0 },
      ]}
    >
      <Text variant="small" color="secondary" style={{ fontSize: 13.5 }}>
        {label}
      </Text>
      <Text
        variant="smallMedium"
        style={[
          {
            fontSize: 13.5,
            fontWeight: '600',
            textAlign: TEXT_END,
            flex: 1,
            marginLeft: spacing.md,
            color: colors.textPrimary,
          },
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const STATUS_EYEBROW = {
  confirmed: 'CONFIRMED',
  on_the_way: 'ON THE WAY',
  in_progress: 'IN PROGRESS',
  completed: 'DONE',
  cancelled: 'CANCELLED',
};

// The hero reads the SAME stage the timeline below it does.
//
// It used to branch on `booking.status === 'on_the_way'` — a value the backend
// never writes. `bookings.status` only ever holds confirmed | in_progress |
// completed | cancelled, so the "ON THE WAY" eyebrow and the "Arriving in X
// min" title were unreachable, and the moment a provider was genuinely en
// route the hero said "Service in progress" while the timeline three lines
// below it highlighted "On the way".
//
// `stageFromEvents` is the B15 helper: it derives the stage from the immutable
// booking_events the provider actually taps, which is the only honest source.
function buildTitle(stage, booking) {
  if (stage === 'on_the_way') {
    const mins = booking?.eta_minutes;
    // No invented ETA. `eta_minutes` is not a column any endpoint returns, so
    // the old `?? 12` default meant every en-route booking claimed "Arriving in
    // 12 min" — a number with nothing behind it.
    return mins ? `Arriving in ${mins} min` : 'On the way';
  }
  if (stage === 'confirmed') return 'Waiting to start';
  if (stage === 'in_progress') return 'Service in progress';
  if (stage === 'completed') return 'Service completed';
  if (stage === 'cancelled') return 'Booking cancelled';
  return 'Checking status…';
}

function toInitials(name) {
  return (name || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Back button + live pill, sitting over whichever surface drew underneath.
// Shared by both hero branches so the real map and the canvas cannot end up
// with different chrome — the pill in particular states something about the
// booking, and two copies is two chances for one of them to say it wrong.
function HeroChrome({ onBack, isLive, hasProvider, distanceLabel, stale }) {
  return (
    <>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Feather name="arrow-left" size={18} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* When there is a real fix, say the real thing — a distance is worth more
          than the word "Live", and it also stops the pill claiming liveness over
          a map showing nothing but the destination. Falls back to the old label
          when the booking is live but the provider is not sharing.
          F015: a stale fix (per the same `is_stale` field ProviderLiveLocation.js
          gates its pulse/badge on) is still worth showing, but not as "Live" — a
          dot with no fresh timestamp is a promise this pill cannot keep either. */}
      {(hasProvider && distanceLabel) || isLive ? (
        <View style={styles.livePill}>
          {stale ? (
            <Feather name="clock" size={12} color={colors.textSecondary} />
          ) : (
            <PulseDot size={7} />
          )}
          {/* Kept, raised from 1.2: livePill has a hard `height: 30`
              (no overflow:hidden, absolute-positioned over the map) — text
              tall enough to exceed that pushes visibly past the pill's
              rounded background rather than growing it. */}
          <Text
            style={{
              color: stale ? colors.textSecondary : colors.textPrimary,
              fontSize: 13,
              fontWeight: '600',
              marginLeft: 8,
            }}
            maxFontSizeMultiplier={1.4}
          >
            {hasProvider && distanceLabel
              ? stale
                ? `Last seen ${distanceLabel} away`
                : `${distanceLabel} away`
              : 'Live'}
          </Text>
        </View>
      ) : null}
    </>
  );
}

// The hero map — a REAL map wherever one can draw, the designed canvas where it
// cannot (walkthrough W8, cause A).
//
// It used to be MapCanvas on every platform, and said so: "the walkthrough
// device is a Huawei with no Play Services, so a real map renders nothing
// there." That was true of the Huawei and was never made conditional, so when
// Kira walked the app on iOS — where the map draws perfectly — the main "where
// are they" screen showed a flat drawn surface. His words: "the image on top
// still renders a normal image."
//
// ProviderLiveLocation.js has done this correctly since X3 and is the pattern
// copied here: ask services/maps for a MapView, use it if there is one, fall
// back otherwise. That module now also answers "is there an API key", so a
// keyless build gets the canvas rather than a blank rectangle.
//
// What it plots is real either way — the job address and, while the provider is
// sharing, their actual last fix. It used to draw a dashed route through five
// hardcoded pixel coordinates and two pins that had nothing to do with the
// booking, which meant the "live tracking" screen showed a provider who never
// moved along a road that did not exist.
function LiveMapHero({ onBack, status, destination, providerLoc, distanceLabel }) {
  const isLive =
    status === 'on_the_way' ||
    status === 'in_progress' ||
    status === 'confirmed';

  // Pixel geometry needs the real container size, and onLayout has not fired on
  // the first pass — `projected` is simply null until it has.
  const [box, setBox] = useState(null);

  // The provider is only ever plotted while the job is live AND a fix exists.
  // Stale-but-present is still shown; the badge says how old it is. A missing
  // fix draws nothing rather than a guess.
  const provider = isLive && providerLoc ? { ...providerLoc, key: 'provider' } : null;
  // F015: same `is_stale` field ProviderLiveLocation.js reads off this endpoint
  // to disable its pulse and show a "Last seen" badge — this hero polls the
  // identical /bookings/{id}/location response and owes the client the same
  // honesty about a fix that's minutes old.
  const stale = !!providerLoc?.is_stale;
  const projected = projectToBox(
    [destination ? { ...destination, key: 'destination' } : null, provider],
    box
  );
  const at = (key) => projected?.points.find((p) => p.key === key) || null;
  const dest = at('destination');
  const prov = at('provider');

  // Both ends framed when both exist, otherwise a close-in box on whichever
  // one does. Null when there is nothing real to centre on — in which case the
  // canvas is the honest surface, because a map centred on a guess is worse
  // than a drawing that claims nothing.
  const region = fitRegion(destination, provider);

  if (MapView && region) {
    return (
      <View style={styles.hero}>
        <MapView
          style={StyleSheet.absoluteFill}
          provider={MAP_PROVIDER}
          {...darkMapProps(DARK_MAP_STYLE)}
          region={region}
          pointerEvents="none"
          toolbarEnabled={false}
        >
          {destination && (
            <Marker
              coordinate={{ latitude: destination.lat, longitude: destination.lng }}
              title="Job address"
            />
          )}
          {provider && (
            <Marker
              coordinate={{ latitude: provider.lat, longitude: provider.lng }}
              title="Your provider"
              description={
                distanceLabel
                  ? stale
                    ? `Last seen ${distanceLabel} away`
                    : `${distanceLabel} away`
                  : undefined
              }
              pinColor={stale ? colors.textSecondary : colors.accent}
            />
          )}
        </MapView>

        {/* The same scrim the canvas gets — chrome has to stay legible over
            map tiles too, and Google's are lighter than the drawn surface. */}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg} stopOpacity="0.55" />
              <Stop offset="0.3" stopColor={colors.bg} stopOpacity="0" />
              <Stop offset="0.75" stopColor={colors.bg} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.bg} stopOpacity="0.35" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
        </Svg>

        <HeroChrome
          onBack={onBack}
          isLive={isLive}
          hasProvider={!!provider}
          distanceLabel={distanceLabel}
          stale={stale}
        />
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <MapCanvas
        style={styles.mapCanvas}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox((b) => (b && b.width === width && b.height === height ? b : { width, height }));
        }}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          {/* A bearing line between two REAL points, not a claimed route. Drawn
              only when both ends exist, so a finished job (My Jobs no longer
              sends those here, but a job can complete while the client watches)
              never shows someone still travelling toward the house. */}
          {prov && dest && (
            <>
              <MapRoute points={[{ x: prov.x, y: prov.y }, { x: dest.x, y: dest.y }]} />
              <MapPin x={prov.x} y={prov.y} />
            </>
          )}
          {dest && <MapPin x={dest.x} y={dest.y} top />}
        </Svg>

        {/* Subtle dark scrim at the top for chrome legibility */}
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg} stopOpacity="0.55" />
              <Stop offset="0.3" stopColor={colors.bg} stopOpacity="0" />
              <Stop offset="0.75" stopColor={colors.bg} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.bg} stopOpacity="0.35" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
        </Svg>
      </MapCanvas>

      <HeroChrome
        onBack={onBack}
        isLive={isLive}
        hasProvider={!!prov}
        distanceLabel={distanceLabel}
        stale={stale}
      />
    </View>
  );
}

export default function ActiveBookingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [providerLoc, setProviderLoc] = useState(null);

  const load = useCallback(async () => {
    setError(false);
    // This screen cannot self-discover a booking — every caller (Home's pinned
    // card, My Jobs, a matched post) must pass bookingId. Without one, show the
    // empty state instead of firing GET /bookings/undefined and reporting the
    // resulting 4xx as "something went wrong".
    if (!bookingId) {
      setBooking(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await api.get(`/bookings/${bookingId}`);
      setBooking(data);
      // AUDIT B15 — booking.status is not evidence the work started: the
      // backend flips it to 'in_progress' the moment a DATE is confirmed
      // (bookings.py confirm-date), so this screen showed "In progress" on
      // jobs where nobody had moved. The events feed is the record of what
      // actually happened. Best-effort: a failed events call must not blank
      // the booking, it just leaves the bar at its honest floor.
      try {
        const ev = await api.get(`/bookings/${bookingId}/events`, { _silent: true });
        setEvents(ev?.items || []);
      } catch {
        setEvents([]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  // The provider's real position for the hero map. Same feed and cadence
  // ProviderLiveLocation uses on Booking Details, so the two screens cannot
  // disagree about where someone is. The server decides whether sharing is even
  // open (`sharing: false` with no coordinates for anyone outside the window),
  // so there is no status check to duplicate here.
  useEffect(() => {
    if (!bookingId) return undefined;
    let alive = true;

    const tick = async () => {
      const res = await fetchProviderLocation(bookingId);
      if (!alive) return;
      // A null is a failed request, not proof the feed closed — keep the last
      // fix and let the badge age it. Only an explicit `sharing: false` clears.
      if (!res) return;
      setProviderLoc(res.sharing ? res.location || null : null);
    };

    tick();
    const id = setInterval(tick, CLIENT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [bookingId]);

  // Assigned employee (if any) comes through the employees join
  const employeeUser = booking?.employees?.users;
  const employeeName = employeeUser
    ? [employeeUser.first_name, employeeUser.last_name].filter(Boolean).join(' ')
    : null;
  const workerName =
    employeeName ||
    booking?.businesses?.business_name ||
    booking?.business_name ||
    'Your provider';
  const companyName =
    booking?.businesses?.business_name || booking?.business_name || null;
  const rating = booking?.businesses?.avg_rating;

  // Kira's ruling (2026-07-25): tapping Call shows the number so it can be
  // COPIED, rather than firing `tel:` blind. Both parties are offered — the
  // person actually coming (the assigned employee) and the business — instead
  // of the old employee-else-business fallback, which hid one of them.
  const callContacts = [
    {
      key: 'employee',
      name: employeeName || 'Your provider',
      role: booking?.employees?.role_title || 'Assigned to your job',
      phone: booking?.employees?.users?.phone || null,
    },
    {
      key: 'business',
      name: companyName || 'The business',
      role: 'Business',
      phone: booking?.businesses?.owner?.phone || null,
    },
  ].filter((c) => c.phone);

  function handleCall() {
    haptics.buttonTap?.();
    setCallVisible(true);
  }
  // One stage, three consumers: the eyebrow, the title and the timeline.
  const heroStage = stageFromEvents(events, booking?.status);
  const eyebrow = STATUS_EYEBROW[heroStage] || 'STATUS';
  const heroTitle = buildTitle(heroStage, booking);

  // Job details live on the linked service post; the date on confirmed_date
  const postTitle = booking?.service_posts?.title;
  const address = booking?.service_posts?.address;
  // The job's real coordinates, already on the booking — bookings.py embeds
  // `service_posts(title, address, lat, lng)`. A direct browse-flow booking has
  // no post at all, so this is legitimately null and the hero handles that.
  const destination =
    typeof booking?.service_posts?.lat === 'number' &&
    typeof booking?.service_posts?.lng === 'number'
      ? { lat: booking.service_posts.lat, lng: booking.service_posts.lng }
      : null;
  const distanceLabel = formatDistance(distanceKm(providerLoc, destination));
  const when = booking?.confirmed_date || booking?.proposed_date_1;
  const date = when
    ? new Date(when).toLocaleDateString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;
  const time = when ? formatTime(when) : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {loading && (
        <View style={{ flex: 1, paddingTop: insets.top + spacing.lg }}>
          <ActiveBookingSkeleton />
        </View>
      )}

      {!loading && error && (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <BookingError
            onRetry={() => {
              setLoading(true);
              load();
            }}
          />
        </View>
      )}

      {!loading && !error && !booking && (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <NoActiveBooking onBrowse={() => navigation.navigate('Home')} />
        </View>
      )}

      {!loading && !error && booking && (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + spacing.xl + 24,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={colors.accent}
              />
            }
          >
            <LiveMapHero
              onBack={() => navigation.goBack()}
              status={booking.status}
              destination={destination}
              providerLoc={providerLoc}
              distanceLabel={distanceLabel}
            />

            {/* Status card overlapping the map by -32 */}
            <View style={styles.statusCardWrap}>
              <SpringCard delay={0}>
                <Surface elevation="modal" style={styles.statusCard}>
                  {/* Eyebrow + hero title + avatar */}
                  <View style={styles.statusTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.eyebrow}
                      >
                        {eyebrow}
                      </Text>
                      <Text
                        style={styles.heroTitle}
                      >
                        {heroTitle}
                      </Text>
                    </View>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{toInitials(workerName)}</Text>
                    </View>
                  </View>

                  {/* Provider row — tap name to open the business profile */}
                  <View style={styles.providerRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() =>
                        navigation.navigate('BusinessProfile', {
                          businessId: booking.business_id,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel="View business profile"
                    >
                      <Text style={styles.providerName}>
                        {workerName}
                      </Text>
                      <View style={styles.providerMetaRow}>
                        <Text
                          style={styles.providerMeta}
                        >
                          {companyName ? `${companyName}` : 'Independent'}
                        </Text>
                        {rating != null && (
                          <>
                            <Text style={styles.providerMeta}>·</Text>
                            <Feather name="star" size={11} color={colors.accentText} strokeWidth={2} />
                            <Text style={styles.providerMeta}>
                              {Number(rating).toFixed(1)}
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Call"
                      onPress={handleCall}
                    >
                      <Feather name="phone" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Message ${workerName}`}
                      accessibilityHint="Opens the chat for this booking"
                      onPress={() =>
                        navigation.navigate('Chat', {
                          bookingId: booking.id,
                          otherPartyName: workerName,
                        })
                      }
                    >
                      <Feather
                        name="message-circle"
                        size={18}
                        color={colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Segmented progress */}
                  <BookingStatusTimeline
                    currentStatus={heroStage}
                    timestamps={{
                      confirmed: booking.created_at
                        ? formatTime(booking.created_at)
                        : null,
                    }}
                  />
                </Surface>
              </SpringCard>
            </View>

            {/* Job details card */}
            <SpringCard delay={80} style={styles.hPad}>
              <View style={styles.detailsCard}>
                {(postTitle || booking.service_category) && (
                  <DetailRow
                    label="Service"
                    value={postTitle || booking.service_category}
                  />
                )}
                {(date || time) && (
                  <DetailRow
                    label="When"
                    value={[date, time].filter(Boolean).join(' · ')}
                  />
                )}
                {address && <DetailRow label="Where" value={address} />}
                {/* Number(...) > 0, not a bare truthiness check: a numeric 0
                    makes `x && <JSX/>` evaluate to the NUMBER 0, which React
                    Native renders as a bare text node and throws "Text strings
                    must be rendered within a <Text> component". A $0 total also
                    has nothing to say, so the row is right to disappear. */}
                {/* AUDIT L5/L6 — this row used to say "held in escrow" for any
                    non-zero total. `total_amount` is written the instant a quote
                    is accepted, BEFORE any Stripe charge exists
                    (interests.py::accept), so a client with an unpaid booking was
                    told their money was safely held. That is the worst thing this
                    screen can say, because it is the one claim they would act on.

                    The server already answers this precisely: `payment_state`
                    carries `capture_backed`, true only when a Stripe capture or a
                    recorded off-platform payment stands behind the figure. Trust
                    that, never the total alone. When it is absent (older backend)
                    we state the amount without claiming anything about it. */}
                {Number(booking.total_amount) > 0 && (
                  <DetailRow
                    label="Total"
                    value={
                      booking.payment_state?.capture_backed
                        ? `$${booking.total_amount} · held in escrow`
                        : `$${booking.total_amount} · not paid yet`
                    }
                    valueStyle={{
                      color: booking.payment_state?.capture_backed
                        ? colors.success
                        : colors.textSecondary,
                      fontFamily: 'SpaceGrotesk_700Bold',
                    }}
                    last
                  />
                )}
              </View>
            </SpringCard>

            {/* Full booking details — Pay with card, live status timeline,
                off-platform mark-as-paid, and the confirm-date handshake card
                all live on BookingDetails, which was previously unreachable
                from here (UBER-2b). */}
            <SpringCard delay={110} style={styles.hPad}>
              <Button
                variant="ghost"
                label={i18n.t('booking.viewFullDetails')}
                icon={<Feather name="file-text" size={17} color={colors.textPrimary} />}
                onPress={() => navigation.navigate('BookingDetails', { bookingId: booking.id })}
                style={styles.messageAction}
              />
            </SpringCard>

            {/* D6 — the full-width "Message <name>" button that used to sit
                here is gone. It was the FOURTH route to the same chat on one
                screen: the message icon in the provider row directly above (a
                44 pt target beside Call, where a person looks for it), the
                Message action inside the call sheet, and the primary CTA on
                Full details. Removing the duplicate loses nobody their only
                way in — the icon above is the survivor, and it now names the
                provider out loud so the shortened label costs no clarity to a
                screen-reader user either. */}

            {/* My disputes — GAP-AUDIT #6. GET /disputes/mine existed with
                zero mobile callers; this is the entry point into the new
                read-only disputes list. */}
            <SpringCard delay={160} style={styles.hPad}>
              <Button
                variant="ghost"
                label={i18n.t('disputes.viewLink')}
                icon={<Feather name="shield" size={17} color={colors.textPrimary} />}
                onPress={() => navigation.navigate('MyDisputes')}
                style={styles.messageAction}
              />
            </SpringCard>

            {/* Escrow caption — only while the outcome is still ahead of us.
                This rendered unconditionally, so a completed booking (money
                already released) and a cancelled one (money refunded) both told
                the client "Payment releases only when you approve the work."
                That is the same false-money-statement family as AUDIT L5/L6: a
                promise about a decision the client no longer has. */}
            {booking.status !== 'completed' && booking.status !== 'cancelled' && (
              <View style={styles.escrowRow}>
                <Feather name="lock" size={12.5} color={colors.textSecondary} />
                <Text
                  style={styles.escrowCaption}
                >
                  Payment releases only when you approve the work.
                </Text>
              </View>
            )}

            {/* Cancel (secondary) */}
            {/* Same reason as BookingDetails' `canCancel`: a booking is only
                'confirmed' until a date is agreed, at which point confirm-date
                flips it to 'in_progress'. Gating on 'confirmed' alone meant the
                client lost every way to cancel the moment they settled on a time
                — which is precisely when they are most likely to need to. */}
            {['confirmed', 'in_progress'].includes(booking.status) && (
              <SpringCard delay={200} style={styles.hPad}>
                <Button
                  variant="secondary"
                  label="Cancel booking"
                  onPress={() =>
                    navigation.navigate('CancellationFlow', {
                      bookingId: booking.id,
                      // F030: without these, CancellationFlowScreen's local
                      // penalty preview falls back to 'no_date'/$0 and shows
                      // a full-refund preview even when the server would
                      // actually charge a late/no-show fee. Same fields
                      // BookingDetailsScreen's cancel button passes.
                      // F031: confirmed_date only — NOT proposed_date_1. The
                      // server's classify_cancellation_timing() (backend
                      // bookings.py) reads confirmed_date alone; a merely
                      // proposed date can show a penalty tier the server will
                      // never actually charge.
                      scheduledDate: booking.confirmed_date,
                      quotedPrice: booking.total_amount,
                    })
                  }
                  style={{
                    borderColor: colors.danger + '4D',
                    marginTop: spacing.md,
                  }}
                />
              </SpringCard>
            )}
          </ScrollView>
        </>
      )}

      <CallContactSheet
        visible={callVisible}
        onClose={() => setCallVisible(false)}
        contacts={callContacts}
        onMessage={() =>
          navigation.navigate('Chat', {
            bookingId: booking?.id,
            otherPartyName: workerName,
          })
        }
      />
    </View>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { gap: spacing.md, paddingTop: spacing.base },
  hPad: { marginHorizontal: spacing.lg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    height: HERO_HEIGHT,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  mapCanvas: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    top: 44,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.overlayScrim,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    position: 'absolute',
    top: 44,
    right: spacing.lg,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.overlayScrim,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusCardWrap: {
    marginTop: -32,
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  statusCard: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base + 2,
    gap: spacing.base,
    ...shadows.card,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.accentText,
  },
  heroTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -1,
    marginTop: 4,
    color: colors.textPrimary,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: colors.accentText,
    letterSpacing: -0.2,
  },

  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  providerMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.base,
    marginTop: spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  messageAction: {
    height: 50,
    borderRadius: 12,
    marginTop: spacing.md,
  },

  escrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  escrowCaption: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
