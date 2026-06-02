// T48 — Messages screen — UX polish pass
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';
import { api } from '../services/api';
import { colors, spacing, radius, shadows, motion } from '../theme/tokens';

import Text from '../components/Text';
import Stack from '../components/Stack';
import Inline from '../components/Inline';
import Surface from '../components/Surface';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchField from '../components/SearchField';
import EmptyState from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── AnimatedPressable row ────────────────────────────────────────────────────

const AnimatedPressableRN = Animated.createAnimatedComponent(Pressable);

function ConversationRow({ item, otherParty, unreadCount, onPress }) {
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
    <AnimatedPressableRN
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.base,
          paddingHorizontal: spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        animatedStyle,
      ]}
    >
      {/* Avatar */}
      <Avatar name={otherParty} size="md" />

      {/* Text content */}
      <Stack spacing="xs" style={{ flex: 1 }}>
        <Text variant="bodyMedium">{otherParty}</Text>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {item.service_type || 'Booking'}
        </Text>
        <Text variant="caption" color="secondary">
          Tap to open chat →
        </Text>
      </Stack>

      {/* Right side: time + unread badge */}
      <Stack spacing="xs" align="flex-end">
        <Text variant="caption" color="secondary">
          {timeAgo(item.updated_at)}
        </Text>
        {unreadCount > 0 && (
          <Badge count={unreadCount} color="accent" />
        )}
      </Stack>
    </AnimatedPressableRN>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadByBooking } = useUnread();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get('/bookings/');
      const withChat = (data || []).filter(
        (b) =>
          b.status === 'confirmed' ||
          b.status === 'in_progress' ||
          b.status === 'completed'
      );
      setBookings(withChat);
    } catch (err) {
      setError('Could not load conversations. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function getOtherParty(booking) {
    if (user?.role === 'client') {
      return booking.business_name || 'Business';
    }
    return booking.client_name || 'Client';
  }

  // Filter conversations by search query
  const filtered = useMemo(() => {
    if (!query.trim()) return bookings;
    const q = query.trim().toLowerCase();
    return bookings.filter((b) =>
      getOtherParty(b).toLowerCase().includes(q)
    );
  }, [bookings, query, user]);

  // ── Loading state ──
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        }}
      >
        {/* Header skeleton */}
        <View
          style={{
            paddingHorizontal: spacing.base,
            paddingTop: spacing.md,
            paddingBottom: spacing.base,
          }}
        >
          <Text variant="display3">Messages</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.base }}>
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
          paddingHorizontal: spacing.base,
        }}
      >
        <View
          style={{
            paddingTop: spacing.md,
            paddingBottom: spacing.base,
          }}
        >
          <Text variant="display3">Messages</Text>
        </View>

        <Surface
          elevation="subtle"
          background="alt"
          rounded="card"
          padding="lg"
          style={{ marginTop: spacing.xl }}
        >
          <Stack spacing="md" align="center">
            <Text variant="bodyMedium" color="danger" style={{ textAlign: 'center' }}>
              {error}
            </Text>
            <Button
              variant="secondary"
              label="Retry"
              onPress={() => {
                setLoading(true);
                load();
              }}
            />
          </Stack>
        </Surface>
      </View>
    );
  }

  // ── Main content ──
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.base,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <Text variant="display3">Messages</Text>
      </View>

      {/* Search field */}
      <View
        style={{
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.md,
        }}
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations..."
          debounceMs={200}
        />
      </View>

      {/* Conversation list or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="message-circle"
          title={query ? 'No results' : 'No conversations yet'}
          body={
            query
              ? `No conversations match "${query}".`
              : 'Chat opens once a booking is confirmed.'
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => String(b.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
          renderItem={({ item }) => {
            const otherParty = getOtherParty(item);
            const unreadCount = unreadByBooking[item.id] || 0;
            return (
              <ConversationRow
                item={item}
                otherParty={otherParty}
                unreadCount={unreadCount}
                onPress={() =>
                  navigation.navigate('Chat', {
                    bookingId: item.id,
                    otherPartyName: otherParty,
                  })
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}
