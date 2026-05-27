import {
  View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import JobCard from '../components/JobCard';
import JobOpportunityCard from '../components/JobOpportunityCard';
import SendQuoteSheet from '../components/SendQuoteSheet';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, p, biz] = await Promise.all([
        api.get('/bookings/'),
        api.get('/service-posts/'),
        api.get('/businesses/me').catch(() => null),
      ]);
      setBookings(b || []);
      setPosts((p || []).filter((post) => post.status === 'open'));
      setBusiness(biz || null);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function openQuoteSheet(post) {
    setSelectedPost(post);
    setSheetVisible(true);
  }

  const activeBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'in_progress'
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Swing<Text style={styles.logoDot}>By</Text></Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C00" />}
      >
        {/* Greeting */}
        <View style={styles.greet}>
          <Text style={styles.greetSub}>{greeting}</Text>
          <Text style={styles.greetName}>
            {user?.first_name || 'Ahmed'} <Text style={styles.greetAccent}>.</Text>
          </Text>
        </View>

        {/* Business stats card */}
        {business && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>{business.business_name}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {business.avg_rating != null ? Number(business.avg_rating).toFixed(1) : '—'}
                </Text>
                <Text style={styles.statLabel}>★ Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{business.review_count ?? 0}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{business.service_radius_km ?? 25} km</Text>
                <Text style={styles.statLabel}>Radius</Text>
              </View>
            </View>
          </View>
        )}

        {/* Active bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Bookings</Text>
        </View>

        {activeBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active bookings right now</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={activeBookings}
            keyExtractor={(b) => b.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookingsList}
            renderItem={({ item }) => (
              <JobCard
                booking={item}
                onPress={() => navigation.navigate('JobManagement', { bookingId: item.id })}
              />
            )}
          />
        )}

        {/* Opportunities */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>New Opportunities</Text>
          <Text style={styles.sectionCount}>{posts.length} open</Text>
        </View>

        <View style={styles.postsList}>
          {posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No open jobs right now — check back soon</Text>
            </View>
          ) : (
            posts.map((post) => (
              <JobOpportunityCard
                key={post.id}
                post={post}
                onSendQuote={() => openQuoteSheet(post)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <SendQuoteSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        post={selectedPost}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 8,
  },
  logo: { fontSize: 24, fontWeight: '700', letterSpacing: -1, color: '#ffffff' },
  logoDot: { color: '#FF5C00' },
  bellBtn: {
    width: 34, height: 34, backgroundColor: '#111315', borderWidth: 1,
    borderColor: '#2a2e33', borderRadius: 17, alignItems: 'center', justifyContent: 'center',
  },
  bellIcon: { fontSize: 16 },
  greet: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4 },
  greetSub: { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  greetName: { fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  greetAccent: { color: '#FF5C00' },
  section: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#9ca3af',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  sectionCount: { fontSize: 13, color: '#FF5C00', fontWeight: '600' },
  bookingsList: { paddingHorizontal: 22, gap: 12, paddingBottom: 4 },
  postsList: { paddingHorizontal: 22, gap: 12, paddingBottom: 24 },
  emptyCard: {
    marginHorizontal: 22,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  statsCard: {
    marginHorizontal: 22, marginTop: 16,
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 18, padding: 16,
  },
  statsTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  statDivider: { width: 1, height: 36, backgroundColor: '#1a1d1f' },
});
