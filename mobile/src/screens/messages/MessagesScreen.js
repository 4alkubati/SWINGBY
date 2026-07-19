// T48 — Messages screen — UX polish pass
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import i18n from '../../i18n';
import { colors, spacing, radius, shadows, motion } from '../../theme/tokens';

import Text from '../../components/Text';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SearchField from '../../components/SearchField';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';

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

// ─── Floating side-chat element (CARD-20, D2) ────────────────────────────────
// Replaces the old plain "Booking"/"Quote" text pill. Booking threads get a
// small elevated chip that CARRIES the booking — tapping it jumps straight to
// BookingDetails, independent of tapping the row (which opens the chat).
// Quote (pre-booking interest) threads have no booking yet to carry, so they
// keep a flat, non-interactive label.
function BookingBadge({ thread, onPress }) {
  const isBooking = thread.thread_type === 'booking';

  if (!isBooking) {
    return (
      <View style={badgeStyles.staticPill}>
        <Text variant="caption" style={badgeStyles.staticPillText}>
          {i18n.t('messages.badgeQuote')}
        </Text>
      </View>
    );
  }

  const isPending = !thread.confirmed_date;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={i18n.t('messages.badgeBookingA11y')}
      style={({ pressed }) => [
        badgeStyles.floatingChip,
        pressed && badgeStyles.floatingChipPressed,
      ]}
    >
      <Feather
        name={isPending ? 'clock' : 'calendar'}
        size={11}
        color={colors.accentText}
      />
      <Text variant="caption" style={badgeStyles.floatingChipText}>
        {isPending ? i18n.t('messages.badgeBookingPending') : i18n.t('messages.badgeBooking')}
      </Text>
    </Pressable>
  );
}

const badgeStyles = {
  staticPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  staticPillText: {
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  floatingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    ...shadows.subtle,
  },
  floatingChipPressed: {
    opacity: 0.7,
  },
  floatingChipText: {
    color: colors.accentText,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
};

// ─── AnimatedPressable row ────────────────────────────────────────────────────

const AnimatedPressableRN = Animated.createAnimatedComponent(Pressable);

function ConversationRow({ thread, onPress, onBadgePress }) {
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

  const isQuote = thread.thread_type === 'interest';
  const otherParty = thread.counterpart_name || 'Chat';
  const subtitle = isQuote
    ? [thread.title, thread.quoted_price != null ? `$${thread.quoted_price}` : null]
        .filter(Boolean).join(' · ')
    : (thread.title !== otherParty ? thread.title : 'Booking');

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
      <Avatar name={otherParty} size="md" source={thread.counterpart_avatar} />

      {/* Text content */}
      <Stack spacing="xs" style={{ flex: 1 }}>
        <Inline spacing="sm" style={{ alignItems: 'center' }}>
          <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
            {otherParty}
          </Text>
          <BookingBadge thread={thread} onPress={onBadgePress} />
        </Inline>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
        <Text
          variant="caption"
          color="secondary"
          numberOfLines={1}
          style={thread.unread_count > 0 ? { color: colors.textPrimary, fontWeight: '600' } : null}
        >
          {thread.last_message || 'Tap to open chat →'}
        </Text>
      </Stack>

      {/* Right side: time + unread badge */}
      <Stack spacing="xs" align="flex-end">
        <Text variant="caption" color="secondary">
          {timeAgo(thread.last_at)}
        </Text>
        {thread.unread_count > 0 && (
          <Badge count={thread.unread_count} color="accent" />
        )}
      </Stack>
    </AnimatedPressableRN>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      // Unified inbox: booking threads + pre-booking quote threads in one call
      const data = await api.get('/messages/threads');
      setThreads(data?.items || []);
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

  // Refresh the inbox whenever the tab regains focus (fresh unread state)
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  // Filter conversations by search query
  const filtered = useMemo(() => {
    if (!query.trim()) return threads;
    const q = query.trim().toLowerCase();
    return threads.filter(
      (t) =>
        (t.counterpart_name || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q)
    );
  }, [threads, query]);

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
              : user?.role === 'client'
                ? 'Chat opens when a business quotes your job or a booking is confirmed.'
                : 'Chat opens when you send a quote or a booking is confirmed.'
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => `${t.thread_type}-${t.id}`}
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
          renderItem={({ item }) => (
            <ConversationRow
              thread={item}
              onPress={() =>
                navigation.navigate('Chat', {
                  ...(item.thread_type === 'interest'
                    ? { interestId: item.id }
                    : { bookingId: item.id }),
                  otherPartyName: item.counterpart_name,
                })
              }
              onBadgePress={
                item.thread_type === 'booking'
                  ? () => navigation.navigate('BookingDetails', { bookingId: item.id })
                  : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}
