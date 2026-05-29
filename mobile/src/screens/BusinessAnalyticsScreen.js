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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  VictoryChart,
  VictoryBar,
  VictoryAxis,
  VictoryTheme,
} from 'victory-native';
import { api } from '../services/api';
import { SkeletonBox } from '../components/Skeleton';
import { RatingStarsDisplay } from '../components/RatingStars';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#07080a',
  card: '#0d0f10',
  card2: '#0f1214',
  subtle: '#131618',
  borderSoft: '#1a1d1f',
  borderMid: '#2a2e33',
  orange: '#FF5C00',
  orangeLight: '#FF8C42',
  orangeBg: 'rgba(255,92,0,0.10)',
  orangeBorder: 'rgba(255,92,0,0.25)',
  textPrimary: '#ffffff',
  textBody: '#f0ede8',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  gridLine: '#1a1d1f',
  green: '#4ade80',
  greenBg: 'rgba(34,197,94,0.08)',
  greenBorder: 'rgba(34,197,94,0.25)',
};

// ─── Placeholder data ─────────────────────────────────────────────────────────
const PLACEHOLDER_CATEGORIES = [
  { category: 'Cleaning', count: 42 },
  { category: 'Lawn', count: 28 },
  { category: 'Plumbing', count: 19 },
  { category: 'Moving', count: 14 },
  { category: 'Painting', count: 9 },
];

const PLACEHOLDER_REVIEWS = [
  {
    id: 1,
    rating: 5,
    comment: 'Absolutely excellent work. The team was punctual, professional, and left the place spotless.',
    client_first_name: 'Sarah',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 2,
    rating: 4,
    comment: 'Great service overall. Would definitely book again.',
    client_first_name: 'James',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 3,
    rating: 5,
    comment: 'Very thorough and friendly. Highly recommend!',
    client_first_name: 'Aisha',
    created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: 4,
    rating: 4,
    comment: 'Good job. A couple small spots were missed but overall happy.',
    client_first_name: 'Michael',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: 5,
    rating: 5,
    comment: 'Fast, efficient, and very communicative throughout.',
    client_first_name: 'Nina',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const PLACEHOLDER_METRICS = {
  avg_rating: 4.7,
  profile_views: 312,
  conversion_rate: 34,
  repeat_rate: 58,
};

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

// ─── Category bar chart ───────────────────────────────────────────────────────
function CategoryChart({ data }) {
  const chartWidth = SCREEN_WIDTH - 44;

  if (!data || !data.length) {
    return (
      <View style={[styles.chartEmpty, { width: chartWidth }]}>
        <Text style={styles.chartEmptyText}>No data yet</Text>
      </View>
    );
  }

  const chartData = data.map((d, i) => ({
    x: d.category.length > 9 ? d.category.slice(0, 8) + '.' : d.category,
    y: d.count,
    label: String(d.count),
  }));

  return (
    <View style={styles.barChartWrap}>
      <VictoryChart
        width={chartWidth}
        height={200}
        padding={{ top: 20, bottom: 50, left: 20, right: 20 }}
        domainPadding={{ x: 28 }}
        theme={VictoryTheme.material}
      >
        <VictoryAxis
          style={{
            axis: { stroke: C.borderSoft },
            tickLabels: { fill: C.textMuted, fontSize: 9, fontWeight: '600' },
            grid: { stroke: 'transparent' },
            ticks: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: C.textMuted, fontSize: 9 },
            grid: { stroke: C.gridLine, strokeDasharray: '4,6' },
            ticks: { stroke: 'transparent' },
          }}
        />
        <VictoryBar
          data={chartData}
          style={{
            data: {
              fill: C.orange,
              borderRadius: 4,
            },
            labels: {
              fill: C.textPrimary,
              fontSize: 9,
              fontWeight: '700',
            },
          }}
          cornerRadius={{ top: 4 }}
          barRatio={0.6}
        />
      </VictoryChart>
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
  const [metrics, setMetrics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [hasData, setHasData] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch reviews
      let reviewData = [];
      try {
        const rRes = await api.get(`/reviews/business/${bizId || 'me'}`);
        reviewData = Array.isArray(rRes) ? rRes : (rRes?.results ?? []);
      } catch {
        reviewData = PLACEHOLDER_REVIEWS;
      }

      // Compute avg rating from reviews or fall back to placeholder
      let avgRating = PLACEHOLDER_METRICS.avg_rating;
      if (reviewData.length) {
        avgRating = reviewData.reduce((s, r) => s + (r.rating || 0), 0) / reviewData.length;
        avgRating = Math.round(avgRating * 10) / 10;
      }

      // Fetch category breakdown (placeholder if missing)
      let catData = PLACEHOLDER_CATEGORIES;
      try {
        const cRes = await api.get('/analytics/categories');
        if (Array.isArray(cRes) && cRes.length) catData = cRes;
      } catch {
        catData = PLACEHOLDER_CATEGORIES;
      }

      setMetrics({ ...PLACEHOLDER_METRICS, avg_rating: avgRating });
      setCategories(catData);
      setReviews(reviewData.slice(0, 5));
      setHasData(true);
    } catch {
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

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
            value={loading ? '—' : String(metrics?.profile_views ?? 0)}
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
            value={loading ? '—' : `${metrics?.repeat_rate ?? 0}%`}
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
  container: { flex: 1, backgroundColor: C.bg },
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
  backBtn: { fontSize: 24, color: '#9ca3af', width: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.5 },

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
    color: C.textPrimary,
    letterSpacing: -1.5,
  },
  heroSub: { fontSize: 13, color: C.textMuted, marginTop: 4 },

  // Section title
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
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
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 18,
    padding: 16,
    width: 152,
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  metricSub: { fontSize: 11, color: C.textMuted },
  progressTrack: {
    height: 4,
    backgroundColor: C.borderMid,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: C.orange,
    borderRadius: 2,
  },

  // Chart
  chartCard: {
    marginHorizontal: 22,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.borderSoft,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barChartWrap: { backgroundColor: C.bg },
  chartLoadingWrap: { padding: 20, alignItems: 'center' },
  chartEmpty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: { fontSize: 14, color: C.textMuted },

  // Reviews
  reviewsLoading: { paddingHorizontal: 22 },
  reviewList: { paddingHorizontal: 22, gap: 10 },
  reviewEmpty: {
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
  },
  reviewEmptyText: { fontSize: 14, color: C.textMuted },
  reviewCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.borderSoft,
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
    backgroundColor: '#1a2a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  reviewMeta: { flex: 1 },
  reviewName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
  reviewDate: { fontSize: 11, color: C.textMuted },
  reviewComment: {
    fontSize: 13,
    color: C.textBody,
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
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },
  emptySub: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
