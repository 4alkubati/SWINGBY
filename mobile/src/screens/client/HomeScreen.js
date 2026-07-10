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
import ModeSwitch from '../../components/ModeSwitch';
import { CategoryGrid } from '../../components/CategoryScroll';
import FeaturedCard from '../../components/FeaturedCard';
import NearbyCard from '../../components/NearbyCard';
import MapPreviewCard from '../../components/MapPreviewCard';
import HeaderGlow from '../../components/HeaderGlow';
import SectionHeader from '../../components/SectionHeader';
import PostJobScreen from './PostJobScreen';

import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';
import { colors, spacing } from '../../theme/tokens';
import Text from '../../components/Text';
import SearchField from '../../components/SearchField';
import Stack from '../../components/Stack';
import Surface from '../../components/Surface';
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
  const [mode, setMode] = useState('browse');
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

      const list = Array.isArray(data) ? data : (data?.businesses ?? []);
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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNearby();
  }, [fetchNearby]);

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

      <ModeSwitch mode={mode} onModeChange={setMode} />

      {mode === 'browse' ? (
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
      ) : (
        <PostJobScreen />
      )}
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
