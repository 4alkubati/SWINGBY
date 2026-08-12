// Everything waiting on a decision from SwingBy.
//
// `PATCH /disputes/{id}/resolve` shipped with ZERO callers — not here, not in
// web/admin — so until now a cancellation refund was approved by hand-crafting an
// API call. This is the list; RefundReviewScreen is the decision.
//
// Requests with money parked against them sort above record-keeping complaints
// (the server does the ordering), because one of those is someone waiting on their
// money and the other is a note in a file.
import { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import EmptyState from '../../components/EmptyState';
import { SkeletonList } from '../../components/Skeleton';
import BusinessLogo from '../../components/BusinessLogo';
import { api } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function shortDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

const ISSUE_LABEL = {
  cancellation_refund: 'Refund request',
  no_show: 'No show',
  poor_quality: 'Poor quality',
  damage: 'Damage',
  overcharge: 'Overcharge',
  safety: 'Safety',
  other: 'Other',
};

function QueueRow({ item, onPress }) {
  const booking = item.bookings || {};
  const biz = booking.businesses || {};
  const money_decision = item.needs_money_decision;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Surface elevation="subtle" rounded="card" padding="base" style={styles.row}>
        <Inline spacing="md" align="flex-start">
          <BusinessLogo
            uri={biz.logo_url}
            name={biz.business_name || 'Business'}
            size={34}
            radius={10}
          />
          <View style={{ flex: 1 }}>
            <Inline justify="space-between" align="flex-start">
              <Text variant="smallMedium" numberOfLines={1} style={{ flex: 1 }}>
                {booking.service_posts?.title || booking.service_category || 'Job'}
              </Text>
              {money_decision && (
                <Text style={styles.amount}>{money(item.held_amount)}</Text>
              )}
            </Inline>
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {biz.business_name || 'Business'}
              {booking.total_amount != null ? ` · job ${money(booking.total_amount)}` : ''}
            </Text>
            <Inline spacing="sm" style={{ marginTop: 6 }}>
              <View
                style={[
                  styles.chip,
                  money_decision && {
                    borderColor: colors.borderAccent,
                    backgroundColor: colors.accentMuted,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{ color: money_decision ? colors.accentText : colors.textSecondary }}
                >
                  {ISSUE_LABEL[item.issue_type] || item.issue_type}
                </Text>
              </View>
              {!!item.created_at && (
                <Text variant="caption" color="secondary">
                  {shortDate(item.created_at)}
                </Text>
              )}
            </Inline>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textSecondary} />
        </Inline>
      </Surface>
    </Pressable>
  );
}

export default function RefundQueueScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get('/disputes/admin/queue');
      setItems(res?.items || []);
    } catch (err) {
      setError(err?.message || 'Could not load the queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-pull on focus: coming back from a decision, the row that was just decided
  // must be gone. A stale list here invites deciding the same request twice.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Awaiting decision" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
          ListEmptyComponent={
            error ? (
              <EmptyState
                icon="alert-circle"
                title="Could not load the queue"
                body={error}
                action={{ label: 'Try again', onPress: load }}
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title="Nothing waiting"
                body="Cancelled jobs with proof of work show up here for a refund decision."
              />
            )
          }
          renderItem={({ item }) => (
            <QueueRow
              item={item}
              onPress={() => navigation.navigate('RefundReview', { dispute: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  row: { marginBottom: 0 },
  amount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: colors.success,
    marginLeft: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.chip ?? 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
});
