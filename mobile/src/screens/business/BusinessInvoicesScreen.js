import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';

import { api } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import { SkeletonCard } from '../../components/Skeleton';

const PAYMENT_BADGES = {
  fully_released:   { label: 'Paid',     color: colors.success },
  partial_released: { label: 'Partial',  color: colors.accent },
  refunded:         { label: 'Refunded', color: colors.danger },
};

function invoiceDate(b) {
  const raw = b.completed_at || b.confirmed_date || b.scheduled_date || b.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function clientName(b) {
  const u = b.users || {};
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Client';
}

function InvoiceRow({ booking, onPress }) {
  const badge = PAYMENT_BADGES[booking.payment_status] || { label: 'Completed', color: colors.textSecondary };
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Surface elevation="subtle" style={styles.row}>
        <Inline spacing="md" style={{ alignItems: 'center' }}>
          <Avatar name={clientName(booking)} size="md" />
          <Stack spacing={2} style={{ flex: 1 }}>
            <Text variant="bodyMedium" numberOfLines={1}>{clientName(booking)}</Text>
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {booking.service_category || 'Service'} · {invoiceDate(booking)}
            </Text>
          </Stack>
          <Stack spacing={2} style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyMedium">
              ${Number(booking.total_amount || 0).toLocaleString()}
            </Text>
            <View style={[styles.pill, { backgroundColor: badge.color + '22' }]}>
              <Text variant="caption" style={{ color: badge.color }}>{badge.label}</Text>
            </View>
          </Stack>
          <Feather name="chevron-right" size={16} color={colors.textSecondary} />
        </Inline>
      </Surface>
    </TouchableOpacity>
  );
}

export default function BusinessInvoicesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await api.get('/bookings/?limit=100');
      const items = res?.items || res || [];
      // Receipts view: anything completed or with money movement
      setInvoices(items.filter(
        (b) => b.status === 'completed' || ['partial_released', 'fully_released', 'refunded'].includes(b.payment_status)
      ));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Inline spacing="md" style={styles.header}>
        <Button
          variant="ghost"
          label=""
          icon={<Feather name="arrow-left" size={20} color={colors.textSecondary} />}
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
        />
        <Text variant="h1">Invoices</Text>
      </Inline>

      {loading ? (
        <Stack spacing="md" style={{ paddingHorizontal: spacing.lg }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </Stack>
      ) : error ? (
        <View style={styles.centered}>
          <Text variant="h1" style={{ textAlign: 'center' }}>Could not load invoices</Text>
          <Text variant="small" color="secondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Check your connection and try again.
          </Text>
          <Button label="Retry" onPress={() => { setLoading(true); load(); }} style={{ marginTop: spacing.lg }} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <Surface background="alt" style={styles.emptyCard}>
              <Stack spacing="sm" align="center">
                <Feather name="file-text" size={24} color={colors.textSecondary} />
                <Text variant="small" color="secondary">No invoices yet</Text>
                <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                  Invoices appear here once a booking is completed.
                </Text>
              </Stack>
            </Surface>
          }
          renderItem={({ item }) => (
            <InvoiceRow
              booking={item}
              onPress={() => navigation.navigate('Invoice', { bookingId: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  iconBtn: { paddingVertical: 0, paddingHorizontal: 0, width: 44, justifyContent: 'center' },
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.base },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
