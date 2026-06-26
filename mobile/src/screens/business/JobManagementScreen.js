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
import { SkeletonBox } from '../../components/Skeleton';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

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

function StatusChip({ status }) {
  const color = STATUS_COLORS[status] || colors.textSecondary;
  return (
    <View style={[chipStyles.wrap, {
      borderColor: withAlpha(color, '55'),
      backgroundColor: withAlpha(color, '18'),
    }]}>
      <View style={[chipStyles.dot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color }}>{STATUS_LABELS[status] || status}</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JobManagementScreen({ navigation, route }) {
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
      setBooking(bData);
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
        await api.patch(`/bookings/${bookingId}/confirm-date`);
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
            <Text variant="h2" color="secondary">←</Text>
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
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text variant="bodyMedium" color="secondary">{error}</Text>
          <Button variant="primary" label="Retry" onPress={load} style={{ minWidth: 120 }} />
          <Button
            variant="ghost"
            label="← Go back"
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
          <Text variant="display3">📋</Text>
          <Text variant="bodyMedium" color="secondary">Booking not found.</Text>
          <Button variant="ghost" label="← Go back" onPress={() => navigation.goBack()} />
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
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text variant="h2" color="secondary">←</Text>
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
                      {date}{booking.scheduled_time ? ` · ${booking.scheduled_time}` : ''}
                    </Text>
                  )}
                  {booking.total_amount && (
                    <Text variant="smallMedium" color="accent">
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
                  label="💬  Message client"
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
                      left={<Text style={{ fontSize: 18 }}>▶</Text>}
                      onPress={() => handleAdvance(booking.status === 'in_progress' ? 'completed' : 'on_the_way')}
                      showChevron
                    />
                    <ListItem
                      title="Reassign employee"
                      subtitle={booking.employee_id ? booking.employee_name : 'Not assigned yet'}
                      left={<Text style={{ fontSize: 18 }}>👤</Text>}
                      onPress={() => setAssignPickerVisible(true)}
                      showChevron
                    />
                  </>
                )}
                <ListItem
                  title="Message client"
                  subtitle="Open the chat"
                  left={<Text style={{ fontSize: 18 }}>💬</Text>}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      bookingId: booking.id,
                      otherPartyName: booking.client_name || 'Client',
                    })
                  }
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
              <Text style={{ fontSize: 28 }}>👥</Text>
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
                      <Text style={[styles.empCheck, { color: colors.success }]}>✓</Text>
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
