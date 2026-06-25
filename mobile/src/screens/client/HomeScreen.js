import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import ModeSwitch from '../../components/ModeSwitch';
import CategoryScroll from '../../components/CategoryScroll';
import FeaturedCard from '../../components/FeaturedCard';
import NearbyCard from '../../components/NearbyCard';
import PostJobScreen from './PostJobScreen';
import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';

// New design-system imports
import { colors, spacing } from '../../theme/tokens';
import Text from '../../components/Text';
import Chip from '../../components/Chip';
import SearchField from '../../components/SearchField';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import { SkeletonBox, SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

// ─── Constants ────────────────────────────────────────────────────────────────
const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719, city: 'Calgary, AB' };

const CATEGORIES = [
  { id: 'all',        label: 'All',       emoji: '🔍' },
  { id: 'cleaning',   label: 'Cleaning',  emoji: '✨' },
  { id: 'plumbing',   label: 'Plumbing',  emoji: '🔧' },
  { id: 'moving',     label: 'Moving',    emoji: '🚚' },
  { id: 'electrical', label: 'Electric',  emoji: '⚡' },
  { id: 'lawn',       label: 'Lawn',      emoji: '🌿' },
  { id: 'painting',   label: 'Painting',  emoji: '🎨' },
  { id: 'carpentry',  label: 'Carpentry', emoji: '🪚' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Skeleton for the featured "Top Rated" card ───────────────────────────────
function SkeletonFeaturedCard() {
  return (
    <Surface elevation="subtle" style={styles.featuredCardSkeleton}>
      <Inline spacing="md">
        <SkeletonBox width={54} height={54} borderRadius={16} />
        <Stack spacing="xs" style={{ flex: 1 }}>
          <SkeletonBox width="60%" height={14} borderRadius={6} />
          <SkeletonBox width="40%" height={12} borderRadius={6} />
          <SkeletonBox width="30%" height={10} borderRadius={6} />
        </Stack>
      </Inline>
    </Surface>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <Inline justify="space-between" style={styles.sectionHeader}>
      <Text variant="label" color="secondary" accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</Text>
      {actionLabel && (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text variant="smallMedium" color="accent" maxFontSizeMultiplier={1.4}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Inline>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
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

  // ── Data fetching (preserved exactly) ──────────────────────────────────────
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

      // Resolve city name for the location chip
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

  // ── Filtering (preserved exactly, extended for search) ─────────────────────
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

  // ── Navigation (preserved exactly) ─────────────────────────────────────────
  const firstName = user?.first_name || 'there';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Fixed Header ───────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Logo */}
        <Text variant="h1" style={styles.logo} accessibilityRole="header" accessibilityLabel="SwingBy">
          Swing<Text variant="h1" color="accent">By</Text>
        </Text>

        {/* Bell button */}
        <TouchableOpacity
          style={styles.bellBtn}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.bellIcon} accessible={false}>🔔</Text>
          <View style={styles.notifDot} accessible={false} />
        </TouchableOpacity>
      </View>

      {/* ── Mode switcher ──────────────────────────────────────────────────── */}
      <ModeSwitch mode={mode} onModeChange={setMode} />

      {/* ── Scrollable content (browse mode) ───────────────────────────────── */}
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
          {/* ── Top section: greeting + location chip ────────────────────── */}
          <Stack spacing="sm" style={styles.topSection}>
            <Inline spacing="sm" align="center" justify="space-between">
              <Text variant="display3" maxFontSizeMultiplier={1.4}>Hey {firstName}</Text>
              <Chip
                label={`📍  ${cityLabel}`}
                selected={false}
                style={styles.locationChip}
              />
            </Inline>
            <Text variant="small" color="secondary">
              What service are you looking for?
            </Text>
          </Stack>

          {/* ── SearchField ──────────────────────────────────────────────── */}
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search services…"
            style={styles.searchField}
          />

          {/* ── Category scroll ──────────────────────────────────────────── */}
          <SectionHeader title="Categories" />
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <Chip
                label={`${item.emoji}  ${item.label}`}
                selected={activeCategory === item.id}
                onPress={() => setActiveCategory(item.id)}
              />
            )}
          />

          {/* ── Top Rated section ────────────────────────────────────────── */}
          <SectionHeader title="Top Rated" style={styles.sectionSpaced} />
          {loadingBusinesses ? (
            <SkeletonFeaturedCard />
          ) : businessError ? (
            <Surface elevation="subtle" style={styles.errorSurface}>
              <Stack spacing="sm" align="center">
                <Text variant="small" color="danger">{businessError}</Text>
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
                  <Text variant="smallMedium" color="accent" maxFontSizeMultiplier={1.4}>Retry</Text>
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
            />
          ) : null}

          {/* ── Nearby section ───────────────────────────────────────────── */}
          <SectionHeader
            title="Nearby"
            actionLabel="Map view"
            onAction={() => navigation.navigate('Map')}
            style={styles.sectionSpaced}
          />

          {loadingBusinesses ? (
            <View style={styles.nearbyList}>
              <SkeletonList count={4} />
            </View>
          ) : businessError ? null /* error already shown above */ : filteredBusinesses.length === 0 ? (
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
              {filteredBusinesses.map((b, index) => (
                <NearbyCard
                  key={b.id}
                  name={b.business_name}
                  initials={toInitials(b.business_name)}
                  rating={b.avg_rating?.toFixed(1) ?? '—'}
                  jobs={b.review_count ?? 0}
                  distance={b._distance}
                  avatarStyle={index % 2 === 0 ? 'green' : 'blue'}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logo: {
    letterSpacing: -1,
  },
  bellBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 16,
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },

  // Top section
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  locationChip: {
    // keeps chip compact, no extra margin
  },

  // Search
  searchField: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Sections
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  sectionSpaced: {
    marginTop: spacing.sm,
  },

  // Category chips
  categoryList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // Featured card skeleton wrapper
  featuredCardSkeleton: {
    marginHorizontal: spacing.lg,
  },

  // Error surface
  errorSurface: {
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.base,
  },
  retryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },

  // Nearby list
  nearbyList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
});
