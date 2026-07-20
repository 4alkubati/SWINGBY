import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeOut, Layout,
} from 'react-native-reanimated';
import { api } from '../../services/api';
import StatusTracker from '../../components/StatusTracker';
import LiveStatusActions from '../../components/LiveStatusActions';
import LiveStatusTimeline from '../../components/LiveStatusTimeline';
import BookingPhotos from '../../components/BookingPhotos';
import Text from '../../components/Text';
import Tabs from '../../components/Tabs';
import Chip from '../../components/Chip';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import ListItem from '../../components/ListItem';
import EmptyState from '../../components/EmptyState';
import JobOpportunityCard from '../../components/JobOpportunityCard';
import SendQuoteSheet from '../../components/SendQuoteSheet';
import { SkeletonBox, SkeletonList } from '../../components/Skeleton';
import Avatar from '../../components/Avatar';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';
import i18n from '../../i18n';
import { groupBusinessJobs, bookingDate } from '../../utils/jobGroups';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  on_the_way: 'On the Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS = {
  pending: colors.warning,
  confirmed: colors.accent,
  on_the_way: colors.accent,
  in_progress: colors.success,
  completed: colors.success,
  cancelled: colors.danger,
};

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function JobSkeleton() {
  return (
    <Stack spacing="md" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base }}>
      {/* Status tracker placeholder */}
      <SkeletonBox height={90} borderRadius={radius.card} style={{ width: '100%' }} />
      {/* Cards */}
      {[1, 2].map((k) => (
        <View key={k} style={skeletonStyles.card}>
          <SkeletonBox height={11} width={80} borderRadius={6} />
          <SkeletonBox height={16} width={160} borderRadius={6} style={{ marginTop: spacing.sm }} />
          <SkeletonBox height={13} width={120} borderRadius={6} style={{ marginTop: spacing.xs }} />
        </View>
      ))}
      {/* Chat button placeholder */}
      <SkeletonBox height={50} borderRadius={radius.button} style={{ width: '100%' }} />
    </Stack>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },
});

// ─── Avatar circle ────────────────────────────────────────────────────────────

function AvatarCircle({ name, isActive }) {
  return (
    <View style={[
      avatarStyles.circle,
      isActive && avatarStyles.circleActive,
    ]}>
      <Text variant="smallMedium" color="accent">{initials(name)}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    width: 42,
    height: 42,
    borderRadius: radius.avatar,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
});

// ─── Job detail sections ───────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <Text variant="label" color="secondary" style={{ marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

/** Appends a 2-char hex alpha to a 6-char hex token color string. */
function withAlpha(hexColor, alpha) {
  return hexColor + alpha;
}

// Accepts either a booking `status` key (existing usage — colors/label come
// from STATUS_COLORS/STATUS_LABELS) or an explicit `label`+`color` override
// (used by the Jobs-list mode for interest statuses, which have their own
// pending/accepted/rejected vocabulary, not the booking one).
function StatusChip({ status, label, color: colorOverride }) {
  const color = colorOverride || STATUS_COLORS[status] || colors.textSecondary;
  const text = label || STATUS_LABELS[status] || status;
  return (
    <View style={[chipStyles.wrap, {
      borderColor: withAlpha(color, '55'),
      backgroundColor: withAlpha(color, '18'),
    }]}>
      <View style={[chipStyles.dot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color }}>{text}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// ─── Per-booking detail/status screen (bookingId present) ─────────────────────
// Unchanged from the original single-purpose JobManagementScreen — Live Job
// Status actions, employee assignment, etc. Only the wiring at the bottom of
// this file changed (routed to via the default export's branch).

function JobDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};

  // Data state
  const [booking, setBooking] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [assignPickerVisible, setAssignPickerVisible] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState(0); // 0 = Details, 1 = Status
  const [activeFilter, setActiveFilter] = useState('all');

  // Spring animation for tab content
  const contentOpacity = useSharedValue(1);
  const contentTranslate = useSharedValue(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bData, eData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get('/employees/').catch(() => []),
      ]);
      // Flatten the nested joins (users / employees / service_posts) into the
      // flat fields this screen renders.
      const empUser = bData?.employees?.users;
      setBooking(bData && {
        ...bData,
        client_name: [bData.users?.first_name, bData.users?.last_name].filter(Boolean).join(' ') || null,
        employee_name: empUser ? [empUser.first_name, empUser.last_name].filter(Boolean).join(' ') : null,
        employee_role: bData.employees?.role_title || null,
        service_type: bData.service_posts?.title || bData.service_category || null,
        address: bData.service_posts?.address || null,
        scheduled_date: bData.confirmed_date || bData.proposed_date_1 || null,
      });
      setEmployees((eData || []).filter((e) => e.is_active));
    } catch (err) {
      setError(err?.message || 'Could not load job details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Tab switch animation
  function handleTabChange(index) {
    contentOpacity.value = withTiming(0, { duration: 80 }, () => {
      contentOpacity.value = withTiming(1, { duration: motion.entryDuration });
    });
    contentTranslate.value = withSpring(0, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
    setActiveTab(index);
  }

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  async function handleAdvance(stage) {
    setAdvancing(true);
    try {
      if (stage === 'completed') {
        await api.patch(`/bookings/${bookingId}/complete`);
      } else {
        // Provider heading out — record a live status event. (confirm-date is
        // the client's action and requires a date; it was wrong here.)
        await api.post(`/bookings/${bookingId}/events`, { event_type: 'en_route' });
      }
      await load();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update status.');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAssign(employeeId) {
    setAssigning(true);
    setAssignPickerVisible(false);
    try {
      await api.patch(`/bookings/${bookingId}/assign-employee`, {
        employee_id: employeeId,
      });
      await load();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not assign employee.');
    } finally {
      setAssigning(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <SkeletonBox width={140} height={18} borderRadius={6} />
          <View style={{ width: 32 }} />
        </View>
        <JobSkeleton />
      </View>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error && !booking) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Stack spacing="md" align="center">
          <Feather name="alert-triangle" size={32} color={colors.warning} strokeWidth={1.8} />
          <Text variant="bodyMedium" color="secondary">{error}</Text>
          <Button variant="primary" label="Retry" onPress={load} style={{ minWidth: 120 }} />
          <Button
            variant="ghost"
            label="Go back"
            onPress={() => navigation.goBack()}
          />
        </Stack>
      </View>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────

  if (!booking) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Stack spacing="md" align="center">
          <Feather name="clipboard" size={40} color={colors.textTertiary} strokeWidth={1.6} />
          <Text variant="bodyMedium" color="secondary">Booking not found.</Text>
          <Button variant="ghost" label="Go back" onPress={() => navigation.goBack()} />
        </Stack>
      </View>
    );
  }

  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

  const isDone = booking.status === 'completed';

  const FILTERS = ['all', 'pending', 'in_progress', 'completed'];
  const filterLabel = { all: 'All', pending: 'Pending', in_progress: 'In Progress', completed: 'Done' };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <Feather name="arrow-left" size={20} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {booking.service_type || 'Job'}
        </Text>
        <StatusChip status={booking.status} />
      </View>

      {/* ── Tab toggle ─────────────────────────────────────────────────────── */}
      <View style={styles.tabsRow}>
        <Tabs
          tabs={['Details', 'Status']}
          activeIndex={activeTab}
          onChange={handleTabChange}
          style={{ flex: 1 }}
        />
      </View>

      {/* ── Status filters (shown on Details tab) ──────────────────────────── */}
      {activeTab === 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            {FILTERS.map((f) => (
              <Chip
                key={f}
                label={filterLabel[f]}
                selected={activeFilter === f}
                onPress={() => setActiveFilter(f)}
              />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <Animated.View style={[{ flex: 1 }, contentStyle]}>
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
          {/* ── TAB 0: Details ─────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <Stack spacing="md">
              {/* Advancing indicator */}
              {advancing && (
                <Inline justify="center" spacing="sm">
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text variant="small" color="secondary">Updating status…</Text>
                </Inline>
              )}

              {/* Client card */}
              <Surface elevation="subtle" rounded="card" padding="base" style={styles.cardMargin}>
                <Stack spacing="xs">
                  <SectionLabel>Client</SectionLabel>
                  <Text variant="bodyMedium">{booking.client_name || 'Client'}</Text>
                  {booking.address && (
                    <Text variant="small" color="secondary">{booking.address}</Text>
                  )}
                  {date && (
                    <Text variant="small" color="secondary">
                      {date} · {new Date(booking.scheduled_date).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                  {booking.total_amount && (
                    <Text variant="smallMedium" style={{ color: colors.success, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] }}>
                      ${booking.total_amount} total
                    </Text>
                  )}
                </Stack>
              </Surface>

              {/* Employee assignment card */}
              <Surface elevation="subtle" rounded="card" padding="base" style={styles.cardMargin}>
                <Inline justify="space-between" style={{ marginBottom: spacing.sm }}>
                  <SectionLabel>Assigned Employee</SectionLabel>
                  {!isDone && (
                    <Button
                      variant="ghost"
                      label={booking.employee_id ? 'Reassign' : '+ Assign'}
                      loading={assigning}
                      onPress={() => setAssignPickerVisible(true)}
                      style={styles.assignBtnInline}
                    />
                  )}
                </Inline>
                {booking.employee_id ? (
                  <Inline spacing="md">
                    <AvatarCircle name={booking.employee_name || 'E'} isActive />
                    <Stack spacing={2} style={{ flex: 1 }}>
                      <Text variant="bodyMedium">{booking.employee_name || 'Assigned'}</Text>
                      {booking.employee_role && (
                        <Text variant="caption" color="secondary">{booking.employee_role}</Text>
                      )}
                    </Stack>
                    <Badge dot color="success" />
                  </Inline>
                ) : (
                  <Text variant="small" color="secondary">No employee assigned yet</Text>
                )}
              </Surface>

              {/* Message client */}
              <View style={styles.cardMargin}>
                <Button
                  variant="secondary"
                  label="Message client"
                  icon={<Feather name="message-circle" size={16} color={colors.textPrimary} strokeWidth={2} />}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      bookingId: booking.id,
                      otherPartyName: booking.client_name || 'Client',
                    })
                  }
                />
              </View>
            </Stack>
          )}

          {/* ── TAB 1: Status ──────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <Stack spacing="md">
              <View style={styles.cardMargin}>
                <StatusTracker bookingStatus={booking.status} onAdvance={handleAdvance} />
              </View>
              {/* Live Job Status — provider posts events; both parties see timeline */}
              <View style={styles.cardMargin}>
                <LiveStatusActions bookingId={booking.id} onEventPosted={() => load()} />
              </View>
              <View style={styles.cardMargin}>
                <LiveStatusTimeline bookingId={booking.id} />
              </View>
              <View style={styles.cardMargin}>
                <BookingPhotos bookingId={booking.id} canAttach />
              </View>
              {advancing && (
                <Inline justify="center" spacing="sm">
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text variant="small" color="secondary">Updating status…</Text>
                </Inline>
              )}

              {/* Quick-action list items */}
              <Stack spacing="xs" style={styles.cardMargin}>
                <SectionLabel>Actions</SectionLabel>
                {!isDone && (
                  <>
                    <ListItem
                      title="Advance status"
                      subtitle="Move job to the next stage"
                      left={<Feather name="play" size={16} color={colors.accentText} strokeWidth={2} />}
                      onPress={() => handleAdvance(booking.status === 'in_progress' ? 'completed' : 'on_the_way')}
                      showChevron
                    />
                    <ListItem
                      title="Reassign employee"
                      subtitle={booking.employee_id ? booking.employee_name : 'Not assigned yet'}
                      left={<Feather name="user" size={16} color={colors.textSecondary} strokeWidth={2} />}
                      onPress={() => setAssignPickerVisible(true)}
                      showChevron
                    />
                  </>
                )}
                <ListItem
                  title="Message client"
                  subtitle="Open the chat"
                  left={<Feather name="message-circle" size={16} color={colors.textSecondary} strokeWidth={2} />}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      bookingId: booking.id,
                      otherPartyName: booking.client_name || 'Client',
                    })
                  }
                  showChevron
                />
                {isDone && (
                  <ListItem
                    title="View receipt"
                    subtitle="See the invoice + download PDF"
                    left={<Feather name="file-text" size={16} color={colors.textSecondary} strokeWidth={2} />}
                    onPress={() => navigation.navigate('Invoice', { bookingId: booking.id })}
                    showChevron
                  />
                )}
                <ListItem
                  title="Report a problem"
                  subtitle="Open a dispute for this booking"
                  left={<Feather name="alert-triangle" size={16} color={colors.warning} strokeWidth={2} />}
                  onPress={() => navigation.navigate('DisputeFlow', { bookingId: booking.id })}
                  showChevron
                />
              </Stack>
            </Stack>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Employee picker modal ───────────────────────────────────────────── */}
      <Modal
        visible={assignPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAssignPickerVisible(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.modalHandle} />
          <Text variant="bodyMedium" style={{ marginBottom: spacing.base }}>Assign Employee</Text>

          {employees.length === 0 ? (
            <Stack spacing="sm" align="center" style={{ paddingVertical: spacing.xl }}>
              <Feather name="users" size={28} color={colors.textTertiary} strokeWidth={1.8} />
              <Text variant="small" color="secondary">No active employees found.</Text>
            </Stack>
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(e) => e.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const fullName = item.user
                  ? `${item.user.first_name} ${item.user.last_name}`
                  : 'Employee';
                const isCurrent = item.id === booking.employee_id;
                return (
                  <TouchableOpacity
                    style={[styles.empRow, isCurrent && styles.empRowActive]}
                    onPress={() => handleAssign(item.id)}
                    activeOpacity={0.8}
                  >
                    <AvatarCircle name={fullName} isActive={isCurrent} />
                    <Stack spacing={2} style={{ flex: 1 }}>
                      <Text variant="smallMedium">{fullName}</Text>
                      <Text variant="caption" color="secondary">{item.role_title || 'Staff'}</Text>
                    </Stack>
                    {isCurrent && (
                      <Feather name="check" size={16} color={colors.success} strokeWidth={2.4} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Jobs list — the operational hub (no bookingId — Business "Jobs" tab) ────
// CARD-24 (Kira, 2026-07-19): "they go to jobs and every job should be listed
// over there — like the past would move to invoices — and their jobs view
// they see like today's jobs or anything related to it." Grouped Today /
// Upcoming / Needs action / Past, sourced entirely from endpoints already
// used elsewhere in the app (GET /bookings/, /service-posts/, /interests/mine
// — see src/utils/jobGroups.js for the shared grouping logic, also consumed
// by DashboardScreen so the two screens can't disagree on counts).
//
// Superseded the earlier New/Quoted/Scheduled taxonomy (DQ-6 QA-07, exec-spec
// #26) — that version was never wired to the "Jobs" tab (BusinessNavigator
// pointed it at the client MyJobsScreen instead) so nothing user-facing
// regresses; this replaces it as the tab's actual destination.
//
// Row → screen routing (deliberate, see CARD-24 report for the full reasoning):
//   Today / Upcoming      → JobManagement {bookingId} (assign employee, advance
//                            status, live timeline — the operational screen)
//   Needs action / awaiting date → BookingDetails {bookingId} (has ConfirmDateCard,
//                            the actual propose/confirm-date UI, works for both roles)
//   Needs action / awaiting staff → JobManagement {bookingId} (Assign Employee modal)
//   Past                  → Invoice {bookingId} when completed (the ask: "past
//                            moves to invoices"); BookingDetails when cancelled
//                            (no invoice exists for those, but the job shouldn't vanish)

function amountLabel(n) {
  if (n === null || n === undefined) return null;
  return `$${Number(n).toLocaleString()}`;
}

function formatTime(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  } catch { return null; }
}

function formatDateShort(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  } catch { return null; }
}

function bookingClientName(b) {
  const u = b.users || {};
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Client';
}

// Today / Upcoming row — client, service, time (+ date for Upcoming),
// address when known, amount, status. Tap → the operational job screen.
function ScheduleRow({ booking, showDate, onPress }) {
  const date = bookingDate(booking);
  const address = booking.service_posts?.address;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base" style={listStyles.rowCard}>
        <Inline spacing="md">
          <Avatar name={bookingClientName(booking)} size="sm" />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" style={{ marginBottom: 2 }}>
              <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{bookingClientName(booking)}</Text>
              <StatusChip status={booking.status} />
            </Inline>
            <Text variant="small" color="secondary" numberOfLines={1}>
              {booking.service_posts?.title || booking.service_category || 'Service'}
            </Text>
            <Text variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
              {[showDate ? formatDateShort(date) : null, formatTime(date), address].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {booking.total_amount != null && (
            <Text variant="smallMedium" style={{ color: colors.success, fontFamily: 'SpaceGrotesk_700Bold' }}>
              {amountLabel(booking.total_amount)}
            </Text>
          )}
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

// Needs-action / awaiting-schedule-or-staff row.
function AwaitingActionRow({ booking, onPress }) {
  const needsDate = !bookingDate(booking);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base" style={listStyles.rowCard}>
        <Inline spacing="md">
          <Avatar name={bookingClientName(booking)} size="sm" />
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium" numberOfLines={1}>{bookingClientName(booking)}</Text>
            <Text variant="small" color="secondary" numberOfLines={1}>
              {booking.service_posts?.title || booking.service_category || 'Service'}
            </Text>
            <Text variant="caption" style={{ color: colors.warning, marginTop: 2 }}>
              {i18n.t(needsDate ? 'businessJobs.needsActionScheduleLabel' : 'businessJobs.needsActionAssignLabel')}
            </Text>
          </View>
          {booking.total_amount != null && (
            <Text variant="smallMedium" style={{ color: colors.success, fontFamily: 'SpaceGrotesk_700Bold' }}>
              {amountLabel(booking.total_amount)}
            </Text>
          )}
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

// Needs-action / quote-awaiting-response row.
function QuoteRow({ interest, onMessage }) {
  const post = interest.service_posts || {};
  const clientUser = post.users || {};
  const clientName = [clientUser.first_name, clientUser.last_name].filter(Boolean).join(' ') || 'Client';
  const canMessage = post.status === 'open' || post.status === 'matched' || interest.status === 'accepted';

  return (
    <Surface elevation="subtle" rounded="card" padding="base" style={listStyles.rowCard}>
      <Inline spacing="md">
        <Avatar name={clientName} size="sm" />
        <View style={{ flex: 1 }}>
          <Inline justify="space-between" style={{ marginBottom: 2 }}>
            <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{post.title || 'Job post'}</Text>
            <StatusChip label={i18n.t('businessJobs.needsActionQuoteBadge')} color={colors.warning} />
          </Inline>
          <Text variant="small" color="secondary">
            {clientName} · <Text variant="smallMedium" style={{ color: colors.success, fontFamily: 'SpaceGrotesk_700Bold' }}>{amountLabel(interest.quoted_price)}</Text>
          </Text>
          {!!post.address && (
            <Text variant="caption" color="secondary" numberOfLines={1}>{post.address}</Text>
          )}
          {canMessage && (
            <Button
              variant="ghost"
              label={i18n.t('businessJobs.messageAction')}
              onPress={onMessage}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.xs }}
            />
          )}
        </View>
      </Inline>
    </Surface>
  );
}

// Past row — completed jobs open their invoice; cancelled ones open
// BookingDetails since no invoice was ever generated for them.
const PAST_PAYMENT_BADGE = {
  fully_released: { label: 'Paid', color: colors.success },
  partial_released: { label: 'Partial', color: colors.accentText },
  refunded: { label: 'Refunded', color: colors.danger },
  held: { label: 'Held', color: colors.warning },
};

function PastRow({ booking, onPress }) {
  const badge = booking.status === 'completed' ? PAST_PAYMENT_BADGE[booking.payment_status] : null;
  const date = booking.completed_at || booking.confirmed_date || booking.created_at;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base" style={listStyles.rowCard}>
        <Inline spacing="md">
          <Avatar name={bookingClientName(booking)} size="sm" />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" style={{ marginBottom: 2 }}>
              <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{bookingClientName(booking)}</Text>
              <StatusChip status={booking.status} />
            </Inline>
            <Text variant="small" color="secondary" numberOfLines={1}>
              {[booking.service_posts?.title || booking.service_category || 'Service', formatDateShort(date)]
                .filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Stack spacing={2} style={{ alignItems: 'flex-end' }}>
            {booking.total_amount != null && (
              <Text variant="smallMedium" style={{ color: colors.success, fontFamily: 'SpaceGrotesk_700Bold' }}>
                {amountLabel(booking.total_amount)}
              </Text>
            )}
            {!!badge && <Text variant="caption" style={{ color: badge.color }}>{badge.label}</Text>}
          </Stack>
          <Feather name="chevron-right" size={16} color={colors.textSecondary} strokeWidth={1.8} />
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

const BUSINESS_JOB_TABS = ['today', 'upcoming', 'needsAction', 'past'];
const TAB_LABEL_KEY = {
  today: 'businessJobs.tabToday',
  upcoming: 'businessJobs.tabUpcoming',
  needsAction: 'businessJobs.tabNeedsAction',
  past: 'businessJobs.tabPast',
};

function JobsListScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [tab, setTab] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, p, i] = await Promise.all([
        api.get('/bookings/?limit=100'),
        api.get('/service-posts/').catch(() => ({ items: [] })),
        api.get('/interests/mine').catch(() => ({ items: [] })),
      ]);
      setBookings(b?.items || b || []);
      setPosts((p?.items || p || []).filter((post) => post.status === 'open'));
      setQuotes(i?.items || i || []);
    } catch (err) {
      setError(err?.message || 'Could not load jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  function openQuoteSheet(post) {
    setSelectedPost(post);
    setSheetVisible(true);
  }
  function passPost(post) {
    setDismissedIds((prev) => new Set(prev).add(post.id));
  }

  const groups = groupBusinessJobs({ bookings, posts, quotes });
  const visibleLeads = groups.needsAction.leads.filter((p) => !dismissedIds.has(p.id));
  const needsActionCount = visibleLeads.length + groups.needsAction.quotes.length + groups.needsAction.awaitingSchedule.length;

  const TAB_COUNT = {
    today: groups.today.length,
    upcoming: groups.upcoming.length,
    needsAction: needsActionCount,
    past: groups.past.length,
  };

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={listStyles.header}>
          <Text variant="display3">{i18n.t('businessJobs.title')}</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <SkeletonList count={4} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Stack spacing="md" align="center">
          <Feather name="alert-triangle" size={32} color={colors.warning} strokeWidth={1.8} />
          <Text variant="bodyMedium" color="secondary">{i18n.t('businessJobs.errorTitle')}</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>{error}</Text>
          <Button variant="primary" label={i18n.t('common.retry')} onPress={load} style={{ minWidth: 120 }} />
        </Stack>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={listStyles.header}>
        <Text variant="display3">{i18n.t('businessJobs.title')}</Text>
      </View>

      <View style={listStyles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={listStyles.filterScroll}>
          {BUSINESS_JOB_TABS.map((t) => (
            <Chip
              key={t}
              label={`${i18n.t(TAB_LABEL_KEY[t])} (${TAB_COUNT[t]})`}
              selected={tab === t}
              onPress={() => setTab(t)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={listStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {tab === 'today' && (
          groups.today.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={i18n.t('businessJobs.emptyTodayTitle')}
              body={i18n.t('businessJobs.emptyTodayBody')}
            />
          ) : (
            <Stack spacing="md">
              {groups.today.map((b) => (
                <ScheduleRow
                  key={b.id}
                  booking={b}
                  onPress={() => navigation.navigate('JobManagement', { bookingId: b.id })}
                />
              ))}
            </Stack>
          )
        )}

        {tab === 'upcoming' && (
          groups.upcoming.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={i18n.t('businessJobs.emptyUpcomingTitle')}
              body={i18n.t('businessJobs.emptyUpcomingBody')}
            />
          ) : (
            <Stack spacing="md">
              {groups.upcoming.map((b) => (
                <ScheduleRow
                  key={b.id}
                  booking={b}
                  showDate
                  onPress={() => navigation.navigate('JobManagement', { bookingId: b.id })}
                />
              ))}
            </Stack>
          )
        )}

        {tab === 'needsAction' && (
          needsActionCount === 0 ? (
            <EmptyState
              icon="check-circle"
              title={i18n.t('businessJobs.emptyNeedsActionTitle')}
              body={i18n.t('businessJobs.emptyNeedsActionBody')}
            />
          ) : (
            <Stack spacing="lg">
              {visibleLeads.length > 0 && (
                <Stack spacing="md">
                  <SectionLabel>{i18n.t('businessJobs.needsActionLeadLabel')}</SectionLabel>
                  {visibleLeads.map((post) => (
                    <JobOpportunityCard
                      key={post.id}
                      post={post}
                      onSendQuote={() => openQuoteSheet(post)}
                      onPass={() => passPost(post)}
                    />
                  ))}
                </Stack>
              )}
              {groups.needsAction.quotes.length > 0 && (
                <Stack spacing="md">
                  <SectionLabel>{i18n.t('businessJobs.needsActionQuoteSectionLabel')}</SectionLabel>
                  {groups.needsAction.quotes.map((q) => (
                    <QuoteRow
                      key={q.id}
                      interest={q}
                      onMessage={() =>
                        navigation.navigate('Chat', {
                          interestId: q.id,
                          otherPartyName: q.service_posts?.users?.first_name || 'Client',
                        })
                      }
                    />
                  ))}
                </Stack>
              )}
              {groups.needsAction.awaitingSchedule.length > 0 && (
                <Stack spacing="md">
                  <SectionLabel>{i18n.t('businessJobs.needsActionScheduleSectionLabel')}</SectionLabel>
                  {groups.needsAction.awaitingSchedule.map((b) => (
                    <AwaitingActionRow
                      key={b.id}
                      booking={b}
                      onPress={() =>
                        !bookingDate(b)
                          ? navigation.navigate('BookingDetails', { bookingId: b.id })
                          : navigation.navigate('JobManagement', { bookingId: b.id })
                      }
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          )
        )}

        {tab === 'past' && (
          groups.past.length === 0 ? (
            <EmptyState
              icon="file-text"
              title={i18n.t('businessJobs.emptyPastTitle')}
              body={i18n.t('businessJobs.emptyPastBody')}
            />
          ) : (
            <Stack spacing="md">
              {groups.past.map((b) => (
                <PastRow
                  key={b.id}
                  booking={b}
                  onPress={() =>
                    b.status === 'completed'
                      ? navigation.navigate('Invoice', { bookingId: b.id })
                      : navigation.navigate('BookingDetails', { bookingId: b.id })
                  }
                />
              ))}
            </Stack>
          )
        )}
      </ScrollView>

      <SendQuoteSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        post={selectedPost}
        onQuoted={(interest, note) => {
          load();
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

const listStyles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterRow: {
    paddingBottom: spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  rowCard: {
    marginBottom: 0,
  },
});

// ─── Default export — branches on whether a specific booking was opened ──────
// No bookingId (Business "Jobs" tab root) → the Today/Upcoming/Needs action/
// Past hub above (CARD-24). bookingId present (navigate('JobManagement',
// {bookingId}) from a Today/Upcoming/awaiting-staff row) → the per-booking
// detail/status manager, unchanged by this card.
export default function JobManagementScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  if (!bookingId) {
    return <JobsListScreen navigation={navigation} />;
  }
  return <JobDetailScreen navigation={navigation} route={route} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },

  tabsRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },

  filtersRow: {
    paddingBottom: spacing.sm,
  },
  filtersScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  content: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },

  cardMargin: {
    marginHorizontal: spacing.lg,
  },

  assignBtnInline: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 0,
  },

  errorIcon: { fontSize: 36 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    maxHeight: '70%',
    ...shadows.modal,
  },
  modalHandle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },

  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  empRowActive: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.input,
    paddingHorizontal: spacing.sm,
  },
  empCheck: { fontSize: 18 },
});
