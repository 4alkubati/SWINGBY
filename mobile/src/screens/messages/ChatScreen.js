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
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUnread } from '../../context/UnreadContext';
import { api, uploadFile } from '../../services/api';
import {
  acceptQuoteAndPay,
  ACCEPT_CANCELLED,
  ACCEPT_CHECKOUT,
  ACCEPT_PAID,
} from '../../services/acceptAndPay';
import { show as showToast } from '../../services/toast';
import * as haptics from '../../services/haptics';
import i18n from '../../i18n';
import { resolveQuoteStatus } from '../../utils/quoteStatus';
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
import BusinessLogo from '../../components/BusinessLogo';
// Guideline 1.2 — report + block. The sheet is shared with every other
// reportable surface (reviews, posts, business profiles).
import ReportSheet from '../../components/ReportSheet';
import * as moderation from '../../services/moderation';
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

// F021: a typing indicator (TypingDot/TypingIndicator + isTyping state) used
// to live here, but there was never a real signal behind it — no typing-event
// endpoint, no websocket presence, nothing anywhere ever called setIsTyping.
// It was permanently "simulated" (per its own state comment) and could never
// turn on. Wiring a real one needs a backend presence/typing-event channel
// that doesn't exist yet; that's a new feature, not a mobile-only fix, so it
// was removed rather than left dead. See TRIAGE-mobile-2026-08-10.md F021.

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ item, isMine, onReport }) {
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
      {/* Long-press to report (Guideline 1.2(b)). Only on messages the reader
          did NOT send — reporting your own message is a 400 server-side, so
          the gesture simply isn't offered there. No visual affordance by
          design: a report button on every bubble would shout at a thread that
          is almost always fine, and long-press is the platform idiom for
          "act on this message". */}
      <TouchableOpacity
        activeOpacity={isMine ? 1 : 0.85}
        onLongPress={isMine ? undefined : () => onReport?.(item)}
        delayLongPress={400}
        accessibilityRole={isMine ? undefined : 'button'}
        accessibilityHint={isMine ? undefined : i18n.t('moderation.reportMessage')}
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
      </TouchableOpacity>
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
  // Guideline 1.2 — report + block. `counterpartId` comes from the thread
  // payload (messages.py::_counterpart_user_id); without it the Block control
  // has nobody to block, so it hides rather than guessing.
  const [counterpartId, setCounterpartId] = useState(null);
  const [threadBlocked, setThreadBlocked] = useState(false);
  // { targetType, targetId } while the report sheet is open, else null. Holding
  // the target here rather than in two booleans is what lets ONE sheet serve
  // both "report this thread" and "report this message".
  const [reportTarget, setReportTarget] = useState(null);

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
  // The header's face. Only a client has a business on the other side, so the
  // logo is scoped to that lens — a provider keeps the initial-letter circle
  // for the person they're talking to (businesses are tiles, people circles).
  const counterpartLogo = user?.role === 'client'
    ? (bookingMeta?.businesses?.logo_url || threadInfo?.business_logo || null)
    : null;
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
      // Booking threads carry it at the top level (a direct geo-browse booking
      // has no `interest` at all); interest threads carry it inside `interest`.
      const nextCounterpart =
        data?.counterpart_user_id ?? data?.interest?.counterpart_user_id ?? null;
      if (nextCounterpart) setCounterpartId(nextCounterpart);
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
        // F029: silenced so this catch owns the toast — a blocked-pair 403 or
        // a content-moderation BLOCK each have purpose-built, three-locale
        // copy below that the generic "Request failed" toast was masking.
        { _retryNonGet: true, _silent: true },
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
          text2: 'Keep phone numbers and emails in SwingByy — payments and support are only covered here.',
        });
      }
    } catch (err) {
      // Drop the optimistic bubble and restore the draft so the user can retry.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(trimmed);
      // messages.py's blocked-pair 403 and content_moderation.BLOCK_MESSAGE
      // (400) are the two backend detail strings this thread can actually
      // hit on send — matched here because _silent above means nothing else
      // will tell the user why the send failed.
      const detail = err?.message || '';
      if (/blocked the other/i.test(detail)) {
        setThreadBlocked(true);
        showToast({
          type: 'error',
          text1: i18n.t('moderation.threadBlockedTitle'),
          text2: i18n.t('moderation.threadBlockedBody'),
        });
      } else if (/can.?t be sent/i.test(detail)) {
        showToast({
          type: 'error',
          text1: 'Message not sent',
          text2: i18n.t('moderation.messageRefused'),
        });
      } else {
        showToast({ type: 'error', text1: 'Request failed', text2: detail || 'Something went wrong' });
      }
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
  // The SAME function the inbox uses (utils/quoteStatus.js). This used to be a
  // local copy that checked `post_status` and never compared a clock, so a
  // quote whose own window had elapsed showed as "Expired" in the inbox and
  // fully live in here — Accept & pay and Decline both offered on a dead quote.
  const quoteStatus = resolveQuoteStatus(
    threadInfo && { status: threadInfo.status, created_at: threadInfo.created_at },
    threadInfo && {
      status: threadInfo.post_status,
      expires_at: threadInfo.post_expires_at || threadInfo.expires_at,
    },
  );

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

  // ── Safety: report + block (App Store Guideline 1.2) ──────────────────────
  //
  // Chat is the highest-value placement in the app for both controls — it is
  // where abuse actually arrives, and it is the first place a reviewer looks
  // for them. Both hang off one header overflow rather than two header icons,
  // because the header already carries a back arrow and a tappable
  // business identity, and a third and fourth control there is clutter.

  // Whether the thread is already blocked decides what the menu offers and
  // whether the composer is usable. Re-checked whenever the counterpart
  // resolves; fails open (services/moderation.js::isBlocked), because the send
  // itself is gated server-side and that is the real enforcement.
  useEffect(() => {
    let cancelled = false;
    if (!counterpartId) return undefined;
    (async () => {
      const blocked = await moderation.isBlocked(counterpartId);
      if (!cancelled) setThreadBlocked(blocked);
    })();
    return () => {
      cancelled = true;
    };
  }, [counterpartId]);

  // Native action sheet rather than a custom menu: it is the platform pattern
  // for "pick one action", it is what Alert.alert already does everywhere else
  // in this screen, and it needs no new surface to maintain.
  function openSafetyMenu() {
    if (!counterpartId) return;
    const options = [
      {
        text: i18n.t('moderation.reportUser'),
        onPress: () =>
          setReportTarget({
            targetType: moderation.REPORT_TARGETS.USER,
            targetId: counterpartId,
          }),
      },
      threadBlocked
        ? { text: i18n.t('moderation.unblock'), onPress: confirmUnblock }
        : {
            text: i18n.t('moderation.blockUser'),
            style: 'destructive',
            onPress: confirmBlock,
          },
      { text: i18n.t('common.cancel'), style: 'cancel' },
    ];
    Alert.alert(i18n.t('moderation.safety'), null, options, { cancelable: true });
  }

  function confirmBlock() {
    if (!counterpartId) return;
    const name = headerName || otherPartyName || '';
    Alert.alert(
      i18n.t('moderation.blockConfirmTitle', { name }),
      i18n.t('moderation.blockConfirmBody'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('moderation.block'),
          style: 'destructive',
          onPress: async () => {
            try {
              await moderation.blockUser(counterpartId);
              setThreadBlocked(true);
              haptics.buttonTap();
              showToast({ type: 'success', text1: i18n.t('moderation.blocked') });
            } catch {
              showToast({ type: 'error', text1: i18n.t('moderation.blockFailed') });
            }
          },
        },
      ],
    );
  }

  function confirmUnblock() {
    if (!counterpartId) return;
    const name = headerName || otherPartyName || '';
    Alert.alert(
      i18n.t('moderation.unblockConfirmTitle', { name }),
      i18n.t('moderation.unblockConfirmBody'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('moderation.unblock'),
          onPress: async () => {
            try {
              await moderation.unblockUser(counterpartId);
              setThreadBlocked(false);
              haptics.buttonTap();
            } catch {
              showToast({ type: 'error', text1: i18n.t('moderation.blockFailed') });
            }
          },
        },
      ],
    );
  }

  // Long-press a bubble to report that specific message. The overflow reports
  // the PERSON; this reports the thing they said, which is what an admin can
  // actually hide.
  function reportMessage(message) {
    if (!message?.id || message.sender_id === user?.id) return;
    haptics.buttonTap();
    setReportTarget({
      targetType: moderation.REPORT_TARGETS.MESSAGE,
      targetId: message.id,
    });
  }

  // PAYMENTS.md §S2(c) — "client agrees → client pays THEN".
  //
  // FOUNDER RULING 2026-07-25: accepting charges immediately, in-app. This used
  // to accept the quote and navigate, leaving the booking at 'pending_payment'
  // and the client to find the pay button later (or, from
  // QuoteComparisonScreen, to be thrown into a browser). The ordering and the
  // cancel/decline semantics live in services/acceptAndPay.js so this screen
  // and QuoteComparisonScreen cannot drift apart.
  //
  // Persisted across CTA taps: PATCH /interests/{id}/accept is not repeatable,
  // so a retry after a declined card must charge the SAME booking rather than
  // re-accepting. Also tells handleClosePaySheet that a booking is on the hook.
  const acceptedRef = useRef(null);

  async function handleConfirmPayment() {
    const result = await acceptQuoteAndPay({
      interestId,
      email: user?.email,
      accepted: acceptedRef.current,
      onAccepted: (accepted) => { acceptedRef.current = accepted; },
    });

    // A dismissed Stripe sheet is a choice, not a failure. Keep our sheet open
    // so retrying is one tap; handleClosePaySheet covers walking away entirely.
    if (result.outcome === ACCEPT_CANCELLED) return;

    setPaySheetVisible(false);
    acceptedRef.current = null;
    setThreadInfo((prev) => (prev ? { ...prev, status: 'accepted' } : prev));

    if (result.outcome === ACCEPT_PAID) {
      showToast({ type: 'success', text1: i18n.t('quotes.paidAndBooked') });
    } else if (result.outcome === ACCEPT_CHECKOUT) {
      showToast({
        type: 'info',
        text1: i18n.t('quotes.accepted'),
        text2: i18n.t('quotes.finishInBrowser'),
      });
    }

    navigation.replace('Chat', {
      bookingId: result.bookingId,
      otherPartyName: headerName,
    });
  }

  // The accept already ran and the client backed out of paying. It cannot be
  // rolled back from here — the server has rejected the rival quotes and matched
  // the post — so the rule is simply that it is never left behind QUIETLY.
  function handleClosePaySheet() {
    const pending = acceptedRef.current;
    setPaySheetVisible(false);
    if (!pending?.bookingId) return;

    acceptedRef.current = null;
    setThreadInfo((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
    showToast({
      type: 'warning',
      text1: i18n.t('quotes.notPaidYet'),
      text2: i18n.t('quotes.notPaidYetBody'),
    });
    navigation.navigate('BookingDetails', { bookingId: pending.bookingId });
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
          {counterpartLogo ? (
            <BusinessLogo uri={counterpartLogo} name={headerName} size={30} radius={9} />
          ) : (
            <View style={styles.avatarSmall}>
              <Text
                variant="caption"
                style={{ color: colors.accentText, fontWeight: '700' }}
              >
                {(headerName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
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
        {/* Guideline 1.2 — Report / Block. This slot was a dead 32px spacer
            holding the title centred; the overflow is the same width, so the
            header keeps its balance and gains the two controls App Review
            looks for. Hidden only when there is genuinely nobody on the other
            side (counterpart unresolved), never merely because it is a quote
            thread — pre-acceptance chat is exactly where abuse arrives. */}
        {counterpartId ? (
          <TouchableOpacity
            onPress={openSafetyMenu}
            hitSlop={10}
            style={{ width: 32, alignItems: 'flex-end' }}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('moderation.safety')}
          >
            <Feather name="more-vertical" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </Surface>

      {/* Blocked threads say so instead of letting the user type into a
          composer whose send will 403. */}
      {threadBlocked ? (
        <View style={styles.blockedBanner}>
          <Feather name="slash" size={16} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium">{i18n.t('moderation.threadBlockedTitle')}</Text>
            <Text variant="caption" color="secondary">
              {i18n.t('moderation.threadBlockedBody')}
            </Text>
          </View>
        </View>
      ) : null}

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
        // The composer keeps the keyboard up for most of this screen's life,
        // and the list header carries the quote card — accept/decline included.
        // With the default "never", the first tap on any of that is spent
        // dismissing the keyboard, so accepting a quote mid-conversation
        // silently does nothing until you tap again. Money path; "handled"
        // delivers the tap to the control that owns it.
        keyboardShouldPersistTaps="handled"
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

          return <MessageBubble item={item} isMine={isMine} onReport={reportMessage} />;
        }}
      />

      {/* Off-platform-leakage notice (item 31) — always visible above the
          composer so hidden phone/email content never reads as a bug. */}
      <Text variant="caption" color="secondary" style={styles.leakageNote}>
        Keep it on SwingByy — shared phone numbers and emails are hidden.
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
          disabled={!text.trim() || sending || threadBlocked}
          loading={sending}
        />
      </Surface>

      {/* PAYMENTS.md Path B — the one shared sheet. It owns the fee, the total
          and the charge; this screen only says which quote is being paid.

          `amount` + `interestId`, NOT a `quote` object: a caller-supplied quote
          is rendered verbatim and this screen has no server TOTAL to supply —
          only the business's bid. It was passing `{ subtotal }` with no `total`,
          so the sheet rendered "Confirm & pay —" and an em-dash where the figure
          belongs. Handing over the amount instead lets PaySheet price it against
          the server (POST /payments/quote), which is what PAYMENTS.md §Release
          means by "server-authoritative", and enables its stale-amount guard. */}
      <PaySheet
        visible={paySheetVisible}
        mode="pay"
        amount={Number(threadInfo?.quoted_price) || 0}
        summary={threadInfo?.post_title}
        interestId={interestId}
        onClose={handleClosePaySheet}
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

      {/* One sheet, two entry points: the header overflow (reports the person)
          and a long-press on a bubble (reports that message). `reportTarget`
          carries which. */}
      <ReportSheet
        visible={!!reportTarget}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        onClose={() => setReportTarget(null)}
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

  // Guideline 1.2(c) — shown instead of letting someone type into a composer
  // whose send is going to 403. Neutral, not alarming: a block is a normal
  // thing to have done, and the banner's job is to explain, not to scold.
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
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
