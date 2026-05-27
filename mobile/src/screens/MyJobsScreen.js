import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'In Progress', color: '#FF8C42', bg: 'rgba(255,92,0,0.12)' },
  completed:   { label: 'Done',        color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  open:        { label: 'Awaiting Quotes', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  matched:     { label: 'Matched',     color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  expired:     { label: 'Expired',     color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function BookingRow({ booking, onPress, onReview, userRole }) {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
  const otherParty = userRole === 'client'
    ? (booking.business_name || 'Business')
    : (booking.client_name || 'Client');
  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{otherParty}</Text>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.rowSub}>{booking.service_type || 'Service'}</Text>
        {date && <Text style={styles.rowDate}>{date}{booking.scheduled_time ? ` · ${booking.scheduled_time}` : ''}</Text>}
      </View>
      {booking.status === 'completed' && onReview && (
        <TouchableOpacity style={styles.actionBtn} onPress={onReview} activeOpacity={0.8}>
          <Text style={styles.actionBtnText}>Review</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function PostRow({ post, onViewQuotes }) {
  const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.open;
  const quoteCount = post.interest_count ?? 0;
  const date = post.preferred_date
    ? new Date(post.preferred_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity style={styles.row} onPress={quoteCount > 0 ? onViewQuotes : undefined} activeOpacity={0.8}>
      <View style={styles.rowLeft}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{post.title || 'Job post'}</Text>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.rowSub}>{post.category || 'General'}</Text>
        {date && <Text style={styles.rowDate}>{date}</Text>}
      </View>
      {post.status === 'open' && (
        <TouchableOpacity
          style={[styles.actionBtn, quoteCount > 0 && styles.actionBtnHighlight]}
          onPress={onViewQuotes}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionBtnText, quoteCount > 0 && styles.actionBtnTextHighlight]}>
            {quoteCount > 0 ? `${quoteCount} quote${quoteCount > 1 ? 's' : ''}` : 'No quotes'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function MyJobsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isClient = user?.role === 'client';

  const load = useCallback(async () => {
    try {
      const calls = [api.get('/bookings/')];
      if (isClient) {
        calls.push(api.get('/service-posts/my').catch(() => []));
      }
      const [bookingData, postData] = await Promise.all(calls);
      setBookings(bookingData || []);
      if (isClient) setPosts(postData || []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient]);

  useEffect(() => { load(); }, [load]);

  const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress');
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled');
  const openPosts = posts.filter((p) => p.status === 'open' || p.status === 'matched');
  const shownBookings = tab === 'active' ? active : past;

  function handleBookingPress(booking) {
    if (isClient) {
      navigation.navigate('ActiveBooking', { bookingId: booking.id });
    } else {
      navigation.navigate('JobManagement', { bookingId: booking.id });
    }
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      {/* Open service posts — client only */}
      {isClient && openPosts.length > 0 && (
        <View style={styles.postsSection}>
          <Text style={styles.sectionLabel}>Open Posts</Text>
          {openPosts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onViewQuotes={() =>
                navigation.navigate('QuoteComparison', {
                  postId: post.id,
                  postTitle: post.title,
                })
              }
            />
          ))}
          <View style={styles.divider} />
        </View>
      )}

      {/* Bookings tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active ({active.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'past' && styles.tabBtnActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
            Past ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={shownBookings}
        keyExtractor={(b) => b.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5C00" />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {tab === 'active' ? 'No active jobs right now' : 'No past jobs yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookingRow
            booking={item}
            userRole={user?.role}
            onPress={() => handleBookingPress(item)}
            onReview={isClient ? () =>
              navigation.navigate('Review', {
                bookingId: item.id,
                workerId: item.employee_id || item.business_id,
                workerName: item.employee_name || item.business_name || 'Provider',
              }) : null
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  postsSection: { paddingHorizontal: 22 },
  sectionLabel: {
    fontSize: 11, color: '#a78bfa', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: '#111315', marginVertical: 12 },
  tabs: {
    flexDirection: 'row', marginHorizontal: 22, marginBottom: 8,
    backgroundColor: '#0d0f10', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: '#1a1d1f',
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#131618', borderWidth: 1, borderColor: '#2a2e33' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff' },
  list: { paddingHorizontal: 22, paddingBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111315',
  },
  rowLeft: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff', flex: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  rowSub: { fontSize: 13, color: '#9ca3af' },
  rowDate: { fontSize: 12, color: '#6b7280' },
  actionBtn: {
    backgroundColor: 'rgba(255,92,0,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.3)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  actionBtnHighlight: {
    backgroundColor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.4)',
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#FF8C42' },
  actionBtnTextHighlight: { color: '#a78bfa' },
  emptyCard: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
});
