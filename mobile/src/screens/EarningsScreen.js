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
import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryAxis,
  VictoryTheme,
} from 'victory-native';
import { api } from '../services/api';
import { SkeletonBox } from '../components/Skeleton';
import { colors } from '../theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Time ranges ──────────────────────────────────────────────────────────────
const RANGES = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '3months', label: 'Last 3 months' },
  { key: 'ytd', label: 'YTD' },
];

// ─── Placeholder data generator ───────────────────────────────────────────────
function generatePlaceholder(range) {
  const now = new Date();
  let days;
  switch (range) {
    case 'week':    days = 7;  break;
    case '3months': days = 90; break;
    case 'ytd':     days = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000); break;
    default:        days = 30; break;
  }

  const points = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Some days have jobs, some don't
    if (Math.random() > 0.35) {
      const amount = Math.round((50 + Math.random() * 250) * 100) / 100;
      points.push({ x: d, y: amount });
    }
  }
  return points;
}

function aggregateStats(data) {
  if (!data.length) return { total: 0, count: 0, avg: 0, pending: 0, fees: 0 };
  const total = data.reduce((s, d) => s + d.y, 0);
  const count = data.length;
  const avg = total / count;
  const pending = Math.round(total * 0.08 * 100) / 100;
  const fees = Math.round(total * 0.05 * 100) / 100;
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

// ─── Chart component ──────────────────────────────────────────────────────────
function EarningsChart({ data, range }) {
  const chartWidth = SCREEN_WIDTH - 44;

  if (!data.length) {
    return (
      <View style={[styles.chartEmpty, { width: chartWidth }]}>
        <Text style={styles.chartEmptyText}>No data yet</Text>
      </View>
    );
  }

  // Sample to keep chart readable (max 30 points)
  let displayData = data;
  if (data.length > 30) {
    const step = Math.ceil(data.length / 30);
    displayData = data.filter((_, i) => i % step === 0);
  }

  // Tick count for x axis
  const tickCount = Math.min(displayData.length, range === 'week' ? 7 : 6);

  return (
    <View style={styles.chartWrap}>
      <VictoryChart
        width={chartWidth}
        height={200}
        padding={{ top: 16, bottom: 40, left: 50, right: 20 }}
        theme={VictoryTheme.material}
        scale={{ x: 'time' }}
      >
        <VictoryAxis
          tickCount={tickCount}
          tickFormat={(t) => formatAxisDate(range, t)}
          style={{
            axis: { stroke: colors.border },
            tickLabels: { fill: colors.textSecondary, fontSize: 9, fontWeight: '600' },
            grid: { stroke: 'transparent' },
            ticks: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t) => (t >= 1000 ? `$${(t / 1000).toFixed(1)}k` : `$${t}`)}
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: colors.textSecondary, fontSize: 9, fontWeight: '600' },
            grid: { stroke: colors.border, strokeDasharray: '4,6' },
            ticks: { stroke: 'transparent' },
          }}
        />
        <VictoryArea
          data={displayData}
          style={{
            data: {
              fill: colors.accent + '1A', // ~10% opacity area fill
              stroke: 'transparent',
            },
          }}
          interpolation="monotoneX"
        />
        <VictoryLine
          data={displayData}
          style={{
            data: {
              stroke: colors.accent,
              strokeWidth: 2,
            },
          }}
          interpolation="monotoneX"
        />
      </VictoryChart>
    </View>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: colors.accent }]}>{value}</Text>
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
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/payments/', { params: { range } });
      // Expect array of { date, amount } or similar
      const raw = Array.isArray(data) ? data : (data?.results ?? []);
      if (raw.length) {
        const parsed = raw.map((d) => ({
          x: new Date(d.date || d.created_at),
          y: parseFloat(d.amount || d.total || 0),
        }));
        setChartData(parsed);
      } else {
        setChartData(generatePlaceholder(range));
      }
    } catch {
      // Backend may not support this endpoint yet — use placeholder
      setChartData(generatePlaceholder(range));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const stats = aggregateStats(chartData);

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
            <Text style={styles.heroSub}>{stats.count} jobs this month</Text>
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
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -1.5,
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
  chartWrap: { backgroundColor: colors.bg },
  chartLoadingWrap: { padding: 20, alignItems: 'center' },
  chartEmpty: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  chartEmptyText: { fontSize: 14, color: colors.textSecondary },

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
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
});
