import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ModeSwitch from '../components/ModeSwitch';
import CategoryScroll from '../components/CategoryScroll';
import FeaturedCard from '../components/FeaturedCard';
import NearbyCard from '../components/NearbyCard';
import PostJobScreen from './PostJobScreen';
import { api } from '../services/api';
import { getUserLocation } from '../services/location';

const CALGARY_FALLBACK = { lat: 51.0447, lng: -114.0719 };

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

export default function HomeScreen({ navigation }) {
  const [mode, setMode] = useState('browse');
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeCategory, setActiveCategory] = useState('cleaning');

  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [businessError, setBusinessError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchNearby() {
      setLoadingBusinesses(true);
      setBusinessError(null);
      try {
        let coords;
        try {
          coords = await getUserLocation();
        } catch {
          coords = CALGARY_FALLBACK;
        }

        const data = await api.get('/businesses/nearby', {
          params: { lat: coords.lat, lng: coords.lng, radius_km: 25 },
        });

        if (!cancelled) {
          const list = Array.isArray(data) ? data : (data?.businesses ?? []);
          setBusinesses(list.map((b) => ({
            ...b,
            _distance: computeDistance(coords.lat, coords.lng, b.lat, b.lng),
          })));
        }
      } catch (err) {
        if (!cancelled) setBusinessError(err.message || 'Failed to load nearby businesses');
      } finally {
        if (!cancelled) setLoadingBusinesses(false);
      }
    }

    fetchNearby();
    return () => { cancelled = true; };
  }, []);

  const filteredBusinesses = activeCategory === 'all'
    ? businesses
    : businesses.filter((b) => (b.category ?? '').toLowerCase() === activeCategory);

  const topRated = filteredBusinesses.length
    ? filteredBusinesses.reduce((best, b) =>
        (b.avg_rating ?? 0) > (best.avg_rating ?? 0) ? b : best
      )
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          Swing<Text style={styles.logoDot}>By</Text>
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.locPill}>
            <Text style={styles.locText}>📍 Calgary, AB</Text>
          </View>
          <View style={styles.bellBtn}>
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.notifDot} />
          </View>
        </View>
      </View>

      {/* Greeting */}
      <View style={styles.greet}>
        <Text style={styles.greetSub}>Good morning</Text>
        <Text style={styles.greetName}>
          {user?.first_name || 'Ali'} <Text style={styles.greetAccent}>.</Text>
        </Text>
      </View>

      {/* Mode switcher */}
      <ModeSwitch mode={mode} onModeChange={setMode} />

      {/* Content — swaps based on mode */}
      {mode === 'browse' ? (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>Search services…</Text>
            <Text style={styles.searchFilter}>⚙</Text>
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.sectionMore}>See all</Text>
            </TouchableOpacity>
          </View>
          <CategoryScroll activeCategory={activeCategory} onSelect={setActiveCategory} />

          {/* Top Rated */}
          <View style={[styles.section, styles.sectionSpaced]}>
            <Text style={styles.sectionTitle}>Top Rated</Text>
          </View>
          {loadingBusinesses ? (
            <ActivityIndicator color="#FF5C00" style={styles.loader} />
          ) : businessError ? (
            <Text style={styles.errorText}>{businessError}</Text>
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

          {/* Nearby */}
          <View style={[styles.section, styles.sectionSpaced]}>
            <Text style={styles.sectionTitle}>Nearby</Text>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Map')}>
              <Text style={styles.sectionMore}>Map view</Text>
            </TouchableOpacity>
          </View>
          {loadingBusinesses ? (
            <ActivityIndicator color="#FF5C00" style={styles.loader} />
          ) : businessError ? (
            <Text style={styles.errorText}>{businessError}</Text>
          ) : filteredBusinesses.length === 0 ? (
            <Text style={styles.emptyText}>
              No {activeCategory} businesses nearby.
            </Text>
          ) : (
            <View style={styles.nearbyList}>
              {filteredBusinesses.map((b, index) => (
                <NearbyCard
                  key={b.id}
                  name={b.business_name}
                  initials={toInitials(b.business_name)}
                  rating={b.avg_rating?.toFixed(1) ?? '—'}
                  jobs={b.review_count ?? 0}
                  distance={b._distance}
                  avatarStyle={index % 2 === 0 ? 'green' : 'blue'}
                  onPress={() => navigation.navigate('BusinessProfile', { businessId: b.id })}
                />
              ))}
            </View>
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
    backgroundColor: '#07080a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -1,
    color: '#ffffff',
  },
  logoDot: {
    color: '#FF5C00',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locPill: {
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.25)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  locText: {
    fontSize: 12,
    color: '#FF8C42',
    fontWeight: '600',
  },
  bellBtn: {
    width: 34,
    height: 34,
    backgroundColor: '#111315',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 16,
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    backgroundColor: '#FF5C00',
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#07080a',
  },
  greet: {
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  greetSub: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },
  greetName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  greetAccent: {
    color: '#FF5C00',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 22,
    marginTop: 12,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchPlaceholder: {
    fontSize: 14,
    color: '#3a424c',
    flex: 1,
  },
  searchFilter: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionSpaced: {
    paddingTop: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionMore: {
    fontSize: 13,
    color: '#FF5C00',
    fontWeight: '600',
  },
  nearbyList: {
    paddingHorizontal: 22,
    paddingTop: 0,
    gap: 10,
  },
  loader: {
    marginVertical: 16,
  },
  errorText: {
    marginHorizontal: 22,
    marginVertical: 10,
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
  emptyText: {
    marginHorizontal: 22,
    marginVertical: 10,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
});
