import {
  View, ScrollView, StyleSheet, RefreshControl, Alert, Platform,
  TextInput, Switch, FlatList, Linking, TouchableOpacity, Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, interpolate,
  useAnimatedScrollHandler, Extrapolation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { api, uploadFile } from '../../services/api';
import { getUserLocation } from '../../services/location';
import { useFavorites } from '../../hooks/useFavorites';
import * as toast from '../../services/toast';
import { colors, spacing, radius, motion } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import BusinessLogo from '../../components/BusinessLogo';
import Chip from '../../components/Chip';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import HeaderGlow from '../../components/HeaderGlow';
import { SkeletonBox, SkeletonCard } from '../../components/Skeleton';
import { RatingStarsDisplay } from '../../components/RatingStars';
import SectionHeader from '../../components/SectionHeader';
import ReviewCard from '../../components/ReviewCard';
// Walkthrough M3 — Google review import. `GoogleReviewsConnect` is the owner's
// control (and renders a "coming soon" card while Google's Business Profile
// approval is pending); `ImportedReviewsSection` is what a CLIENT sees, in its
// own labelled block so an imported review is never mistaken for a SwingBy one.
import GoogleReviewsConnect from '../../components/GoogleReviewsConnect';
import ImportedReviewsSection from '../../components/ImportedReviewsSection';
import { getImportedReviews } from '../../services/googleReviews';
import i18n from '../../i18n';

// Haversine distance in km — same formula as SearchScreen's local helper
// (not shared/exported anywhere today; duplicated here rather than editing
// that off-limits file).
function computeDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Owner-view profile-completeness meter. Every check reads a field already
// fetched on `business` — zero backend dependency. The "jobs done" stat is not
// part of completeness (it measures work, not a filled-in profile); it is a
// real figure and renders in the stat row from `completed_bookings`.
function computeProfileCompleteness(business) {
  const checks = [
    !!business?.business_name,
    !!business?.category,
    !!business?.description,
    !!business?.service_radius_km,
    // A logo counts toward completeness, so uploading one visibly moves the
    // bar. No matching entry is added to the tip chain below on purpose: those
    // strings are translated into FR and AR in the shared catalogue, and this
    // screen should not be the thing that ships an English-only tip.
    !!business?.logo_url,
    Array.isArray(business?.photos) && business.photos.length > 0,
    Array.isArray(business?.services) && business.services.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  const pct = Math.round((done / checks.length) * 100);
  let tip = null;
  if (!business?.description) tip = i18n.t('businessProfile.completenessTipDescription');
  else if (!(Array.isArray(business?.photos) && business.photos.length > 0)) tip = i18n.t('businessProfile.completenessTipPhotos');
  else if (!(Array.isArray(business?.services) && business.services.length > 0)) tip = i18n.t('businessProfile.completenessTipServices');
  else if (!business?.service_radius_km) tip = i18n.t('businessProfile.completenessTipRadius');
  return { pct, tip };
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

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

// SectionHeader was redefined locally here, a plainer copy of
// components/SectionHeader.js that had drifted from it (no header a11y role,
// no letter-spacing, no font-scaling cap). It now imports the shared one and
// passes the screen's spacing as `style`.

// ─── Owner-view grouped row (D4) ──────────────────────────────────────────────
// The owner blocks in the mock are grouped cards of 14px rows: label left,
// an optional muted value or tinted status pill, chevron right. Dividers use
// borderSubtle — the darker divider that separates rows *inside* a card.
function ManageRow({ label, value, pill, pillTone = 'success', onPress, last, accent }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        styles.manageRow,
        !last && styles.manageRowDivided,
        pressed && styles.manageRowPressed,
      ]}
    >
      <Text
        variant="small"
        style={[styles.manageLabel, accent && { color: colors.accentText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {pill ? (
        <View style={[styles.manageePill, pillTone === 'success' ? styles.pillSuccess : styles.pillNeutral]}>
          <Text
            variant="caption"
            style={{
              fontFamily: 'Inter_600SemiBold',
              color: pillTone === 'success' ? colors.success : colors.textSecondary,
            }}
          >
            {pill}
          </Text>
        </View>
      ) : null}
      {value ? (
        <Text variant="small" color="secondary" style={styles.manageValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={16} strokeWidth={1.8} color={colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

// ReviewCard moved to components/ReviewCard.js — it existed here and in
// BusinessAnalyticsScreen with two different ideas of where the reviewer's
// name lives. GET /reviews/business/{id} nests it under `users`; the analytics
// payload flattens it to `client_first_name`; this copy read `review.reviewer`,
// which neither returns, so every card here fell back to "Client". The shared
// component's `reviewerName()` knows all three.

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
  // Imported Google reviews are kept in their OWN state, never merged into
  // `reviews`. Merging them would be one refactor away from them appearing in
  // a count or an average that is supposed to mean "rated on a SwingBy job".
  const [importedReviews, setImportedReviews] = useState([]);
  const [importedSummary, setImportedSummary] = useState(null);
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
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Scroll-based header animation
  const scrollY = useSharedValue(0);

  // Resolved business id. Starts from the route param or the auth payload,
  // but when neither is present (e.g. stale cached user without business_id)
  // we fall back to GET /businesses/me and resolve it from the response.
  const [bizId, setBizId] = useState(businessId || user?.business_id || null);

  const isOwnProfile = !businessId || businessId === user?.business_id;
  // D4 — "Preview public" flips the owner into the visitor render tree so they
  // can see exactly what a client sees. Local UI state only: same screen, same
  // fetch, same route.
  const [previewPublic, setPreviewPublic] = useState(false);
  const isOwner = user?.role === 'business_owner' && isOwnProfile && !previewPublic;

  // CARD-12 — Favorites. FavoritesScreen + useFavorites (AsyncStorage,
  // persists across restarts) already existed, but nothing in the app ever
  // called add() — there was no way to actually favorite a business, so the
  // list could only ever be empty. This is that missing entry point: a heart
  // toggle on the visitor view of a business profile, client role only
  // (Favorites has no route in BusinessNavigator — see docs/FLOW_GRAPH.md).
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const canFavorite = user?.role === 'client' && !isOwnProfile;
  const isFav = canFavorite && bizId ? isFavorite(bizId) : false;

  function handleToggleFavorite() {
    if (!bizId) return;
    const wasFav = isFavorite(bizId);
    toggleFavorite(bizId);
    toast.show({
      type: 'success',
      text1: wasFav ? i18n.t('favorites.removed') : i18n.t('favorites.added'),
    });
  }

  // Distance-from-viewer (public view only) — best-effort, never blocks the
  // profile from rendering. Same "silent catch, distance simply omitted"
  // idiom as SearchScreen's location fetch.
  const [viewerCoords, setViewerCoords] = useState(null);
  useEffect(() => {
    if (isOwnProfile) return;
    getUserLocation()
      .then(setViewerCoords)
      .catch(() => setViewerCoords(null));
  }, [isOwnProfile]);

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
      const isOwnerView = isOwn && user?.role === 'business_owner';
      const [emps, revs, sub, imported] = await Promise.all([
        // Two rosters, deliberately (founder ruling 2026-07-25).
        //
        // `/employees/business/{id}` is the PUBLIC trust card and now omits the
        // owner's own employees row once the business is past
        // SMALL_BUSINESS_MAX_TEAM_SIZE. That is right for a stranger reading the
        // profile and WRONG for the owner reading their own — this screen is
        // also the team-management surface (Manage / the active toggles), so
        // filtering the owner out of it would hide them from their own team and
        // undercount "Team & employees" by one.
        //
        // `/employees/` is the internal roster: owner-authenticated, always
        // complete, and the same list the assignee picker uses.
        (isOwnerView
          ? api.get('/employees/')
          : api.get(`/employees/business/${id}`)
        ).catch(() => []),
        api.get(`/reviews/business/${id}`).catch(() => []),
        isOwnerView
          ? api.get('/businesses/me/subscription').catch(() => null)
          : Promise.resolve(null),
        // Returns an empty list while the feature flag is off, so this is a
        // no-op today rather than a call that needs its own gate.
        getImportedReviews(id).catch(() => null),
      ]);
      setBusiness(biz);
      setEmployees(emps || []);
      setReviews(revs || []);
      setSubscription(sub);
      setImportedReviews(imported?.reviews || []);
      setImportedSummary(imported?.summary || null);
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

  // Business logo. Mirrors the client-avatar path in ProfileEditScreen exactly
  // — permission → library → POST /uploads/image → PATCH the url onto the row
  // — because that path is proven and a business had no equivalent at all.
  //
  // Two deliberate differences, both about not destroying work:
  //   · the PATCH sends ONLY logo_url, so it can never overwrite a name or
  //     radius the owner is midway through editing;
  //   · success updates `business` in place instead of calling load(), because
  //     load() re-seeds editName/editCategory/editRadius from the server and
  //     would silently throw away whatever is currently typed in those fields.
  // A failure leaves every piece of state untouched and says so in a toast, so
  // a dropped upload costs the photo and nothing else.
  async function handleLogoPress() {
    if (uploadingLogo) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      toast.show({
        type: 'error',
        text1: 'Photo access needed',
        text2: 'Allow photo access to upload your logo.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
    const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    setUploadingLogo(true);
    try {
      const up = await uploadFile('/uploads/image', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName || `logo_${Date.now()}.${ext}`,
      });
      await api.patch(`/businesses/${bizId}`, { logo_url: up.url });
      setBusiness((prev) => (prev ? { ...prev, logo_url: up.url } : prev));
      toast.show({ type: 'success', text1: 'Logo updated' });
    } catch (err) {
      toast.show({
        type: 'error',
        text1: 'Could not upload logo',
        text2: err?.message || 'Try again.',
      });
    } finally {
      setUploadingLogo(false);
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

  // ─── Owner render: "My Business" (D4) ──────────────────────────────────────
  //
  // The walkthrough logged this as "a different screen entirely": the owner was
  // getting the visitor layout (centred hero, rating, review list) with an
  // 8-row settings menu bolted underneath. The mock's owner view is a
  // management console — identity, completeness, Services & Pricing, Manage,
  // Plan, Account.
  //
  // Three of the mock's Manage rows have no field behind them and are NOT
  // faked here:
  //   · per-service pricing  — `businesses` has no services/prices column;
  //     `business.services` is read where present but is never written by any
  //     endpoint, so the block renders its empty state rather than an
  //     "Add service" row that could not save.
  //   · working hours        — no column, no endpoint. Omitted entirely.
  //   · payout account       — there is no Stripe Connect onboarding in this
  //     build. The two real money surfaces (how escrow pays out, and the
  //     invoice list) are linked instead.
  if (isOwner && !editMode && !loading && !error) {
    const { pct, tip } = computeProfileCompleteness(business || {});
    const services = Array.isArray(business?.services) ? business.services : [];
    const locality = business?.address || null;
    const subLine = [business?.category, locality].filter(Boolean).join(' · ');

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <HeaderGlow width={420} height={320} offsetTop={-120} align="center" opacity={0.26} />

        <AnimatedScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.ownerContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.accent}
            />
          }
        >
          {/* ── Title row ── */}
          <View style={styles.ownerTitleRow}>
            <Text style={styles.ownerTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              My Business
            </Text>
            <Pressable
              onPress={() => setPreviewPublic(true)}
              accessibilityRole="button"
              accessibilityLabel="Preview public profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.previewBtn, pressed && styles.manageRowPressed]}
            >
              <Text style={styles.previewBtnText}>Preview public</Text>
            </Pressable>
          </View>

          {/* ── Identity ── */}
          <View style={styles.ownerIdentity}>
            {/* The tile IS the logo control. A business had no picture
                anywhere in the product, and this is the one place its owner
                reliably looks at their own identity — so tapping it changes
                the logo, exactly like tapping your avatar on ProfileEditScreen
                changes your photo. Editing name/category/radius did not lose
                an entry point: it moved to a labelled "Business name &
                category" row in Manage below, which is more discoverable than
                a pencil on a tile ever was. */}
            <Pressable
              onPress={handleLogoPress}
              disabled={uploadingLogo}
              accessibilityRole="button"
              accessibilityLabel={
                business?.logo_url ? 'Change business logo' : 'Add a business logo'
              }
              accessibilityState={{ busy: uploadingLogo }}
              style={{ position: 'relative' }}
            >
              <BusinessLogo
                uri={business?.logo_url}
                name={business?.business_name || ''}
                size={60}
              />
              {uploadingLogo && (
                <View style={styles.ownerLogoBusy}>
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                </View>
              )}
              <View style={styles.ownerEditBadge}>
                <Feather name="camera" size={11} strokeWidth={2} color={colors.textPrimary} />
              </View>
            </Pressable>

            <View style={styles.ownerIdentityText}>
              <View style={styles.ownerNameRow}>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {business?.business_name || '—'}
                </Text>
                {business?.license_status === 'verified' && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>Verified</Text>
                  </View>
                )}
              </View>
              {subLine ? (
                <Text variant="small" color="secondary" numberOfLines={1}>{subLine}</Text>
              ) : null}
            </View>
          </View>

          {/* ── Profile completeness ── */}
          <View style={styles.completeCard}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color="secondary">
                {i18n.t('businessProfile.completenessLabel')}
              </Text>
              <Text variant="smallMedium" numberOfLines={1}>
                {tip ? `${pct}% — ${tip}` : `${pct}% complete`}
              </Text>
            </View>
            <View style={styles.completeTrack}>
              <View style={[styles.completeFill, { width: `${Math.max(2, Math.min(100, pct))}%` }]} />
            </View>
          </View>

          {/* ── Services & pricing ── */}
          <Text variant="label" color="secondary" style={styles.ownerSectionLabel}>
            Services & pricing
          </Text>
          <View style={styles.ownerBlock}>
            {services.length > 0 ? (
              services.map((svc, i) => (
                <ManageRow
                  key={`${svc}-${i}`}
                  label={typeof svc === 'string' ? svc : svc?.name || 'Service'}
                  value={typeof svc === 'object' && svc?.price ? `from $${svc.price}` : undefined}
                  last={i === services.length - 1}
                />
              ))
            ) : (
              <View style={styles.ownerEmptyRow}>
                <Feather name="tag" size={16} strokeWidth={1.8} color={colors.textSecondary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="smallMedium">No services listed yet</Text>
                  <Text variant="caption" color="secondary">
                    The trades you picked during setup show here.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Manage ── */}
          <Text variant="label" color="secondary" style={styles.ownerSectionLabel}>Manage</Text>
          <View style={styles.ownerBlock}>
            {/* Took over the tile's old job as the edit affordance. */}
            <ManageRow
              label="Business name & category"
              value={business?.category || undefined}
              onPress={() => setEditMode(true)}
            />
            {/* A second, named way in. The tile above is the fast path once
                you know it is tappable; this is the one an owner finds when
                they are looking for "where do I put my logo". */}
            <ManageRow
              label="Logo"
              value={
                uploadingLogo ? 'Uploading…' : business?.logo_url ? undefined : 'Add'
              }
              pill={!uploadingLogo && business?.logo_url ? 'Added' : undefined}
              onPress={handleLogoPress}
            />
            <ManageRow
              label="Team & employees"
              value={String(employees.length)}
              onPress={() => navigation.navigate('EmployeeManagement')}
            />
            <ManageRow
              label="Service area"
              value={business?.service_radius_km ? `${Math.round(business.service_radius_km)} km` : undefined}
              onPress={() => setEditMode(true)}
            />
            <ManageRow
              label="How you get paid"
              onPress={() => navigation.navigate('PaymentMethod')}
            />
            <ManageRow
              label="Invoices"
              onPress={() => navigation.navigate('BusinessInvoices')}
              last
            />
          </View>

          {/* ── Reviews (walkthrough M3) ──
              An owner arriving with years of Google reviews should not start
              at zero here. While Google's Business Profile approval is pending
              this card renders as "coming soon" with no pressable control —
              never a button that fails. */}
          <Text variant="label" color="secondary" style={styles.ownerSectionLabel}>Reviews</Text>
          <GoogleReviewsConnect compact onImported={() => load()} />

          {/* ── Plan ── */}
          {subscription ? (
            <>
              <Text variant="label" color="secondary" style={styles.ownerSectionLabel}>Plan</Text>
              <View style={styles.ownerBlock}>
                <ManageRow
                  label={
                    subscription.tier === 'team' ? 'Team ($80/mo)'
                      : subscription.tier === 'enterprise' ? 'Enterprise'
                        : 'Solo ($30/mo)'
                  }
                  pill={(subscription.status || 'trialing').toUpperCase()}
                  pillTone={subscription.status === 'active' ? 'success' : 'neutral'}
                  last
                />
              </View>
              <View style={styles.ownerCtaWrap}>
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
                      } catch { /* toast via api */ } finally {
                        setSubActionInFlight(false);
                      }
                    }}
                    disabled={subActionInFlight}
                    loading={subActionInFlight}
                  />
                )}
              </View>
            </>
          ) : null}

          {/* ── Account ──
              Notifications stays here. D11 removes it from the CLIENT profile
              because the client home header carries the bell; the business
              dashboard has no bell, so this is the only way in. */}
          <Text variant="label" color="secondary" style={styles.ownerSectionLabel}>Account</Text>
          <View style={styles.ownerBlock}>
            {/* AutoBiddingScreen shipped registered in BusinessNavigator with
                no route into it. It is subscriber-only and gates itself, so it
                belongs next to the subscription block rather than behind one. */}
            <ManageRow label="Auto-bidding" onPress={() => navigation.navigate('AutoBidding')} />
            <ManageRow label="Notifications" onPress={() => navigation.navigate('NotificationsCenter')} />
            <ManageRow label="Settings" onPress={() => navigation.navigate('Settings')} />
            <ManageRow label="Help & FAQ" onPress={() => navigation.navigate('HelpFAQ')} />
            <ManageRow label="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
            <ManageRow label="Terms of Service" onPress={() => navigation.navigate('TermsOfService')} last />
          </View>

          {/* ── Log out ── */}
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            style={({ pressed }) => [
              styles.ownerLogout,
              pressed && styles.manageRowPressed,
              loggingOut && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.ownerLogoutText}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </Text>
          </Pressable>
        </AnimatedScrollView>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Owner previewing their public page — one tap back to management. */}
      {previewPublic && (
        <Pressable
          onPress={() => setPreviewPublic(false)}
          accessibilityRole="button"
          accessibilityLabel="Exit public preview"
          style={styles.previewBanner}
        >
          <Feather name="eye" size={14} strokeWidth={1.8} color={colors.accentText} />
          <Text variant="caption" style={{ flex: 1, color: colors.accentText }}>
            Previewing your public profile
          </Text>
          <Text variant="caption" style={{ color: colors.accentText, fontFamily: 'Inter_600SemiBold' }}>
            Done
          </Text>
        </Pressable>
      )}


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
        {/* CARD-12 — Favorites entry point (client visitor view only) */}
        {!loading && !error && !editMode && canFavorite && (
          <TouchableOpacity
            onPress={handleToggleFavorite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isFav ? i18n.t('favorites.remove') : i18n.t('favorites.add')}
            style={styles.favBtn}
          >
            <Feather
              name="heart"
              size={20}
              color={isFav ? colors.danger : colors.textSecondary}
            />
          </TouchableOpacity>
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
              {/* The public face of the business. A tile, not a circle:
                  businesses are tiles and people are circles throughout the
                  system (Avatar shape="tile"), and this hero was the one place
                  a business was drawn as a person. */}
              <BusinessLogo
                uri={business?.logo_url}
                name={business?.business_name || ''}
                size={96}
                accessibilityLabel={
                  business?.business_name
                    ? `${business.business_name} logo`
                    : 'Business logo'
                }
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
                        <RatingStarsDisplay rating={Number(business.avg_rating)} size={14} color={colors.warning} />
                        <Text variant="smallMedium">{Number(business.avg_rating).toFixed(1)}</Text>
                      </Inline>
                    )}
                    {business?.review_count != null && (
                      <Text variant="small" color="secondary">
                        {business.review_count} {business.review_count === 1 ? 'review' : 'reviews'}
                      </Text>
                    )}
                    {/* "Jobs done" — the third stat in the mock's row. It was
                        left out as "ambiguous, unconfirmed by product"; it is
                        neither. It is completed bookings, and GET /businesses/
                        {id} now returns `completed_bookings` for exactly this.
                        Note it is NOT the analytics endpoint's `total_bookings`
                        (owner-only, and counts cancelled and pending rows too)
                        — see _completed_bookings in backend/app/api/businesses.py. */}
                    {business?.completed_bookings > 0 && (
                      <Text variant="small" color="secondary">
                        {i18n.t('businessProfile.jobsDone', {
                          count: business.completed_bookings,
                        })}
                      </Text>
                    )}
                    {/* Distance from viewer — public view only, real data (viewer
                        coords + business lat/lng), never shown as a fabricated
                        stat. */}
                    {!isOwnProfile && viewerCoords && typeof business?.lat === 'number' && typeof business?.lng === 'number' && (
                      <Text variant="small" color="secondary">
                        {i18n.t('businessProfile.distanceAway', {
                          km: computeDistanceKm(viewerCoords.lat, viewerCoords.lng, business.lat, business.lng).toFixed(1),
                        })}
                      </Text>
                    )}
                  </Inline>

                  {/* Category chip */}
                  {business?.category && (
                    <Chip label={business.category} selected={false} />
                  )}

                  {/* Service radius */}
                  {/* Same numeric-guard trap: a 0 km radius would render a
                      bare 0 rather than nothing. */}
                  {Number(business?.service_radius_km) > 0 && (
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

          {/* Completeness, Plan, Account and Log out now live in the owner
              render tree above (D4). They are deliberately absent here: this
              tree is the PUBLIC page, and it is also what "Preview public"
              shows the owner. */}

          {/* ── Services / Tags chips row ── */}
          {!editMode && business?.services && business.services.length > 0 && (
            <>
              <SectionHeader title="Services" style={styles.sectionHeader} />
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
              <SectionHeader title="Photos" style={styles.sectionHeader} />
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

          {/* ── Reviews section ──
              "SwingBy reviews" rather than the old bare "Reviews": once a
              second, differently-earned kind of review can appear on this page,
              an unqualified heading is the ambiguity. These are the ones left
              on jobs booked and completed through SwingBy. */}
          <SectionHeader title="SwingBy reviews" style={styles.sectionHeader} />
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

          {/* ── Imported Google reviews (walkthrough M3) ──
              Its own block, below the native ones, and it renders nothing at
              all when there are none. Never merged into the list above and
              never into business.avg_rating — see the component header. */}
          {importedReviews.length > 0 && (
            <ImportedReviewsSection
              reviews={importedReviews}
              summary={importedSummary}
              style={[styles.hPad, styles.importedSection]}
            />
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

        </AnimatedScrollView>
      )}

      {/* ── Sticky "Book" button (visitor view) ── */}
      {!loading && !error && !editMode && businessId && businessId !== user?.business_id && (
        <View style={[styles.bookBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
          <Button
            label="Book now"
            onPress={() => navigation.navigate('PostJob', {
              businessId: bizId,
              businessName: business?.business_name,
            })}
            style={styles.bookBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },

  // ── Owner view: "My Business" (D4) ──────────────────────────────────────
  ownerContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  ownerTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md,
  },
  ownerTitle: {
    fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary, letterSpacing: -0.8,
  },
  previewBtn: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    borderRadius: 10, paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    minHeight: 36, justifyContent: 'center',
  },
  previewBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.accentText },
  previewBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: radius.input,
    backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.borderAccent,
  },

  ownerIdentity: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  ownerIdentityText: { flex: 1, gap: 3 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ownerName: {
    flexShrink: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary,
  },
  ownerLogoBusy: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerEditBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.accentBtn, borderWidth: 3, borderColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  verifiedPill: {
    backgroundColor: colors.successTint, borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  verifiedPillText: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: colors.success },

  completeCard: {
    marginTop: spacing.base,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: spacing.base, paddingVertical: 14,
  },
  completeTrack: {
    width: 110, height: 6, borderRadius: radius.pill,
    backgroundColor: colors.border, overflow: 'hidden',
  },
  completeFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },

  ownerSectionLabel: { marginTop: 18, marginBottom: 9 },
  ownerBlock: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, overflow: 'hidden',
  },
  ownerEmptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.base, paddingVertical: spacing.base,
  },
  ownerCtaWrap: { marginTop: spacing.md },
  ownerLogout: {
    marginTop: spacing.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    borderRadius: 14, paddingVertical: 14, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  ownerLogoutText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.danger },

  // Grouped-row primitives shared by every owner block.
  manageRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: 14, minHeight: 50,
  },
  manageRowDivided: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  manageRowPressed: { backgroundColor: colors.surfaceAlt },
  manageLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },
  manageValue: { fontSize: 13, marginRight: 2 },
  manageePill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  pillSuccess: { backgroundColor: colors.successTint },
  pillNeutral: { backgroundColor: colors.surfaceAlt },

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
  favBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

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
  noReviews:    { alignItems: 'center', padding: spacing.xl },
  // Imported Google reviews sit a full step below the native list — the gap is
  // doing work here, separating two things a client must not conflate.
  importedSection: { marginTop: spacing.xl },

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

  // D2.4 subscription pill — tint bg + full-color text per POLISH-TIPS §2
  subPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radius.pill,
  },
  subActive:   { backgroundColor: 'rgba(46,189,133,0.14)' },
  subTrialing: { backgroundColor: colors.accentMuted },
  subPastDue:  { backgroundColor: 'rgba(255,92,92,0.14)' },
  subPillText: { fontWeight: '700', letterSpacing: 0.8 },
  subActiveText:   { color: colors.success },
  subTrialingText: { color: colors.accentText },
  subPastDueText:  { color: colors.danger },
});
