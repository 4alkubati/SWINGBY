import {
  View, FlatList, TextInput, StyleSheet,
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
  interpolate,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import i18n from '../../i18n';
import Text from '../../components/Text';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import { SkeletonBox } from '../../components/Skeleton';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

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
          {timeStr(item.sent_at)}
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

  const listRef = useRef(null);

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = interestId
        ? await api.get(`/messages/interest/${interestId}`)
        : await api.get(`/messages/${bookingId}`);
      // API returns { items: [...] } newest-first; the list renders oldest-first
      const items = Array.isArray(data) ? data : (data?.items || []);
      setMessages([...items].reverse());
      if (data?.interest) setThreadInfo(data.interest);
    } catch (err) {
      if (!messages.length) {
        setError(err?.message || 'Could not load messages.');
      }
      // keep stale on background poll failure
    } finally {
      setLoading(false);
    }
  }, [bookingId, interestId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await api.post('/messages/', {
        ...(interestId ? { interest_id: interestId } : { booking_id: bookingId }),
        content: trimmed,
      });
      const msg = res?.data || res;
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(trimmed); // restore on failure
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
            <Button variant="primary" label="Retry" onPress={load} style={{ minWidth: 120 }} />
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
        <View style={styles.headerCenter}>
          <View style={styles.avatarSmall}>
            <Text
              variant="caption"
              style={{ color: colors.accentText, fontWeight: '700' }}
            >
              {(headerName || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text variant="bodyMedium">{headerName || 'Chat'}</Text>
            {threadInfo ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {[
                  threadInfo.post_title,
                  threadInfo.quoted_price != null ? `$${threadInfo.quoted_price} quoted` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ width: 32 }} />
      </Surface>

      {/* CARD-20 — "disappearing chat" framing. A booking thread with no
          confirmed_date yet is the pre-confirm state of D2's entry flow: the
          job was posted without a time, so this chat is temporary until one
          gets agreed below. It disappears the moment bookingMeta reloads
          with a confirmed_date (ConfirmDateCard's onConfirmed callback). */}
      {!!bookingId && !!bookingMeta && !bookingMeta.confirmed_date && (
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <Surface elevation="none" background="alt" rounded="input" padding="sm">
            <Inline spacing="xs" align="center">
              <Feather name="clock" size={13} color={colors.textSecondary} />
              <Text variant="caption" color="secondary" style={{ flex: 1 }}>
                {i18n.t('chat.disappearingBanner')}
              </Text>
            </Inline>
          </Surface>
        </View>
      )}

      {/* Pinned confirm-date handshake card (UBER-3) — booking threads only,
          two-sided: either party proposes times, the other accepts. Passing
          this screen's own bookingMeta down (once loaded) and wiring
          onConfirmed back to loadBookingMeta keeps the two in sync, so the
          disappearing-chat banner above drops the moment a date confirms. */}
      {!!bookingId && (
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <ConfirmDateCard bookingId={bookingId} booking={bookingMeta} onConfirmed={loadBookingMeta} />
        </View>
      )}

      {/* ── Messages list ──────────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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

  messagesList: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
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
