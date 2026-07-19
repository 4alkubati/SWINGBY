// T56 — MessageThreadScreen
// Real-time chat thread for a confirmed booking.
// Route params: { bookingId }
//
// Push notification subscription note:
//   Register a background message listener (e.g. via expo-notifications
//   addNotificationReceivedListener) when this screen mounts and clear it
//   on unmount to surface new messages even when the user is elsewhere.
//   Full push integration is left to the notifications wave.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import * as toast from '../../services/toast';
import * as haptics from '../../services/haptics';
import i18n from '../../i18n';
import EmptyState from '../../components/EmptyState';
import ConfirmDateCard from '../../components/ConfirmDateCard';
import { colors } from '../../theme/tokens';

// ─── helpers ──────────────────────────────────────────────────────────────────
function msgTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function toInitials(name) {
  return (name || '??').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function statusChipStyle(status) {
  switch ((status || '').toLowerCase()) {
    case 'on_the_way':  return { bg: colors.accentMuted, text: colors.accentText };
    case 'in_progress': return { bg: colors.accentMuted, text: colors.accentText };
    case 'completed':   return { bg: 'rgba(46,189,133,0.14)', text: colors.success };
    case 'cancelled':   return { bg: 'rgba(255,92,92,0.14)', text: colors.danger };
    default:            return { bg: colors.accentMuted, text: colors.accentText };
  }
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current,
                useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.typingBubble}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ item, isMe }) {
  return (
    <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
      <View style={[
        styles.bubble,
        isMe ? styles.bubbleMe : styles.bubbleThem,
      ]}>
        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
          {item.content ?? item.text ?? ''}
        </Text>
      </View>
      <Text style={[styles.msgTime, isMe ? styles.msgTimeRight : styles.msgTimeLeft]}>
        {msgTime(item.sent_at ?? item.created_at ?? item.timestamp)}
        {item._optimistic && '  ·  sending…'}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function MessageThreadScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params ?? {};
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [bookingMeta, setBookingMeta] = useState(null);

  const listRef = useRef(null);
  const typingTimer = useRef(null);

  // ── fetch booking meta ──
  const loadBookingMeta = useCallback(() => {
    if (!bookingId) return;
    api.get(`/bookings/${bookingId}`)
      .then((d) => setBookingMeta(d))
      .catch(() => { /* non-fatal */ });
  }, [bookingId]);

  useEffect(() => { loadBookingMeta(); }, [loadBookingMeta]);

  // ── initial message load ──
  const loadMessages = useCallback(async (before = null) => {
    if (!bookingId) return;
    try {
      const params = { limit: 50 };
      if (before) params.before = before;
      const data = await api.get(`/messages/${bookingId}`, { params });
      // API shape: { items: [...newest-first], next_before } — render oldest-first
      const raw = Array.isArray(data) ? data : (data?.items ?? []);
      const items = [...raw].reverse();

      if (before) {
        setMessages((prev) => [...items, ...prev]);
      } else {
        setMessages(items);
      }
      setCursor(data?.next_before ?? null);
      setHasMore(raw.length === params.limit);
    } catch {
      // swallow — empty state will show
    }
  }, [bookingId]);

  useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));
  }, [loadMessages]);

  // ── load older (scroll to top) ──
  const handleLoadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadMessages(cursor);
    setLoadingMore(false);
  };

  // ── send ──
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const tempId = `_opt_${Date.now()}`;
    const optimistic = {
      id: tempId,
      content: text,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };

    setInputText('');
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    setShowTyping(true);

    // clear typing indicator after short delay
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setShowTyping(false), 1500);

    try {
      await haptics.buttonTap();
      // API shape: { message: 'Sent', data: {...row} }
      const res = await api.post('/messages/', {
        booking_id: bookingId,
        content: text,
      });
      const sent = res?.data || res;
      // replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...sent, _optimistic: false } : m))
      );
      setShowTyping(false);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.show({ type: 'error', text1: 'Message not sent', text2: err.message });
      setInputText(text); // restore
    } finally {
      setSending(false);
    }
  };

  // ── auto-scroll ──
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // ── derived ──
  const otherName = (() => {
    if (!bookingMeta || !user) return 'Chat';
    // Counterpart depends on who's looking: client sees the business/employee,
    // provider sees the client. Joins come nested from /bookings/{id}.
    if (user.role === 'client') {
      const empUser = bookingMeta.employees?.users;
      return (
        (empUser && [empUser.first_name, empUser.last_name].filter(Boolean).join(' '))
        || bookingMeta.businesses?.business_name
        || 'Provider'
      );
    }
    const clientUser = bookingMeta.users;
    return (
      (clientUser && [clientUser.first_name, clientUser.last_name].filter(Boolean).join(' '))
      || 'Client'
    );
  })();

  const bookingStatus = bookingMeta?.status ?? 'confirmed';
  const chip = statusChipStyle(bookingStatus);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerMeta}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{toInitials(otherName)}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{otherName}</Text>
            <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
              <Text style={[styles.statusChipText, { color: chip.text }]}>
                {bookingStatus.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* CARD-20 — "disappearing chat" banner, same rule as ChatScreen: a
          booking with no confirmed_date yet means the post was made without
          a time, so this thread is temporary until one is agreed below. */}
      {!!bookingId && !!bookingMeta && !bookingMeta.confirmed_date && (
        <View style={styles.disappearingBanner}>
          <Feather name="clock" size={13} color={colors.textSecondary} />
          <Text style={styles.disappearingBannerText}>
            {i18n.t('chat.disappearingBanner')}
          </Text>
        </View>
      )}

      {/* Pinned confirm-date handshake card (UBER-3) — client only, renders
          nothing until the business has proposed dates. Waits for bookingMeta
          (already fetched above) instead of letting the card double-fetch. */}
      {!!bookingId && !!bookingMeta && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <ConfirmDateCard bookingId={bookingId} booking={bookingMeta} onConfirmed={loadBookingMeta} />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id?.toString()}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                isMe={item.sender_id === user?.id}
              />
            )}
            contentContainerStyle={
              messages.length === 0 ? styles.emptyFlex : styles.listContent
            }
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={handleLoadMore}
            ListHeaderComponent={
              loadingMore ? (
                <View style={styles.loadMoreWrap}>
                  <ActivityIndicator color={colors.accent} size="small" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="message-circle"
                title="Start the conversation"
                body="Send a message to your service provider."
              />
            }
            ListFooterComponent={showTyping ? <TypingIndicator /> : null}
          />
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message…"
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxHeight={96} // ~4 rows
            textAlignVertical="top"
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color={colors.textPrimary} size="small" />
              : <Feather name="send" size={18} color={colors.textPrimary} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 13, fontWeight: '700', color: colors.accentText },
  headerName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadMoreWrap: { alignItems: 'center', paddingVertical: 10 },

  disappearingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  disappearingBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },

  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 4 },
  emptyFlex: { flex: 1 },

  msgRow: { marginVertical: 3, maxWidth: '78%' },
  msgRowRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  msgRowLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  bubble: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleMe: {
    backgroundColor: colors.accentBtn,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: colors.textPrimary },
  bubbleTextThem: { color: colors.textPrimary },

  msgTime: { fontSize: 11, color: colors.textSecondary, marginTop: 3 },
  msgTimeRight: { textAlign: 'right' },
  msgTimeLeft: { textAlign: 'left' },

  // Typing indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 5,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textSecondary,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
