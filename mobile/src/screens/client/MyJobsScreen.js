import {
  View, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
import { colors, spacing } from '../../theme/tokens';
import { SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import Tabs from '../../components/Tabs';
import StatusBadge from '../../components/StatusBadge';
import EditPostSheet from '../../components/EditPostSheet';

// ─── Status vocabularies ──────────────────────────────────────────────────────
// Three separate state machines that used to be flattened into one lookup —
// which made an interest's `accepted` and a post's `matched` render as the
// same green pill despite meaning different things. They are kept apart now so
// each row reads from the vocabulary that actually applies to it.
const BOOKING_STATUS = {
  confirmed:   { label: 'Confirmed',   tone: 'accent' },
  in_progress: { label: 'In progress', tone: 'accent' },
  completed:   { label: 'Done',        tone: 'success' },
  cancelled:   { label: 'Cancelled',   tone: 'muted' },
};
const POST_STATUS = {
  open:    { label: 'Awaiting quotes', tone: 'accent' },
  matched: { label: 'Matched',         tone: 'success' },
  expired: { label: 'Expired',         tone: 'muted' },
};
const INTEREST_STATUS = {
  pending:  { label: 'Pending',  tone: 'accent' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Declined', tone: 'muted' },
};

const CATEGORY_ICON = {
  cleaning: 'droplet',
  plumbing: 'tool',
  moving: 'truck',
  electrical: 'zap',
  landscaping: 'feather',
};

function shortDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ─── Shared row anatomy ───────────────────────────────────────────────────────
// One structure for every row on this screen: a leading slot (person avatar OR
// a job icon tile — never a person-shaped avatar for a job), a title that leads
// with the JOB/service, a secondary line for the counterparty/meta, a
// non-interactive status badge top-right, and — when present — a single action
// bar at the bottom. This keeps card anatomy and height behaviour consistent.
function RowCard({ onPress, left, title, badge, subtitle, meta, actions }) {
  const body = (
    <Surface elevation="subtle" rounded="card" padding="base">
      <Inline spacing="md" align="flex-start">
        {left}
        <View style={styles.rowMain}>
          <Inline justify="space-between" align="flex-start">
            <Text variant="smallMedium" numberOfLines={1} style={styles.rowTitle}>
              {title}
            </Text>
            {badge}
          </Inline>
          {subtitle != null && (
            <Text variant="small" color="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
          {meta}
        </View>
      </Inline>
      {actions && <View style={styles.actionBar}>{actions}</View>}
    </Surface>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  );
}

function JobIconTile({ category }) {
  const icon = CATEGORY_ICON[(category || '').toLowerCase()] || 'briefcase';
  return (
    <View style={styles.iconTile}>
      <Feather name={icon} size={15} color={colors.accentText} strokeWidth={2} />
    </View>
  );
}

function ActionButton({ label, onPress, highlight, danger, loading, icon }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, highlight && styles.actionBtnHighlight]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Inline spacing="xs">
          {icon}
          <Text
            variant="caption"
            style={[
              styles.actionBtnText,
              highlight && { color: colors.accentText },
              danger && { color: colors.danger },
            ]}
          >
            {label}
          </Text>
        </Inline>
      )}
    </TouchableOpacity>
  );
}

// Business lens on a sent quote: its interest status + a fast follow-up path.
// A declined quote isn't dead — Message reopens the negotiation.
function QuoteRow({ interest, onMessage }) {
  const status = INTEREST_STATUS[interest.status] || INTEREST_STATUS.pending;
  const post = interest.service_posts || {};
  const clientUser = post.users || {};
  const clientName = [clientUser.first_name, clientUser.last_name].filter(Boolean).join(' ') || 'Client';
  const canMessage = post.status === 'open' || post.status === 'matched' || interest.status === 'accepted';

  return (
    <RowCard
      left={<Avatar name={clientName} size="sm" />}
      title={post.title || 'Job post'}
      badge={<StatusBadge label={status.label} tone={status.tone} />}
      subtitle={
        <>
          {clientName} · <Text variant="small" style={styles.price}>${interest.quoted_price}</Text>
        </>
      }
      actions={
        canMessage ? (
          <Inline spacing="sm" justify="flex-end" wrap>
            <ActionButton label="Message" onPress={onMessage} />
          </Inline>
        ) : null
      }
    />
  );
}

function BookingRow({ booking, onPress, onReview, onDetails, onRebook, userRole }) {
  const status = BOOKING_STATUS[booking.status] || BOOKING_STATUS.confirmed;
  const service = booking.service_posts?.title || booking.service_category || 'Service';
  const counterparty = userRole === 'client'
    ? (booking.businesses?.business_name || booking.business_name || 'Business')
    : (booking.users?.first_name
        ? [booking.users.first_name, booking.users.last_name].filter(Boolean).join(' ')
        : (booking.client_name || 'Client'));
  const when = booking.confirmed_date || booking.proposed_date_1;
  const date = shortDate(when);
  const isDone = booking.status === 'completed';

  const actionEls = [];
  if (onDetails) {
    actionEls.push(
      <ActionButton key="details" label="Details" onPress={onDetails} />
    );
  }
  if (isDone && onReview) {
    actionEls.push(
      <ActionButton key="review" label="Review" onPress={onReview} />
    );
  }
  // CARD-12 — Rebook: cheapest nudge back on-platform for job #2.
  if (isDone && onRebook) {
    actionEls.push(
      <ActionButton key="rebook" label={i18n.t('rebook.button')} onPress={onRebook} highlight />
    );
  }

  return (
    <RowCard
      onPress={onPress}
      left={<Avatar name={counterparty} size="sm" />}
      title={service}
      badge={<StatusBadge label={status.label} tone={status.tone} />}
      subtitle={counterparty}
      meta={date ? <Text variant="caption" color="secondary" style={styles.rowMeta}>{date}</Text> : null}
      actions={
        actionEls.length > 0 ? (
          <Inline spacing="sm" justify="flex-end" wrap>{actionEls}</Inline>
        ) : null
      }
    />
  );
}

function PostRow({ post, onViewQuotes, onViewBooking, onEdit, onDelete, deleting }) {
  const status = POST_STATUS[post.status] || POST_STATUS.open;
  const quoteCount = post.interest_count ?? 0;
  const isMatched = post.status === 'matched';
  const isOpen = post.status === 'open';
  // Matched posts open their booking; open posts open the quote list.
  const rowAction = isMatched ? onViewBooking : (quoteCount > 0 ? onViewQuotes : undefined);
  const date = shortDate(post.created_at);

  // The quotes count is an ACTION (opens the comparison), not a status — it
  // renders as a button in the action bar, never as a status pill.
  const actionEls = [];
  if (isMatched && onViewBooking) {
    actionEls.push(
      <ActionButton key="booking" label="View booking" onPress={onViewBooking} highlight />
    );
  } else if (isOpen && quoteCount > 0) {
    actionEls.push(
      <ActionButton
        key="quotes"
        label={`${quoteCount} quote${quoteCount > 1 ? 's' : ''}`}
        onPress={onViewQuotes}
        highlight
      />
    );
  }
  if (isOpen && onEdit) {
    actionEls.push(
      <ActionButton
        key="edit"
        label="Edit"
        icon={<Feather name="edit-2" size={13} color={colors.textSecondary} strokeWidth={1.8} />}
        onPress={() => onEdit(post)}
      />
    );
  }
  if (isOpen && onDelete) {
    actionEls.push(
      <ActionButton
        key="delete"
        label="Delete"
        danger
        loading={deleting}
        icon={<Feather name="trash-2" size={13} color={colors.danger} strokeWidth={1.8} />}
        onPress={() => onDelete(post)}
      />
    );
  }

  return (
    <RowCard
      onPress={rowAction}
      left={<JobIconTile category={post.category} />}
      title={post.title || 'Job post'}
      badge={<StatusBadge label={status.label} tone={status.tone} />}
      subtitle={post.category || 'General'}
      meta={date ? <Text variant="caption" color="secondary" style={styles.rowMeta}>{date}</Text> : null}
      actions={
        actionEls.length > 0 ? (
          <Inline spacing="sm" justify="flex-end" wrap>{actionEls}</Inline>
        ) : null
      }
    />
  );
}

// Collapsible "Open Posts" section. Lives INSIDE the bookings FlatList header so
// it scrolls with the list — the previous plain-View-with-map above the list
// had no height cap and pushed the tabs + entire bookings list off-screen once
// a client had 4+ open posts (the page couldn't scroll to reach them).
// Collapsed by default so open posts stay tucked away, not dominant.
function OpenPostsSection({ posts, expanded, onToggle, renderPost }) {
  return (
    <View style={styles.postsSection}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={styles.postsToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Open posts, ${posts.length}`}
      >
        <Text style={styles.sectionLabel}>Open Posts · {posts.length}</Text>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <Stack spacing="sm" style={{ marginTop: spacing.sm }}>
          {posts.map(renderPost)}
        </Stack>
      )}
    </View>
  );
}

export default function MyJobsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [postsExpanded, setPostsExpanded] = useState(false);
  const isClient = user?.role === 'client';

  const load = useCallback(async () => {
    try {
      setError(null);
      const calls = [api.get('/bookings/')];
      if (isClient) {
        calls.push(api.get('/service-posts/my').catch(() => ({ items: [] })));
      } else {
        calls.push(api.get('/interests/mine').catch(() => ({ items: [] })));
      }
      const [bookingRes, secondRes] = await Promise.all(calls);
      setBookings(bookingRes?.items || bookingRes || []);
      if (isClient) setPosts(secondRes?.items || secondRes || []);
      else setQuotes(secondRes?.items || []);
    } catch (e) {
      setError(e.message || 'Could not load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient]);

  useEffect(() => { load(); }, [load]);

  const active = bookings.filter((b) => b.status === 'confirmed' || b.status === 'in_progress');
  const past = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled');
  const openPosts = posts.filter((p) => p.status === 'open' || p.status === 'matched');
  const showingQuotes = tab === 'quotes' && !isClient;
  const shownBookings = tab === 'active' ? active : past;

  function handleBookingPress(booking) {
    if (isClient) {
      navigation.navigate('ActiveBooking', { bookingId: booking.id });
    } else {
      navigation.navigate('JobManagement', { bookingId: booking.id });
    }
  }

  function handleEditPost(post) {
    setEditingPost(post);
  }

  function handlePostSaved(updatedPost) {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p)));
    toast.show({ type: 'success', text1: 'Post updated' });
  }

  function handleDeletePost(post) {
    Alert.alert(
      'Delete this post?',
      'Clients waiting to quote will no longer see it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingPostId(post.id);
            try {
              await api.delete(`/service-posts/${post.id}`);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
              toast.show({ type: 'success', text1: 'Post deleted' });
            } catch (err) {
              toast.show({ type: 'error', text1: 'Could not delete post', text2: err.message });
            } finally {
              setDeletingPostId(null);
            }
          },
        },
      ],
    );
  }

  function renderPost(post) {
    // A matched post's booking (post_id links them) — its real landing page.
    const matchedBooking = bookings.find((b) => b.post_id === post.id);
    return (
      <PostRow
        key={post.id}
        post={post}
        onViewQuotes={() =>
          navigation.navigate('QuoteComparison', { postId: post.id, postTitle: post.title })
        }
        onViewBooking={
          matchedBooking
            ? () => navigation.navigate('ActiveBooking', { bookingId: matchedBooking.id })
            : undefined
        }
        onEdit={post.status === 'open' ? handleEditPost : undefined}
        onDelete={post.status === 'open' ? handleDeletePost : undefined}
        deleting={deletingPostId === post.id}
      />
    );
  }

  const tabKeys = isClient ? ['active', 'past'] : ['active', 'past', 'quotes'];
  const tabLabels = isClient
    ? [`Active (${active.length})`, `Past (${past.length})`]
    : [`Active (${active.length})`, `Past (${past.length})`, `Quotes (${quotes.length})`];

  // Everything above the list rows lives in the FlatList header so the whole
  // screen is one scroll surface — no more content trapped off-screen.
  const ListHeader = (
    <View>
      {isClient && openPosts.length > 0 && (
        <OpenPostsSection
          posts={openPosts}
          expanded={postsExpanded}
          onToggle={() => setPostsExpanded((v) => !v)}
          renderPost={renderPost}
        />
      )}
      <View style={styles.tabsWrap}>
        <Tabs
          tabs={tabLabels}
          activeIndex={tabKeys.indexOf(tab)}
          onChange={(idx) => setTab(tabKeys[idx])}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <View style={{ paddingHorizontal: 22, paddingTop: spacing.sm }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <EmptyState
          icon="alert-circle"
          title="Could not load jobs"
          body={error}
          action={{ label: 'Try again', onPress: load }}
        />
      </View>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surface}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      {showingQuotes ? (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon="send"
              title="No quotes sent yet"
              body="Quote a job from your Dashboard and it will show up here with its status."
            />
          }
          renderItem={({ item }) => (
            <QuoteRow
              interest={item}
              onMessage={() =>
                navigation.navigate('Chat', {
                  interestId: item.id,
                  otherPartyName: item.service_posts?.users?.first_name || 'Client',
                })
              }
            />
          )}
        />
      ) : (
        <FlatList
          data={shownBookings}
          keyExtractor={(b) => b.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'active' ? 'briefcase' : 'clock'}
              title={tab === 'active' ? 'No active jobs right now' : 'No past jobs yet'}
              body={
                tab === 'active'
                  ? 'Book a service or post a job to get started.'
                  : 'Completed and cancelled jobs will appear here.'
              }
            />
          }
          renderItem={({ item }) => (
            <BookingRow
              booking={item}
              userRole={user?.role}
              onPress={() => handleBookingPress(item)}
              onDetails={isClient ? () => navigation.navigate('BookingDetails', { bookingId: item.id }) : undefined}
              onRebook={isClient ? () =>
                navigation.navigate('PostJob', {
                  rebookBusinessId: item.business_id,
                  rebookBusinessName: item.businesses?.business_name,
                  rebookCategory: item.service_category,
                  rebookAddress: item.service_posts?.address,
                  rebookBudget: item.total_amount,
                }) : undefined
              }
              onReview={isClient ? () =>
                navigation.navigate('Review', {
                  bookingId: item.id,
                  workerId: item.employee_id || item.business_id,
                  workerName:
                    [item.employees?.users?.first_name, item.employees?.users?.last_name]
                      .filter(Boolean).join(' ')
                    || item.businesses?.business_name
                    || 'Provider',
                }) : undefined
              }
            />
          )}
        />
      )}

      <EditPostSheet
        visible={!!editingPost}
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={handlePostSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold', color: colors.textPrimary, letterSpacing: -0.5 },

  postsSection: { marginBottom: spacing.md },
  postsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 1.4,
  },

  tabsWrap: { marginBottom: spacing.md },
  list: { paddingHorizontal: 22, paddingBottom: 24, gap: spacing.sm },

  rowMain: { flex: 1, gap: 2 },
  rowTitle: { flex: 1, color: colors.textPrimary },
  rowMeta: { marginTop: 2 },
  price: {
    color: colors.success,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontVariant: ['tabular-nums'],
  },

  iconTile: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center',
  },

  actionBar: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1,
    borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    minHeight: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnHighlight: {
    backgroundColor: colors.accentMuted, borderColor: colors.borderAccent,
  },
  actionBtnText: { color: colors.textSecondary },
});
