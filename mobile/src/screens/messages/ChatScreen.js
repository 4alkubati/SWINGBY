import {
  View, FlatList, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { show as showToast } from '../../services/toast';
import * as haptics from '../../services/haptics';
import i18n from '../../i18n';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import ChatBookingSummary from '../../components/ChatBookingSummary';
import QuoteBubble from '../../components/QuoteBubble';
import { SkeletonBox } from '../../components/Skeleton';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

// Newest-first server rows and locally-appended optimistic rows are merged by
// id (see load()); this keeps the whole thread in send order regardless of
// source. Optimistic rows stamp sent_at = now, so they trail the last server
// row until their real timestamp arrives.
function msgSortKey(m) {
  return m?.sent_at || m?.created_at || '';
}

function mergeMessagesById(prev, serverItems) {
  const byId = new Map();
  // Local rows first (preserves optimistic sends + just-confirmed rows the
  // server poll may not have echoed yet), then overlay server truth.
  for (const m of prev) byId.set(m.id, m);
  for (const m of serverItems) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => {
    const ka = msgSortKey(a);
    const kb = msgSortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// Swap an optimistic row for the server row it turned into. A poll landing
// between the POST leaving and its response arriving can have merged that same
// server row in already, so this drops the temp row and re-merges rather than
// mapping in place — mapping in place would leave the same id twice and trip
// FlatList's duplicate-key warning.
function reconcileSent(prev, tempId, serverMsg) {
  const withoutTemp = prev.filter((m) => m.id !== tempId);
  if (!serverMsg?.id) return withoutTemp;
  return mergeMessagesById(withoutTemp, [{ ...serverMsg, _optimistic: false }]);
}

// Messages per fetch — both the newest-page poll and each older page pulled in
// when the user scrolls back. Matches the API's default `limit`.
const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeStr(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDot({ delay }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-5, { duration: 320 }),
          withTiming(0, { duration: 320 }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      translateY.value = 0;
    };
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[typingStyles.dot, dotStyle]} />;
}

function TypingIndicator() {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={typingStyles.wrapper}
    >
      <Surface elevation="subtle" rounded="pill" padding={0} style={typingStyles.bubble}>
        <Inline spacing="xs" style={typingStyles.inner}>
          <TypingDot delay={0} />
          <TypingDot delay={140} />
          <TypingDot delay={280} />
        </Inline>
      </Surface>
    </Animated.View>
  );
}

const typingStyles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginLeft: spacing.base,
    marginBottom: spacing.sm,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inner: {
    height: 20,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textSecondary,
  },
});

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ item, isMine }) {
  return (
    <Animated.View
      entering={FadeIn.springify()
        .stiffness(motion.spring.stiffness)
        .damping(motion.spring.damping)}
      style={[
        bubbleStyles.wrap,
        isMine ? bubbleStyles.wrapMine : bubbleStyles.wrapTheirs,
      ]}
    >
      <View
        style={[
          bubbleStyles.bubble,
          isMine ? bubbleStyles.bubbleMine : bubbleStyles.bubbleTheirs,
        ]}
      >
        <Text
          variant="body"
          style={{ color: isMine ? colors.textPrimary : colors.textPrimary, lineHeight: 22 }}
        >
          {item.content}
        </Text>
        <Text
          variant="caption"
          style={[
            bubbleStyles.time,
            { color: isMine ? colors.textSecondary : colors.textSecondary, opacity: isMine ? 0.65 : 1 },
          ]}
        >
          {item._optimistic ? 'sending…' : timeStr(item.sent_at)}
        </Text>
      </View>
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  wrapMine: { justifyContent: 'flex-end' },
  wrapTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: colors.accentBtn,
    borderBottomRightRadius: 4,
    ...shadows.subtle,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  time: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
});

// ─── Send button ──────────────────────────────────────────────────────────────

function SendButton({ onPress, disabled, loading }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: disabled ? 0.4 : 1,
  }));

  function handlePressIn() {
    if (disabled) return;
    scale.value = withSpring(0.88, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
  }

  function handlePress() {
    if (disabled || loading) return;
    // Micro-interaction: brief upward tilt
    rotate.value = withSequence(
      withTiming(-12, { duration: 100 }),
      withSpring(0, { stiffness: motion.spring.stiffness, damping: motion.spring.damping }),
    );
    onPress?.();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
    >
      <Animated.View style={[sendBtnStyles.btn, animatedStyle]}>
        <Feather name="arrow-up" size={20} color={colors.textPrimary} strokeWidth={1.8} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const sendBtnStyles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
});

// ─── Chat skeleton ────────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <View style={{ padding: spacing.base, gap: spacing.md }}>
      {/* Received */}
      <SkeletonBox height={44} width={200} borderRadius={18} style={{ borderBottomLeftRadius: 4 }} />
      {/* Sent */}
      <SkeletonBox height={36} width={160} borderRadius={18} style={{ alignSelf: 'flex-end', borderBottomRightRadius: 4 }} />
      {/* Received */}
      <SkeletonBox height={56} width={240} borderRadius={18} style={{ borderBottomLeftRadius: 4 }} />
      {/* Sent */}
      <SkeletonBox height={36} width={120} borderRadius={18} style={{ alignSelf: 'flex-end', borderBottomRightRadius: 4 }} />
    </View>
  );
}

// A booking thread's own endpoint (/messages/{bookingId}) carries no
// participant identity, so the self-heal below (when otherPartyName wasn't
// passed by the caller) reads it off the booking payload instead — same
// client/business/employee lens MessageThreadScreen already uses.
function deriveBookingCounterpart(bookingMeta, role) {
  if (!bookingMeta) return null;
  if (role === 'client') {
    const empUser = bookingMeta.employees?.users;
    return (
      (empUser && [empUser.first_name, empUser.last_name].filter(Boolean).join(' '))
      || bookingMeta.businesses?.business_name
      || null
    );
  }
  const clientUser = bookingMeta.users;
  return (
    (clientUser && [clientUser.first_name, clientUser.last_name].filter(Boolean).join(' '))
    || null
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  // A chat thread is either a booking thread or a pre-booking quote (interest) thread.
  const { bookingId, interestId, otherPartyName } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [threadInfo, setThreadInfo] = useState(null); // interest threads: {post_title, quoted_price, status}
  const [bookingMeta, setBookingMeta] = useState(null); // booking threads: self-heal source for the header name
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // simulated typing indicator state
  // Older-history paging (ported from MessageThreadScreen when the two screens
  // were consolidated): the API returns the newest `limit` messages plus a
  // `next_before` cursor for the page behind them.
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const listRef = useRef(null);
  // load() runs on a 5s interval, so it must not close over `messages` — the
  // ref gives the poll's error branch a current view without re-creating the
  // callback (and restarting the interval) on every new message.
  const messagesRef = useRef([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Only auto-scroll to the newest message when the user is already parked at
  // the bottom; otherwise a poll (or a page of older history) would yank them
  // away from what they were reading.
  const atBottomRef = useRef(true);

  // Booking payload — feeds two things: (1) self-heal the header name when
  // the caller didn't pass one (already used elsewhere, e.g.
  // MessageThreadScreen), and (2) CARD-20's "disappearing chat" banner below,
  // which needs to know whether a date is confirmed yet. Always fetched for
  // booking threads (not just when the name is missing) so ConfirmDateCard
  // can reuse this instead of self-fetching a second time.
  const loadBookingMeta = useCallback(() => {
    if (!bookingId) return;
    api.get(`/bookings/${bookingId}`)
      .then((data) => setBookingMeta(data))
      .catch(() => { /* best-effort — header/banner keep their fallback */ });
  }, [bookingId]);

  useEffect(() => { loadBookingMeta(); }, [loadBookingMeta]);

  // Resolved header identity: caller-provided name wins; otherwise self-heal
  // from data this screen already fetches (booking payload / interest thread info).
  const headerName = otherPartyName
    || deriveBookingCounterpart(bookingMeta, user?.role)
    || threadInfo?.post_title
    || null;

  // #9 — tap the header through to the counterpart business's profile. Only a
  // client has a business to open (the provider's counterpart is the client,
  // who has no public profile), and BusinessProfile is a client-stack route.
  // Booking threads read business_id straight off bookingMeta (already
  // fetched); interest threads get it from threadInfo (backend now includes
  // business_id in the interest payload).
  const counterpartBusinessId = bookingMeta?.business_id || threadInfo?.business_id || null;
  const canOpenBusiness = user?.role === 'client' && !!counterpartBusinessId;
  const openBusinessProfile = useCallback(() => {
    if (!canOpenBusiness) return;
    navigation.navigate('BusinessProfile', { businessId: counterpartBusinessId });
  }, [canOpenBusiness, counterpartBusinessId, navigation]);

  const load = useCallback(async (before = null) => {
    if (!before) setError(null);
    const path = interestId ? `/messages/interest/${interestId}` : `/messages/${bookingId}`;
    try {
      // _silent: this screen renders its own inline error + Retry, so the
      // global failure toast would just spam once every poll.
      const data = await api.get(path, {
        params: { limit: PAGE_SIZE, ...(before ? { before } : {}) },
        _silent: true,
      });
      // API returns { items: [...] } newest-first; the list renders oldest-first.
      // Merge by id instead of replacing wholesale — a full replace mid-send
      // WIPED the just-sent (optimistic) message whenever a 5s poll landed
      // before the POST resolved (#7b). mergeMessagesById keeps local rows the
      // server hasn't echoed yet and overlays server truth on the rest, and it
      // is also what makes paging older history safe alongside the poll.
      const items = Array.isArray(data) ? data : (data?.items || []);
      const serverItems = [...items].reverse();
      setMessages((prev) => mergeMessagesById(prev, serverItems));
      if (data?.interest) setThreadInfo(data.interest);
      // Only the first page (and each older page) moves the cursor; a poll
      // re-reads the newest page and must not clobber it.
      if (before || cursor === null) {
        setCursor(data?.next_before ?? null);
        setHasMore(items.length === PAGE_SIZE);
      }
    } catch (err) {
      if (!messagesRef.current.length) {
        setError(err?.message || 'Could not load messages.');
      }
      // keep stale on background poll failure
    } finally {
      setLoading(false);
    }
    // `cursor` is deliberately excluded: it changes as the user pages back and
    // would otherwise restart the 5s poll interval below on every page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, interestId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    await load(cursor);
    setLoadingMore(false);
  }, [cursor, hasMore, load, loadingMore]);

  const handleScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottomRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
    if (contentOffset.y <= 24) loadOlder();
  }, [loadOlder]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Optimistic send (#7a) — append the bubble immediately, then reconcile
    // with the server row on success. Ported from MessageThreadScreen, which
    // already did this; ChatScreen previously awaited the POST before showing
    // anything, so the message sat invisible for the whole round-trip.
    const tempId = `_opt_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic = {
      id: tempId,
      content: trimmed,
      sender_id: user?.id,
      sent_at: now,
      created_at: now,
      _optimistic: true,
    };

    setText('');
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    atBottomRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      haptics.buttonTap();
      // _retryNonGet lets the retry interceptor re-issue this POST after a
      // network error / cold start (#7d); the server dedupes a retried write
      // via the X-Send-Retry header so a committed-but-lost send won't double.
      const res = await api.post(
        '/messages/',
        {
          ...(interestId ? { interest_id: interestId } : { booking_id: bookingId }),
          content: trimmed,
        },
        { _retryNonGet: true },
      );
      const msg = res?.data || res;
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      // Off-platform-leakage guard (item 31): the backend strips phone numbers
      // and emails from message content and flags it. Tell the user why their
      // number/email vanished so it doesn't read as a bug.
      if (res?.masked) {
        haptics.warningTap();
        showToast({
          type: 'info',
          text1: 'Contact info hidden',
          text2: 'Keep phone numbers and emails in SwingBy — payments and support are only covered here.',
        });
      }
    } catch {
      // Drop the optimistic bubble and restore the draft so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(trimmed);
    } finally {
      setSending(false);
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
          <Text variant="bodyMedium">{headerName || 'Chat'}</Text>
          <View style={{ width: 32 }} />
        </View>
        <ChatSkeleton />
      </View>
    );
  }

  // ── Error (initial load only) ────────────────────────────────────────────────

  if (error && !messages.length) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text variant="bodyMedium">{headerName || 'Chat'}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorContainer}>
          <View style={[styles.center, { gap: spacing.md }]}>
            <Feather name="alert-triangle" size={32} color={colors.warning} strokeWidth={1.8} />
            <Text variant="small" color="secondary">{error}</Text>
            {/* Arrow-wrapped: onPress hands the press event through, and load()
                would read it as the `before` cursor. */}
            <Button variant="primary" label="Retry" onPress={() => load()} style={{ minWidth: 120 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Surface
        elevation="none"
        background="default"
        rounded={0}
        padding={0}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerCenter}
          onPress={openBusinessProfile}
          disabled={!canOpenBusiness}
          activeOpacity={canOpenBusiness ? 0.6 : 1}
          accessibilityRole={canOpenBusiness ? 'button' : undefined}
          accessibilityLabel={canOpenBusiness ? `View ${headerName || 'business'} profile` : undefined}
          hitSlop={6}
        >
          <View style={styles.avatarSmall}>
            <Text
              variant="caption"
              style={{ color: colors.accentText, fontWeight: '700' }}
            >
              {(headerName || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Inline spacing="xs" align="center">
              <Text variant="bodyMedium">{headerName || 'Chat'}</Text>
              {canOpenBusiness ? (
                <Feather name="chevron-right" size={14} color={colors.textSecondary} />
              ) : null}
            </Inline>
            {/* Interest threads only: booking threads surface their quote in the
                floating QuoteBubble, not the header subtitle. */}
            {threadInfo && !bookingId ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {[
                  threadInfo.post_title,
                  threadInfo.quoted_price != null ? `$${threadInfo.quoted_price} quoted` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <View style={{ width: 32 }} />
      </Surface>

      {/* ── Pinned booking context ─────────────────────────────────────────
          Owner direction (2026-07-21): once a quote is accepted the thread's
          identity IS the booking, so the booking is the primary content —
          summary card first, and the quote that started it demoted to the
          collapsed bubble underneath. Interest (pre-booking) threads have no
          booking yet: their quote stays in the header subtitle instead. */}
      {!!bookingId && (
        <View style={styles.contextBlock}>
          <ChatBookingSummary
            booking={bookingMeta}
            onPress={() => navigation.navigate('BookingDetails', { bookingId })}
          />

          {/* #13 — the demoted quote. Backend already hands booking threads
              their quote context under `interest` (_quote_context_for_booking),
              so this is presentation only. */}
          <QuoteBubble quote={threadInfo} />

          {/* CARD-20 — "disappearing chat" framing. A booking thread with no
              confirmed_date yet is the pre-confirm state of D2's entry flow:
              the job was posted without a time, so this chat is temporary
              until one gets agreed below. It disappears the moment bookingMeta
              reloads with a confirmed_date (ConfirmDateCard's onConfirmed). */}
          {!!bookingMeta && !bookingMeta.confirmed_date && (
            <Surface elevation="none" background="alt" rounded="input" padding="sm">
              <Inline spacing="xs" align="center">
                <Feather name="clock" size={13} color={colors.textSecondary} />
                <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                  {i18n.t('chat.disappearingBanner')}
                </Text>
              </Inline>
            </Surface>
          )}

          {/* Pinned confirm-date handshake card (UBER-3) — two-sided: either
              party proposes times, the other accepts. Suppressed once a date
              is confirmed: its confirmed banner would just repeat the date the
              summary card above already shows, and chat needs the room. */}
          {!bookingMeta?.confirmed_date && (
            <ConfirmDateCard
              bookingId={bookingId}
              booking={bookingMeta}
              onConfirmed={loadBookingMeta}
              style={{ marginBottom: 0 }}
            />
          )}
        </View>
      )}

      {/* ── Messages list ──────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          // Stay put when the user has scrolled up to read (or just pulled in a
          // page of older history) — only follow the tail when they're at it.
          if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          loadingMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyIcon}>
              <Feather name="message-circle" size={28} color={colors.accentText} strokeWidth={1.8} />
            </View>
            <Text variant="bodyMedium" style={{ textAlign: 'center' }}>
              No messages yet
            </Text>
            <Text variant="small" color="secondary" style={{ textAlign: 'center', marginTop: spacing.xs }}>
              Say hello — start the conversation!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return <MessageBubble item={item} isMine={isMine} />;
        }}
        ListFooterComponent={isTyping ? <TypingIndicator /> : null}
      />

      {/* Off-platform-leakage notice (item 31) — always visible above the
          composer so hidden phone/email content never reads as a bug. */}
      <Text variant="caption" color="secondary" style={styles.leakageNote}>
        Keep it on SwingBy — shared phone numbers and emails are hidden.
      </Text>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <Surface
        elevation="subtle"
        background="default"
        rounded={0}
        padding={0}
        style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}
      >
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <SendButton
          onPress={handleSend}
          disabled={!text.trim() || sending}
          loading={sending}
        />
      </Surface>
    </KeyboardAvoidingView>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: radius.avatar,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pinned booking context above the thread: summary card → quote bubble →
  // schedule state. One owner of the vertical rhythm so the blocks never
  // double up their own margins.
  contextBlock: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },

  messagesList: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  emptyChat: {
    paddingTop: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  leakageNote: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
    fontFamily: 'Inter_400Regular',
  },
});
