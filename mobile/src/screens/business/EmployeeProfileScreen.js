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
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import { colors, spacing, radius, shadows } from '../../theme/tokens';
import Text from '../../components/Text';
import Avatar from '../../components/Avatar';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import { SkeletonBox } from '../../components/Skeleton';
import { RatingStarsDisplay } from '../../components/RatingStars';

// ─── helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatJoinedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton({ insets }) {
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <SkeletonBox width={32} height={32} borderRadius={radius.chip} />
        <SkeletonBox width={80} height={18} borderRadius={6} />
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={[styles.identityCard, { alignItems: 'center', gap: spacing.sm }]}>
          <SkeletonBox width={96} height={96} borderRadius={radius.avatar} />
          <SkeletonBox width={160} height={22} borderRadius={6} />
          <SkeletonBox width={100} height={16} borderRadius={6} />
          <SkeletonBox width={140} height={20} borderRadius={radius.chip} />
          <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statBox}>
                <SkeletonBox width={36} height={22} borderRadius={6} />
                <SkeletonBox width={44} height={11} borderRadius={4} style={{ marginTop: 4 }} />
              </View>
            ))}
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

// ─── Stat counter with fade-in micro-interaction ───────────────────────────────

function StatItem({ value, label, sub, isFirst }) {
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
      {sub ? (
        <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
          {sub}
        </Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Verified badge — static pill, success colour ─────────────────────────────

function VerifiedBadge({ businessName }) {
  return (
    <View style={styles.verifiedPill}>
      <Feather name="check-circle" size={12} color={colors.success} strokeWidth={2.2} />
      <Text variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
        Verified by {businessName}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EmployeeProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { employeeId } = route.params || {};

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await api.get(`/employees/${employeeId}/profile`);
      setProfile(data || null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId) {
      setError(true);
      setLoading(false);
      return;
    }
    load();
  }, [load, employeeId]);

  if (loading) {
    return <ProfileSkeleton insets={insets} />;
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="arrow-left" size={20} color={colors.textSecondary} strokeWidth={1.8} />
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

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Team member';
  const ratingValue = typeof profile.avg_rating === 'number' ? profile.avg_rating : null;
  const reviewCount = profile.review_count || 0;
  const jobsCompleted = profile.jobs_completed || 0;
  const sinceLabel = formatJoinedAt(profile.joined_at);
  const businessId = profile.business_id;
  const businessName = profile.business_name;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <Surface
          elevation="subtle"
          background="default"
          rounded="card"
          padding="lg"
          style={[styles.identityCard, shadows.subtle]}
        >
          <Stack spacing="sm" style={{ alignItems: 'center' }}>
            <Avatar name={fullName} source={profile.avatar_url || undefined} size="xl" />

            <Stack spacing="xs" style={{ alignItems: 'center' }}>
              <Text variant="display3" color="primary" style={{ textAlign: 'center' }}>
                {fullName}
              </Text>
              {profile.role_title ? (
                <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                  {profile.role_title}
                </Text>
              ) : null}
            </Stack>

            {ratingValue !== null ? (
              <Inline spacing="xs" align="center">
                <RatingStarsDisplay rating={ratingValue} size={14} />
                <Text variant="small" color="secondary">
                  {ratingValue.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </Text>
              </Inline>
            ) : null}

            {profile.verified_via_business && businessName ? (
              <VerifiedBadge businessName={businessName} />
            ) : null}

            {businessId && businessName ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('BusinessProfile', { businessId })}
                activeOpacity={0.7}
                style={styles.companyLink}
              >
                <Inline spacing="xs" align="center">
                  <Text variant="caption" color="accent">{businessName}</Text>
                  <Feather name="arrow-right" size={12} color={colors.accentText} strokeWidth={1.8} />
                </Inline>
              </TouchableOpacity>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.statsRow}>
              <StatItem
                value={ratingValue !== null ? ratingValue.toFixed(1) : '0.0'}
                label="Rating"
                isFirst={true}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={jobsCompleted}
                label="Jobs"
                isFirst={false}
              />
              <View style={styles.statDivider} />
              <StatItem
                value={sinceLabel ? sinceLabel.split(' ')[1] : '—'}
                label="Since"
                sub={sinceLabel ? sinceLabel.split(' ')[0] : null}
                isFirst={null}
              />
            </View>
          </Stack>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text variant="label" color="secondary">Reviews</Text>
        </View>

        {reviewCount === 0 ? (
          <Surface padding="lg" rounded="card" style={styles.emptyCard}>
            <Stack spacing="sm" style={{ alignItems: 'center' }}>
              <Text variant="h1" style={{ textAlign: 'center' }}>No reviews yet</Text>
              <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                First one earns a badge.
              </Text>
            </Stack>
          </Surface>
        ) : (
          <Surface padding="lg" rounded="card" style={styles.emptyCard}>
            <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
              {reviewCount} review{reviewCount === 1 ? '' : 's'} — list coming with the
              client→employee review flow.
            </Text>
          </Surface>
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
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(46,189,133,0.4)',
    backgroundColor: 'rgba(46,189,133,0.12)',
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
