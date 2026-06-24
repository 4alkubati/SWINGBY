// T53 — BusinessAnalyticsScreen
// Business owner: avg rating hero, metric cards, category bar chart, recent reviews
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// victory-native@41 requires Skia + reanimated@4 which conflict with Expo SDK 54.
// CategoryChart is stubbed with native View bars until we upgrade Expo OR pin
// victory-native to ~40.x. All other UI on this screen is unaffected.
import { api } from '../services/api';
import { SkeletonBox } from '../components/Skeleton';
import { RatingStarsDisplay } from '../components/RatingStars';
import { colors } from '../theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Placeholder data removed — all data now sourced from /businesses/me/analytics

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeDate(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Category bar chart (stub — see top-of-file comment) ──────────────────────
function CategoryChart({ data }) {
  const chartWidth = SCREEN_WIDTH - 44;

  if (!data || !data.length) {
    return (
      <View style={[styles.chartEmpty, { width: chartWidth }]}>
        <Text style={styles.chartEmptyText}>No data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <View style={styles.barChartWrap}>
      {data.map((d, i) => (
        <View key={i} style={styles.catRow}>
          <Text style={styles.catLabel} numberOfLines={1}>
            {d.category}
          </Text>
          <View style={styles.catTrack}>
            <View
              style={[
                styles.catFill,
                { width: `${Math.max(6, (d.count / max) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.catCount}>{d.count}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(value, 100)}%` }]} />
    </View>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, showProgress }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sub && <Text style={styles.metricSub}>{sub}</Text>}
      {showProgress && typeof showProgress === 'number' && (
        <ProgressBar value={showProgress} />
      )}
    </View>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>
            {(review.client_first_name || 'A')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewName}>{review.client_first_name || 'Client'}</Text>
          <Text style={styles.reviewDate}>{relativeDate(review.created_at)}</Text>
        </View>
        <RatingStarsDisplay rating={review.rating} size={12} />
      </View>
      {review.comment ? (
        <Text style={styles.reviewComment} numberOfLines={2}>
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Hero skeleton ────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <View style={styles.heroSkeleton}>
      <SkeletonBox width={120} height={58} borderRadius={14} style={{ marginBottom: 10 }} />
      <SkeletonBox width={140} height={16} borderRadius={8} />
    </View>
  );
}

// ─── Empty full-screen ────────────────────────────────────────────────────────
function EmptyAnalytics() {
  return (
    <View style={styles.emptyFull}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>Analytics coming soon</Text>
      <Text style={styles.emptySub}>
        Once you complete jobs, analytics will appear here.
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BusinessAnalyticsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const bizId = route?.params?.businessId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [hasData, setHasData] = useState(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.get('/businesses/me/analytics');
      setMetrics({
        avg_rating: data.avg_rating ?? 0,
        review_count: data.review_count ?? 0,
        total_bookings: data.total_bookings ?? 0,
        total_earnings: data.total_earnings ?? 0,
        profile_views: data.profile_views ?? 0,
        conversion_rate: data.conversion_rate ?? 0,
        repeat_rate: data.repeat_rate ?? 0,
      });
      setCategories(Array.isArray(data.top_categories) ? data.top_categories : []);
      setReviews(Array.isArray(data.recent_reviews) ? data.recent_reviews.slice(0, 5) : []);
      setHasData(
        (data.review_count ?? 0) > 0 ||
        (data.total_bookings ?? 0) > 0 ||
        Array.isArray(data.recent_reviews) && data.recent_reviews.length > 0
      );
    } catch (err) {
      setError(err.message || 'Could not load analytics.');
      setHasData(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  useEffect(() => { load(); }, [load]);

  if (!loading && error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyFull}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Failed to load</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => load()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!loading && !hasData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyAnalytics />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Hero — avg rating */}
        {loading ? (
          <HeroSkeleton />
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroRating}>
              {metrics?.avg_rating?.toFixed(1) ?? '—'}
            </Text>
            <RatingStarsDisplay
              rating={metrics?.avg_rating ?? 0}
              size={22}
            />
            <Text style={styles.heroSub}>Average customer rating</Text>
          </View>
        )}

        {/* Metric cards — horizontal scroll */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricRow}
        >
          <MetricCard
            label="Profile Views"
            value={loading ? '—' : (metrics?.profile_views ? String(metrics.profile_views) : '—')}
            sub="This month"
          />
          <MetricCard
            label="Quote-to-Booking"
            value={loading ? '—' : `${metrics?.conversion_rate ?? 0}%`}
            sub="Conversion rate"
            showProgress={loading ? false : metrics?.conversion_rate ?? 0}
          />
          <MetricCard
            label="Repeat Customers"
            value={loading ? '—' : (metrics?.repeat_rate ? `${metrics.repeat_rate}%` : '—')}
            sub="Come back rate"
            showProgress={loading ? false : metrics?.repeat_rate ?? 0}
          />
        </ScrollView>

        {/* Most requested categories */}
        <Text style={styles.sectionTitle}>Most Requested</Text>
        <View style={styles.chartCard}>
          {loading ? (
            <View style={styles.chartLoadingWrap}>
              <SkeletonBox width={SCREEN_WIDTH - 88} height={160} borderRadius={10} />
            </View>
          ) : (
            <CategoryChart data={categories} />
          )}
        </View>

        {/* Recent reviews */}
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        {loading ? (
          <View style={styles.reviewsLoading}>
            {[0, 1, 2].map((i) => (
              <SkeletonBox
                key={i}
                width={SCREEN_WIDTH - 44}
                height={88}
                borderRadius={16}
                style={{ marginBottom: 10 }}
              />
            ))}
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.reviewEmpty}>
            <Text style={styles.reviewEmptyText}>No reviews yet</Text>
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { fontSize: 24, color: colors.textSecondary, width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  heroSkeleton: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 8 },
  heroRating: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1.5,
  },
  heroSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 22,
    marginBottom: 10,
    marginTop: 20,
  },

  // Metric cards
  metricRow: {
    paddingHorizontal: 22,
    gap: 10,
    paddingBottom: 4,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    width: 152,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricSub: { fontSize: 11, color: colors.textSecondary },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },

  // Chart
  chartCard: {
    marginHorizontal: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barChartWrap: {
    backgroundColor: colors.bg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 10,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  catTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  catFill: {
    height: 10,
    backgroundColor: colors.accent,
    borderRadius: 5,
  },
  catCount: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartLoadingWrap: { padding: 20, alignItems: 'center' },
  chartEmpty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: { fontSize: 14, color: colors.textSecondary },

  // Reviews
  reviewsLoading: { paddingHorizontal: 22 },
  reviewList: { paddingHorizontal: 22, gap: 10 },
  reviewEmpty: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
  },
  reviewEmptyText: { fontSize: 14, color: colors.textSecondary },
  reviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: colors.accent },
  reviewMeta: { flex: 1 },
  reviewName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  reviewDate: { fontSize: 11, color: colors.textSecondary },
  reviewComment: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 19,
  },

  // Empty full
  emptyFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 32,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
