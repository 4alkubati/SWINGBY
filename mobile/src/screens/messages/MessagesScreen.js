// Messages — the inbox model from design/handoff-jet-pulse/MESSAGES-AND-QUOTES.md
// (canvas section 5a). Replaces the old unified list that mixed quotes and
// bookings together (walkthrough D2: "does not look good at all", and Kira's
// complaint that "a chat opened without the client approving anything").
//
// THE RULE: the chat list holds BOOKED WORK ONLY. A thread appears here the
// moment a quote is accepted and paid — never before. Everything still being
// negotiated sits behind ONE docked bubble; tapping it swaps the list in place
// (same screen, no navigation push) and the bubble becomes "Back to chats".
//
// Same component on both sides — only copy and row content differ:
//   client   → received quotes  ("3 open · not booked yet")
//   business → sent quotes      ("4 out · $1,145 pending")
// Business Jobs no longer lists pending quotes at all (JobManagementScreen);
// a job lands in Jobs on acceptance only.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { useUnread } from '../../context/UnreadContext';
import { api } from '../../services/api';
import i18n from '../../i18n';
import { colors, spacing, radius, motion } from '../../theme/tokens';
import BusinessLogo from '../../components/BusinessLogo';

import Text from '../../components/Text';
import Button from '../../components/Button';
import SearchField from '../../components/SearchField';
import EmptyState from '../../components/EmptyState';
import QuotesBubble from '../../components/QuotesBubble';
import { formatMoney } from '../../components/ChatQuoteCard';
import { SkeletonList } from '../../components/Skeleton';

// Local token — the actionable quote border is rgba(136,120,249,0.28), one
// step stronger than tokens.colors.borderAccent (0.25, "new card"). Lane 4
// owns theme/tokens.js; promote this if a third surface needs it.
const QUOTE_BORDER = 'rgba(136,120,249,0.28)';
// List dividers sitting on the screen background are darker than the 1px
// dividers inside a card (POLISH-TIPS §3).
const LIST_DIVIDER = '#14171D';

const DAY_MS = 86400000;
// Declined and expired quotes stay in the quotes list, greyed, for 30 days —
// then drop off. Nothing is ever deleted by hand.
const RESOLVED_TTL_MS = 30 * DAY_MS;
// A quote with no expiry of its own inherits the post's 7-day window.

// Client quotes list: /interests/post/{id} is per-post, so the list is an N+1.
// Cap the fan-out — the newest posts are the ones with live quotes.
const MAX_QUOTE_POSTS = 10;

// These four moved to utils/quoteStatus.js so ChatScreen computes the SAME
// answer — it had its own copy that skipped the expiry clock entirely.
import {
  hoursLeft,
  quoteExpiry,
  resolveQuoteStatus,
  isResolved,
  DEFAULT_QUOTE_WINDOW_MS,
} from '../../utils/quoteStatus';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

// Relative under 24h, then "Thu" / "Jun 30" (POLISH-TIPS §8).
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return i18n.t('messages.now');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const d = new Date(then);
  if (hrs < 24 * 7) return d.toLocaleDateString('en-CA', { weekday: 'short' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}



// Quotes carry no expires_at column of their own — they inherit the post's
// window, and fall back to created_at + 7d when the post payload omits it
// (/interests/mine does not select expires_at).


// Booked-thread meta line: "Today · 9:00 AM" / "Upcoming · Jul 19" /
// "Completed · Jul 2". Never a raw enum or ISO string (walkthrough B16).
function bookingMeta(thread) {
  const when = thread.confirmed_date ? new Date(thread.confirmed_date) : null;
  const valid = when && !Number.isNaN(when.getTime());
  if (thread.status === 'completed') {
    return valid
      ? i18n.t('messages.metaCompletedOn', {
        date: when.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      })
      : i18n.t('messages.metaCompleted');
  }
  if (!valid) return i18n.t('messages.metaAwaitingTime');
  const today = new Date();
  const sameDay = when.toDateString() === today.toDateString();
  const time = when.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return i18n.t('messages.metaToday', { time });
  if (when.getTime() < today.getTime()) return i18n.t('messages.metaInProgress');
  return i18n.t('messages.metaUpcoming', {
    date: when.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
  });
}

// ─── Booked chat row ─────────────────────────────────────────────────────────

function ChatRow({ thread, onPress }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const spring = { stiffness: motion.spring.stiffness, damping: motion.spring.damping };
  const unread = thread.unread_count > 0;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, spring); }}
        onPressOut={() => { scale.value = withSpring(1, spring); }}
        accessibilityRole="button"
        accessibilityLabel={`${thread.counterpart_name}, ${bookingMeta(thread)}${unread ? `, ${thread.unread_count} unread` : ''}`}
        style={({ pressed }) => [styles.chatRow, pressed && styles.rowPressed]}
      >
        {thread.counterpart_logo ? (
          // A business the client has booked shows its own face here. The
          // unread ring is dropped on purpose when a logo is present — the
          // accent fill exists to carry the monogram, and tinting a real logo
          // would misrepresent the brand. Unread is still carried by the name,
          // the preview weight and the badge.
          <BusinessLogo
            uri={thread.counterpart_logo}
            name={thread.counterpart_name}
            size={50}
            radius={16}
          />
        ) : (
          <View style={[styles.chatTile, unread && styles.tileActive]}>
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.tileText, { fontSize: 16 }, unread && styles.tileTextActive]}
            >
              {initials(thread.counterpart_name)}
            </Text>
          </View>
        )}

        <View style={styles.chatBody}>
          <View style={styles.chatTopLine}>
            <Text variant="caption" numberOfLines={1} style={styles.chatName}>
              {thread.counterpart_name || i18n.t('messages.chatFallback')}
            </Text>
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.chatTime, unread && styles.chatTimeUnread]}
            >
              {timeAgo(thread.last_at)}
            </Text>
          </View>

          <View style={styles.chatTopLine}>
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.chatPreview, unread && styles.chatPreviewUnread]}
            >
              {thread.last_message || i18n.t('messages.noMessagesYet')}
            </Text>
            {unread && (
              <View style={styles.unreadBadge}>
                <Text variant="caption" numberOfLines={1} style={styles.unreadBadgeText}>
                  {thread.unread_count > 99 ? '99+' : thread.unread_count}
                </Text>
              </View>
            )}
          </View>

          <Text variant="caption" numberOfLines={1} style={styles.chatMeta}>
            {bookingMeta(thread)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Quote row ───────────────────────────────────────────────────────────────

function QuoteRow({ quote, active, onPress }) {
  const expired = quote.status === 'expired';
  const declined = quote.status === 'declined';
  const grey = expired || declined;
  const left = hoursLeft(quote.expiresAt);
  const expiringSoon = quote.status === 'pending' && left != null && left < 24;

  let statusColor = colors.textSecondary;
  if (expiringSoon) statusColor = colors.warning;
  if (grey) statusColor = colors.textTertiary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${quote.name}, ${quote.service}, ${quote.statusLabel}`}
      style={({ pressed }) => [
        styles.quoteRow,
        // Purple-tinted border ONLY while it awaits the viewer's own action.
        { borderColor: quote.awaitsViewer ? QUOTE_BORDER : colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      {quote.logoUrl ? (
        // Comparing quotes is the moment a client picks a company, so this is
        // the row where a logo earns its keep. Expired/declined quotes keep the
        // logo rather than greying it — the brand did not change, only the
        // quote's standing, which the status line already says.
        <BusinessLogo uri={quote.logoUrl} name={quote.name} size={46} radius={14} />
      ) : (
        <View style={[styles.quoteTile, active && styles.tileActive]}>
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.tileText, active && styles.tileTextActive, grey && styles.tileTextGrey]}
          >
            {initials(quote.name)}
          </Text>
        </View>
      )}

      <View style={styles.quoteBody}>
        <Text variant="caption" numberOfLines={1} style={[styles.quoteName, grey && styles.textGrey]}>
          {quote.name}
        </Text>
        <Text variant="caption" numberOfLines={1} style={[styles.quoteService, grey && styles.textGrey]}>
          {quote.service}
        </Text>
        <Text variant="caption" numberOfLines={1} style={[styles.quoteStatus, { color: statusColor }]}>
          {quote.statusLabel}
        </Text>
      </View>

      <View style={styles.quoteRight}>
        {!!quote.price && (
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.quotePrice, grey && { color: colors.textTertiary }]}
          >
            {formatMoney(quote.price)}
          </Text>
        )}
        <Text variant="caption" numberOfLines={1} style={styles.quoteStamp}>
          {timeAgo(quote.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { mark } = useUnread();

  const isBusiness = user?.role === 'business_owner' || user?.role === 'employee';

  const [tab, setTab] = useState('chats'); // 'chats' | 'quotes'
  const [threads, setThreads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  // ── Quotes: business = /interests/mine, client = per-post fan-out ──────────
  const loadBusinessQuotes = useCallback(async () => {
    const data = await api.get('/interests/mine', { _silent: true });
    const items = data?.items || (Array.isArray(data) ? data : []);
    return items.flatMap((i) => {
      const post = i.service_posts || {};
      const client = post.users || {};
      const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
        || i18n.t('messages.clientFallback');
      const expiresAt = quoteExpiry(i, post);
      const status = resolveQuoteStatus(i, post, expiresAt);
      // Same rule the client side has always had (see loadClientQuotes): an
      // accepted quote is a BOOKING and belongs in chats, not in "Sent quotes".
      //
      // Leaving it in caused both bugs on that screen at once. The backend
      // stops masking a client once they accept — correctly, the business is
      // working for them now — so an accepted row carried the client's real
      // name while still being labelled "Awaiting reply", which read as a
      // privacy leak. And the header counts only `pending`, so it showed
      // "0 out · $0 pending" above four rows worth $550. One missing filter,
      // both symptoms.
      if (status === 'accepted') return [];
      const left = hoursLeft(expiresAt);
      let statusLabel = i18n.t('messages.quoteAwaitingReply');
      if (status === 'pending' && left != null && left < 48) {
        statusLabel = i18n.t('messages.quoteAwaitingReplyLeft', { left: `${Math.max(1, Math.round(left))} h` });
      }
      if (status === 'declined') statusLabel = i18n.t('messages.quoteDeclined');
      if (status === 'expired') statusLabel = i18n.t('messages.quoteExpired');
      return {
        key: `i-${i.id}`,
        interestId: i.id,
        name,
        service: post.title || i18n.t('messages.jobFallback'),
        price: i.quoted_price,
        createdAt: i.created_at,
        expiresAt,
        status,
        statusLabel,
        // Business side: a sent quote is waiting on THEM, so it never gets the
        // purple "you must act" border.
        awaitsViewer: false,
      };
    });
  }, []);

  const loadClientQuotes = useCallback(async () => {
    const postsRes = await api.get('/service-posts/my', {
      params: { limit: MAX_QUOTE_POSTS * 2 },
      _silent: true,
    });
    const posts = (postsRes?.items || (Array.isArray(postsRes) ? postsRes : [])).slice(0, MAX_QUOTE_POSTS * 2);

    // Direct "Book now" requests that nobody has quoted yet still belong in
    // the quotes list — they are the client's proof the request went somewhere
    // (walkthrough B17/D9). They carry no price and no thread yet.
    const awaiting = posts
      .filter((p) => p.target_business_id && !p.interest_count && p.status === 'open')
      .map((p) => ({
        key: `p-${p.id}`,
        postId: p.id,
        name: p.title || i18n.t('messages.jobFallback'),
        service: i18n.t('messages.quoteAwaitingTheirs'),
        price: null,
        createdAt: p.created_at,
        expiresAt: p.expires_at,
        status: 'awaiting',
        statusLabel: i18n.t('messages.quoteRequested', { when: timeAgo(p.created_at) }),
        awaitsViewer: false,
      }));

    const withQuotes = posts.filter((p) => p.interest_count > 0).slice(0, MAX_QUOTE_POSTS);
    const perPost = await Promise.all(
      withQuotes.map((p) =>
        api.get(`/interests/post/${p.id}`, { _silent: true })
          .then((res) => ({ post: p, interests: Array.isArray(res) ? res : (res?.items || []) }))
          .catch(() => ({ post: p, interests: [] })),
      ),
    );

    const rows = [];
    for (const { post, interests } of perPost) {
      for (const i of interests) {
        const expiresAt = quoteExpiry(i, post);
        const status = resolveQuoteStatus(i, post, expiresAt);
        if (status === 'accepted') continue; // it is a booking now — it lives in chats
        const left = hoursLeft(expiresAt);
        let statusLabel = i18n.t('messages.quoteAwaitingYou');
        if (status === 'pending' && left != null) {
          statusLabel = left < 48
            ? i18n.t('messages.quoteExpiresIn', { left: `${Math.max(1, Math.round(left))} h` })
            : i18n.t('messages.quoteExpiresInDays', { n: Math.floor(left / 24) });
        }
        if (status === 'declined') statusLabel = i18n.t('messages.quoteYouDeclined');
        if (status === 'expired') statusLabel = i18n.t('messages.quoteExpired');
        rows.push({
          key: `i-${i.id}`,
          interestId: i.id,
          businessId: i.business_id,
          name: i.businesses?.business_name || i18n.t('messages.businessFallback'),
          logoUrl: i.businesses?.logo_url || null,
          service: post.title || i18n.t('messages.jobFallback'),
          price: i.quoted_price,
          createdAt: i.created_at,
          expiresAt,
          status,
          statusLabel,
          // Client side: a pending quote is waiting on the viewer.
          awaitsViewer: status === 'pending',
        });
      }
    }
    return [...rows, ...awaiting];
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [threadRes, quoteRows] = await Promise.all([
        api.get('/messages/threads'),
        (isBusiness ? loadBusinessQuotes() : loadClientQuotes()).catch(() => []),
      ]);
      if (!mounted.current) return;
      // BOOKED ONLY. Quote (interest) threads are deliberately dropped here —
      // they live behind the bubble, not in the chat list.
      setThreads((threadRes?.items || []).filter((t) => t.thread_type === 'booking'));
      setQuotes(quoteRows);
    } catch {
      if (mounted.current) setError(i18n.t('messages.loadError'));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isBusiness, loadBusinessQuotes, loadClientQuotes]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => navigation.addListener('focus', load), [navigation, load]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredThreads = useMemo(() => {
    if (!query.trim()) return threads;
    const q = query.trim().toLowerCase();
    return threads.filter(
      (t) => (t.counterpart_name || '').toLowerCase().includes(q)
        || (t.last_message || '').toLowerCase().includes(q),
    );
  }, [threads, query]);

  const visibleQuotes = useMemo(() => {
    const cutoff = Date.now() - RESOLVED_TTL_MS;
    const kept = quotes.filter((q) => {
      if (!isResolved(q.status)) return true;
      const t = q.createdAt ? new Date(q.createdAt).getTime() : 0;
      return !t || t >= cutoff; // 30-day greyed lifecycle, then it drops off
    });
    const rank = { pending: 0, awaiting: 1, expired: 2, declined: 3 };
    return kept.sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      const ea = new Date(a.expiresAt || a.createdAt || 0).getTime();
      const eb = new Date(b.expiresAt || b.createdAt || 0).getTime();
      return a.status === 'pending' ? ea - eb : eb - ea;
    });
  }, [quotes]);

  const liveQuotes = visibleQuotes.filter((q) => q.status === 'pending' || q.status === 'awaiting');
  const expiringSoon = visibleQuotes.filter((q) => {
    if (q.status !== 'pending') return false;
    const left = hoursLeft(q.expiresAt);
    return left != null && left > 0 && left < 24;
  }).length;
  const pendingValue = visibleQuotes
    .filter((q) => q.status === 'pending')
    .reduce((sum, q) => sum + (Number(q.price) || 0), 0);

  // First live row gets the accent tile — the one the eye should land on.
  const activeQuoteKey = liveQuotes[0]?.key;

  const openChats = tab === 'chats';

  // ── B13: the unread badge must clear the instant a thread is opened, not on
  // the next 30s poll. The server marks the thread read on GET, but the inbox
  // row and the tab-bar badge both render from cached client state — so zero
  // them here as well.
  function openThread(thread) {
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t)));
    mark(thread.id);
    navigation.navigate('Chat', {
      bookingId: thread.id,
      otherPartyName: thread.counterpart_name,
    });
  }

  function openQuote(quote) {
    if (quote.status === 'awaiting' && quote.postId) {
      navigation.navigate('QuoteComparison', { postId: quote.postId, postTitle: quote.name });
      return;
    }
    if (!quote.interestId) return;
    navigation.navigate('Chat', { interestId: quote.interestId, otherPartyName: quote.name });
  }

  // ── Header ────────────────────────────────────────────────────────────────
  function renderHeader() {
    if (openChats) {
      return (
        <View style={styles.header}>
          <Text variant="display2" style={styles.title}>{i18n.t('messages.title')}</Text>
        </View>
      );
    }
    const subtitle = isBusiness
      ? i18n.t('messages.quotesSubtitleBusiness', {
        n: liveQuotes.length,
        amount: formatMoney(pendingValue) || '$0',
      })
      : i18n.t('messages.quotesSubtitleClient', { n: liveQuotes.length });
    return (
      <View style={styles.header}>
        <Text variant="display2" style={styles.title}>
          {isBusiness ? i18n.t('messages.sentQuotesTitle') : i18n.t('messages.quotesTitle')}
        </Text>
        <Text variant="caption" style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
    );
  }

  const bubble = (
    <QuotesBubble
      count={liveQuotes.length}
      expiringSoon={expiringSoon}
      open={!openChats}
      label={isBusiness ? i18n.t('messages.bubbleSent') : i18n.t('messages.bubbleQuotes')}
      closedLabel={i18n.t('messages.bubbleBack')}
      onPress={() => setTab((t) => (t === 'chats' ? 'quotes' : 'chats'))}
    />
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="display2" style={styles.title}>{i18n.t('messages.title')}</Text>
        </View>
        <View style={styles.gutter}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="display2" style={styles.title}>{i18n.t('messages.title')}</Text>
        </View>
        <View style={[styles.gutter, styles.errorWrap]}>
          <View style={styles.errorIcon}>
            <Feather name="wifi-off" size={28} color={colors.warning} strokeWidth={1.8} />
          </View>
          <Text variant="caption" style={styles.errorTitle}>{i18n.t('messages.errorTitle')}</Text>
          <Text variant="caption" style={styles.errorBody}>{error}</Text>
          <Button
            variant="secondary"
            label={i18n.t('common.retry')}
            onPress={() => { setLoading(true); load(); }}
            style={{ minWidth: 140 }}
          />
        </View>
      </View>
    );
  }

  // ── Content ───────────────────────────────────────────────────────────────
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {renderHeader()}

      {openChats && (
        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={i18n.t('messages.searchPlaceholder')}
            debounceMs={200}
          />
        </View>
      )}

      {openChats ? (
        filteredThreads.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={query ? 'search' : 'message-circle'}
              title={query ? i18n.t('messages.emptySearchTitle') : i18n.t('messages.emptyChatsTitle')}
              body={query
                ? i18n.t('messages.emptySearchBody', { query })
                : i18n.t('messages.emptyChatsBody')}
            />
          </View>
        ) : (
          <FlatList
            data={filteredThreads}
            keyExtractor={(t) => `b-${t.id}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, styles.listContentFlush]}
            refreshControl={refreshControl}
            ListHeaderComponent={
              <Text variant="caption" style={styles.sectionLabel}>
                {i18n.t('messages.bookedSection')}
              </Text>
            }
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <ChatRow thread={item} onPress={() => openThread(item)} />
            )}
          />
        )
      ) : (
        visibleQuotes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="briefcase"
              title={i18n.t('messages.emptyQuotesTitle')}
              body={isBusiness
                ? i18n.t('messages.emptyQuotesBodyBusiness')
                : i18n.t('messages.emptyQuotesBodyClient')}
            />
          </View>
        ) : (
          <FlatList
            data={visibleQuotes}
            keyExtractor={(q) => q.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={refreshControl}
            renderItem={({ item }) => (
              <QuoteRow
                quote={item}
                active={item.key === activeQuoteKey}
                onPress={() => openQuote(item)}
              />
            )}
            ListFooterComponent={
              <View style={styles.footerNote}>
                <Feather name="info" size={13} color={colors.textTertiary} strokeWidth={1.8} />
                <Text variant="caption" style={styles.footerNoteText}>
                  {isBusiness
                    ? i18n.t('messages.quotesFooterBusiness')
                    : i18n.t('messages.quotesFooterClient')}
                </Text>
              </View>
            }
          />
        )
      )}

      {bubble}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  gutter: { paddingHorizontal: spacing.lg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  title: { letterSpacing: -1 },
  subtitle: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },

  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  // Clears the tab bar AND the docked bubble (bottom 104 + 56 tall).
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 180,
    gap: spacing.md,
  },
  // Booked chats are a hairline-separated list, not a stack of cards — the
  // divider replaces the 12px gap the quote cards need.
  listContentFlush: { gap: 0 },
  divider: { height: 1, backgroundColor: LIST_DIVIDER },

  rowPressed: { backgroundColor: '#12151B' },

  // ── Booked chat row ──
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.base,
    borderRadius: radius.card,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chatTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: {
    backgroundColor: colors.accentMuted,
    borderWidth: 0,
  },
  tileText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  tileTextActive: { color: colors.accentText },
  tileTextGrey: { color: colors.textTertiary },
  chatBody: { flex: 1, gap: 3 },
  chatTopLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatName: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  chatTime: { fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  chatTimeUnread: { color: colors.accentText, fontFamily: 'Inter_600SemiBold' },
  chatPreview: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  chatPreviewUnread: { color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  chatMeta: { fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
  unreadBadge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  // ── Quote row ──
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  quoteTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteBody: { flex: 1, gap: 3 },
  quoteName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  quoteService: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  quoteStatus: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, lineHeight: 16 },
  textGrey: { color: colors.textTertiary },
  quoteRight: { alignItems: 'flex-end', gap: 2 },
  quotePrice: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },
  quoteStamp: { fontSize: 11.5, lineHeight: 15, color: colors.textTertiary },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textTertiary,
  },

  emptyWrap: { flex: 1, paddingBottom: 120 },

  errorWrap: { alignItems: 'center', gap: spacing.md, paddingTop: spacing['2xl'] },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  errorBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
