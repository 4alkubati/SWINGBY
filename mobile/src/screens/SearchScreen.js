// T59 — SearchScreen
// Dominant focal point: the sticky search bar.
// Debounced 300ms → GET /businesses/nearby?q= (client-side filter fallback).
// Recent searches stored in AsyncStorage (last 5).
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { getUserLocation } from '../services/location';
import NearbyCard from '../components/NearbyCard';
import CategoryScroll from '../components/CategoryScroll';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';
import { Feather } from '@expo/vector-icons';

const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };
const RECENT_KEY = 'swingby_recent_searches';
const RADIUS_OPTIONS = [5, 10, 25, 50];
const DEBOUNCE_MS = 300;

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

// ─── Radius pill ──────────────────────────────────────────────────────────────
function RadiusPill({ value, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.radiusPill, active && styles.radiusPillActive]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Text style={[styles.radiusPillText, active && styles.radiusPillTextActive]}>
        {value}km
      </Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const coordsRef = useRef(null);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRadius, setActiveRadius] = useState(25);

  const [results, setResults] = useState([]);
  const [loadState, setLoadState] = useState('idle'); // idle | loading | done | empty | error
  const [errorMsg, setErrorMsg] = useState('');

  const [recentSearches, setRecentSearches] = useState([]);

  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try { setRecentSearches(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });

    // Prefetch location so first search is instant
    getUserLocation()
      .then((c) => { coordsRef.current = c; })
      .catch(() => { coordsRef.current = CALGARY_FALLBACK; });
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setLoadState('idle');
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(query.trim(), activeCategory, activeRadius);
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query, activeCategory, activeRadius]);

  const runSearch = useCallback(
    async (q, category, radius) => {
      setLoadState('loading');
      setErrorMsg('');

      let coords = coordsRef.current;
      if (!coords) {
        try { coords = await getUserLocation(); }
        catch { coords = CALGARY_FALLBACK; }
        coordsRef.current = coords;
      }

      try {
        const params = { lat: coords.lat, lng: coords.lng, radius_km: radius };
        // Pass q to backend — backend may support it; we also filter client-side defensively.
        if (q) params.q = q;

        const data = await api.get('/businesses/nearby', { params });
        let list = Array.isArray(data) ? data : (data?.businesses ?? []);

        // Client-side filter by query text (defensive)
        if (q) {
          const lower = q.toLowerCase();
          list = list.filter(
            (b) =>
              (b.business_name ?? '').toLowerCase().includes(lower) ||
              (b.category ?? '').toLowerCase().includes(lower)
          );
        }

        // Client-side filter by category chip
        if (category && category !== 'all') {
          list = list.filter((b) => (b.category ?? '').toLowerCase() === category);
        }

        // Attach distance
        list = list.map((b) => ({
          ...b,
          _distance: computeDistance(coords.lat, coords.lng, b.lat, b.lng),
        }));

        setResults(list);
        setLoadState(list.length === 0 ? 'empty' : 'done');

        // Save to recent searches
        saveRecent(q);
      } catch (err) {
        setErrorMsg(err.message || 'Network error');
        setLoadState('error');
      }
    },
    []
  );

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

  // ─── Render states ─────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loadState === 'idle') {
      // No query — show recent searches or empty hero
      if (recentSearches.length > 0) {
        return (
          <View style={styles.recentWrap}>
            <Text style={styles.recentLabel}>RECENT</Text>
            {recentSearches.map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.recentRow}
                onPress={() => handleRecentTap(term)}
                activeOpacity={0.75}
              >
                <Feather name="clock" size={14} color="#6b7280" style={styles.recentIcon} />
                <Text style={styles.recentText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
        <View style={styles.listWrap}>
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
          action={{ label: 'Retry', onPress: () => runSearch(query, activeCategory, activeRadius) }}
        />
      );
    }

    // done — show results list (F-pattern: full-width cards)
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
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
            onPress={() => navigation.navigate('BusinessProfile', { businessId: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Sticky search bar (dominant focal point) ─────────────────────── */}
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color="#6b7280" />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search businesses, categories…"
          placeholderTextColor="#3a424c"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter row: Category chips + Radius pills ─────────────────────── */}
      <View style={styles.filterRow}>
        {/* Category scroll — "All" injected first */}
        <CategoryScroll
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          prependAll
        />
      </View>

      {/* Radius selector */}
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((r) => (
          <RadiusPill
            key={r}
            value={r}
            active={activeRadius === r}
            onPress={() => setActiveRadius(r)}
          />
        ))}
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  // ── Search bar (48pt tall, dark bg, prominent) ─────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#f0ede8',
    fontWeight: '500',
    height: 48,
  },
  // ── Filter area ────────────────────────────────────────────────────────────
  filterRow: {
    marginTop: 8,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  radiusPill: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusPillActive: {
    backgroundColor: 'rgba(255,92,0,0.12)',
    borderColor: '#FF5C00',
  },
  radiusPillText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  radiusPillTextActive: {
    color: '#FF5C00',
  },
  // ── Content area ───────────────────────────────────────────────────────────
  content: {
    flex: 1,
    marginTop: 8,
  },
  listWrap: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 10,
  },
  // ── Recent searches ────────────────────────────────────────────────────────
  recentWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
    minHeight: 44,
  },
  recentIcon: {
    marginRight: 10,
  },
  recentText: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
