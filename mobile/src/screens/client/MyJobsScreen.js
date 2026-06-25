import {
  View, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { colors, spacing } from '../../theme/tokens';
import { SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Text from '../../components/Text';

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: colors.accent,   bg: colors.accentMuted },
  in_progress: { label: 'In Progress', color: colors.accent,   bg: colors.accentMuted },
  completed:   { label: 'Done',        color: colors.success,  bg: colors.accentMuted },
  cancelled:   { label: 'Cancelled',   color: colors.textSecondary, bg: colors.surfaceAlt },
  open:        { label: 'Awaiting Quotes', color: colors.accentText,   bg: colors.accentMuted },
  matched:     { label: 'Matched',     color: colors.success,  bg: colors.accentMuted },
  expired:     { label: 'Expired',     color: colors.textSecondary, bg: colors.surfaceAlt },
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
  const [error, setError] = useState(null);
  const isClient = user?.role === 'client';

  const load = useCallback(async () => {
    try {
      setError(null);
      const calls = [api.get('/bookings/')];
      if (isClient) {
        calls.push(api.get('/service-posts/my').catch(() => ({ items: [] })));
      }
      const [bookingRes, postRes] = await Promise.all(calls);
      setBookings(bookingRes?.items || bookingRes || []);
      if (isClient) setPosts(postRes?.items || postRes || []);
    } catch (e) {
      setError(e.message || 'Could not load jobs');
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <EmptyState
          icon="alert-circle"
          title="Could not load jobs"
          body={error}
          ctaLabel="Try again"
          onCta={load}
        />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
        ListEmptyComponent={
          <EmptyState
            icon={tab === 'active' ? 'briefcase' : 'clock'}
            title={tab === 'active' ? 'No active jobs right now' : 'No past jobs yet'}
            body={
              tab === 'active'
                ? 'Book a service or post a job to get started.'
                : 'Completed and cancelled jobs will appear here.'
            }
          />
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, letterSpacing: -0.5 },
  postsSection: { paddingHorizontal: 22 },
  sectionLabel: {
    fontSize: 11, color: colors.accentText, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  tabs: {
    flexDirection: 'row', marginHorizontal: 22, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary },
  list: { paddingHorizontal: 22, paddingBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLeft: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, flex: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  rowDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  actionBtn: {
    backgroundColor: colors.accentMuted, borderWidth: 1,
    borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  actionBtnHighlight: {
    backgroundColor: colors.accentMuted, borderColor: colors.border,
  },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.accent },
  actionBtnTextHighlight: { color: colors.accentText },
});
