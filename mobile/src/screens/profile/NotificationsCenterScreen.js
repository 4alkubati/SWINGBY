// T56 — NotificationsCenterScreen (UX polish)
// Displays a persisted list of in-app notifications from AsyncStorage.
// Pull-to-refresh, mark all as read, tap-to-navigate.
import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import { colors, spacing, radius, motion } from '../../theme/tokens';

const STORAGE_KEY = 'swingby_notifications';

// ─── AnimatedPressable ────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      stiffness: motion.spring.stiffness,
      damping: motion.spring.damping,
    });
  };

  return (
    <AnimatedPressable
      onPress={() => onPress(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animatedStyle,
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingVertical: spacing.base - 2,
          paddingHorizontal: spacing.sm - 2,
          gap: spacing.md,
        },
      ]}
    >
      {/* Icon wrap */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.chip,
          backgroundColor: item.read ? colors.surface : colors.accentMuted,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Feather
          name={iconForType(item.type)}
          size={18}
          color={item.read ? colors.textSecondary : colors.accent}
        />
      </View>

      {/* Body */}
      <Stack spacing="xs" style={{ flex: 1 }}>
        <Text
          variant="bodyMedium"
          color={item.read ? 'secondary' : 'primary'}
          numberOfLines={1}
          style={{ fontSize: 14, lineHeight: 20 }}
        >
          {item.title}
        </Text>
        <Text variant="small" color="secondary" numberOfLines={2}>
          {item.body}
        </Text>
        <Text variant="caption" color="secondary">
          {relativeTime(item.createdAt)}
        </Text>
      </Stack>

      {/* Unread dot */}
      {!item.read && (
        <Badge
          dot
          color="accent"
          style={{ marginTop: spacing.base, flexShrink: 0 }}
        />
      )}
    </AnimatedPressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      setNotifications(list.slice().reverse()); // newest first
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
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
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <Inline
        justify="space-between"
        style={{
          paddingHorizontal: spacing.base + spacing.xs,
          paddingTop: spacing.md,
          paddingBottom: spacing.base - 2,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text variant="display3">Notifications</Text>
        {unreadCount > 0 && (
          <Pressable
            onPress={markAllRead}
            hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
          >
            <Text variant="smallMedium" color="accent">Mark all read</Text>
          </Pressable>
        )}
      </Inline>

      {/* Loading skeleton — shown only on first mount before AsyncStorage resolves */}
      {loading ? (
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.sm }}>
          <SkeletonList count={6} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifItem item={item} onPress={handlePress} />
          )}
          contentContainerStyle={
            notifications.length === 0
              ? { flex: 1 }
              : {
                  paddingHorizontal: spacing.base,
                  paddingTop: spacing.sm,
                  paddingBottom: spacing.xl,
                }
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bell"
              title="No notifications yet"
              body="Quotes, messages and booking updates will appear here."
            />
          }
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginHorizontal: spacing.base,
              }}
            />
          )}
        />
      )}
    </View>
  );
}
