// T60 — FavoritesScreen
// Reads favorited IDs from AsyncStorage, fetches each business in parallel,
// renders a list of NearbyCards with a removable heart icon.
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { show as showToast } from '../services/toast';
import { useFavorites } from '../hooks/useFavorites';
import NearbyCard from '../components/NearbyCard';
import EmptyState from '../components/EmptyState';
import { Feather } from '@expo/vector-icons';

function toInitials(name) {
  return (name || '').slice(0, 2).toUpperCase();
}

export default function FavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { ids, remove } = useFavorites();

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all favorited businesses in parallel whenever the ids list changes
  useEffect(() => {
    if (ids.length === 0) {
      setBusinesses([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(ids.map((id) => api.get(`/businesses/${id}`)))
      .then((results) => {
        if (!cancelled) {
          // Filter out any nulls in case an id no longer exists
          setBusinesses(results.filter(Boolean));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load favorites');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [ids]);

  const handleRemove = useCallback(
    (id) => {
      remove(id);
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      showToast({ type: 'info', text1: 'Removed', text2: 'Business removed from favorites' });
    },
    [remove]
  );

  // ─── Header ──────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="arrow-left" size={20} color="#ffffff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Favorites</Text>
      <View style={styles.headerRight} />
    </View>
  );

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (!loading && ids.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <EmptyState
          icon="heart"
          title="No favorites yet"
          body="Tap the heart on any business to save it"
          action={{
            label: 'Browse',
            onPress: () => navigation.navigate('Home'),
          }}
        />
      </View>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator color="#FF5C00" size="large" />
        </View>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <EmptyState
          icon="wifi-off"
          title="Couldn't load favorites"
          body={error}
          action={{
            label: 'Retry',
            onPress: () => setError(null), // triggers re-render → useEffect re-runs
          }}
        />
      </View>
    );
  }

  // ─── Results list ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      <FlatList
        data={businesses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={styles.cardWrap}>
            <NearbyCard
              name={item.business_name}
              initials={toInitials(item.business_name)}
              rating={item.avg_rating?.toFixed(1) ?? '—'}
              jobs={item.review_count ?? 0}
              distance={item._distance ?? '—'}
              avatarStyle={index % 2 === 0 ? 'green' : 'blue'}
              onPress={() =>
                navigation.navigate('BusinessProfile', { businessId: item.id })
              }
            />
            {/* Heart button — filled orange, top-right of card */}
            <TouchableOpacity
              style={styles.heartBtn}
              onPress={() => handleRemove(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              <Feather name="heart" size={18} color="#FF5C00" />
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="heart"
            title="No favorites yet"
            body="Tap the heart on any business to save it"
            action={{ label: 'Browse', onPress: () => navigation.navigate('Home') }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerRight: {
    width: 40,
  },
  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 10,
  },
  // ── Card + heart overlay ───────────────────────────────────────────────────
  cardWrap: {
    position: 'relative',
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,92,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.3)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Loading / error fallbacks ──────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
