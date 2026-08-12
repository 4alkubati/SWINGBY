import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';

import { api } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';
import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Button from '../../components/Button';
import Surface from '../../components/Surface';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Avatar from '../../components/Avatar';
import { SkeletonCard } from '../../components/Skeleton';

// GET /bookings/ attaches `payment_state` — the backend's own honest money
// block (bookings.py::_payment_state). It is the only thing here allowed to
// decide what a business was PAID: it reads the payments ledger, refuses to
// count a 'fully_released' row with no Stripe capture behind it, and reports
// released/held/total separately.
//
// This screen used to render `booking.total_amount` — the client's GROSS charge
// — in green next to a "Paid" badge. A $150 booking nets the business $135, so
// every row overstated the payout by the platform's own 10% cut.
const STATE_BADGES = {
  released:          { label: 'Paid',       color: colors.success },
  held:              { label: 'In escrow',  color: colors.accentText },
  paid_off_platform: { label: 'Paid direct', color: colors.success },
  refunded:          { label: 'Refunded',   color: colors.danger },
  unpaid:            { label: 'Unpaid',     color: colors.textSecondary },
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
  const ps = booking.payment_state || {};
  const badge = STATE_BADGES[ps.state] || { label: 'Unpaid', color: colors.textSecondary };
  // What the business actually received. Falls back to held-in-escrow so a job
  // mid-flight shows the real pending figure instead of a confident $0.
  const released = Number(ps.amount_released || 0);
  const held = Number(ps.amount_held || 0);
  const shown = released > 0 ? released : held;
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
            <Text variant="bodyMedium" style={{ color: badge.color, fontFamily: 'SpaceGrotesk_700Bold', fontVariant: ['tabular-nums'] }}>
              ${shown.toLocaleString()}
            </Text>
            {Number(ps.amount_total || 0) > shown ? (
              <Text variant="caption" color="secondary">
                of ${Number(ps.amount_total).toLocaleString()} charged
              </Text>
            ) : null}
            <View style={[styles.pill, { backgroundColor: badge.color + '22' }]}>
              <Text variant="caption" style={{ color: badge.color }}>{badge.label}</Text>
            </View>
          </Stack>
          <Feather name="chevron-right" size={16} color={colors.textSecondary} strokeWidth={1.8} />
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
    <View style={styles.container}>
      <ScreenHeader title="Invoices" onBack={() => navigation.goBack()} />

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
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.base },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  emptyCard: { alignItems: 'center', padding: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
