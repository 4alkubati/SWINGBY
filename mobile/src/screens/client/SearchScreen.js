// T58 — SearchScreen (UX polish pass) · LANE F — work-history search
// Sticky SearchField (design-system), AnimatedPressable recent rows.
// GET /businesses/?q= no longer matches business NAMES — it ranks businesses by
// how much the work they have COMPLETED resembles the query ("big house" finds
// whoever did a big-house job). Works with NO location; distance is attached
// only when coords are available (degrades gracefully when denied).
// `route.params.q` seeds the box so arriving from Home lands on results.
// All colors/spacing via tokens. No StyleSheet.create.
import { View, FlatList, Pressable, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

import { api } from '../../services/api';
import { getUserLocation } from '../../services/location';
import i18n from '../../i18n';
import NearbyCard from '../../components/NearbyCard';
import CategoryScroll from '../../components/CategoryScroll';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import SearchField from '../../components/SearchField';
import DSText from '../../components/Text';
import Stack from '../../components/Stack';
import { colors, spacing, motion } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────
const RECENT_KEY = 'swingby_recent_searches';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toInitials(name) {
  return (name || '').slice(0, 2).toUpperCase();
}

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
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1) + ' km';
}

// ─── AnimatedPressable recent row ────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function RecentRow({ term, onPress }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onPress(term)}
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
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          minHeight: 44,
        },
        animStyle,
      ]}
    >
      <Feather
        name="clock"
        size={14}
        color={colors.textSecondary}
        style={{ marginRight: spacing.sm + 2 }}
      />
      <DSText variant="small" color="secondary">
        {term}
      </DSText>
    </AnimatedPressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const coordsRef = useRef(null);

  // Seed from route.params.q so arriving with a term lands on RESULTS, not an
  // empty box. HomeScreen already navigates `Search` with { q } — without this
  // the term was dropped on the floor and the screen opened blank (LANE F).
  const [query, setQuery] = useState(route?.params?.q ?? '');
  const [activeCategory, setActiveCategory] = useState('all');

  const [results, setResults] = useState([]);
  const [loadState, setLoadState] = useState('idle'); // idle | loading | done | empty | error
  const [errorMsg, setErrorMsg] = useState('');

  const [recentSearches, setRecentSearches] = useState([]);
  const abortRef = useRef(null);

  // ─── Load recent searches + prefetch location on mount ───────────────────
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try { setRecentSearches(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });

    // Best-effort location — never block name search on it. If permission is
    // denied or the lookup fails, coords stay null and distance is simply
    // skipped (DQ-1: browse must work without location).
    getUserLocation()
      .then((c) => { coordsRef.current = c; })
      .catch(() => { coordsRef.current = null; });
  }, []);

  // ─── Re-seed when navigated to again with a different term ───────────────
  // useState above only covers the first mount. Navigating to Search a second
  // time with a new { q } reuses the mounted screen, so mirror the param into
  // state here; the search-trigger effect below then runs it.
  const seededQuery = route?.params?.q;
  useEffect(() => {
    if (typeof seededQuery === 'string' && seededQuery.trim()) {
      setQuery(seededQuery);
    }
  }, [seededQuery]);

  // ─── Search trigger — fires after SearchField debounce updates `query` ───
  useEffect(() => {
    if (!query.trim()) {
      setLoadState('idle');
      setResults([]);
      return;
    }
    runSearch(query.trim(), activeCategory);
  }, [query, activeCategory]);

  // ─── Core search logic ───────────────────────────────────────────────────
  // Name-based search hits GET /businesses/?q=… which requires NO location, so
  // results render even when geolocation is denied. Distance is attached only
  // when we happen to have the caller's coordinates.
  const runSearch = useCallback(async (q, category) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadState('loading');
    setErrorMsg('');

    const coords = coordsRef.current;

    try {
      const params = { q, limit: 50 };
      if (category && category !== 'all') params.category = category;
      // Send coords when we have them so the backend can return an authoritative
      // distance_km. Never required — omitting them just means no distance.
      if (coords) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }

      const data = await api.get('/businesses/', { params, signal: controller.signal });
      let list = Array.isArray(data) ? data : (data?.items ?? []);

      // Prefer the server's distance_km; fall back to computing it locally when
      // the backend didn't supply one (older build, or coords sent but the row
      // has no lat/lng).
      list = list.map((b) => {
        const hasCoords =
          coords && typeof b.lat === 'number' && typeof b.lng === 'number';
        return {
          ...b,
          _distance:
            typeof b.distance_km === 'number'
              ? `${b.distance_km.toFixed(1)} km`
              : hasCoords
                ? computeDistance(coords.lat, coords.lng, b.lat, b.lng)
                : null,
        };
      });

      setResults(list);
      setLoadState(list.length === 0 ? 'empty' : 'done');
      saveRecent(q);
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMsg(err.message || i18n.t('common.error'));
      setLoadState('error');
    }
  }, []);

  const saveRecent = useCallback(async (q) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((r) => r !== q)].slice(0, 5);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setLoadState('idle');
  }, []);

  const handleRecentTap = useCallback((term) => {
    setQuery(term);
  }, []);

  // ─── Render content area ──────────────────────────────────────────────────
  const renderContent = () => {
    if (loadState === 'idle') {
      if (recentSearches.length > 0) {
        return (
          <Stack
            spacing={0}
            style={{
              paddingHorizontal: spacing.base,
              paddingTop: spacing.sm,
            }}
          >
            <DSText
              variant="label"
              color="secondary"
              style={{ marginBottom: spacing.sm + 2 }}
            >
              {i18n.t('search.recent')}
            </DSText>
            {recentSearches.map((term) => (
              <RecentRow key={term} term={term} onPress={handleRecentTap} />
            ))}
          </Stack>
        );
      }
      return (
        <EmptyState
          icon="search"
          title={i18n.t('search.idleTitle')}
          body={i18n.t('search.idleBody')}
        />
      );
    }

    if (loadState === 'loading') {
      return (
        <View style={{ paddingHorizontal: spacing.base }}>
          <SkeletonList count={5} />
        </View>
      );
    }

    if (loadState === 'empty') {
      return (
        <EmptyState
          icon="slash"
          title={i18n.t('search.noMatchesTitle')}
          body={i18n.t('search.noMatchesBody', { query })}
          action={{ label: i18n.t('search.clear'), onPress: handleClear }}
        />
      );
    }

    if (loadState === 'error') {
      return (
        <EmptyState
          icon="wifi-off"
          title={i18n.t('search.errorTitle')}
          body={errorMsg}
          action={{
            label: i18n.t('common.retry'),
            onPress: () => runSearch(query.trim(), activeCategory),
          }}
        />
      );
    }

    // done — F-pattern full-width result cards under a result-count eyebrow
    // (mock: "8 RESULTS NEAR YOU"). Falls back to an English default so this
    // screen doesn't have to reach into the shared i18n catalogue.
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
        }}
        ListHeaderComponent={
          <DSText
            variant="label"
            color="secondary"
            style={{ marginBottom: spacing.sm, letterSpacing: 1.4 }}
          >
            {i18n
              .t('search.resultsCount', {
                count: results.length,
                defaultValue: '%{count} RESULTS',
              })
              .toUpperCase()}
          </DSText>
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <NearbyCard
            name={item.business_name}
            initials={toInitials(item.business_name)}
            rating={item.avg_rating?.toFixed(1) ?? '—'}
            jobs={item.review_count ?? 0}
            distance={item._distance}
            avatarStyle={index % 2 === 0 ? 'green' : 'blue'}
            onPress={() =>
              navigation.navigate('BusinessProfile', { businessId: item.id })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm + 2 }} />}
      />
    );
  };

  // ─── Root layout ──────────────────────────────────────────────────────────
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* Sticky search bar — dominant focal point */}
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={i18n.t('search.placeholder')}
        debounceMs={300}
        // Only grab focus on a cold open. Arriving with a seeded term means the
        // user already typed it elsewhere — popping the keyboard would just
        // cover the results they came here to see.
        autoFocus={!route?.params?.q}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          marginHorizontal: spacing.base,
          marginTop: spacing.sm,
          marginBottom: spacing.xs,
        }}
      />

      {/* Category chips */}
      <View style={{ marginTop: spacing.sm }}>
        <CategoryScroll
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          prependAll
        />
      </View>

      {/* Content area */}
      <View style={{ flex: 1, marginTop: spacing.sm }}>
        {renderContent()}
      </View>
    </View>
  );
}
