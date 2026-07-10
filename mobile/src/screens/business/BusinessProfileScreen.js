import {
  View, ScrollView, StyleSheet, RefreshControl, Alert, Platform,
  TextInput, Switch, FlatList, Linking, TouchableOpacity, Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, interpolate,
  useAnimatedScrollHandler, Extrapolation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Chip from '../../components/Chip';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Card from '../../components/Card';
import { SkeletonBox, SkeletonCard } from '../../components/Skeleton';
import { RatingStarsDisplay } from '../../components/RatingStars';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function BusinessProfileSkeleton() {
  return (
    <Stack spacing="base" style={{ paddingTop: spacing.base, paddingHorizontal: spacing.lg }}>
      {/* Hero */}
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
        <SkeletonBox width={96} height={96} borderRadius={radius.avatar} />
        <SkeletonBox width={180} height={22} />
        <SkeletonBox width={120} height={16} />
        <SkeletonBox width={160} height={16} />
      </View>
      {/* Chips row */}
      <Inline spacing="sm" wrap>
        <SkeletonBox width={70} height={32} borderRadius={radius.chip} />
        <SkeletonBox width={90} height={32} borderRadius={radius.chip} />
        <SkeletonBox width={60} height={32} borderRadius={radius.chip} />
      </Inline>
      {/* Team grid */}
      <SkeletonBox height={14} width={60} borderRadius={6} />
      <Inline spacing="md">
        <SkeletonBox width="47%" height={110} borderRadius={radius.card} />
        <SkeletonBox width="47%" height={110} borderRadius={radius.card} />
      </Inline>
      {/* Reviews */}
      <SkeletonBox height={14} width={70} borderRadius={6} />
      <SkeletonCard />
      <SkeletonCard />
    </Stack>
  );
}

// ─── Full-screen error ────────────────────────────────────────────────────────
function ProfileError({ onRetry, onBack }) {
  return (
    <View style={styles.centered}>
      <View style={[styles.iconWrap, { backgroundColor: colors.danger + '1A', borderColor: colors.danger + '33' }]}>
        <Feather name="alert-circle" size={32} color={colors.danger} />
      </View>
      <Text variant="h1" style={styles.emptyTitle}>Could not load profile</Text>
      <Text variant="small" color="secondary" style={styles.emptyBody}>
        Something went wrong. Please try again.
      </Text>
      <Inline spacing="md" style={{ marginTop: spacing.lg }}>
        <Button variant="secondary" label="Go back" onPress={onBack} />
        <Button label="Retry" onPress={onRetry} />
      </Inline>
    </View>
  );
}

// ─── No-reviews empty state ───────────────────────────────────────────────────
function NoReviews() {
  return (
    <Surface background="alt" style={styles.noReviews}>
      <Stack spacing="sm" align="center">
        <Feather name="star" size={24} color={colors.textSecondary} />
        <Text variant="small" color="secondary">No reviews yet</Text>
        <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
          Reviews will appear here after completed bookings.
        </Text>
      </Stack>
    </Surface>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="label" color="secondary">{title}</Text>
    </View>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <Surface elevation="subtle" style={styles.reviewCard}>
      <Inline justify="space-between" style={{ marginBottom: spacing.sm }}>
        <Text variant="smallMedium">{review.reviewer?.first_name || 'Client'}</Text>
        <RatingStarsDisplay rating={review.rating || 0} size={12} color={colors.accent} />
      </Inline>
      {review.comment ? (
        <Text variant="small" color="secondary" style={{ lineHeight: 20 }}>
          {review.comment}
        </Text>
      ) : null}
    </Surface>
  );
}

// ─── Employee card (2-column grid) ────────────────────────────────────────────
function EmployeeCard({ emp, editMode, onToggle, onPress }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const empName = [emp.user?.first_name, emp.user?.last_name].filter(Boolean).join(' ') || 'Employee';

  return (
    <Animated.View style={[styles.empCard, animStyle]}>
      <Animated.View
        onTouchStart={() => {
          scale.value = withSpring(0.97, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
        }}
        onTouchEnd={() => {
          scale.value = withSpring(1, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
          onPress?.();
        }}
      >
        <Surface elevation="subtle" style={styles.empCardInner}>
          <Stack spacing="sm" align="center">
            <Avatar name={empName} size="md" showStatus online={emp.is_active} />
            <Stack spacing={2} align="center">
              <Text variant="smallMedium" numberOfLines={1}>{emp.user?.first_name || 'Employee'}</Text>
              <Text variant="caption" color="secondary" numberOfLines={1}>{emp.role_title || 'Staff'}</Text>
            </Stack>
            {editMode ? (
              <Switch
                value={emp.is_active}
                onValueChange={onToggle}
                thumbColor={emp.is_active ? colors.accent : colors.textSecondary}
                trackColor={{ false: colors.border, true: colors.accentMuted }}
              />
            ) : !emp.is_active ? (
              <View style={styles.inactivePill}>
                <Text variant="caption" color="secondary">Inactive</Text>
              </View>
            ) : null}
          </Stack>
        </Surface>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Photo item (horizontal carousel) ────────────────────────────────────────
function PhotoItem({ uri }) {
  return (
    <View style={styles.photoItem}>
      <Surface
        elevation="subtle"
        padding={0}
        style={[styles.photoSurface, { backgroundColor: colors.surfaceAlt }]}
      >
        {uri ? (
          <Animated.Image
            source={{ uri }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Feather name="image" size={24} color={colors.textSecondary} />
          </View>
        )}
      </Surface>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BusinessProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { businessId, editMode: initialEditMode } = route.params || {};

  const [business, setBusiness] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subActionInFlight, setSubActionInFlight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(!!initialEditMode);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRadius, setEditRadius] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Scroll-based header animation
  const scrollY = useSharedValue(0);

  // Resolved business id. Starts from the route param or the auth payload,
  // but when neither is present (e.g. stale cached user without business_id)
  // we fall back to GET /businesses/me and resolve it from the response.
  const [bizId, setBizId] = useState(businessId || user?.business_id || null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const biz = businessId
        ? await api.get(`/businesses/${businessId}`)
        : await api.get('/businesses/me');
      const id = biz?.id;
      if (!id) throw new Error('No business found');
      setBizId(id);

      const isOwn = !businessId || businessId === id;
      const [emps, revs, sub] = await Promise.all([
        api.get(`/employees/business/${id}`).catch(() => []),
        api.get(`/reviews/business/${id}`).catch(() => []),
        isOwn && user?.role === 'business_owner'
          ? api.get('/businesses/me/subscription').catch(() => null)
          : Promise.resolve(null),
      ]);
      setBusiness(biz);
      setEmployees(emps || []);
      setReviews(revs || []);
      setSubscription(sub);
      setEditName(biz.business_name || '');
      setEditCategory(biz.category || '');
      setEditRadius(String(biz.service_radius_km || 25));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessId, user?.role]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/businesses/${bizId}`, {
        business_name: editName,
        category: editCategory,
        service_radius_km: parseInt(editRadius, 10),
      });
      await load();
      setEditMode(false);
    } catch (err) {
      const msg = err.message || 'Could not save changes.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        setLoggingOut(true);
        try { await logout(); } catch { /* AuthContext handles cleanup */ }
      }
      return;
    }
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await logout(); } catch { /* AuthContext handles cleanup */ }
        },
      },
    ]);
  }

  async function toggleEmployee(emp) {
    try {
      if (emp.is_active) {
        await api.patch(`/employees/${emp.id}/deactivate`);
      } else {
        await api.patch(`/employees/${emp.id}/reactivate`);
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  const isOwnProfile = !businessId || businessId === user?.business_id;
  const isOwner = user?.role === 'business_owner' && isOwnProfile;

  // ─── Scroll-based header shrink animation ──────────────────────────────────
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  const heroScale = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(scrollY.value, [0, 80], [1, 0.92], Extrapolation.CLAMP),
    }],
    opacity: interpolate(scrollY.value, [0, 80], [1, 0.8], Extrapolation.CLAMP),
  }));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Animated sticky header (appears on scroll) ── */}
      <Animated.View style={[styles.stickyHeader, headerOpacity]}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {business?.business_name || 'Business Profile'}
        </Text>
      </Animated.View>

      {/* ── Top nav bar ── */}
      <Inline justify="space-between" style={styles.navBar}>
        {navigation.canGoBack() ? (
          <Button
            variant="ghost"
            label=""
            icon={<Feather name="arrow-left" size={20} color={colors.textSecondary} />}
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
          />
        ) : (
          <View style={styles.iconBtn} />
        )}
        {isOwner && !editMode && (
          <Button
            variant="ghost"
            label="Edit"
            onPress={() => setEditMode(true)}
            style={styles.editBtn}
          />
        )}
        {editMode && (
          <Button
            variant="ghost"
            label="Cancel"
            onPress={() => setEditMode(false)}
            style={styles.editBtn}
          />
        )}
      </Inline>

      {/* ── Loading ── */}
      {loading && <BusinessProfileSkeleton />}

      {/* ── Error ── */}
      {!loading && error && (
        <ProfileError
          onBack={() => navigation.goBack()}
          onRetry={() => { setLoading(true); load(); }}
        />
      )}

      {/* ── Content ── */}
      {!loading && !error && (
        <AnimatedScrollView
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.accent}
            />
          }
        >
          {/* ── Hero section ── */}
          <Animated.View style={[styles.heroSection, heroScale]}>
            <Stack spacing="md" align="center">
              <Avatar
                name={business?.business_name || ''}
                size="xl"
              />

              {editMode ? (
                /* ── Edit fields ── */
                <Stack spacing="sm" style={styles.editBlock}>
                  <Text variant="label" color="secondary">Business name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Business name"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text variant="label" color="secondary">Category</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editCategory}
                    onChangeText={setEditCategory}
                    placeholder="e.g. Cleaning"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text variant="label" color="secondary">Service radius (km)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editRadius}
                    onChangeText={setEditRadius}
                    placeholder="25"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </Stack>
              ) : (
                /* ── View mode ── */
                <Stack spacing="sm" align="center">
                  <Text variant="display3" style={{ textAlign: 'center' }}>
                    {business?.business_name || '—'}
                  </Text>

                  {/* Verified badge */}
                  {business?.license_status === 'verified' && (
                    <Inline spacing="xs">
                      <Feather name="check-circle" size={14} color={colors.success} />
                      <Text variant="smallMedium" color="success">Verified</Text>
                    </Inline>
                  )}

                  {/* Rating + review count */}
                  <Inline spacing="md">
                    {business?.avg_rating != null && (
                      <Inline spacing="xs">
                        <RatingStarsDisplay rating={Number(business.avg_rating)} size={14} color={colors.accent} />
                        <Text variant="smallMedium">{Number(business.avg_rating).toFixed(1)}</Text>
                      </Inline>
                    )}
                    {business?.review_count != null && (
                      <Text variant="small" color="secondary">
                        {business.review_count} {business.review_count === 1 ? 'review' : 'reviews'}
                      </Text>
                    )}
                  </Inline>

                  {/* Category chip */}
                  {business?.category && (
                    <Chip label={business.category} selected={false} />
                  )}

                  {/* Service radius */}
                  {business?.service_radius_km && (
                    <Inline spacing="xs">
                      <Feather name="map-pin" size={12} color={colors.textSecondary} />
                      <Text variant="caption" color="secondary">
                        {business.service_radius_km} km radius
                      </Text>
                    </Inline>
                  )}
                </Stack>
              )}
            </Stack>
          </Animated.View>

          {/* ── Services / Tags chips row ── */}
          {!editMode && business?.services && business.services.length > 0 && (
            <>
              <SectionHeader title="Services" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {business.services.map((svc, i) => (
                  <Chip key={i} label={svc} />
                ))}
              </ScrollView>
            </>
          )}

          {/* ── Team section ── */}
          <View style={styles.sectionHeaderRow}>
            <Text variant="label" color="secondary">Team</Text>
            {isOwner && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('EmployeeManagement')}
                accessibilityRole="button"
                accessibilityLabel="Manage team"
              >
                <Text variant="caption" color="accent">Manage</Text>
              </TouchableOpacity>
            )}
          </View>
          {employees.length === 0 ? (
            <Surface background="alt" style={[styles.emptyCard, styles.hPad]}>
              <Text variant="small" color="secondary">No team members yet</Text>
            </Surface>
          ) : (
            <View style={styles.teamGrid}>
              {employees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  editMode={editMode}
                  onToggle={() => toggleEmployee(emp)}
                  onPress={() => navigation.navigate('EmployeeProfile', { employeeId: emp.id, businessId: bizId })}
                />
              ))}
            </View>
          )}

          {/* ── Photos carousel ── */}
          {business?.photos && business.photos.length > 0 && (
            <>
              <SectionHeader title="Photos" />
              <FlatList
                horizontal
                data={business.photos}
                keyExtractor={(item, i) => String(i)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosRow}
                renderItem={({ item }) => <PhotoItem uri={item} />}
              />
            </>
          )}

          {/* ── Reviews section ── */}
          <SectionHeader title="Reviews" />
          {reviews.length === 0 ? (
            <View style={styles.hPad}>
              <NoReviews />
            </View>
          ) : (
            <Stack spacing="sm" style={styles.hPad}>
              {reviews.map((rev) => (
                <ReviewCard key={rev.id} review={rev} />
              ))}
            </Stack>
          )}

          {/* ── Save button (edit mode) ── */}
          {editMode && (
            <View style={styles.hPad}>
              <Button
                label="Save changes"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
                style={{ marginTop: spacing.md }}
              />
            </View>
          )}

          {/* ── D2.4 Plan card — only on own profile ── */}
          {isOwner && subscription && (
            <View style={styles.hPad}>
              <SectionHeader title="Plan" />
              <Surface elevation="subtle" padding="base" rounded="card">
                <Stack spacing="sm">
                  <Inline justify="space-between">
                    <Text variant="bodyMedium">
                      {subscription.tier === 'team' ? 'Team ($80/mo)' : subscription.tier === 'enterprise' ? 'Enterprise' : 'Solo ($30/mo)'}
                    </Text>
                    <View style={[styles.subPill, subscription.status === 'active' ? styles.subActive : subscription.status === 'past_due' ? styles.subPastDue : styles.subTrialing]}>
                      <Text variant="caption" style={{ color: '#fff' }}>{(subscription.status || 'trialing').toUpperCase()}</Text>
                    </View>
                  </Inline>
                  {subscription.current_period_end ? (
                    <Text variant="caption" color="secondary">
                      Next billing: {new Date(subscription.current_period_end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  ) : null}
                  {subscription.manage_url ? (
                    <Button
                      variant="secondary"
                      label="Manage subscription"
                      onPress={() => Linking.openURL(subscription.manage_url)}
                    />
                  ) : (
                    <Button
                      label={subActionInFlight ? 'Starting…' : 'Start subscription'}
                      onPress={async () => {
                        setSubActionInFlight(true);
                        try {
                          const res = await api.post('/businesses/me/subscribe', {});
                          if (res.checkout_url) await Linking.openURL(res.checkout_url);
                          else await load();
                        } catch { /* toast via api */ }
                        finally { setSubActionInFlight(false); }
                      }}
                      disabled={subActionInFlight}
                      loading={subActionInFlight}
                    />
                  )}
                </Stack>
              </Surface>
            </View>
          )}

          {/* ── Account menu — only on own profile ── */}
          {isOwnProfile && (
            <>
              <SectionHeader title="Account" />
              <View style={styles.acctMenu}>
                <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('NotificationsCenter')}>
                  <Feather name="bell" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Notifications</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('PaymentMethod')}>
                  <Feather name="credit-card" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Payment methods</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {user?.role === 'business_owner' && (
                  <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('BusinessInvoices')}>
                    <Feather name="file-text" size={18} color={colors.textSecondary} />
                    <Text variant="body" style={styles.acctLabel}>Invoices</Text>
                    <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('Settings')}>
                  <Feather name="settings" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Settings</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('HelpFAQ')}>
                  <Feather name="help-circle" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Help & FAQ</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.acctRow} activeOpacity={0.7} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  <Feather name="shield" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Privacy Policy</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.acctRow, styles.acctRowLast]} activeOpacity={0.7} onPress={() => navigation.navigate('TermsOfService')}>
                  <Feather name="file-text" size={18} color={colors.textSecondary} />
                  <Text variant="body" style={styles.acctLabel}>Terms of Service</Text>
                  <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── Logout — only on own profile ── */}
          {isOwnProfile && (
            <View style={[styles.hPad, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              <Button
                variant="secondary"
                label={loggingOut ? 'Logging out…' : 'Log out'}
                onPress={handleLogout}
                disabled={loggingOut}
                loading={loggingOut}
                style={styles.logoutBtn}
              />
            </View>
          )}
        </AnimatedScrollView>
      )}

      {/* ── Sticky "Book" button (visitor view) ── */}
      {!loading && !error && !editMode && businessId && businessId !== user?.business_id && (
        <View style={[styles.bookBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
          <Button
            label="Book now"
            onPress={() => navigation.navigate('PostJob', { businessId: bizId })}
            style={styles.bookBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },

  // Sticky animated header title
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg + 'DD',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Account for insets via paddingTop applied to container
  },

  navBar:       { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  iconBtn:      { paddingVertical: 0, paddingHorizontal: 0, width: 44, justifyContent: 'center' },
  editBtn:      { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },

  content:      { paddingTop: spacing.sm, gap: 0 },
  hPad:         { marginHorizontal: spacing.lg },

  // Hero
  heroSection:  {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  editBlock:    { width: '100%' },
  editInput:    {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  acctMenu: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  acctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  acctRowLast: { borderBottomWidth: 0 },
  acctLabel: { flex: 1 },

  // Chips
  chipsRow:     { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },

  // Team grid
  teamGrid:     {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  empCard:      { width: '47%' },
  empCardInner: { alignItems: 'center' },
  inactivePill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },

  // Photos
  photosRow:    { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  photoItem:    { width: 160 },
  photoSurface: { borderRadius: radius.card, overflow: 'hidden' },
  photoImage:   { width: 160, height: 120 },
  photoPlaceholder: {
    width: 160, height: 120,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },

  // Reviews
  reviewCard:   { marginBottom: 0 },
  noReviews:    { alignItems: 'center', padding: spacing.xl },

  // Empty card
  emptyCard:    { padding: spacing.lg, alignItems: 'center' },

  // Centered state (error)
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap:     {
    width: 68, height: 68, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:   { marginTop: spacing.lg, textAlign: 'center' },
  emptyBody:    { marginTop: spacing.sm, textAlign: 'center', maxWidth: 280 },

  // Logout
  logoutBtn:    { borderColor: colors.danger + '4D' },

  // Sticky book bar
  bookBar:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  bookBtn:      {},

  // D2.4 subscription pill
  subPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.pill,
  },
  subActive:   { backgroundColor: colors.success },
  subTrialing: { backgroundColor: colors.accent },
  subPastDue:  { backgroundColor: colors.danger },
});
