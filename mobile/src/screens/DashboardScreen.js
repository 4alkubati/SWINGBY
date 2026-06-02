import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import JobCard from '../components/JobCard';
import JobOpportunityCard from '../components/JobOpportunityCard';
import SendQuoteSheet from '../components/SendQuoteSheet';
import { colors, spacing, radius, shadows, motion } from '../theme/tokens';
import Text from '../components/Text';
import Surface from '../components/Surface';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { SkeletonBox } from '../components/Skeleton';

// ─── greeting helper ──────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── KPI skeleton ─────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <View style={styles.kpiRow}>
      {[0, 1, 2].map((i) => (
        <Surface
          key={i}
          padding="base"
          rounded="card"
          style={styles.kpiCard}
        >
          <Stack spacing="xs">
            <SkeletonBox width={44} height={11} borderRadius={4} />
            <SkeletonBox width={52} height={26} borderRadius={6} />
            <SkeletonBox width={36} height={11} borderRadius={4} />
          </Stack>
        </Surface>
      ))}
    </View>
  );
}

// ─── Activity feed skeleton ───────────────────────────────────────────────────

function FeedSkeleton({ count = 3 }) {
  return (
    <Stack spacing="sm" style={{ paddingHorizontal: spacing.lg }}>
      {Array.from({ length: count }, (_, i) => (
        <Surface key={i} padding="base" rounded="card">
          <Inline justify="space-between">
            <Stack spacing="xs" style={{ flex: 1 }}>
              <SkeletonBox width="60%" height={14} borderRadius={4} />
              <SkeletonBox width="40%" height={12} borderRadius={4} />
            </Stack>
            <SkeletonBox width={60} height={24} borderRadius={radius.chip} />
          </Inline>
        </Surface>
      ))}
    </Stack>
  );
}

// ─── Animated KPI card with entry animation ───────────────────────────────────

function KpiCard({ label, value, subLabel, color = 'primary', index = 0 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: motion.entryDuration + 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, index]);

  return (
    <Animated.View
      style={[
        styles.kpiCard,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Surface padding="base" rounded="card" elevation="subtle" style={{ flex: 1 }}>
        <Stack spacing="xs">
          <Text variant="label" color="secondary">{label}</Text>
          <Text variant="display3" color={color} style={{ lineHeight: 30 }}>
            {value}
          </Text>
          {!!subLabel && (
            <Text variant="caption" color="secondary">{subLabel}</Text>
          )}
        </Stack>
      </Surface>
    </Animated.View>
  );
}

// ─── Activity item (booking row) ──────────────────────────────────────────────

const STATUS_BADGE = {
  confirmed: { label: 'Confirmed', color: 'accent' },
  in_progress: { label: 'Active', color: 'success' },
  completed: { label: 'Done', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'danger' },
};

function ActivityItem({ booking, onPress }) {
  const statusInfo = STATUS_BADGE[booking.status] || { label: booking.status, color: 'accent' };
  const serviceName = booking.service_post?.title || booking.service?.name || 'Booking';
  const clientName = booking.client?.first_name
    ? `${booking.client.first_name} ${booking.client.last_name || ''}`.trim()
    : 'Client';

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <Surface padding="base" rounded="card" style={{ gap: spacing.xs }}>
        <Inline justify="space-between">
          <Stack spacing={2} style={{ flex: 1, marginRight: spacing.sm }}>
            <Text variant="smallMedium" color="primary" numberOfLines={1}>
              {serviceName}
            </Text>
            <Text variant="caption" color="secondary">
              {clientName}
            </Text>
          </Stack>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor:
                  statusInfo.color === 'accent'
                    ? colors.accentMuted
                    : statusInfo.color === 'success'
                    ? 'rgba(46,189,133,0.15)'
                    : 'rgba(255,92,92,0.15)',
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color:
                  statusInfo.color === 'accent'
                    ? colors.accent
                    : statusInfo.color === 'success'
                    ? colors.success
                    : colors.danger,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {statusInfo.label}
            </Text>
          </View>
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setError(false);
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
      setError(true);
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

  const recentActivity = [...bookings]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 10);

  // derived KPI values
  const todayBookings = bookings.filter((b) => {
    if (!b.scheduled_at && !b.created_at) return false;
    const d = new Date(b.scheduled_at || b.created_at);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });

  const weekEarnings = bookings
    .filter((b) => {
      if (!b.created_at) return false;
      const d = new Date(b.created_at);
      const now = new Date();
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      return diff <= 7 && (b.status === 'completed' || b.status === 'confirmed');
    })
    .reduce((sum, b) => sum + (Number(b.total_price) || 0), 0);

  const avgRating =
    business?.avg_rating != null
      ? Number(business.avg_rating).toFixed(1)
      : null;

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* header */}
        <View style={styles.header}>
          <SkeletonBox width={90} height={26} borderRadius={6} />
          <SkeletonBox width={34} height={34} borderRadius={radius.avatar} />
        </View>
        {/* greeting */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base, gap: spacing.xs }}>
          <SkeletonBox width={110} height={14} borderRadius={4} />
          <SkeletonBox width={160} height={26} borderRadius={6} />
        </View>
        {/* KPI skeleton */}
        <View style={{ marginTop: spacing.base }}>
          <KpiSkeleton />
        </View>
        {/* section label skeleton */}
        <View style={styles.sectionRow}>
          <SkeletonBox width={120} height={13} borderRadius={4} />
        </View>
        {/* feed skeleton */}
        <FeedSkeleton count={4} />
      </View>
    );
  }

  // ─── Error with retry ────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="display2" style={styles.logoText}>
            Swing<Text variant="display2" color="accent">By</Text>
          </Text>
        </View>
        <View style={styles.centeredState}>
          <Surface padding="lg" rounded="card" style={{ alignItems: 'center', gap: spacing.base }}>
            <Text variant="h1" style={{ textAlign: 'center' }}>Failed to load dashboard</Text>
            <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
              Check your connection and try again.
            </Text>
            <Button
              variant="primary"
              label="Retry"
              onPress={() => { setLoading(true); load(); }}
              style={{ alignSelf: 'stretch' }}
            />
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── App header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text variant="display2" style={styles.logoText}>
          Swing<Text variant="display2" color="accent">By</Text>
        </Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 17 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <View style={styles.greetBlock}>
          <Text variant="small" color="secondary">{getGreeting()}</Text>
          <Text variant="display2" color="primary">
            {user?.first_name || 'There'}
            <Text variant="display2" color="accent"> .</Text>
          </Text>
        </View>

        {/* ── KPI cards row ─────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KpiCard
            index={0}
            label="Today"
            value={todayBookings.length}
            subLabel="bookings"
          />
          <KpiCard
            index={1}
            label="This week"
            value={weekEarnings > 0 ? `£${weekEarnings.toFixed(0)}` : '—'}
            subLabel="earnings"
            color={weekEarnings > 0 ? 'success' : 'primary'}
          />
          <KpiCard
            index={2}
            label="Avg rating"
            value={avgRating ?? '—'}
            subLabel={business?.review_count ? `${business.review_count} reviews` : 'no reviews'}
            color="warning"
          />
        </View>

        {/* ── Active bookings ───────────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
          <Text variant="label" color="secondary">Active Bookings</Text>
          {activeBookings.length > 0 && (
            <Badge count={activeBookings.length} color="accent" />
          )}
        </View>

        {activeBookings.length === 0 ? (
          <Surface
            padding="lg"
            rounded="card"
            style={styles.emptyCard}
          >
            <Stack spacing="xs" style={{ alignItems: 'center' }}>
              <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
                No active bookings
              </Text>
              <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                Confirmed and in-progress jobs appear here.
              </Text>
            </Stack>
          </Surface>
        ) : (
          <FlatList
            horizontal
            data={activeBookings}
            keyExtractor={(b) => String(b.id)}
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

        {/* ── Recent activity feed ──────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
          <Text variant="label" color="secondary">Recent Activity</Text>
          {recentActivity.length > 0 && (
            <Text variant="caption" color="accent">{recentActivity.length} bookings</Text>
          )}
        </View>

        {recentActivity.length === 0 ? (
          <Surface
            padding="lg"
            rounded="card"
            style={styles.emptyCard}
          >
            <Stack spacing="xs" style={{ alignItems: 'center' }}>
              <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
                No activity yet
              </Text>
              <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                Your booking history will show here.
              </Text>
            </Stack>
          </Surface>
        ) : (
          <Stack spacing="sm" style={styles.feedList}>
            {recentActivity.map((booking) => (
              <ActivityItem
                key={booking.id}
                booking={booking}
                onPress={() => navigation.navigate('JobManagement', { bookingId: booking.id })}
              />
            ))}
          </Stack>
        )}

        {/* ── New Opportunities ─────────────────────────────────────────── */}
        <View style={[styles.sectionRow, { marginTop: spacing.base }]}>
          <Text variant="label" color="secondary">New Opportunities</Text>
          {posts.length > 0 && (
            <Text variant="caption" color="accent">{posts.length} open</Text>
          )}
        </View>

        <View style={styles.postsList}>
          {posts.length === 0 ? (
            <Surface padding="lg" rounded="card" style={styles.emptyCard}>
              <Stack spacing="xs" style={{ alignItems: 'center' }}>
                <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
                  No open jobs right now
                </Text>
                <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                  Check back soon for new opportunities.
                </Text>
              </Stack>
            </Surface>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logoText: {
    letterSpacing: -1,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.avatar,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  kpiCard: {
    flex: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  bookingsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  feedList: {
    paddingHorizontal: spacing.lg,
  },
  postsList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
