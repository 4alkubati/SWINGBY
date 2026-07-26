import {
  View, FlatList, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// Already a dependency (mobile/package.json), already used by
// business/ProofOfWorkScreen.js, client/PostJobScreen.js and the dispute flow.
// M11 adds no native module: photos ride the SAME picker and the SAME
// POST /uploads/image endpoint, so this ships as a JS-only OTA update.
import * as ImagePicker from 'expo-image-picker';
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
import { useUnread } from '../../context/UnreadContext';
import { api, uploadFile } from '../../services/api';
import { show as showToast } from '../../services/toast';
import * as haptics from '../../services/haptics';
import i18n from '../../i18n';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import ChatBookingSummary from '../../components/ChatBookingSummary';
import ChatQuoteCard from '../../components/ChatQuoteCard';
// M11 — the thread stops being text-only. Both cards are new files; the
// lightbox is the one that already exists and is reused as-is.
import ChatImageBubble from '../../components/ChatImageBubble';
import ChatTermsCard from '../../components/ChatTermsCard';
import ImageViewer from '../../components/ImageViewer';
import SendTermsSheet from './SendTermsSheet';
// LANE 3 owns components/PaySheet.js (design/handoff-jet-pulse/PAYMENTS.md).
// This screen is Path B's entry point: "Accept & pay" opens the ONE shared
// sheet, and no dollar figure may appear anywhere before it does.
import PaySheet from '../../components/PaySheet';
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
  const { mark } = useUnread();
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
  // Quote card (canvas 3a) — Path B of PAYMENTS.md runs from here.
  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  // M11 — photos + in-thread agreements.
  const [viewerIndex, setViewerIndex] = useState(null); // null = lightbox closed
  const [termsSheetVisible, setTermsSheetVisible] = useState(false);
  const [termsSending, setTermsSending] = useState(false);
  const [termsBusyId, setTermsBusyId] = useState(null);

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

  // B13 — the unread badge did not clear after opening a thread. The server
  // marks the thread read on GET, but the tab-bar badge renders from
  // UnreadContext's cached 30s poll, so it kept showing "(1)" for up to half a
  // minute after the messages were plainly on screen. Zero it locally the
  // moment the thread is open. (UnreadContext keys its map by booking id only,
  // so a quote thread's unread still waits for the next poll — see the PR
  // notes; fixing that needs a change in context/UnreadContext.js.)
  useEffect(() => {
    if (bookingId) mark(bookingId);
  }, [bookingId, mark]);

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

  // ── Photos in the thread (M11) ───────────────────────────────────────────────
  //
  // Upload FIRST, write the message row SECOND — the same order
  // ProofOfWorkScreen and the dispute flow already use. A failed upload leaves
  // no half-message behind, and a failed message leaves an orphaned object in
  // storage rather than a broken bubble.
  //
  // PRIVACY: this deliberately reuses POST /uploads/image, the one path every
  // other photo in the app already takes. It does NOT widen who can see
  // anything — a thread photo is only ever handed out by the two participant-
  // gated message reads (see backend/app/api/messages.py::_attachment_url for
  // the full reasoning and the note on moving to signed URLs later).
  const threadKey = interestId
    ? { interest_id: interestId }
    : { booking_id: bookingId };

  // Every photo in the thread, in send order — the lightbox pages through them
  // all, not just the one that was tapped.
  const photos = useMemo(
    () =>
      messages
        .filter((m) => m.message_type === 'image')
        .map((m) => m._localUri || m.attachment_url)
        .filter(Boolean),
    [messages],
  );

  function photoIndexOf(item) {
    const uri = item?._localUri || item?.attachment_url;
    const i = photos.indexOf(uri);
    return i >= 0 ? i : 0;
  }

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Photos permission needed',
        'Allow photo access so you can show them what you mean.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      // No EXIF: a job photo's GPS tag is the client's home address, and the
      // walkthrough audit's worst finding (L3) was photos leaking exactly that.
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) sendPhoto(asset);
  }

  async function sendPhoto(asset, existingId = null) {
    const tempId = existingId || `_img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Optimistic bubble showing the LOCAL file, so the photo is in the thread
    // before the upload finishes (#7a, same contract as an optimistic text send).
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      return [
        ...withoutTemp,
        {
          id: tempId,
          message_type: 'image',
          content: 'Photo',
          sender_id: user?.id,
          sent_at: now,
          created_at: now,
          attachment_width: asset?.width,
          attachment_height: asset?.height,
          _localUri: asset?.uri,
          _asset: asset,
          _optimistic: true,
        },
      ];
    });
    atBottomRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    try {
      haptics.buttonTap();
      const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const up = await uploadFile('/uploads/image', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName || `chat_${Date.now()}.${ext}`,
      });

      const res = await api.post(
        '/messages/',
        {
          ...threadKey,
          message_type: 'image',
          attachment_url: up.url,
          attachment_path: up.path,
          ...(asset?.width ? { attachment_width: Math.round(asset.width) } : {}),
          ...(asset?.height ? { attachment_height: Math.round(asset.height) } : {}),
        },
        { _retryNonGet: true },
      );
      const msg = res?.data || res;
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch {
      // Keep the bubble and mark it — the photo is still tappable to retry, so
      // a flaky upload never silently eats what somebody tried to send.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, _optimistic: true, _failed: true } : m,
        ),
      );
    }
  }

  // ── Terms in the thread (M11) ────────────────────────────────────────────────

  function replaceTerms(messageId, terms) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, terms } : m)),
    );
  }

  async function handleSendTerms({ title, terms_text }) {
    setTermsSending(true);
    try {
      const res = await api.post('/messages/terms', { ...threadKey, title, terms_text });
      const msg = res?.data || res;
      if (msg?.id) setMessages((prev) => mergeMessagesById(prev, [msg]));
      setTermsSheetVisible(false);
      haptics.successTap?.();
      atBottomRef.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      return true;
    } catch (err) {
      showToast({
        type: 'error',
        text1: "Couldn't send those terms",
        text2: err?.message || '',
      });
      return false;
    } finally {
      setTermsSending(false);
    }
  }

  // The tap that makes it an agreement. Confirmed first — an accepted record is
  // permanent for both sides, so it must not be reachable by a mis-tap.
  function handleAcceptTerms(item) {
    const terms = item?.terms;
    if (!terms?.id || termsBusyId) return;
    Alert.alert(
      'Agree to these terms?',
      'Your name and the time are recorded against this exact wording. Neither side can edit it afterwards.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'I agree',
          onPress: async () => {
            setTermsBusyId(terms.id);
            try {
              const res = await api.post(`/messages/terms/${terms.id}/accept`);
              const updated = res?.data || res;
              if (updated?.id) replaceTerms(item.id, updated);
              haptics.successTap?.();
            } catch (err) {
              showToast({
                type: 'error',
                text1: "Couldn't record your agreement",
                text2: err?.message || '',
              });
              load();
            } finally {
              setTermsBusyId(null);
            }
          },
        },
      ],
    );
  }

  async function handleWithdrawTerms(item) {
    const terms = item?.terms;
    if (!terms?.id || termsBusyId) return;
    setTermsBusyId(terms.id);
    try {
      const res = await api.post(`/messages/terms/${terms.id}/withdraw`);
      const updated = res?.data || res;
      if (updated?.id) replaceTerms(item.id, updated);
    } catch (err) {
      showToast({
        type: 'error',
        text1: "Couldn't withdraw those terms",
        text2: err?.message || '',
      });
      load();
    } finally {
      setTermsBusyId(null);
    }
  }

  // ── The quote card (canvas 3a) ───────────────────────────────────────────────
  // A quote thread's whole reason to exist is the quote, so it renders as the
  // first bubble in the stream (an interest always predates every message on
  // it). On a booking thread the same component renders the collapsed
  // "Accepted" record above the conversation.
  const isBusinessSide = user?.role === 'business_owner' || user?.role === 'employee';

  // pending | accepted | expired | declined — derived from the interest row the
  // messages endpoint hands back alongside the thread.
  const quoteStatus = (() => {
    if (!threadInfo) return null;
    if (threadInfo.status === 'accepted') return 'accepted';
    if (threadInfo.status === 'rejected') return 'declined';
    const postStatus = threadInfo.post_status;
    if (postStatus && postStatus !== 'open' && postStatus !== 'matched') return 'expired';
    return 'pending';
  })();

  const quotePending = !bookingId && quoteStatus === 'pending';

  async function handleDeclineQuote() {
    if (quoteBusy || !interestId) return;
    setQuoteBusy(true);
    try {
      await api.patch(`/interests/${interestId}/reject`);
      setThreadInfo((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
      haptics.buttonTap();
    } catch (err) {
      showToast({
        type: 'error',
        text1: i18n.t('quoteCard.declineError'),
        text2: err?.message || '',
      });
    } finally {
      setQuoteBusy(false);
    }
  }

  // PAYMENTS.md Path B: charge first, accept second. The sheet owns the charge
  // and calls this only once its CTA is confirmed; accepting is what turns the
  // quote into a booking (and creates the escrow payment row server-side).
  async function handleConfirmPayment() {
    const res = await api.patch(`/interests/${interestId}/accept`);
    const newBookingId = res?.booking?.id;
    setPaySheetVisible(false);
    setThreadInfo((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
    if (newBookingId) {
      navigation.replace('Chat', { bookingId: newBookingId, otherPartyName: headerName });
    }
  }

  function renderQuoteCard() {
    if (bookingId) {
      // Resolved record — the quote that became this booking.
      if (!threadInfo) return null;
      return (
        <ChatQuoteCard
          status="accepted"
          side={isBusinessSide ? 'business' : 'client'}
          price={threadInfo.quoted_price}
          paidTotal={bookingMeta?.total_amount ?? threadInfo.quoted_price}
          when={bookingMeta?.confirmed_date
            ? new Date(bookingMeta.confirmed_date).toLocaleDateString('en-CA', {
              weekday: 'short', month: 'short', day: 'numeric',
            })
            : null}
          onView={() => navigation.navigate('BookingDetails', { bookingId })}
        />
      );
    }
    if (!threadInfo || !quoteStatus) return null;
    return (
      <ChatQuoteCard
        status={quoteStatus}
        side={isBusinessSide ? 'business' : 'client'}
        price={threadInfo.quoted_price}
        service={threadInfo.post_title}
        expiresAt={threadInfo.expires_at}
        busy={quoteBusy}
        onAccept={() => setPaySheetVisible(true)}
        onDecline={handleDeclineQuote}
        // Withdraw / edit of a sent quote have no backend route yet
        // (interests exposes create / accept / reject only), so the buttons
        // render disabled rather than lying about what they do.
        canWithdraw={false}
        canEdit={false}
      />
    );
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
            {/* Interest threads only. While the quote is live the subtitle
                says exactly what this thread is — "Quote · not booked yet" in
                amber — so nobody mistakes a negotiation for a booking (5a).
                No price here: the quote's own card carries the figure. */}
            {threadInfo && !bookingId ? (
              <Text
                variant="caption"
                numberOfLines={1}
                style={quotePending ? { color: colors.warning } : { color: colors.textSecondary }}
              >
                {quotePending
                  ? i18n.t('chat.quoteNotBooked')
                  : (threadInfo.post_title || '')}
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

          {/* The quote that became this booking, collapsed to its one-line
              resolved record (3a). Backend already hands booking threads their
              quote context under `interest` (_quote_context_for_booking), so
              this is presentation only. */}
          {renderQuoteCard()}

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
          <>
            {loadingMore ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null}
            {/* Quote threads: the quote is the first thing in the stream. */}
            {!bookingId ? renderQuoteCard() : null}
          </>
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

          // M11 — a thread row is now typed. Anything unrecognised falls
          // through to the text bubble it has always been, so an older client
          // reading a newer message type still renders its preview line
          // instead of a blank row.
          if (item.message_type === 'image') {
            return (
              <ChatImageBubble
                item={item}
                isMine={isMine}
                onPress={() => setViewerIndex(photoIndexOf(item))}
                onRetry={() => item._asset && sendPhoto(item._asset, item.id)}
              />
            );
          }

          if (item.message_type === 'terms' && item.terms) {
            return (
              <ChatTermsCard
                terms={item.terms}
                isMine={isMine}
                busy={termsBusyId === item.terms.id}
                onAccept={() => handleAcceptTerms(item)}
                onWithdraw={() => handleWithdrawTerms(item)}
              />
            );
          }

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
        {/* Attachments. Neutral, never accent — the send button is this
            screen's one purple element (POLISH-TIPS §2). 36px visual with a
            44px hit area via hitSlop (§6). */}
        <TouchableOpacity
          onPress={handlePickPhoto}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Send a photo"
          style={styles.attachBtn}
        >
          <Feather name="image" size={19} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>

        {/* Only the provider side proposes terms — the client is the party who
            agrees, and the server enforces the same rule. */}
        {isBusinessSide && (
          <TouchableOpacity
            onPress={() => setTermsSheetVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Send terms to agree"
            style={styles.attachBtn}
          >
            <Feather name="file-text" size={19} color={colors.textSecondary} strokeWidth={1.8} />
          </TouchableOpacity>
        )}

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

      {/* PAYMENTS.md Path B — the one shared sheet. It owns the fee, the total
          and the charge; this screen only says which quote is being paid. */}
      <PaySheet
        visible={paySheetVisible}
        mode="pay"
        quote={{
          interestId,
          subtotal: threadInfo?.quoted_price,
          summary: threadInfo?.post_title,
        }}
        onClose={() => setPaySheetVisible(false)}
        onConfirm={handleConfirmPayment}
      />

      {/* The existing lightbox, reused as-is — it already pages, counts and
          dismisses. Thread photos are just another set of URIs to it. */}
      <ImageViewer
        visible={viewerIndex !== null}
        images={photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      <SendTermsSheet
        visible={termsSheetVisible}
        sending={termsSending}
        onClose={() => setTermsSheetVisible(false)}
        onSend={handleSendTerms}
      />
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
  // POLISH-TIPS §8 — empty states are a 28px Feather icon in a 64px tinted
  // circle. This was a 20px-radius square on `surface`.
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
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
  // Attachment buttons sit on the input row's baseline with the composer.
  attachBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
