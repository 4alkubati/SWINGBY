// T58 — SearchScreen (UX polish pass)
// Sticky SearchField (design-system), Chip radius pills, AnimatedPressable recent rows.
// All colors/spacing/radius via tokens. No StyleSheet.create.
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
import NearbyCard from '../../components/NearbyCard';
import CategoryScroll from '../../components/CategoryScroll';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import SearchField from '../../components/SearchField';
import Chip from '../../components/Chip';
import DSText from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import { colors, spacing, radius, motion } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────
const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };
const RECENT_KEY = 'swingby_recent_searches';
const RADIUS_OPTIONS = [5, 10, 25, 50];

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
export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const coordsRef = useRef(null);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRadius, setActiveRadius] = useState(25);

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

    getUserLocation()
      .then((c) => { coordsRef.current = c; })
      .catch(() => { coordsRef.current = CALGARY_FALLBACK; });
  }, []);

  // ─── Search trigger — fires after SearchField debounce updates `query` ───
  useEffect(() => {
    if (!query.trim()) {
      setLoadState('idle');
      setResults([]);
      return;
    }
    runSearch(query.trim(), activeCategory, activeRadius);
  }, [query, activeCategory, activeRadius]);

  // ─── Core search logic ───────────────────────────────────────────────────
  const runSearch = useCallback(async (q, category, rad) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadState('loading');
    setErrorMsg('');

    let coords = coordsRef.current;
    if (!coords) {
      try { coords = await getUserLocation(); }
      catch { coords = CALGARY_FALLBACK; }
      coordsRef.current = coords;
    }

    try {
      const params = { lat: coords.lat, lng: coords.lng, radius_km: rad };
      if (q) params.q = q;

      const data = await api.get('/businesses/nearby', { params, signal: controller.signal });
      let list = Array.isArray(data) ? data : (data?.businesses ?? []);

      // Client-side text filter (defensive fallback)
      if (q) {
        const lower = q.toLowerCase();
        list = list.filter(
          (b) =>
            (b.business_name ?? '').toLowerCase().includes(lower) ||
            (b.category ?? '').toLowerCase().includes(lower)
        );
      }

      // Client-side category filter
      if (category && category !== 'all') {
        list = list.filter((b) => (b.category ?? '').toLowerCase() === category);
      }

      // Attach computed distance
      list = list.map((b) => ({
        ...b,
        _distance: computeDistance(coords.lat, coords.lng, b.lat, b.lng),
      }));

      setResults(list);
      setLoadState(list.length === 0 ? 'empty' : 'done');
      saveRecent(q);
    } catch (err) {
      if (controller.signal.aborted) return;
      setErrorMsg(err.message || 'Network error');
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
              RECENT
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
          title="Search local pros"
          body="Type a business name or category"
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
          title="No matches"
          body={`No results for "${query}"`}
          action={{ label: 'Clear search', onPress: handleClear }}
        />
      );
    }

    if (loadState === 'error') {
      return (
        <EmptyState
          icon="wifi-off"
          title="Network error"
          body={errorMsg}
          action={{
            label: 'Retry',
            onPress: () => runSearch(query, activeCategory, activeRadius),
          }}
        />
      );
    }

    // done — F-pattern full-width result cards
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.xl,
        }}
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
        placeholder="Search businesses, categories…"
        debounceMs={300}
        autoFocus
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

      {/* Radius pills — Chip components in an Inline row */}
      <Inline
        spacing="sm"
        style={{
          paddingHorizontal: spacing.base,
          marginTop: spacing.sm + 2,
          marginBottom: spacing.xs,
        }}
      >
        {RADIUS_OPTIONS.map((r) => (
          <Chip
            key={r}
            label={`${r}km`}
            selected={activeRadius === r}
            onPress={() => setActiveRadius(r)}
          />
        ))}
      </Inline>

      {/* Content area */}
      <View style={{ flex: 1, marginTop: spacing.sm }}>
        {renderContent()}
      </View>
    </View>
  );
}
