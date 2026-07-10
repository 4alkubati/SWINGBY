import {
  View, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import Text from '../../components/Text';
import { api } from '../../services/api';
import { colors, spacing } from '../../theme/tokens';
import { SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildNotifications(bookings, posts) {
  const notifs = [];

  (bookings || []).forEach((b) => {
    if (b.status === 'confirmed') {
      notifs.push({
        id: `booking-confirmed-${b.id}`,
        iconName: 'check-circle',
        iconTone: 'success',
        title: 'Booking confirmed',
        desc: `Your job has been confirmed.`,
        time: b.created_at,
        screen: 'ActiveBooking',
        params: { bookingId: b.id },
      });
    }
    if (b.status === 'completed') {
      notifs.push({
        id: `booking-done-${b.id}`,
        iconName: 'award',
        iconTone: 'accent',
        title: 'Job completed',
        desc: 'Leave a review for your provider.',
        time: b.created_at,
        screen: 'Review',
        params: {
          bookingId: b.id,
          workerId: b.employee_id || b.business_id,
          workerName: b.businesses?.business_name || 'Provider',
        },
      });
    }
  });

  (posts || []).forEach((p) => {
    if (p.interest_count > 0) {
      notifs.push({
        id: `quotes-${p.id}`,
        iconName: 'dollar-sign',
        iconTone: 'money',
        title: `${p.interest_count} quote${p.interest_count > 1 ? 's' : ''} received`,
        desc: p.title || 'View and compare quotes',
        time: p.created_at,
        screen: 'QuoteComparison',
        params: { postId: p.id, postTitle: p.title },
      });
    }
  });

  return notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
}

const TONE_MAP = {
  success: { color: colors.success, bg: 'rgba(46,189,133,0.15)' },
  accent: { color: colors.accentText, bg: colors.accentMuted },
  money: { color: colors.success, bg: 'rgba(46,189,133,0.15)' },
};

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bookingsRes, postsRes] = await Promise.all([
        api.get('/bookings/'),
        api.get('/service-posts/my').catch(() => ({ items: [] })),
      ]);
      setNotifications(buildNotifications(
        bookingsRes?.items || bookingsRes || [],
        postsRes?.items || postsRes || [],
      ));
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ width: 32 }} />
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        ListEmptyComponent={
          <EmptyState
            icon="bell"
            title="All caught up"
            body="Booking updates and messages will appear here."
          />
        }
        renderItem={({ item }) => {
          const tone = TONE_MAP[item.iconTone] || TONE_MAP.accent;
          return (
            <TouchableOpacity
              style={styles.notifRow}
              onPress={() => item.screen && navigation.navigate(item.screen, item.params)}
              activeOpacity={0.85}
            >
              <View style={[styles.notifIcon, { backgroundColor: tone.bg }]}>
                <Feather name={item.iconName} size={16} color={tone.color} strokeWidth={2} />
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifDesc} numberOfLines={1}>{item.desc}</Text>
              </View>
              <Text style={styles.notifTime}>{timeAgo(item.time)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  list: { paddingHorizontal: 22, paddingBottom: 24 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  notifDesc: { fontSize: 13, color: colors.textSecondary },
  notifTime: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
});
