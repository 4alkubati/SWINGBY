import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { api } from '../../services/api';
import StatusTracker from '../../components/StatusTracker';
import LiveStatusActions from '../../components/LiveStatusActions';
import LiveLocationSharing from '../../components/LiveLocationSharing';
import LiveStatusTimeline from '../../components/LiveStatusTimeline';
import BookingPhotos from '../../components/BookingPhotos';
import Text from '../../components/Text';
import Tabs from '../../components/Tabs';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Badge from '../../components/Badge';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import ListItem from '../../components/ListItem';
import EmptyState from '../../components/EmptyState';
import SectionHeader from '../../components/SectionHeader';
import JobOpportunityCard from '../../components/JobOpportunityCard';
import SendQuoteSheet from '../../components/SendQuoteSheet';
import ReviewSubmitSheet from '../../components/ReviewSubmitSheet';
import { SkeletonBox, SkeletonList } from '../../components/Skeleton';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';
import i18n from '../../i18n';
import { bucketBooking, needsActionReason } from '../../utils/bookingBuckets';
// Shared with ProofOfWorkScreen's CTA: whichever control the business reaches
// first sends the proof AND marks the job done.
import { finishJob, FINISH_DONE } from '../../services/finishJob';
import { groupScheduledJobs, countScheduledJobs } from '../../utils/scheduleGroups';
import useQuotedPostIds from '../../hooks/useQuotedPostIds';

// How often the booking detail screen re-reads the live job-status events.
const EVENTS_POLL_MS = 8000;

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
        <View key={k} style={styles.skeletonCard}>
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

// ─── Avatar circle ────────────────────────────────────────────────────────────

function AvatarCircle({ name, isActive }) {
  return (
    <View style={[
      styles.avatarCircle,
      isActive && styles.avatarCircleActive,
    ]}>
      <Text variant="smallMedium" color="accent">{initials(name)}</Text>
    </View>
  );
}

// ─── Job detail sections ───────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <Text variant="label" color="secondary" style={{ marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

// ─── Assignee credentials (walkthrough M8) ────────────────────────────────────
// Jobs completed + tenure, both derived server-side (bookings.py::_attach_assignee)
// from real rows. A null figure is a figure we could not compute — it renders as
// NOTHING, never as "0 jobs", because a fabricated zero reads as a real (and
// damning) credential. A genuine zero is different: it's true, and it says
// "new to the team" rather than a bare numeral.
function assigneeCredentials(assignee) {
  if (!assignee || assignee.type !== 'employee') return [];
  const bits = [];
  const jobs = assignee.jobs_completed;
  if (jobs != null) {
    bits.push(jobs === 0 ? 'New to the team' : `${jobs} job${jobs === 1 ? '' : 's'} completed`);
  }
  if (assignee.tenure_label) {
    bits.push(
      assignee.business_name
        ? `${assignee.tenure_label} with ${assignee.business_name}`
        : assignee.tenure_label,
    );
  }
  return bits;
}

function AssigneeCredentials({ assignee }) {
  const bits = assigneeCredentials(assignee);
  if (bits.length === 0) return null;
  return (
    <Text variant="caption" color="secondary">{bits.join(' · ')}</Text>
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
    <View style={[styles.statusChip, {
      borderColor: withAlpha(color, '55'),
      backgroundColor: withAlpha(color, '18'),
    }]}>
      <View style={[styles.statusChipDot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color }}>{text}</Text>
    </View>
  );
}

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
  const [reviewSheetVisible, setReviewSheetVisible] = useState(false);
  // Local-only: backend still enforces one review per (booking, reviewer) —
  // this just hides the action immediately after a successful submit so the
  // owner isn't invited to double-tap it in the same session.
  const [justReviewed, setJustReviewed] = useState(false);
  // Walkthrough bug 8: the Progress tab used to render the exact same "Add
  // photo" / "Send proof to client" controls whether or not proof had
  // already been sent, so a business had no way to tell their submission
  // went through. 'draft' | 'submitted' | 'approved' | null (not loaded /
  // load failed — falls back to the draft-shaped controls, same as today).
  const [proofStatus, setProofStatus] = useState(null);

  // View state
  const [activeTab, setActiveTab] = useState(0); // 0 = Details, 1 = Status

  // Cross-fade for the tab content
  const contentOpacity = useSharedValue(1);

  const load = useCallback(async () => {
    setError(null);
    try {
      // M8: the roster comes from the BOOKING, not from `GET /employees/`.
      // That list holds invited staff only — never the owner — which is why a
      // solo business saw "No active employees found." and could not assign
      // the job to anyone. `/assignees` always includes the owner.
      const [bData, roster, proofData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get(`/bookings/${bookingId}/assignees`).catch(() => null),
        // Same endpoint ProofOfWorkScreen reads. Non-fatal like /assignees —
        // this only feeds the Progress tab's submitted/approved indicator,
        // it must not take the whole booking screen down if it 404s.
        api.get(`/bookings/${bookingId}/proof`).catch(() => null),
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
      setEmployees(roster?.items || []);
      setProofStatus(proofData?.status || null);
    } catch (err) {
      setError(err?.message || 'Could not load job details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // ── Live job status — ONE fetch, one source of truth ───────────────────────
  // The tracker, the action button and the timeline all render the same
  // booking. They used to get their state from three different places: the
  // tracker from `booking.status`, and the other two from a GET each held
  // privately. Nothing synced them, so on 2026-07-29 the timeline listed three
  // "On the way" entries while the button above it still offered "On my way".
  // The events live here now and are passed down. Polling stays on this screen
  // for the same reason — one timer, not one per component.
  const [events, setEvents] = useState([]);
  const [eventsStatus, setEventsStatus] = useState('loading'); // loading|ready|error
  const eventsAlive = useRef(true);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.get(`/bookings/${bookingId}/events`);
      if (!eventsAlive.current) return;
      setEvents(res.items || []);
      setEventsStatus('ready');
    } catch {
      if (!eventsAlive.current) return;
      // A failed poll must not blank a timeline that already loaded.
      setEventsStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, [bookingId]);

  useEffect(() => {
    eventsAlive.current = true;
    loadEvents();
    const id = setInterval(loadEvents, EVENTS_POLL_MS);
    return () => {
      eventsAlive.current = false;
      clearInterval(id);
    };
  }, [loadEvents]);

  // Tab switch animation
  function handleTabChange(index) {
    contentOpacity.value = withTiming(0, { duration: 80 }, () => {
      contentOpacity.value = withTiming(1, { duration: motion.entryDuration });
    });
    setActiveTab(index);
  }

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // `stage` is an event type from jobStages.FLOW — whichever stage the control
  // that called this is actually offering. It used to ignore its argument and
  // post a hardcoded `en_route` for everything short of completion, which is
  // half of why the same event could be appended over and over.
  async function handleAdvance(stage) {
    setAdvancing(true);
    try {
      if (stage === 'completed') {
        // ONE "I'm done" (walkthrough item 2). This used to PATCH /complete
        // and nothing else, so a business that had already loaded photos onto
        // ProofOfWorkScreen but not tapped its separate send button finished
        // the job WITHOUT them — the client then approved, or the 24h window
        // released, against no evidence at all. finishJob sends any submittable
        // proof first; it is the same call ProofOfWorkScreen's CTA makes, so
        // the two controls cannot produce different outcomes.
        //
        // /complete still writes the `completed` event itself, and since
        // 2026-07-31 it NO LONGER releases the money: it opens a 24h window for
        // the client to approve. Say so, rather than let the business assume
        // they have just been paid.
        const res = await finishJob(bookingId);
        if (res.approvalDeadlineAt) {
          Alert.alert(
            i18n.t('approval.businessWaitingTitle'),
            res.outcome === FINISH_DONE
              ? i18n.t('approval.businessWaitingBodyProof')
              : i18n.t('approval.businessWaitingBody'),
          );
        }
      } else {
        await api.post(`/bookings/${bookingId}/events`, { event_type: stage });
      }
      // Both the booking and the events — the status badge and the tracker
      // must not be able to describe different stages.
      await Promise.all([load(), loadEvents()]);
    } catch (err) {
      // The half-failure — photos on the record, job not done — is the frozen
      // money state, so it never shares the generic status-update copy.
      Alert.alert(
        err?.proofSentButNotComplete
          ? i18n.t('finish.halfDoneTitle')
          : 'Error',
        err?.response?.data?.detail || err.message || 'Could not update status.',
      );
    } finally {
      setAdvancing(false);
    }
  }

  // `employeeId` may be the literal 'owner' — the backend materialises the
  // owner's own employees row on demand, so an owner with no staff can always
  // put themselves on the job.
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

  // M8. `assignee` is derived server-side (bookings.py::_attach_assignee) so
  // the business name / person name / job count / tenure are never guessed here.
  const assignee = booking.assignee;
  const isAssigned = !!booking.employee_id && assignee?.type === 'employee';
  const assigneeName =
    (isAssigned ? assignee?.name || booking.employee_name : assignee?.name)
    || booking.businesses?.business_name
    || 'Your business';
  // Assigning is possible BEFORE the date handshake closes — the owner decides
  // who is going first. Only terminal jobs are locked (mirrors the backend's
  // deny-list in assign_employee).
  const canAssign = !isDone && booking.status !== 'cancelled';

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
      {/* "Status" was the wrong word twice over: this tab renders a
          StatusTracker of how far the JOB has got, and the header directly
          above already carries a StatusChip showing booking.status. One screen,
          two different meanings of "status". "Progress" says what the tab
          actually shows and stops it colliding with the chip. */}
      <View style={styles.tabsRow}>
        <Tabs
          tabs={['Details', 'Progress']}
          activeIndex={activeTab}
          onChange={handleTabChange}
          style={{ flex: 1 }}
        />
      </View>

      {/* A second, hand-rolled Chip filter row used to sit here. It filtered
          nothing — this screen shows ONE booking — and it was the file's second
          tab idiom. Removed: `Tabs` above is now the only one. */}

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
                  {/* See ActiveBookingScreen: a bare `x &&` on a numeric field
                      renders 0 as a loose text node and red-boxes the app.
                      D19: green + "paid out" ONLY once it has actually been
                      released. Escrow is the client's money until then, and
                      still gross — see businessAmount(). */}
                  {businessAmount(booking).amount > 0 && (
                    <Text variant="smallMedium" style={{ color: businessAmount(booking).received ? colors.success : colors.textSecondary, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] }}>
                      ${businessAmount(booking).amount} {businessAmount(booking).received ? 'paid out' : 'in escrow'}
                    </Text>
                  )}
                </Stack>
              </Surface>

              {/* Who's going — walkthrough M8.
                  Until somebody is assigned this reads as the BUSINESS (the
                  client hired the company, and that is who is on the hook), not
                  as an empty slot. Once assigned it reads as that person, with
                  the credentials the server derived for them. */}
              <Surface elevation="subtle" rounded="card" padding="base" style={styles.cardMargin}>
                <Inline justify="space-between" style={{ marginBottom: spacing.sm }}>
                  <SectionLabel>{isAssigned ? 'Assigned to' : "Who's going"}</SectionLabel>
                  {canAssign && (
                    <Button
                      variant="ghost"
                      label={isAssigned ? 'Reassign' : '+ Assign'}
                      loading={assigning}
                      onPress={() => setAssignPickerVisible(true)}
                      style={styles.assignBtnInline}
                    />
                  )}
                </Inline>
                <Inline spacing="md">
                  <AvatarCircle name={assigneeName} isActive={isAssigned} />
                  <Stack spacing={2} style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{assigneeName}</Text>
                    {isAssigned ? (
                      <>
                        {!!(assignee?.role_title || booking.employee_role) && (
                          <Text variant="caption" color="secondary">
                            {assignee?.role_title || booking.employee_role}
                          </Text>
                        )}
                        <AssigneeCredentials assignee={assignee} />
                      </>
                    ) : (
                      <Text variant="caption" color="secondary">
                        Nobody assigned yet — the job sits with the business.
                      </Text>
                    )}
                  </Stack>
                  {isAssigned && <Badge dot color="success" />}
                </Inline>
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
              {/* The tracker and the card below it read the SAME `events`
                  array, fetched once by this screen. This tab used to stack
                  two cards both headed "Live status" over two independent
                  fetches, plus a tracker reading `booking.status`. */}
              {/* P1 — the tracker SHOWS progress; the button in the card below
                  is the only thing that changes it. It used to be tappable and
                  to hint "Tap 'On the way'" right above a CTA that did the same
                  transition. */}
              <StatusTracker events={events} />
              {/* ONE "Live status" card: next step on top, timeline beneath. */}
              <View style={styles.cardMargin}>
                <Surface elevation="subtle" rounded="card" padding="base">
                  <Stack spacing="md">
                    <Text variant="bodyMedium">Live status</Text>
                    <LiveStatusActions
                      events={events}
                      onAdvance={handleAdvance}
                      busy={advancing}
                    />
                    <LiveStatusTimeline events={events} status={eventsStatus} />
                  </Stack>
                </Surface>
              </View>
              {/* Renders nothing unless this provider opened the en-route window
                  themselves by tapping "On my way" above — so it costs no space
                  on a job that is not in motion. */}
              <View style={styles.cardMargin}>
                <LiveLocationSharing bookingId={booking.id} bookingStatus={booking.status} />
              </View>
              {/* Proof of work — ONE region. The route into ProofOfWorkScreen
                  used to be a separate "Proof of work" row down in Actions,
                  identically titled to the card BookingPhotos draws, so the
                  screen showed the same name twice for two different things.
                  It sits with the card it belongs to now.

                  Not deleted, despite the photos card looking like it covers
                  this: ProofOfWorkScreen is the capture-and-send flow (before/
                  after plus a voice memo — sending it is what makes the job
                  approvable, but only once this booking is also marked
                  complete below; see the proofStatus block underneath), and
                  this is still its ONLY route. Dropping the row would stand
                  the screen back up with nothing navigating to it — the bug
                  it was added to fix. */}
              <View style={styles.cardMargin}>
                <Stack spacing="xs">
                  {/* Locking Add once submitted mirrors ProofOfWorkScreen's own
                      AddTile (disabled={alreadySubmitted}) — without this, a
                      business could keep attaching photos here after sending
                      proof, silently past the set the client is reviewing. */}
                  <BookingPhotos
                    bookingId={booking.id}
                    canAttach={proofStatus !== 'submitted' && proofStatus !== 'approved'}
                  />
                  {/* Walkthrough bug 8: this row used to read "Send proof to
                      client" forever, even after the provider had already sent
                      it — nothing distinguished "not sent yet" from "sent,
                      waiting on the client" from "approved". Same ListItem,
                      state-aware now; still opens ProofOfWorkScreen either way
                      so a business can review what they sent. */}
                  {proofStatus === 'submitted' ? (
                    <ListItem
                      title={i18n.t('proof.progress.submittedTitle')}
                      subtitle={i18n.t('proof.progress.submittedSubtitle')}
                      left={<Feather name="clock" size={16} color={colors.textSecondary} strokeWidth={2} />}
                      right={<StatusBadge label={i18n.t('proof.progress.submittedBadge')} tone="warning" />}
                      onPress={() => navigation.navigate('ProofOfWork', { bookingId: booking.id })}
                    />
                  ) : proofStatus === 'approved' ? (
                    <ListItem
                      title={i18n.t('proof.progress.approvedTitle')}
                      subtitle={i18n.t('proof.progress.approvedSubtitle')}
                      left={<Feather name="check-circle" size={16} color={colors.success} strokeWidth={2} />}
                      right={<StatusBadge label={i18n.t('proof.progress.approvedBadge')} tone="success" />}
                      onPress={() => navigation.navigate('ProofOfWork', { bookingId: booking.id })}
                    />
                  ) : (
                    <ListItem
                      title="Send proof to client"
                      subtitle="Before/after photos and a voice note"
                      left={<Feather name="camera" size={16} color={colors.textSecondary} strokeWidth={2} />}
                      onPress={() => navigation.navigate('ProofOfWork', { bookingId: booking.id })}
                      showChevron
                    />
                  )}
                </Stack>
              </View>
              {advancing && (
                <Inline justify="center" spacing="sm">
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text variant="small" color="secondary">Updating status…</Text>
                </Inline>
              )}

              {/* Quick-action list items.
                  "Advance status" is gone: it advanced the job, exactly like
                  the tracker at the top of this tab, and did it by posting a
                  hardcoded `en_route` whatever stage the job was on. Two
                  controls for one action, one of them wrong. The tracker is
                  the one control now. */}
              <Stack spacing="xs" style={styles.cardMargin}>
                <SectionLabel>Actions</SectionLabel>
                {canAssign && (
                  <ListItem
                    title={isAssigned ? 'Reassign this job' : 'Assign this job'}
                    subtitle={isAssigned ? assigneeName : 'Pick who is going'}
                    left={<Feather name="user" size={16} color={colors.textSecondary} strokeWidth={2} />}
                    onPress={() => setAssignPickerVisible(true)}
                    showChevron
                  />
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
                {isDone && !justReviewed && (
                  <ListItem
                    title="Review client"
                    subtitle="Rate how this job went"
                    left={<Feather name="star" size={16} color={colors.textSecondary} strokeWidth={2} />}
                    onPress={() => setReviewSheetVisible(true)}
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
                {/* The business could not cancel AT ALL until 2026-07-30 — the
                    route was registered only in ClientNavigator, so every
                    business-side rung of the published cancellation ladder
                    (penalty + the client's goodwill credit) was unreachable and a
                    provider who genuinely could not make it had to phone. The
                    backend always allowed it: cancel_booking derives the actor
                    from the caller's role and refuses only completed/cancelled. */}
                {!isDone && booking.status !== 'cancelled' && (
                  <ListItem
                    title="Cancel this job"
                    subtitle="The client is refunded in full; a penalty may apply to you"
                    left={<Feather name="x-circle" size={16} color={colors.danger} strokeWidth={2} />}
                    onPress={() =>
                      navigation.navigate('CancellationFlow', {
                        bookingId: booking.id,
                        scheduledDate: booking.confirmed_date || booking.proposed_date_1,
                        quotedPrice: booking.total_amount,
                      })
                    }
                    showChevron
                  />
                )}
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
          <Text variant="bodyMedium" style={{ marginBottom: spacing.base }}>Assign this job</Text>

          {/* M8: this list is never empty. The owner is always in it (the server
              materialises their staffing row), so the old "No active employees
              found." dead end — which left a solo business unable to assign a
              job to anybody, including themselves — cannot happen. The fallback
              below only fires if the roster request itself failed, and it still
              offers the one assignment that always works. */}
          {employees.length === 0 ? (
            <Stack spacing="md" align="center" style={{ paddingVertical: spacing.lg }}>
              <Feather name="user-check" size={28} color={colors.textTertiary} strokeWidth={1.8} />
              <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>
                We couldn&apos;t load your team just now.
              </Text>
              <Button
                variant="primary"
                label="Assign to me"
                onPress={() => handleAssign('owner')}
              />
            </Stack>
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(e) => e.employee_id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const fullName = item.name || (item.is_you ? 'You' : 'Team member');
                const isCurrent = item.employee_id === booking.employee_id;
                const credentials = assigneeCredentials(item);
                return (
                  <TouchableOpacity
                    style={[styles.empRow, isCurrent && styles.empRowActive]}
                    onPress={() => handleAssign(item.employee_id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Assign to ${fullName}`}
                  >
                    <AvatarCircle name={fullName} isActive={isCurrent} />
                    <Stack spacing={2} style={{ flex: 1 }}>
                      <Inline spacing="xs">
                        <Text variant="smallMedium">{fullName}</Text>
                        {item.is_you && <StatusBadge label="You" tone="accent" />}
                      </Inline>
                      <Text variant="caption" color="secondary">
                        {item.role_title || (item.is_owner ? 'Owner' : 'Staff')}
                      </Text>
                      {credentials.length > 0 && (
                        <Text variant="caption" color="secondary">{credentials.join(' · ')}</Text>
                      )}
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

      {/* Business → client review — GAP-AUDIT M3: ReviewSubmitSheet existed
          but was mounted nowhere. This is the business-side counterpart to
          the client's ReviewScreen (client -> business/employee). */}
      <ReviewSubmitSheet
        visible={reviewSheetVisible}
        onClose={() => setReviewSheetVisible(false)}
        bookingId={booking.id}
        revieweeName={booking.client_name || 'Client'}
        onSubmitted={() => setJustReviewed(true)}
      />
    </View>
  );
}

// ─── Jobs list — the operational hub (no bookingId — Business "Jobs" tab) ─────
// CARD-24, Kira's product call 2026-07-19: "they go to jobs and every job
// should be listed over there — like the past would move to invoices — and
// their jobs view they see like today's jobs or anything related to it."
// Replaces the earlier New/Quoted/Scheduled lead-triage tabs (DQ-6 QA-07)
// with groupings built around what a working owner needs *today*. As of D7
// there are three: Scheduled (default), Needs action, Past. New leads +
// bookings-awaiting-a-date fold into Needs action; every live job — dated or
// not — is on Scheduled, one band per day; completed/cancelled fall into
// Past, each one linking to its invoice. Bucketing logic lives in
// utils/bookingBuckets.js so these counts always match the Dashboard's.
// New-lead cards + the send-quote sheet still come from DashboardScreen
// (JobOpportunityCard + SendQuoteSheet) — reused, not rebuilt. Tapping any
// row still opens the existing per-booking JobDetailScreen above via the
// same route (`JobManagement`, {bookingId}) — nothing about the
// detail/status/review flow above changes.

// Sent quotes no longer appear in Jobs at all — they live behind the Quotes
// bubble on Messages (design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md §5a:
// "Business Jobs no longer lists pending quotes at all. A job lands in Jobs on
// acceptance."). This also closes walkthrough B11: the same lead used to render
// twice — once as a "New request" opportunity card still offering "Send quote",
// and again below under "Quotes awaiting response" — which is why re-quoting
// answered "You already expressed interest in this post" (B12). Interests are
// still fetched, but only to know which posts this business has already quoted.

const NEEDS_ACTION_REASON_KEY = {
  unassigned: 'jobManagement.needsActionUnassigned',
  proposeDate: 'jobManagement.needsActionProposeDate',
  awaitingDate: 'jobManagement.needsActionAwaitingDate',
};

// D7 — the tabs used to be Today / Upcoming / Needs action / Past. Today and
// Upcoming were the same list split at midnight, and the split cost the owner
// a tap to see tomorrow. They are now ONE "Scheduled" list, first and default,
// spanning ~3 months and grouped by day — so "Today" is the heading you land
// on and "Tomorrow" is the next one down, no tab switching (walkthrough D7,
// Kira 2026-07-24). Grouping rules + the undated/horizon decisions live in
// utils/scheduleGroups.js.
//
// Three tabs, not five: `components/Tabs` is a fixed-width segmented control
// (each tab is flex:1), and five labels-with-counts clip on a phone. Today and
// Upcoming survive as the first groups of Scheduled, and as route params —
// see FILTER_ALIAS, which keeps the Dashboard's existing
// `navigate('Jobs', {filter: 'today'})` deep link landing somewhere sane.
const LIST_FILTERS = ['scheduled', 'needsAction', 'past'];

// Old filter names still arriving from deep links / saved params.
const FILTER_ALIAS = { today: 'scheduled', upcoming: 'scheduled' };

function resolveFilter(name) {
  const resolved = FILTER_ALIAS[name] || name;
  return LIST_FILTERS.includes(resolved) ? resolved : 'scheduled';
}

// Headings for the Scheduled day groups. scheduleGroups.js returns a `kind`
// and stays string-free so it carries no locale; the words are chosen here.
// `defaultValue` is used for the keys that are not in i18n.js yet — that file
// belongs to another lane this cycle, and this way adding the keys later turns
// the translations on with no code change.
function scheduleGroupHeading(group) {
  switch (group.kind) {
    case 'undated':
      return i18n.t('jobManagement.groupUndated', { defaultValue: 'Date not set' });
    case 'today':
      return i18n.t('jobManagement.filterToday');
    case 'tomorrow':
      return i18n.t('jobManagement.groupTomorrow', { defaultValue: 'Tomorrow' });
    case 'later':
      return i18n.t('jobManagement.groupLater', { defaultValue: 'Later' });
    default:
      return formatRowDate(group.date);
  }
}

function jobClientName(booking) {
  return booking.users?.first_name
    ? [booking.users.first_name, booking.users.last_name].filter(Boolean).join(' ')
    : (booking.client_name || 'Client');
}

// F090/F104: these rows used to render booking.total_amount — the client's
// GROSS charge — in success-green. The business's actual take is total_amount
// minus SwingBy's 10% cut, and BusinessInvoicesScreen already solved this by
// reading the backend's honest payment_state block instead of the raw
// booking total. Same fix, same source of truth, applied here.
//
// D19 (2026-08-11) — the first pass returned `released || held` as one number
// and every caller painted it success-green, i.e. "this is yours". That is only
// true of `amount_released`. `amount_held` is escrow: money the CLIENT has paid
// that has NOT moved to the business, and it is still GROSS — the 10% comes out
// when it releases, so the eventual payout is strictly less than the figure
// shown. Green said "received and netted" about money that was neither.
//
// Mobile cannot net it itself: `payment_state` (bookings.py::_payment_state)
// exposes amount_due / held / released / total and NO platform_cut, and
// hardcoding 10% here would fork escrow.PLATFORM_RATE into the client, which is
// how these numbers drifted apart in the first place. So the honest move is to
// report the STATE accurately rather than invent the arithmetic: callers get
// `received` and colour on it.
export function businessAmount(booking) {
  const ps = booking.payment_state || {};
  const released = Number(ps.amount_released || 0);
  const held = Number(ps.amount_held || 0);
  if (released > 0) return { amount: released, received: true };
  return { amount: held, received: false };
}

// Kept as the value-only form for existing callers/tests. Prefer
// businessAmount() at any site that colours or labels the figure.
export function paidToBusiness(booking) {
  return businessAmount(booking).amount;
}

function formatRowTime(date) {
  return date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
function formatRowDate(date) {
  return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Today/Upcoming row — what a working owner needs at a glance: client,
// service, time, address, status, amount.
function JobRow({ booking, showDate, onPress }) {
  const service = booking.service_posts?.title || booking.service_category || 'Service';
  const address = booking.service_posts?.address;
  const when = booking.confirmed_date ? new Date(booking.confirmed_date) : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline justify="space-between" style={{ marginBottom: spacing.xs }}>
          <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{jobClientName(booking)}</Text>
          <StatusChip status={booking.status} />
        </Inline>
        <Text variant="small" color="secondary" numberOfLines={1}>{service}</Text>
        <Inline justify="space-between" style={{ marginTop: spacing.xs }}>
          <Inline spacing="xs" style={{ flex: 1 }}>
            <Feather name="clock" size={12} color={colors.textTertiary} strokeWidth={2} />
            <Text variant="caption" color="secondary">
              {when ? (showDate ? `${formatRowDate(when)} · ${formatRowTime(when)}` : formatRowTime(when)) : '—'}
            </Text>
          </Inline>
          {businessAmount(booking).amount > 0 && (
            <Text variant="smallMedium" style={{ color: businessAmount(booking).received ? colors.success : colors.textSecondary, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] }}>
              ${businessAmount(booking).amount}{businessAmount(booking).received ? '' : ' held'}
            </Text>
          )}
        </Inline>
        {!!address && (
          <Inline spacing="xs" style={{ marginTop: spacing.xs }}>
            <Feather name="map-pin" size={12} color={colors.textTertiary} strokeWidth={2} />
            <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>{address}</Text>
          </Inline>
        )}
        {/* M8: who is going, at a glance. Unassigned jobs say so plainly rather
            than leaving the row silent about it. */}
        <Inline spacing="xs" style={{ marginTop: spacing.xs }}>
          <Feather name="user" size={12} color={colors.textTertiary} strokeWidth={2} />
          <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {booking.assignee?.type === 'employee' && booking.assignee?.name
              ? booking.assignee.name
              : 'Unassigned'}
          </Text>
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

// Needs Action row — a confirmed booking blocked on the owner (no employee
// assigned yet, or a date handshake that hasn't closed).
function ActionBookingRow({ booking, onPress }) {
  const service = booking.service_posts?.title || booking.service_category || 'Service';
  const reasonKey = NEEDS_ACTION_REASON_KEY[needsActionReason(booking)];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline justify="space-between" style={{ marginBottom: spacing.xs }}>
          <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{jobClientName(booking)}</Text>
          <StatusChip label={i18n.t(reasonKey)} color={colors.warning} />
        </Inline>
        <Text variant="small" color="secondary" numberOfLines={1}>{service}</Text>
      </Surface>
    </TouchableOpacity>
  );
}

// Past row — completed/cancelled. Completed jobs link straight to their
// invoice ("the past would move to invoices" — Kira).
function PastJobRow({ booking, onPress }) {
  const service = booking.service_posts?.title || booking.service_category || 'Service';
  const when = booking.confirmed_date ? new Date(booking.confirmed_date) : null;
  const isCompleted = booking.status === 'completed';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline justify="space-between" style={{ marginBottom: spacing.xs }}>
          <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>{jobClientName(booking)}</Text>
          <StatusChip status={booking.status} />
        </Inline>
        <Inline justify="space-between">
          <Text variant="small" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {service}{when ? ` · ${formatRowDate(when)}` : ''}
          </Text>
          {businessAmount(booking).amount > 0 && (
            <Text variant="smallMedium" style={{ color: businessAmount(booking).received ? colors.success : colors.textSecondary, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] }}>
              ${businessAmount(booking).amount}{businessAmount(booking).received ? '' : ' held'}
            </Text>
          )}
        </Inline>
        {isCompleted && (
          <Button
            variant="ghost"
            label={i18n.t('jobManagement.viewInvoice')}
            onPress={onPress}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.xs }}
          />
        )}
      </Surface>
    </TouchableOpacity>
  );
}

// A titled band with a count and a hairline rule above it, so the boundaries
// between stacked lists are visible at a glance. Used twice:
//   * "Needs action", which stacks two queues — new leads and bookings blocked
//     on the owner. (It used to stack a third, "quotes awaiting response";
//     sent quotes now live behind the Quotes bubble on Messages.)
//   * "Scheduled", where each band is one day — "Today", "Tomorrow", then
//     dated (D7).
function ActionGroup({ label, count, first, children }) {
  return (
    <View style={!first && styles.actionGroupDivided}>
      <SectionHeader title={label} count={count} style={{ marginBottom: spacing.md }} />
      <Stack spacing="md">{children}</Stack>
    </View>
  );
}

function JobsListScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  // Post ids this business has already quoted on. Not rendered — used purely
  // to keep an already-quoted lead out of "New leads" (B11/B12). Shared with
  // the Dashboard through hooks/useQuotedPostIds (B10).
  const { quotedPostIds, syncFromInterests, markQuoted } = useQuotedPostIds();
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const [filter, setFilter] = useState(resolveFilter(route?.params?.filter));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, i, b] = await Promise.all([
        api.get('/service-posts/').catch(() => ({ items: [] })),
        api.get('/interests/mine').catch(() => ({ items: [] })),
        api.get('/bookings/').catch(() => ({ items: [] })),
      ]);
      const openPosts = (p?.items || p || []).filter((post) => post.status === 'open');
      setPosts(openPosts);
      // A lead I have ALREADY quoted is not a lead. It used to stay in the
      // feed offering "Send quote" a second time (which the API rejects with
      // "You already expressed interest in this post" — B12) while also
      // appearing below as "Quotes awaiting response" — B11's two states from
      // one row. The quote itself now lives on Messages, behind the bubble.
      syncFromInterests(i);
      setBookings(b?.items || b || []);
    } catch (err) {
      setError(err?.message || 'Could not load jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncFromInterests]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  // Deep-link from the Dashboard's "needs action" / "today" surfaces — jump
  // straight to the relevant tab, then clear the param so switching tabs
  // manually afterward doesn't keep getting overridden.
  useEffect(() => {
    if (route?.params?.filter) {
      setFilter(resolveFilter(route.params.filter));
      navigation.setParams({ filter: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.filter]);

  const visiblePosts = posts.filter((p) => !dismissedIds.has(p.id) && !quotedPostIds.has(p.id));

  // D7 — one Scheduled list, ~3 months, grouped by day. Empty days produce no
  // header; undated jobs lead the list; anything past the horizon lands in a
  // trailing "Later" group. See utils/scheduleGroups.js for the reasoning.
  const scheduleGroups = groupScheduledJobs(bookings);
  const scheduledCount = countScheduledJobs(scheduleGroups);
  const needsActionBookings = bookings.filter((b) => bucketBooking(b) === 'needsAction');
  const pastJobs = bookings
    .filter((b) => bucketBooking(b) === 'past')
    .sort((a, b) => new Date(b.confirmed_date || b.created_at || 0) - new Date(a.confirmed_date || a.created_at || 0));

  function openQuoteSheet(post) {
    setSelectedPost(post);
    setSheetVisible(true);
  }
  function passPost(post) {
    setDismissedIds((prev) => new Set(prev).add(post.id));
  }
  function openBooking(bookingId) {
    navigation.navigate('JobManagement', { bookingId });
  }

  const FILTER_LABEL = {
    scheduled: i18n.t('jobManagement.filterScheduled', { defaultValue: 'Scheduled' }),
    needsAction: i18n.t('jobManagement.filterNeedsAction'),
    past: i18n.t('jobManagement.filterPast'),
  };
  const needsActionCount = visiblePosts.length + needsActionBookings.length;
  const FILTER_COUNT = {
    scheduled: scheduledCount,
    needsAction: needsActionCount,
    past: pastJobs.length,
  };

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.listHeader}>
          <Text variant="display3">{i18n.t('jobManagement.title')}</Text>
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
          <Text variant="bodyMedium" color="secondary">{i18n.t('jobManagement.errorTitle')}</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center' }}>{error}</Text>
          <Button variant="primary" label={i18n.t('common.retry')} onPress={load} style={{ minWidth: 120 }} />
        </Stack>
      </View>
    );
  }

  const needsActionGroups = [];
  if (visiblePosts.length > 0) {
    needsActionGroups.push({
      key: 'leads',
      label: i18n.t('jobManagement.needsActionNewLeads'),
      count: visiblePosts.length,
      items: visiblePosts.map((post) => (
        <JobOpportunityCard
          key={post.id}
          post={post}
          onSendQuote={() => openQuoteSheet(post)}
          onPass={() => passPost(post)}
        />
      )),
    });
  }
  if (needsActionBookings.length > 0) {
    needsActionGroups.push({
      key: 'bookings',
      label: i18n.t('jobManagement.needsActionBookings'),
      count: needsActionBookings.length,
      items: needsActionBookings.map((b) => (
        <ActionBookingRow key={b.id} booking={b} onPress={() => openBooking(b.id)} />
      )),
    });
  }
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.listHeader}>
        <Text variant="display3">{i18n.t('jobManagement.title')}</Text>
      </View>

      {/* Segmented control per the JobManagementScreen mock — same `Tabs`
          component the client's My Jobs uses, so "switch the list" looks
          identical on both sides of the marketplace. */}
      <View style={styles.listTabsRow}>
        <Tabs
          tabs={LIST_FILTERS.map((f) => `${FILTER_LABEL[f]} (${FILTER_COUNT[f]})`)}
          activeIndex={LIST_FILTERS.indexOf(filter)}
          onChange={(idx) => setFilter(LIST_FILTERS[idx])}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* D7 — Scheduled: the default landing tab. One list, ~3 months,
            one band per day. Days with nothing on them are never rendered;
            the grouping is built from the jobs, so there is no such thing as
            an empty header here. */}
        {filter === 'scheduled' && (
          scheduledCount === 0 ? (
            <EmptyState
              icon="calendar"
              title={i18n.t('jobManagement.emptyUpcomingTitle')}
              body={i18n.t('jobManagement.emptyUpcomingBody')}
            />
          ) : (
            <Stack spacing="lg">
              {scheduleGroups.map((group, i) => (
                <ActionGroup
                  key={group.key}
                  label={scheduleGroupHeading(group)}
                  count={group.jobs.length}
                  first={i === 0}
                >
                  {group.jobs.map((b) => (
                    group.kind === 'undated'
                      // No confirmed date means no day to file it under, so
                      // the row leads with WHY (unassigned / propose a date /
                      // awaiting the client) instead of a blank time.
                      ? <ActionBookingRow key={b.id} booking={b} onPress={() => openBooking(b.id)} />
                      : (
                        <JobRow
                          key={b.id}
                          booking={b}
                          // The band header already carries the date; only the
                          // horizon overflow group needs it back on the row.
                          showDate={group.kind === 'later'}
                          onPress={() => openBooking(b.id)}
                        />
                      )
                  ))}
                </ActionGroup>
              ))}
            </Stack>
          )
        )}

        {filter === 'needsAction' && (
          <Stack spacing="lg">
            {needsActionCount === 0 ? (
              <EmptyState
                icon="check-circle"
                title={i18n.t('jobManagement.emptyNeedsActionTitle')}
                body={i18n.t('jobManagement.emptyNeedsActionBody')}
              />
            ) : (
              <Stack spacing="lg">
                {needsActionGroups.map((g, i) => (
                  <ActionGroup key={g.key} label={g.label} count={g.count} first={i === 0}>
                    {g.items}
                  </ActionGroup>
                ))}
              </Stack>
            )}

            {/* Where the sent quotes went. Jobs deliberately no longer lists
                them — one line so nobody hunts for a quote that "disappeared". */}
            <Inline spacing="sm" align="flex-start">
              <Feather name="info" size={13} color={colors.textTertiary} strokeWidth={1.8} />
              <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                {i18n.t('jobManagement.sentQuotesMoved')}
              </Text>
            </Inline>
          </Stack>
        )}

        {filter === 'past' && (
          pastJobs.length === 0 ? (
            <EmptyState
              icon="archive"
              title={i18n.t('jobManagement.emptyPastTitle')}
              body={i18n.t('jobManagement.emptyPastBody')}
            />
          ) : (
            <Stack spacing="md">
              {pastJobs.map((b) => (
                <PastJobRow
                  key={b.id}
                  booking={b}
                  onPress={() =>
                    b.status === 'completed'
                      ? navigation.navigate('Invoice', { bookingId: b.id })
                      : openBooking(b.id)
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
          // B12 — collapse the lead the instant the quote is sent, without
          // waiting on the refetch below to come back (or on the write to be
          // readable). It is now a sent quote, and sent quotes live on
          // Messages behind the Quotes bubble.
          markQuoted(interest?.post_id || selectedPost?.id);
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

// ─── Default export — branches on whether a specific booking was opened ──────
// No bookingId (Business "Jobs" tab root, CARD-24) → the operational-hub
// feed above (Today/Upcoming/Needs action/Past). bookingId present (from a
// row's onPress here, or from MyJobsScreen/Dashboard) → unchanged per-booking
// detail/status manager.
export default function JobManagementScreen({ navigation, route }) {
  const { bookingId } = route.params || {};
  if (!bookingId) {
    return <JobsListScreen navigation={navigation} route={route} />;
  }
  return <JobDetailScreen navigation={navigation} route={route} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// One StyleSheet for the whole file. This used to be five separate blocks
// (skeleton / avatar / chip / list / screen) scattered between the components
// they styled, which made it impossible to see what the file actually defines.

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

  // Loading skeleton
  skeletonCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },

  // Avatar circle
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.avatar,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },

  // Status chip
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Jobs list (no bookingId)
  listHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  listTabsRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  actionGroupDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },

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
});
