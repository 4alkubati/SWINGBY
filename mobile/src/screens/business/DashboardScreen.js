import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import JobOpportunityCard from '../../components/JobOpportunityCard';
import SendQuoteSheet from '../../components/SendQuoteSheet';
import SectionHeader from '../../components/SectionHeader';
import EarningsHero from '../../components/EarningsHero';
import HeaderGlow from '../../components/HeaderGlow';

import { colors, spacing, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import { SkeletonBox } from '../../components/Skeleton';
import { groupBusinessJobs, bookingDate } from '../../utils/jobGroups';
import i18n from '../../i18n';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function toInitials(name) {
  return (name || '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// CARD-24 — "next job" chip: just the time if it's today, date+time otherwise.
function nextJobWhenLabel(booking) {
  const d = bookingDate(booking);
  if (!d) return '';
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return `${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · ${time}`;
}

function nextJobClientName(booking) {
  const u = booking?.users || {};
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Client';
}

function KpiCard({ label, value, sub, index = 0 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

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
      style={[styles.kpiCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <Text style={styles.kpiLabel} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
      <Text style={styles.kpiValue} maxFontSizeMultiplier={1.2}>
        {value}
      </Text>
      {!!sub && (
        <Text style={styles.kpiSub} maxFontSizeMultiplier={1.3}>
          {sub}
        </Text>
      )}
    </Animated.View>
  );
}

// Stale-while-refetch cache: the dashboard paints instantly from the last
// payload on reopen while a fresh load runs in the background.
let _dashboardCache = null;

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [bookings, setBookings] = useState(_dashboardCache?.bookings || []);
  const [posts, setPosts] = useState(_dashboardCache?.posts || []);
  const [business, setBusiness] = useState(_dashboardCache?.business || null);
  const [unreadTotal, setUnreadTotal] = useState(_dashboardCache?.unreadTotal || 0);
  // CARD-24 — quotes (for needs-action parity with the Jobs tab) + payments
  // (for the "money in flight" held/cleared split). Real endpoints, not derived
  // client-side from bookings — GET /payments/mine is the same call EarningsScreen
  // already uses for its released/pending totals.
  const [quotes, setQuotes] = useState(_dashboardCache?.quotes || []);
  const [payments, setPayments] = useState(_dashboardCache?.payments || null);
  const [loading, setLoading] = useState(!_dashboardCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const load = useCallback(async () => {
    setError(false);
    try {
      const [b, p, biz, threads, i, pay] = await Promise.all([
        api.get('/bookings/'),
        api.get('/service-posts/'),
        api.get('/businesses/me').catch(() => null),
        api.get('/messages/threads', { _silent: true }).catch(() => null),
        api.get('/interests/mine').catch(() => null),
        api.get('/payments/mine').catch(() => null),
      ]);
      const nextBookings = b?.items || b || [];
      const nextPosts = (p?.items || p || []).filter((post) => post.status === 'open');
      const nextUnread = (threads?.items || []).reduce(
        (sum, t) => sum + (t.unread_count || 0),
        0
      );
      const nextQuotes = i?.items || i || [];
      setBookings(nextBookings);
      setPosts(nextPosts);
      setBusiness(biz || null);
      setUnreadTotal(nextUnread);
      setQuotes(nextQuotes);
      setPayments(pay || null);
      _dashboardCache = {
        bookings: nextBookings,
        posts: nextPosts,
        business: biz || null,
        unreadTotal: nextUnread,
        quotes: nextQuotes,
        payments: pay || null,
      };
    } catch {
      // With cached data on screen, a background failure shouldn't nuke the UI
      if (!_dashboardCache) setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when the tab regains focus — counts stay honest
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function openQuoteSheet(post) {
    setSelectedPost(post);
    setSheetVisible(true);
  }

  function passPost(post) {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(post.id);
      return next;
    });
  }

  const visiblePosts = posts.filter((p) => !dismissedIds.has(p.id));

  // CARD-24 — same grouping logic the Jobs tab uses (src/utils/jobGroups.js),
  // so "today" here always matches the Jobs tab's Today count, and the
  // "awaiting action" chip means the same thing in both places.
  const groups = groupBusinessJobs({ bookings, posts, quotes });
  const todayBookings = groups.today;
  const nextJob = groups.nextJob;
  // Quotes-awaiting-response + jobs-awaiting-date/staff — deliberately excludes
  // "leads" so this doesn't double-count against the leads chip below.
  const awaitingAction = groups.needsAction.quotes.length + groups.needsAction.awaitingSchedule.length;

  // Money in flight — GET /payments/mine (same endpoint EarningsScreen uses).
  // null (not 0) when the call fails or hasn't returned, so the UI can tell
  // "no money moving" apart from "don't know yet" and never show a fake number.
  const moneyHeld = payments?.total_pending ?? null;
  const moneyCleared = payments?.total_released ?? null;

  const attentionChips = [
    visiblePosts.length > 0 && {
      key: 'leads',
      icon: 'zap',
      label: `${visiblePosts.length} new ${visiblePosts.length === 1 ? 'lead' : 'leads'}`,
      onPress: () => navigation.navigate('Jobs'),
    },
    unreadTotal > 0 && {
      key: 'unread',
      icon: 'message-circle',
      label: `${unreadTotal} unread`,
      onPress: () => navigation.navigate('Messages'),
    },
    awaitingAction > 0 && {
      key: 'awaiting',
      icon: 'alert-circle',
      label: `${awaitingAction} awaiting action`,
      onPress: () => navigation.navigate('Jobs'),
    },
  ].filter(Boolean);

  const earningsIn = (minDaysAgo, maxDaysAgo) =>
    bookings
      .filter((b) => {
        if (!b.created_at) return false;
        const diff = (Date.now() - new Date(b.created_at)) / (1000 * 60 * 60 * 24);
        return diff >= minDaysAgo && diff < maxDaysAgo
          && (b.status === 'completed' || b.status === 'confirmed');
      })
      .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

  const weekEarnings = earningsIn(0, 7);
  const prevWeekEarnings = earningsIn(7, 14);
  const deltaPct = prevWeekEarnings > 0
    ? Math.round(((weekEarnings - prevWeekEarnings) / prevWeekEarnings) * 100)
    : null;

  // Daily totals for the sparkline — oldest day first
  const sparkData = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    return earningsIn(daysAgo, daysAgo + 1);
  });
  const hasSparkData = sparkData.some((v) => v > 0);

  const avgRating =
    business?.avg_rating != null ? Number(business.avg_rating).toFixed(1) : null;
  const reviewCount = business?.review_count ?? 0;
  const businessName = business?.business_name || 'Your business';

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={{ gap: 4 }}>
            <SkeletonBox width={90} height={12} borderRadius={4} />
            <SkeletonBox width={170} height={22} borderRadius={6} />
          </View>
          <SkeletonBox width={40} height={40} borderRadius={20} />
        </View>
        <View style={styles.scrollBody}>
          <SkeletonBox width="100%" height={172} borderRadius={22} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <SkeletonBox width="50%" height={72} borderRadius={18} />
            <SkeletonBox width="50%" height={72} borderRadius={18} />
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.businessName}>{businessName}</Text>
        </View>
        <View style={styles.centeredState}>
          <Surface padding="lg" rounded="card" style={{ alignItems: 'center', gap: spacing.base }}>
            <Text variant="h1" style={{ textAlign: 'center' }}>
              Failed to load dashboard
            </Text>
            <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
              Check your connection and try again.
            </Text>
            <Button
              variant="primary"
              label="Retry"
              onPress={() => {
                setLoading(true);
                load();
              }}
              style={{ alignSelf: 'stretch' }}
            />
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Radial purple glow behind the header, right-aligned */}
      <HeaderGlow
        width={520}
        height={280}
        offsetTop={-40}
        align="right"
        opacity={0.28}
      />

      {/* Header row */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} maxFontSizeMultiplier={1.3}>
            {getGreeting()}
          </Text>
          <Text
            style={styles.businessName}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {businessName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate('My Business')}
          accessibilityRole="button"
          accessibilityLabel="Open your business"
        >
          <Text style={styles.avatarText}>{toInitials(businessName)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Needs-attention strip — the money-first glance */}
        {attentionChips.length > 0 && (
          <View style={styles.attentionRow}>
            {attentionChips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={styles.attentionChip}
                activeOpacity={0.8}
                onPress={chip.onPress}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
              >
                <Feather name={chip.icon} size={14} color={colors.accentText} strokeWidth={2} />
                <Text style={styles.attentionLabel} maxFontSizeMultiplier={1.2}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Next job — CARD-24. Tap opens the operational job screen. */}
        <TouchableOpacity
          activeOpacity={nextJob ? 0.8 : 1}
          disabled={!nextJob}
          onPress={() => nextJob && navigation.navigate('JobManagement', { bookingId: nextJob.id })}
          accessibilityRole={nextJob ? 'button' : undefined}
        >
          <Surface elevation="subtle" rounded="card" padding="base" style={styles.nextJobCard}>
            <Text style={styles.kpiLabel} maxFontSizeMultiplier={1.3}>
              {i18n.t('dashboard.nextJobTitle')}
            </Text>
            {nextJob ? (
              <Inline justify="space-between" style={{ marginTop: 6 }}>
                <Inline spacing="sm" style={{ flex: 1 }}>
                  <Avatar name={nextJobClientName(nextJob)} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" numberOfLines={1}>{nextJobClientName(nextJob)}</Text>
                    <Text variant="small" color="secondary" numberOfLines={1}>
                      {nextJob.service_posts?.title || nextJob.service_category || 'Service'}
                    </Text>
                  </View>
                </Inline>
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={{ color: colors.accentText, fontFamily: 'SpaceGrotesk_700Bold' }}
                >
                  {nextJobWhenLabel(nextJob)}
                </Text>
              </Inline>
            ) : (
              <Text variant="small" color="secondary" style={{ marginTop: 6 }}>
                {i18n.t('dashboard.nextJobEmpty')}
              </Text>
            )}
          </Surface>
        </TouchableOpacity>

        {/* Earnings hero */}
        <EarningsHero
          amount={
            weekEarnings > 0
              ? `$${Math.round(weekEarnings).toLocaleString()}`
              : '$0'
          }
          deltaPct={deltaPct}
          data={hasSparkData ? sparkData : undefined}
        />

        {/* KPI row (Today / Rating) */}
        <View style={styles.kpiRow}>
          <KpiCard
            index={0}
            label="TODAY"
            value={String(todayBookings.length)}
            sub={todayBookings.length === 1 ? 'booking' : 'bookings'}
          />
          <KpiCard
            index={1}
            label="RATING"
            value={avgRating ?? '—'}
            sub={reviewCount ? `${reviewCount} reviews` : 'no reviews yet'}
          />
        </View>

        {/* Money in flight — GET /payments/mine, held vs cleared — CARD-24 */}
        <View style={styles.sectionHeader}>
          <SectionHeader title={i18n.t('dashboard.moneyInFlightTitle')} />
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Earnings')}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('dashboard.moneyInFlightTitle')}
        >
          <View style={styles.kpiRow}>
            <KpiCard
              index={0}
              label={i18n.t('dashboard.escrowHeld')}
              value={moneyHeld != null ? `$${Math.round(moneyHeld).toLocaleString()}` : '—'}
            />
            <KpiCard
              index={1}
              label={i18n.t('dashboard.cleared')}
              value={moneyCleared != null ? `$${Math.round(moneyCleared).toLocaleString()}` : '—'}
            />
          </View>
        </TouchableOpacity>

        {/* New opportunities header */}
        <View style={styles.sectionHeader}>
          <SectionHeader
            variant="heading"
            title="New opportunities"
            actionLabel={visiblePosts.length > 0 ? 'See all' : null}
            onAction={() => navigation.navigate('Jobs')}
            count={visiblePosts.length}
          />
        </View>

        {visiblePosts.length === 0 ? (
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
          <View style={styles.postsList}>
            {visiblePosts.slice(0, 1).map((post) => (
              <JobOpportunityCard
                key={post.id}
                post={post}
                highlighted
                onSendQuote={() => openQuoteSheet(post)}
                onPass={() => passPost(post)}
              />
            ))}
            {visiblePosts.slice(1, 3).map((post) => (
              <JobOpportunityCard
                key={post.id}
                post={post}
                compact
                onSendQuote={() => openQuoteSheet(post)}
              />
            ))}
          </View>
        )}

        {/* Business tools row */}
        <View style={styles.sectionHeader}>
          <SectionHeader
            title="BUSINESS TOOLS"
          />
        </View>
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={styles.toolChip}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Earnings')}
            accessibilityRole="button"
            accessibilityLabel="Open earnings"
          >
            <Feather name="dollar-sign" size={18} color={colors.accentText} strokeWidth={1.8} />
            <Text style={styles.toolLabel} maxFontSizeMultiplier={1.2}>
              Earnings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolChip}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('BusinessAnalytics')}
            accessibilityRole="button"
            accessibilityLabel="Open analytics"
          >
            <Feather name="bar-chart-2" size={18} color={colors.accentText} strokeWidth={1.8} />
            <Text style={styles.toolLabel} maxFontSizeMultiplier={1.2}>
              Analytics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolChip}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('EmployeeManagement')}
            accessibilityRole="button"
            accessibilityLabel="Manage team"
          >
            <Feather name="users" size={18} color={colors.accentText} strokeWidth={1.8} />
            <Text style={styles.toolLabel} maxFontSizeMultiplier={1.2}>
              Team
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SendQuoteSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        post={selectedPost}
        onQuoted={(interest, note) => {
          // A note seeded a chat thread — take the business straight there
          if (note) {
            navigation.navigate('Chat', {
              interestId: interest.id,
              otherPartyName: selectedPost?.users?.first_name || 'Client',
            });
          }
        }}
      />
    </View>
  );
}

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
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  greeting: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  businessName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.textPrimary,
    marginTop: 2,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: colors.accentText,
    letterSpacing: -0.2,
  },

  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  attentionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attentionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.accentText,
  },

  nextJobCard: {
    marginBottom: 0,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.base,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  kpiSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  sectionHeader: {
    paddingTop: spacing.sm,
  },

  postsList: {
    gap: spacing.md,
  },

  emptyCard: {
    marginHorizontal: 0,
  },

  toolsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    gap: 6,
  },
  toolLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
