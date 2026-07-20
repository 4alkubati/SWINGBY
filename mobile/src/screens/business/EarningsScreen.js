// T52 — EarningsScreen
// Business owner: monthly earnings hero, chart, stats grid, CSV export
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// victory-native@41 requires @shopify/react-native-skia + react-native-reanimated@4
// which conflict with Expo SDK 54 (RN 0.81). Chart is stubbed with a placeholder
// until we upgrade Expo OR pin victory-native to ~40.x (older API). All other
// EarningsScreen UI (hero, stats grid, range chips) is unaffected.
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import { SkeletonBox } from '../../components/Skeleton';
import { colors } from '../../theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Time ranges ──────────────────────────────────────────────────────────────
const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '3months', label: 'Last 3 months' },
  { key: 'ytd', label: 'YTD' },
];

function rangeDays(range) {
  const now = new Date();
  switch (range) {
    case 'week':    return 7;
    case '3months': return 90;
    case 'ytd':     return Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
    default:        return 30;
  }
}

// Real numbers from the payments table — released money, held escrow, platform cut.
function aggregateStats(payments) {
  if (!payments.length) return { total: 0, count: 0, avg: 0, pending: 0, fees: 0 };
  const total = payments.reduce((s, p) => s + (parseFloat(p.released_to_business) || 0), 0);
  const count = payments.length;
  const avg = count ? total / count : 0;
  const pending = payments.reduce(
    (s, p) =>
      s + (['held', 'partial', 'partial_released'].includes(p.status)
        ? (parseFloat(p.escrow_held) || 0)
        : 0),
    0
  );
  const fees = payments.reduce((s, p) => s + (parseFloat(p.platform_cut) || 0), 0);
  return { total, count, avg, pending, fees };
}

function formatMoney(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatAxisDate(range, date) {
  const d = new Date(date);
  if (range === 'week') {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (range === 'month') {
    return d.getDate().toString();
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Chart component (stub — see top-of-file comment) ─────────────────────────
function EarningsChart({ data, range }) {
  const chartWidth = SCREEN_WIDTH - 44;

  if (!data.length) {
    return (
      <View style={[styles.chartEmpty, { width: chartWidth }]}>
        <Text style={styles.chartEmptyText}>No data yet</Text>
      </View>
    );
  }

  // Lightweight bar visualization without victory-native. Renders inline
  // proportional bars across the data points so the screen feels alive.
  let display = data;
  if (data.length > 14) {
    const step = Math.ceil(data.length / 14);
    display = data.filter((_, i) => i % step === 0);
  }
  const max = Math.max(...display.map((d) => d.y), 1);

  return (
    <View style={[styles.chartWrap, { width: chartWidth, height: 200 }]}>
      <View style={styles.barsRow}>
        {display.map((d, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: Math.max(6, (d.y / max) * 140) },
            ]}
          />
        ))}
      </View>
      <Text style={styles.chartEmptyText}>
        Detailed chart coming soon
      </Text>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

// ─── Hero skeleton ────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <View style={styles.heroSkeleton}>
      <SkeletonBox width={180} height={52} borderRadius={14} style={{ marginBottom: 8 }} />
      <SkeletonBox width={120} height={16} borderRadius={8} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EarningsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState('month');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.get('/payments/mine');
      setPayments(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      // Don't silently render a confident $0.00 — a failed fetch is an
      // error state, not "no earnings" (this is what hid the P0 backend
      // crash: 500s were swallowed into an empty list here).
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cutoff = Date.now() - rangeDays(range) * 86400000;
  const inRange = payments.filter((p) => {
    const t = new Date(
      p.created_at || p.bookings?.completed_at || p.bookings?.scheduled_date
    ).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });

  const chartData = inRange
    .map((p) => ({
      x: new Date(p.created_at || p.bookings?.completed_at || p.bookings?.scheduled_date),
      y: parseFloat(p.released_to_business ?? p.total_charged ?? 0),
    }))
    .filter((pt) => !Number.isNaN(pt.x?.getTime()))
    .sort((a, b) => a.x - b.x);

  const stats = aggregateStats(inRange);

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Back"
            accessibilityRole="button"
            style={{ width: 40 }}
          >
            <Feather name="arrow-left" size={20} color={colors.textSecondary} strokeWidth={1.8} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorState}>
          <Feather name="alert-circle" size={28} color={colors.danger} />
          <Text style={styles.errorTitle}>Failed to load earnings</Text>
          <Text style={styles.errorBody}>Check your connection and try again.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={load}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
          accessibilityLabel="Back"
          accessibilityRole="button"
          style={{ width: 40 }}
        >
          <Feather name="arrow-left" size={20} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => Alert.alert('Coming soon', 'CSV export will be available soon.')}
          activeOpacity={0.8}
        >
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero metric */}
        {loading ? (
          <HeroSkeleton />
        ) : (
          <View style={styles.hero}>
            <Text style={styles.heroAmount}>{formatMoney(stats.total)}</Text>
            <Text style={styles.heroSub}>
              {stats.count} {stats.count === 1 ? 'job' : 'jobs'} · {RANGES.find((r) => r.key === range)?.label.toLowerCase()}
            </Text>
          </View>
        )}

        {/* Range chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.chip, range === r.key && styles.chipActive]}
              onPress={() => setRange(r.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Chart */}
        <View style={styles.chartCard}>
          {loading ? (
            <View style={styles.chartLoadingWrap}>
              <SkeletonBox width={SCREEN_WIDTH - 88} height={160} borderRadius={10} />
            </View>
          ) : (
            <EarningsChart data={chartData} range={range} />
          )}
        </View>

        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="Avg Job Value"
              value={loading ? '—' : formatMoney(stats.avg)}
              accent
            />
            <StatCard
              label="Completed Jobs"
              value={loading ? '—' : String(stats.count)}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label="Pending Payouts"
              value={loading ? '—' : formatMoney(stats.pending)}
            />
            <StatCard
              label="Platform Fees"
              value={loading ? '—' : formatMoney(stats.fees)}
            />
          </View>
        </View>
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
  exportBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  // Hero
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  heroSkeleton: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 8 },
  heroAmount: {
    fontSize: 48,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    color: colors.success,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  heroSub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

  // Chips
  chipRow: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  chip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.textPrimary },

  // Chart
  chartCard: {
    marginHorizontal: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
  },
  chartWrap: {
    backgroundColor: colors.bg,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartLoadingWrap: { padding: 20, alignItems: 'center' },
  chartEmpty: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  chartEmptyText: { fontSize: 12, color: colors.textSecondary, marginTop: 12 },

  // Bar chart stub
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    height: 140,
    gap: 4,
  },
  bar: {
    flex: 1,
    backgroundColor: colors.accent,
    opacity: 0.85,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  // Stats grid
  statsGrid: { paddingHorizontal: 22, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },

  // Error state
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
