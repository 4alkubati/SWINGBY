import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function timeStr(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookingId, otherPartyName } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/messages/${bookingId}`);
      setMessages(data || []);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  // Poll for new messages every 5s
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
      const msg = await api.post('/messages/', {
        booking_id: bookingId,
        content: trimmed,
      });
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setText(trimmed); // restore on failure
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherPartyName || 'Chat'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMine = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                {item.content}
              </Text>
              <Text style={styles.bubbleTime}>{timeStr(item.sent_at)}</Text>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor="#3a424c"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          activeOpacity={0.8}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#111315',
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF5C00',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f1214',
    borderWidth: 1,
    borderColor: '#1e2226',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#ffffff' },
  bubbleTextTheirs: { color: '#f0ede8' },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', alignSelf: 'flex-end' },
  emptyChat: { paddingTop: 40, alignItems: 'center' },
  emptyChatText: { fontSize: 14, color: '#6b7280' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#111315',
    backgroundColor: '#07080a',
  },
  input: {
    flex: 1,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#f0ede8',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#FF5C00',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2a2e33' },
  sendBtnText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
});
