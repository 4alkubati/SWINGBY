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
import { MapCanvas, MapPin, MapRoute } from '../../components/MapPreviewCard';
import PulseDot from '../../components/PulseDot';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import { SkeletonBox } from '../../components/Skeleton';
import { colors, spacing, radius, motion, shadows } from '../../theme/tokens';

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
            textAlign: 'right',
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

function buildTitle(booking) {
  const status = booking?.status;
  if (status === 'on_the_way') {
    const mins = booking?.eta_minutes ?? 12;
    return `Arriving in ${mins} min`;
  }
  if (status === 'confirmed') return 'Waiting to start';
  if (status === 'in_progress') return 'Service in progress';
  if (status === 'completed') return 'Service completed';
  if (status === 'cancelled') return 'Booking cancelled';
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

// Faux "live" hero using MapCanvas + purple dashed route.
function LiveMapHero({ onBack, status }) {
  const isLive =
    status === 'on_the_way' ||
    status === 'in_progress' ||
    status === 'confirmed';

  return (
    <View style={styles.hero}>
      <MapCanvas style={styles.mapCanvas}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <MapRoute
            points={[
              { x: 40, y: 200 },
              { x: 120, y: 170 },
              { x: 180, y: 140 },
              { x: 250, y: 100 },
              { x: 320, y: 70 },
            ]}
          />
          <MapPin x={40} y={200} />
          <MapPin x={320} y={70} top />
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
              <Stop offset="0" stopColor="#07080A" stopOpacity="0.55" />
              <Stop offset="0.3" stopColor="#07080A" stopOpacity="0" />
              <Stop offset="0.75" stopColor="#07080A" stopOpacity="0" />
              <Stop offset="1" stopColor="#07080A" stopOpacity="0.35" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
        </Svg>
      </MapCanvas>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Feather name="arrow-left" size={18} color={colors.textPrimary} />
      </TouchableOpacity>

      {isLive && (
        <View style={styles.livePill}>
          <PulseDot size={7} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 13,
              fontWeight: '600',
              marginLeft: 8,
            }}
            maxFontSizeMultiplier={1.2}
          >
            Live
          </Text>
        </View>
      )}
    </View>
  );
}

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

  useEffect(() => {
    load();
  }, [load]);

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
  const eyebrow = STATUS_EYEBROW[booking?.status] || 'STATUS';
  const heroTitle = buildTitle(booking);

  // Job details live on the linked service post; the date on confirmed_date
  const postTitle = booking?.service_posts?.title;
  const address = booking?.service_posts?.address;
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
                        maxFontSizeMultiplier={1.3}
                      >
                        {eyebrow}
                      </Text>
                      <Text
                        style={styles.heroTitle}
                        maxFontSizeMultiplier={1.3}
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
                      <Text style={styles.providerName} maxFontSizeMultiplier={1.3}>
                        {workerName}
                      </Text>
                      <View style={styles.providerMetaRow}>
                        <Text
                          style={styles.providerMeta}
                          maxFontSizeMultiplier={1.3}
                        >
                          {companyName ? `${companyName}` : 'Independent'}
                        </Text>
                        {rating != null && (
                          <>
                            <Text style={styles.providerMeta}>·</Text>
                            <Feather name="star" size={11} color={colors.accentText} strokeWidth={2} />
                            <Text style={styles.providerMeta} maxFontSizeMultiplier={1.3}>
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
                      onPress={() => {}}
                    >
                      <Feather name="phone" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Message"
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
                    currentStatus={booking.status}
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
                {booking.total_amount && (
                  <DetailRow
                    label="Total"
                    value={`$${booking.total_amount} · held in escrow`}
                    valueStyle={{
                      color: colors.success,
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

            {/* Secondary chat button */}
            <SpringCard delay={140} style={styles.hPad}>
              <Button
                variant="secondary"
                label={`Message ${workerName.split(' ')[0]}`}
                icon={<Feather name="message-circle" size={17} color={colors.textPrimary} />}
                onPress={() =>
                  navigation.navigate('Chat', {
                    bookingId: booking.id,
                    otherPartyName: workerName,
                  })
                }
                style={styles.messageAction}
              />
            </SpringCard>

            {/* Escrow caption */}
            <View style={styles.escrowRow}>
              <Feather name="lock" size={12.5} color={colors.textSecondary} />
              <Text
                style={styles.escrowCaption}
                maxFontSizeMultiplier={1.3}
              >
                Payment releases only when you approve the work.
              </Text>
            </View>

            {/* Cancel (secondary) */}
            {booking.status === 'confirmed' && (
              <SpringCard delay={200} style={styles.hPad}>
                <Button
                  variant="secondary"
                  label="Cancel booking"
                  onPress={() =>
                    navigation.navigate('CancellationFlow', {
                      bookingId: booking.id,
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
