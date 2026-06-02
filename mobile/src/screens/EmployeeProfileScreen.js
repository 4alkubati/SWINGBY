import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { colors, spacing, radius, shadows } from '../theme/tokens';
import Text from '../components/Text';
import Avatar from '../components/Avatar';
import Surface from '../components/Surface';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { SkeletonBox } from '../components/Skeleton';

// ─── helpers ─────────────────────────────────────────────────────────────────

function starString(rating) {
  const r = Math.round(Math.max(0, Math.min(5, rating)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton({ insets }) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* fake header */}
      <View style={styles.header}>
        <SkeletonBox width={32} height={32} borderRadius={radius.chip} />
        <SkeletonBox width={80} height={18} borderRadius={6} />
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* identity card skeleton */}
        <Surface style={[styles.identityCard, { alignItems: 'center', gap: spacing.sm }]}>
          <SkeletonBox width={96} height={96} borderRadius={radius.avatar} />
          <SkeletonBox width={160} height={22} borderRadius={6} />
          <SkeletonBox width={100} height={16} borderRadius={6} />
          <SkeletonBox width={120} height={14} borderRadius={6} />
          {/* stats row skeleton */}
          <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statBox}>
                <SkeletonBox width={36} height={22} borderRadius={6} />
                <SkeletonBox width={44} height={11} borderRadius={4} style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>
        </Surface>

        {/* reviews skeleton */}
        <View style={styles.sectionHeader}>
          <SkeletonBox width={80} height={13} borderRadius={4} />
        </View>

        <Stack spacing="sm" style={{ paddingHorizontal: spacing.lg }}>
          {[0, 1, 2].map((i) => (
            <Surface key={i} padding="base" rounded="card" style={{ gap: spacing.sm }}>
              <Inline justify="space-between">
                <SkeletonBox width={80} height={13} borderRadius={4} />
                <SkeletonBox width={72} height={12} borderRadius={4} />
              </Inline>
              <SkeletonBox width="100%" height={13} borderRadius={4} />
              <SkeletonBox width="70%" height={13} borderRadius={4} />
            </Surface>
          ))}
        </Stack>
      </ScrollView>
    </View>
  );
}

// ─── Stat counter with fade-in micro-interaction ───────────────────────────────

function StatItem({ value, label, isFirst }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: isFirst ? 0 : isFirst === false ? 120 : 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: isFirst ? 0 : isFirst === false ? 120 : 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY, isFirst]);

  return (
    <Animated.View
      style={[styles.statBox, { opacity: fadeAnim, transform: [{ translateY }] }]}
    >
      <Text variant="display3" color="primary" style={{ textAlign: 'center' }}>
        {value}
      </Text>
      <Text variant="label" color="secondary" style={{ textAlign: 'center' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
  return (
    <Surface padding="base" rounded="card">
      <Stack spacing="xs">
        <Inline justify="space-between">
          <Text variant="smallMedium" color="primary">
            {review.reviewer?.first_name || 'Client'}
          </Text>
          <Text variant="caption" style={{ color: colors.warning }}>
            {starString(review.rating)}
          </Text>
        </Inline>
        {!!review.comment && (
          <Text variant="small" color="secondary" style={{ lineHeight: 20 }}>
            {review.comment}
          </Text>
        )}
      </Stack>
    </Surface>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EmployeeProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { employeeId, businessId } = route.params || {};

  const [employee, setEmployee] = useState(null);
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const calls = [
        api.get('/employees/'),
        businessId ? api.get(`/reviews/business/${businessId}`) : Promise.resolve([]),
        businessId ? api.get(`/businesses/${businessId}`) : Promise.resolve(null),
      ];
      const [emps, revs, biz] = await Promise.all(calls);
      const emp = (emps || []).find((e) => e.id === employeeId);
      setEmployee(emp || null);
      setReviews(revs || []);
      setBusiness(biz || null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, businessId]);

  useEffect(() => { load(); }, [load]);

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return <ProfileSkeleton insets={insets} />;
  }

  // ─── Error with retry ──────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Text variant="display3" color="secondary">←</Text>
          </TouchableOpacity>
          <Text variant="bodyMedium">Profile</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.centeredState}>
          <Surface padding="lg" rounded="card" style={{ alignItems: 'center', gap: spacing.base }}>
            <Text variant="h1" style={{ textAlign: 'center' }}>Could not load profile</Text>
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

  const fullName = employee?.user
    ? `${employee.user.first_name} ${employee.user.last_name}`
    : 'Team member';

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Nav header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text variant="display3" color="secondary">←</Text>
        </TouchableOpacity>
        <Text variant="bodyMedium">Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* ── Identity card ──────────────────────────────────────────────── */}
        <Surface
          elevation="subtle"
          background="default"
          rounded="card"
          padding="lg"
          style={[styles.identityCard, shadows.subtle]}
        >
          <Stack spacing="sm" style={{ alignItems: 'center' }}>
            {/* xl avatar */}
            <Avatar name={fullName} size="xl" />

            {/* name + role */}
            <Stack spacing="xs" style={{ alignItems: 'center' }}>
              <Text variant="display3" color="primary" style={{ textAlign: 'center' }}>
                {fullName}
              </Text>
              {employee?.role_title ? (
                <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                  {employee.role_title}
                </Text>
              ) : null}
            </Stack>

            {/* company link */}
            {businessId && business?.business_name ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('BusinessProfile', { businessId })}
                activeOpacity={0.7}
                style={styles.companyLink}
              >
                <Inline spacing="xs">
                  <Text variant="caption" color="accent">
                    {business.business_name}
                  </Text>
                  <Text variant="caption" color="accent">→</Text>
                </Inline>
              </TouchableOpacity>
            ) : null}

            {/* divider */}
            <View style={styles.divider} />

            {/* stats row with fade-in counter animation */}
            <View style={styles.statsRow}>
              <StatItem
                value={avgRating ?? '—'}
                label="Rating"
                isFirst={true}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={employee?.completed_jobs ?? '—'}
                label="Jobs"
                isFirst={false}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={reviews.length}
                label="Reviews"
                isFirst={null}
              />
            </View>
          </Stack>
        </Surface>

        {/* ── Reviews section ────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Inline justify="space-between">
            <Text variant="label" color="secondary">Reviews</Text>
            {reviews.length > 0 && (
              <Badge count={reviews.length} color="accent" />
            )}
          </Inline>
        </View>

        {reviews.length === 0 ? (
          /* Empty state */
          <Surface
            padding="lg"
            rounded="card"
            style={styles.emptyCard}
          >
            <Stack spacing="sm" style={{ alignItems: 'center' }}>
              <Text variant="h1" style={{ textAlign: 'center' }}>No reviews yet</Text>
              <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                Reviews from completed jobs will appear here.
              </Text>
            </Stack>
          </Surface>
        ) : (
          <Stack spacing="sm" style={{ paddingHorizontal: spacing.lg }}>
            {reviews.map((rev) => (
              <ReviewCard key={rev.id} review={rev} />
            ))}
          </Stack>
        )}
      </ScrollView>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingBottom: spacing['2xl'],
    gap: spacing.xs,
  },
  identityCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  companyLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.chip,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
