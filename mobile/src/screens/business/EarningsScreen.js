// T52 — EarningsScreen
// Business owner: monthly earnings hero, chart, stats grid, CSV export
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
// victory-native@41 requires @shopify/react-native-skia + react-native-reanimated@4
// which conflict with Expo SDK 54 (RN 0.81). Chart is stubbed with a placeholder
// until we upgrade Expo OR pin victory-native to ~40.x (older API). All other
// EarningsScreen UI (hero, stats grid, range chips) is unaffected.
import { api } from '../../services/api';
import { SkeletonBox } from '../../components/Skeleton';
import ScreenHeader from '../../components/ScreenHeader';
import { colors } from '../../theme/tokens';
import i18n from '../../i18n';

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

// Statuses that mean "money is held and not yet released" — mirrors
// escrow.HELD_NOT_RELEASED on the backend. 'pending_payment' is deliberately
// NOT here: it is an accept-time row for money nobody has been charged yet.
const HELD_NOT_RELEASED = ['held', 'paid_full', 'partial', 'partial_released'];

// SB-0099 — real numbers from the payments table, PHANTOM ROWS EXCLUDED.
//
// This used to sum every row it was handed. GET /payments/mine deliberately
// keeps unverified rows out of its own totals — 24 production rows read
// 'fully_released' with no Stripe charge behind them, $4,675.50 of payouts
// nobody ever paid — and re-summing the raw items put every one of them back
// into the business's headline earnings.
//
// The totals the endpoint returns cover the whole account, and this screen
// shows a date RANGE, so they cannot simply be displayed. Instead the endpoint
// now marks each row (`was_ever_captured`, `is_capture_backed`) and the filters
// below turn on those flags, so a range subtotal uses the same rule as the
// whole-account total. Rows from an older backend that lack the flags are
// treated as unverified: understating earnings is recoverable, inventing them
// is not.
export function aggregateStats(payments) {
  if (!payments.length) return { total: 0, count: 0, avg: 0, pending: 0, fees: 0 };

  const released = payments.filter((p) => p.was_ever_captured === true);
  const total = released.reduce((s, p) => s + (parseFloat(p.released_to_business) || 0), 0);

  // "Completed Jobs" means completed, not "has a payments row". A row is
  // created the moment a quote is accepted (interests.py), so counting rows
  // counted every job still in progress as finished. Escrow reaching
  // 'fully_released' is what completion/approval actually does to the ledger.
  const count = released.filter((p) => p.status === 'fully_released').length;
  const avg = count ? total / count : 0;

  const pending = payments.reduce(
    (s, p) =>
      s + (HELD_NOT_RELEASED.includes(p.status) && p.is_capture_backed === true
        ? (parseFloat(p.escrow_held) || 0)
        : 0),
    0
  );
  const fees = released.reduce((s, p) => s + (parseFloat(p.platform_cut) || 0), 0);
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
      {/* P5 — this said "Detailed chart coming soon" while sitting directly
          under a chart that works. An apology for a feature that shipped. It
          says what the bars ARE now, which is the thing that was actually
          missing: a legend and a date range. */}
      <View style={styles.chartFooter}>
        <Text style={styles.chartCaption}>Released to you, per payment</Text>
        {display.length > 1 ? (
          <Text style={styles.chartCaption}>
            {formatAxisDate(range, display[0].x)} –{' '}
            {formatAxisDate(range, display[display.length - 1].x)}
          </Text>
        ) : null}
      </View>
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
  const [range, setRange] = useState('month');
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/payments/mine');
      setPayments(Array.isArray(data) ? data : (data?.items ?? []));
    } catch {
      setPayments([]);
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

  return (
    <View style={styles.container}>
      {/* D5 — this trailing slot held an "Export CSV" button whose entire
          behaviour was an alert saying the feature did not exist. This screen
          answers "what have I earned"; the obvious next question is "how do I
          get it", and until now nothing on it led anywhere. The slot now
          opens the Wallet, which is a real destination. CSV export was never
          built and is not lost by removing a button that only apologised for
          it. */}
      <ScreenHeader
        title="Earnings"
        onBack={() => navigation.goBack()}
        trailingIcon="credit-card"
        onTrailingPress={() => navigation.navigate('Wallet')}
        trailingAccessibilityLabel={i18n.t('wallet.title')}
      />

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
  chartFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  chartCaption: { fontSize: 11, color: colors.textSecondary },

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
});
