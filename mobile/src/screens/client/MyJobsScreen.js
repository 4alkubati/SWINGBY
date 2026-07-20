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
import { colors, spacing, radius } from '../../theme/tokens';
import { SkeletonList } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import Tabs from '../../components/Tabs';
import EditPostSheet from '../../components/EditPostSheet';

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: colors.accentText,    bg: colors.accentMuted },
  in_progress: { label: 'In Progress', color: colors.accentText,    bg: colors.accentMuted },
  completed:   { label: 'Done',        color: colors.success,       bg: 'rgba(46,189,133,0.14)' },
  cancelled:   { label: 'Cancelled',   color: colors.textSecondary, bg: colors.surfaceAlt },
  open:        { label: 'Awaiting Quotes', color: colors.accentText, bg: colors.accentMuted },
  matched:     { label: 'Matched',     color: colors.success,       bg: 'rgba(46,189,133,0.14)' },
  expired:     { label: 'Expired',     color: colors.textSecondary, bg: colors.surfaceAlt },
  pending:     { label: 'Pending',     color: colors.accentText,    bg: colors.accentMuted },
  accepted:    { label: 'Accepted',    color: colors.success,       bg: 'rgba(46,189,133,0.14)' },
  rejected:    { label: 'Declined',    color: colors.textSecondary, bg: colors.surfaceAlt },
};

// Business lens: a sent quote with its status and a fast follow-up path.
// A declined quote isn't dead — Message reopens the negotiation.
function QuoteRow({ interest, onMessage }) {
  const status = STATUS_CONFIG[interest.status] || STATUS_CONFIG.pending;
  const post = interest.service_posts || {};
  const clientUser = post.users || {};
  const clientName = [clientUser.first_name, clientUser.last_name].filter(Boolean).join(' ') || 'Client';
  const canMessage = post.status === 'open' || post.status === 'matched' || interest.status === 'accepted';

  return (
    <Surface elevation="subtle" rounded="card" padding="base" style={styles.card}>
      <Inline spacing="md">
        <Avatar name={clientName} size="sm" />
        <View style={{ flex: 1 }}>
          <Inline justify="space-between" style={{ marginBottom: 2 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{post.title || 'Job post'}</Text>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </Inline>
          <Text style={styles.rowSub}>
            {clientName} · <Text style={styles.priceInline}>${interest.quoted_price}</Text>
          </Text>
          {canMessage && (
            <TouchableOpacity style={styles.actionBtnInline} onPress={onMessage} activeOpacity={0.8}>
              <Text style={styles.actionBtnText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
      </Inline>
    </Surface>
  );
}

function BookingRow({ booking, onPress, onReview, onDetails, userRole }) {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
  const otherParty = userRole === 'client'
    ? (booking.businesses?.business_name || booking.business_name || 'Business')
    : (booking.users?.first_name
        ? [booking.users.first_name, booking.users.last_name].filter(Boolean).join(' ')
        : (booking.client_name || 'Client'));
  const when = booking.confirmed_date || booking.proposed_date_1;
  const date = when
    ? new Date(when).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base" style={styles.card}>
        <Inline spacing="md">
          <Avatar name={otherParty} size="sm" />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" style={{ marginBottom: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{otherParty}</Text>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </Inline>
            <Text style={styles.rowSub}>{booking.service_posts?.title || booking.service_category || 'Service'}</Text>
            {date && <Text style={styles.rowDate}>{date}</Text>}
          </View>
          <View style={styles.rowActions}>
            {booking.status === 'completed' && onReview && (
              <TouchableOpacity style={styles.actionBtn} onPress={onReview} activeOpacity={0.8}>
                <Text style={styles.actionBtnText}>Review</Text>
              </TouchableOpacity>
            )}
            {/* UBER-2(a) — Pay with card / live timeline live on BookingDetails,
                which was previously unreachable from My Jobs. This chevron opens
                it without disturbing the row's existing tap → ActiveBooking flow. */}
            {onDetails && (
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={onDetails}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="View booking details"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

function PostRow({ post, onViewQuotes, onViewBooking, onEdit, onDelete, deleting }) {
  const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.open;
  const quoteCount = post.interest_count ?? 0;
  const isMatched = post.status === 'matched';
  const isOpen = post.status === 'open';
  // Matched posts open their booking; open posts open the quote list.
  const rowAction = isMatched ? onViewBooking : (quoteCount > 0 ? onViewQuotes : undefined);
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity onPress={rowAction} activeOpacity={0.8}>
      <Surface elevation="subtle" rounded="card" padding="base" style={styles.card}>
        <Inline spacing="md">
          <Avatar name={post.title || 'Job'} size="sm" />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" style={{ marginBottom: 2 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{post.title || 'Job post'}</Text>
              <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </Inline>
            <Text style={styles.rowSub}>{post.category || 'General'}</Text>
            {date && <Text style={styles.rowDate}>{date}</Text>}
          </View>
          {post.status === 'open' && (
            <TouchableOpacity
              style={[styles.actionBtn, quoteCount > 0 && styles.actionBtnHighlight]}
              onPress={onViewQuotes}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, quoteCount > 0 && styles.actionBtnTextHighlight]}>
                {quoteCount > 0 ? `${quoteCount} quote${quoteCount > 1 ? 's' : ''}` : 'No quotes'}
              </Text>
            </TouchableOpacity>
          )}
          {isMatched && onViewBooking && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnHighlight]}
              onPress={onViewBooking}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextHighlight]}>View booking</Text>
            </TouchableOpacity>
          )}
        </Inline>

        {/* Edit/delete — PATCH /service-posts/{id} + DELETE (owner + status
            'open' only, backend-enforced) — GAP-AUDIT carryover: PATCH
            shipped in c96f995 with no mobile UI until now. */}
        {isOpen && (onEdit || onDelete) && (
          <Inline justify="flex-end" spacing="md" style={styles.editDeleteRow}>
            {onEdit && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onEdit(post); }}
                style={styles.iconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Edit post"
              >
                <Feather name="edit-2" size={14} color={colors.textSecondary} strokeWidth={1.8} />
                <Text style={styles.iconBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onDelete(post); }}
                style={styles.iconBtn}
                disabled={deleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Delete post"
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Feather name="trash-2" size={14} color={colors.danger} strokeWidth={1.8} />
                )}
                <Text style={[styles.iconBtnText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </Inline>
        )}
      </Surface>
    </TouchableOpacity>
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

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
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
          ctaLabel="Try again"
          onCta={load}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      {/* Open service posts — client only */}
      {isClient && openPosts.length > 0 && (
        <View style={styles.postsSection}>
          <Text style={styles.sectionLabel}>Open Posts</Text>
          {openPosts.map((post) => {
            // A matched post's booking (post_id links them) — its real landing page
            const matchedBooking = bookings.find((b) => b.post_id === post.id);
            return (
              <PostRow
                key={post.id}
                post={post}
                onViewQuotes={() =>
                  navigation.navigate('QuoteComparison', {
                    postId: post.id,
                    postTitle: post.title,
                  })
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
          })}
          <View style={styles.divider} />
        </View>
      )}

      {/* Bookings tab switcher */}
      <View style={styles.tabsWrap}>
        <Tabs
          tabs={
            isClient
              ? [`Active (${active.length})`, `Past (${past.length})`]
              : [`Active (${active.length})`, `Past (${past.length})`, `Quotes (${quotes.length})`]
          }
          activeIndex={(isClient ? ['active', 'past'] : ['active', 'past', 'quotes']).indexOf(tab)}
          onChange={(idx) => setTab((isClient ? ['active', 'past'] : ['active', 'past', 'quotes'])[idx])}
        />
      </View>

      {tab === 'quotes' && !isClient ? (
        <FlatList
          data={quotes}
          keyExtractor={(q) => q.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />}
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
            onReview={isClient ? () =>
              navigation.navigate('Review', {
                bookingId: item.id,
                workerId: item.employee_id || item.business_id,
                workerName:
                  [item.employees?.users?.first_name, item.employees?.users?.last_name]
                    .filter(Boolean).join(' ')
                  || item.businesses?.business_name
                  || 'Provider',
              }) : null
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
  postsSection: { paddingHorizontal: 22 },
  sectionLabel: {
    fontSize: 11, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  tabsWrap: { marginHorizontal: 22, marginBottom: 8 },
  list: { paddingHorizontal: 22, paddingBottom: 24, gap: spacing.sm },
  card: { marginBottom: 0 },
  rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, flex: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  rowSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  rowDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.textSecondary },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailsBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  priceInline: {
    color: colors.success,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontVariant: ['tabular-nums'],
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
  actionBtnInline: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  actionBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
  actionBtnTextHighlight: { color: colors.accentText },
  editDeleteRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  iconBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.textSecondary },
});
