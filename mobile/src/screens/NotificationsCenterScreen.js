// T54 — NotificationsCenterScreen
// Displays a persisted list of in-app notifications from AsyncStorage.
// Pull-to-refresh, mark all as read, tap-to-navigate.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import EmptyState from '../components/EmptyState';

const STORAGE_KEY = 'swingby_notifications';

// ─── helpers ─────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function iconForType(type) {
  switch (type) {
    case 'quote':    return 'dollar-sign';
    case 'message':  return 'message-circle';
    case 'booking':  return 'check-circle';
    case 'dispute':  return 'alert-triangle';
    default:         return 'bell';
  }
}

function screenForType(type, meta) {
  switch (type) {
    case 'quote':   return { screen: 'QuoteComparison', params: { postId: meta?.postId } };
    case 'message': return { screen: 'MessageThread',   params: { bookingId: meta?.bookingId } };
    case 'booking': return { screen: 'BookingDetails',  params: { bookingId: meta?.bookingId } };
    default:        return null;
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────
function NotifItem({ item, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.item, !item.read && styles.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
        <Feather name={iconForType(item.type)} size={18} color={item.read ? '#6b7280' : '#FF5C00'} />
      </View>

      <View style={styles.itemBody}>
        <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemText} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.itemTime}>{relativeTime(item.createdAt)}</Text>
      </View>

      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      setNotifications(list.slice().reverse()); // newest first
    } catch {
      setNotifications([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAllRead = async () => {
    try {
      const updated = notifications.map((n) => ({ ...n, read: true }));
      // persist in original order (reverse back)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice().reverse()));
      setNotifications(updated);
    } catch { /* no-op */ }
  };

  const handlePress = async (item) => {
    // mark this notif as read
    const updated = notifications.map((n) =>
      n.id === item.id ? { ...n, read: true } : n
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice().reverse()));
    setNotifications(updated);

    const dest = screenForType(item.type, item.meta);
    if (dest) {
      navigation.navigate(dest.screen, dest.params);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.markAllBtn}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotifItem item={item} onPress={handlePress} />
        )}
        contentContainerStyle={notifications.length === 0 ? styles.emptyFlex : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF5C00"
            colors={['#FF5C00']}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bell"
            title="No notifications yet"
            body="Quotes, messages and booking updates will appear here."
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  markAllBtn: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF5C00',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyFlex: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#1a1d1f',
    marginHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 12,
  },
  itemUnread: {
    // subtle tint handled via iconWrapUnread + unreadDot
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapUnread: {
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderColor: 'rgba(255,92,0,0.25)',
  },
  itemBody: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  itemTitleUnread: {
    color: '#ffffff',
    fontWeight: '700',
  },
  itemText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: '#3a424c',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5C00',
    marginTop: 16,
    flexShrink: 0,
  },
});
