import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { useAuth } from '../../context/AuthContext';
import { CategoryGrid } from '../../components/CategoryScroll';
import FeaturedCard from '../../components/FeaturedCard';
import NearbyCard from '../../components/NearbyCard';
import MapPreviewCard from '../../components/MapPreviewCard';
import HeaderGlow from '../../components/HeaderGlow';
import SectionHeader from '../../components/SectionHeader';
// UBER-5: Home is browse-first now — PostJobScreen is no longer hosted here
// behind a toggle. It stays reachable from the bottom nav's "Post" tab
// (BottomNav → navigation.navigate('PostJob'), registered in ClientNavigator).

import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import SearchField from '../../components/SearchField';
import Stack from '../../components/Stack';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import ListItem from '../../components/ListItem';
import StatusBadge from '../../components/StatusBadge';
import { SkeletonBox, SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719, city: 'Calgary, AB' };

const CATEGORY_TILES = [
  { id: 'cleaning', label: 'Cleaning', icon: 'droplet' },
  { id: 'plumbing', label: 'Plumbing', icon: 'tool' },
  { id: 'moving', label: 'Moving', icon: 'truck' },
];

function computeDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1) + ' km';
}

function toInitials(name) {
  return (name || '').slice(0, 2).toUpperCase();
}

async function resolveCity(lat, lng) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      const { city, region } = results[0];
      if (city && region) return `${city}, ${region}`;
      if (city) return city;
    }
  } catch {
    // fallback below
  }
  return CALGARY_FALLBACK.city;
}

const BOOKING_STATUS_LABEL = {
  confirmed: 'Confirmed',
  in_progress: 'In progress',
};

function bookingService(b) {
  return b.service_posts?.title || b.service_category || 'Your booking';
}
function bookingWhen(b) {
  const raw = b.confirmed_date || b.proposed_date_1;
  if (!raw) return null;
  return new Date(raw).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
// Undated bookings sort last rather than to the top of the list.
function bookingTime(b) {
  const raw = b.confirmed_date || b.proposed_date_1;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? Infinity : t;
}

// The live job, pinned to the top of Home (item #14). Taps through to
// ActiveBookingScreen, which needs the bookingId param — it can't self-discover
// which booking to show.
function PinnedBookingCard({ booking, onPress }) {
  const isLive = booking.status === 'in_progress';
  const provider = booking.businesses?.business_name || booking.business_name || 'Your provider';
  const when = bookingWhen(booking);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <Surface elevation="subtle" style={styles.pinnedCard}>
        <Inline justify="space-between" align="flex-start" style={{ marginBottom: spacing.xs }}>
          <Text variant="label" style={styles.pinnedEyebrow} maxFontSizeMultiplier={1.2}>
            {isLive ? 'HAPPENING NOW' : 'YOUR NEXT JOB'}
          </Text>
          <StatusBadge
            label={BOOKING_STATUS_LABEL[booking.status] || 'Active'}
            tone="accent"
          />
        </Inline>
        <Text variant="h1" numberOfLines={1} style={{ marginBottom: 2 }}>
          {bookingService(booking)}
        </Text>
        <Inline spacing="xs">
          <Feather name="briefcase" size={13} color={colors.textSecondary} />
          <Text variant="small" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {provider}{when ? ` · ${when}` : ''}
          </Text>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

function UpcomingBookingRow({ booking, onPress }) {
  const provider = booking.businesses?.business_name || booking.business_name || 'Provider';
  const when = bookingWhen(booking);
  return (
    <ListItem
      left={<Avatar name={provider} size="sm" />}
      title={bookingService(booking)}
      subtitle={when ? `${provider} · ${when}` : provider}
      right={<StatusBadge label={BOOKING_STATUS_LABEL[booking.status] || 'Active'} tone="accent" />}
      onPress={onPress}
    />
  );
}

// Open posts get ONE compact line on Home, never a stack of cards — Home is
// browse-first, and My Jobs is where posts are actually managed.
function OpenPostsStrip({ count, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${count} open job ${count === 1 ? 'post' : 'posts'}, awaiting quotes`}
      style={styles.postsStrip}
    >
      <Feather name="file-text" size={14} color={colors.textSecondary} />
      <Text variant="small" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
        {count} open {count === 1 ? 'post' : 'posts'} · awaiting quotes
      </Text>
      <Feather name="chevron-right" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function SkeletonFeaturedCard() {
  return (
    <Surface elevation="subtle" style={styles.featuredCardSkeleton}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <SkeletonBox width={48} height={48} borderRadius={14} />
        <Stack spacing="xs" style={{ flex: 1 }}>
          <SkeletonBox width="60%" height={14} borderRadius={6} />
          <SkeletonBox width="40%" height={12} borderRadius={6} />
        </Stack>
      </View>
    </Surface>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState('cleaning');
  const [searchQuery, setSearchQuery] = useState('');

  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [businessError, setBusinessError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [cityLabel, setCityLabel] = useState(CALGARY_FALLBACK.city);
  const coordsRef = useRef(null);

  // Item #14 — Home surfaces the live job. One `GET /bookings/` already returns
  // status, confirmed_date and the embedded businesses/service_posts rows, so
  // the pinned card needs no extra round-trip. Both calls are `_silent` because
  // this is secondary content: if it fails the block simply doesn't render
  // rather than throwing a toast over a browse screen that still works.
  const [bookings, setBookings] = useState([]);
  const [openPosts, setOpenPosts] = useState([]);

  const fetchJobs = useCallback(async () => {
    try {
      const [bookingRes, postRes] = await Promise.all([
        api.get('/bookings/', { _silent: true }).catch(() => []),
        api.get('/service-posts/my', { _silent: true }).catch(() => []),
      ]);
      const bookingList = bookingRes?.items || bookingRes || [];
      const postList = postRes?.items || postRes || [];
      setBookings(Array.isArray(bookingList) ? bookingList : []);
      setOpenPosts(
        (Array.isArray(postList) ? postList : []).filter((p) => p.status === 'open')
      );
    } catch {
      setBookings([]);
      setOpenPosts([]);
    }
  }, []);

  const fetchNearby = useCallback(async () => {
    setBusinessError(null);
    try {
      let coords;
      try {
        coords = await getUserLocation();
      } catch {
        coords = CALGARY_FALLBACK;
      }
      coordsRef.current = coords;

      const city = await resolveCity(coords.lat, coords.lng);
      setCityLabel(city);

      const data = await api.get('/businesses/nearby', {
        params: { lat: coords.lat, lng: coords.lng, radius_km: 25 },
      });

      const list = Array.isArray(data) ? data : (data?.items ?? []);
      setBusinesses(
        list.map((b) => ({
          ...b,
          _distance: computeDistance(coords.lat, coords.lng, b.lat, b.lng),
        }))
      );
    } catch (err) {
      setBusinessError(err.message || 'Failed to load nearby businesses');
    } finally {
      setLoadingBusinesses(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNearby();
  }, [fetchNearby]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // A booking can be confirmed / started / finished while the client is on
  // another tab — re-pull on focus so the pinned card is never stale.
  useEffect(() => navigation.addListener('focus', fetchJobs), [navigation, fetchJobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchJobs();
    fetchNearby();
  }, [fetchNearby, fetchJobs]);

  const categoryFiltered =
    activeCategory === 'all'
      ? businesses
      : businesses.filter((b) => (b.category ?? '').toLowerCase() === activeCategory);

  const filteredBusinesses = searchQuery.trim()
    ? categoryFiltered.filter((b) =>
        (b.business_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categoryFiltered;

  const topRated = filteredBusinesses.length
    ? filteredBusinesses.reduce((best, b) =>
        (b.avg_rating ?? 0) > (best.avg_rating ?? 0) ? b : best
      )
    : null;

  const firstName = user?.first_name || 'there';

  // A job in progress always outranks one that is merely confirmed; after that,
  // soonest first. The head of the list is pinned, the next few list under it.
  const liveBookings = bookings
    .filter((b) => b.status === 'in_progress' || b.status === 'confirmed')
    .sort((a, b) => {
      const aLive = a.status === 'in_progress';
      const bLive = b.status === 'in_progress';
      if (aLive !== bLive) return aLive ? -1 : 1;
      const ta = bookingTime(a);
      const tb = bookingTime(b);
      // Two undated bookings would subtract to NaN — keep their relative order.
      if (ta === tb) return 0;
      return ta - tb;
    });
  const pinnedBooking = liveBookings[0] || null;
  const upcomingBookings = liveBookings.slice(1, 4);

  const openBooking = (id) => navigation.navigate('ActiveBooking', { bookingId: id });
  const openMyJobs = () => navigation.navigate('My Jobs');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Faint radial purple glow behind the header */}
      <HeaderGlow width={480} height={280} offsetTop={-40} align="right" opacity={0.22} />

      {/* Fixed Header ─ wordmark + bell */}
      <View style={styles.header}>
        <Text
          variant="h1"
          style={styles.logo}
          accessibilityRole="header"
          accessibilityLabel="SwingBy"
        >
          Swing
          <Text variant="h1" style={{ color: colors.accentText }}>
            By
          </Text>
        </Text>

        <TouchableOpacity
          style={styles.bellBtn}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => navigation.navigate('Notifications')}
        >
          <Feather name="bell" size={17} color={colors.textPrimary} strokeWidth={1.8} />
          <View style={styles.notifDot} accessible={false} />
        </TouchableOpacity>
      </View>

      <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {/* Greeting hero */}
          <View style={styles.greetingSection}>
            <Text variant="display2" style={styles.heyHeading} maxFontSizeMultiplier={1.3}>
              Hey {firstName}.
            </Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={13} color={colors.textSecondary} />
              <Text variant="small" color="secondary" maxFontSizeMultiplier={1.3}>
                {cityLabel} · What needs doing?
              </Text>
            </View>
          </View>

          {/* Live job — pinned above everything browsable. Renders only when
              the client actually has one, so the browse-first Home is
              unchanged for everyone else. */}
          {(pinnedBooking || openPosts.length > 0) && (
            <Stack spacing="sm" style={styles.jobsBlock}>
              {pinnedBooking && (
                <PinnedBookingCard
                  booking={pinnedBooking}
                  onPress={() => openBooking(pinnedBooking.id)}
                />
              )}

              {upcomingBookings.length > 0 && (
                <>
                  <SectionHeader
                    title="UPCOMING"
                    actionLabel="All jobs"
                    onAction={openMyJobs}
                    style={styles.upcomingHeader}
                  />
                  {upcomingBookings.map((b) => (
                    <UpcomingBookingRow
                      key={b.id}
                      booking={b}
                      onPress={() => openBooking(b.id)}
                    />
                  ))}
                </>
              )}

              {openPosts.length > 0 && (
                <OpenPostsStrip count={openPosts.length} onPress={openMyJobs} />
              )}
            </Stack>
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <SearchField
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() =>
                navigation.navigate('Search', { q: searchQuery })
              }
              placeholder='Try "deep clean saturday"'
            />
          </View>

          {/* Category grid — 4 tiles: 3 shortcuts + More */}
          <View style={styles.categoryWrap}>
            <CategoryGrid
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
              data={CATEGORY_TILES}
              onMorePress={() =>
                navigation.navigate('Search', { q: searchQuery })
              }
            />
          </View>

          {/* Map preview */}
          <View style={styles.mapWrap}>
            <MapPreviewCard
              countLabel={
                filteredBusinesses.length
                  ? `${filteredBusinesses.length} pros near you`
                  : '12 pros near you'
              }
              areaLabel={`Kensington · ${cityLabel.split(',')[0] || 'Calgary'}`}
              onPress={() => navigation.navigate('NearbyMap')}
            />
          </View>

          {/* TOP RATED NEAR YOU */}
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader
              title="TOP RATED NEAR YOU"
              actionLabel="See all"
              onAction={() => navigation.navigate('NearbyMap')}
            />
          </View>

          <View style={styles.cardBlock}>
            {loadingBusinesses ? (
              <SkeletonFeaturedCard />
            ) : businessError ? (
              <Surface elevation="subtle" style={styles.errorSurface}>
                <Stack spacing="sm" align="center">
                  <Text variant="small" color="danger">
                    {businessError}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setLoadingBusinesses(true);
                      fetchNearby();
                    }}
                    activeOpacity={0.8}
                    style={styles.retryBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading businesses"
                  >
                    <Text
                      variant="smallMedium"
                      style={{ color: colors.accentText }}
                    >
                      Retry
                    </Text>
                  </TouchableOpacity>
                </Stack>
              </Surface>
            ) : topRated ? (
              <FeaturedCard
                name={topRated.business_name}
                initials={toInitials(topRated.business_name)}
                rating={topRated.avg_rating?.toFixed(1) ?? '—'}
                jobs={topRated.review_count ?? 0}
                distance={topRated._distance}
                category={topRated.category}
                verified={topRated.license_status === 'verified'}
                onPress={() =>
                  navigation.navigate('BusinessProfile', { businessId: topRated.id })
                }
              />
            ) : null}
          </View>

          {/* NEARBY */}
          <View style={styles.sectionHeaderWrap}>
            <SectionHeader
              title="NEARBY"
              actionLabel="Map view"
              onAction={() => navigation.navigate('NearbyMap')}
            />
          </View>

          {loadingBusinesses ? (
            <View style={styles.nearbyList}>
              <SkeletonList count={4} />
            </View>
          ) : businessError ? null : filteredBusinesses.length === 0 ? (
            <EmptyState
              icon="map-pin"
              title="No businesses nearby"
              body={
                activeCategory !== 'all'
                  ? `No ${activeCategory} businesses found in your area.`
                  : 'No businesses found near you. Try adjusting your search.'
              }
              action={
                activeCategory !== 'all'
                  ? { label: 'Show all categories', onPress: () => setActiveCategory('all') }
                  : undefined
              }
            />
          ) : (
            <Stack spacing="sm" style={styles.nearbyList}>
              {filteredBusinesses.map((b) => (
                <NearbyCard
                  key={b.id}
                  name={b.business_name}
                  initials={toInitials(b.business_name)}
                  rating={b.avg_rating?.toFixed(1) ?? '—'}
                  jobs={b.review_count ?? 0}
                  distance={b._distance}
                  onPress={() =>
                    navigation.navigate('BusinessProfile', { businessId: b.id })
                  }
                />
              ))}
            </Stack>
          )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 21,
    letterSpacing: -0.4,
  },
  bellBtn: {
    width: 38,
    height: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    backgroundColor: colors.accent,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#0A0B0E',
  },

  greetingSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: 6,
  },
  heyHeading: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    color: colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  jobsBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },
  // Accent-tinted so the live job reads as the one card on Home that is about
  // *you*, not about browsing.
  pinnedCard: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderAccent,
  },
  pinnedEyebrow: {
    color: colors.accentSoft,
    letterSpacing: 1.4,
  },
  upcomingHeader: {
    paddingTop: spacing.xs,
  },
  postsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  categoryWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.base,
  },

  mapWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  sectionHeaderWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  cardBlock: {
    paddingHorizontal: spacing.lg,
  },

  featuredCardSkeleton: {
    marginHorizontal: 0,
  },

  errorSurface: {
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  retryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },

  nearbyList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
});
