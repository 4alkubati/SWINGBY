import { View, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import Button from '../../components/Button';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import { SkeletonCard } from '../../components/Skeleton';

import { api, getBaseUrl, getAuthToken } from '../../services/api';
import { colors, spacing, radius } from '../../theme/tokens';

function money(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Number(n) || 0).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return iso; }
}

export default function InvoiceScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}/invoice`);
        setData(res);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  async function handleDownload() {
    const base = getBaseUrl();
    const token = getAuthToken();
    const url = `${base}/bookings/${bookingId}/invoice.pdf?token=${encodeURIComponent(token || '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      // no-op
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text variant="h1">Receipt</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={{ padding: spacing.base }}>
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <Text variant="h1">Receipt</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={28} color={colors.danger} />
          <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
            Could not load this invoice.
          </Text>
          <Button label="Try again" onPress={() => { setLoading(true); setError(false); }} />
        </View>
      </View>
    );
  }

  const { invoice_number, issued_at, client, business, employee, service, schedule, line_items, totals, payment } = data;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.textSecondary} />
        </Pressable>
        <Text variant="h1">Receipt</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Stack spacing="lg">
          <Surface elevation="subtle" padding="base" rounded="card">
            <Stack spacing="xs">
              <Text variant="display3">SwingBy</Text>
              <Text variant="caption" color="secondary">Invoice {invoice_number}</Text>
              <Text variant="caption" color="secondary">Issued {fmtDate(issued_at)}</Text>
            </Stack>
          </Surface>

          <Inline spacing="md" align="flex-start">
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Text variant="label" color="secondary">Bill to</Text>
              <Text variant="smallMedium">{client?.name}</Text>
              {client?.email ? <Text variant="caption" color="secondary">{client.email}</Text> : null}
            </Stack>
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Text variant="label" color="secondary">From</Text>
              <Text variant="smallMedium">{business?.name}</Text>
              {business?.category ? <Text variant="caption" color="secondary">{business.category}</Text> : null}
              <Text variant="caption" color="secondary">License: {business?.license_status || 'unverified'}</Text>
            </Stack>
          </Inline>

          {employee?.name ? (
            <Surface background="alt" padding="sm" rounded="input">
              <Text variant="small">
                Delivered by <Text variant="smallMedium">{employee.name}</Text>
                {employee.role_title ? ` — ${employee.role_title}` : ''}
              </Text>
            </Surface>
          ) : null}

          <Stack spacing="sm">
            <Text variant="label" color="secondary">Service</Text>
            <Text variant="body">{service?.category || 'Booking'}</Text>
            <Text variant="caption" color="secondary">
              Completed {fmtDate(schedule?.completed_at)}
            </Text>
          </Stack>

          <Surface elevation="subtle" padding="base" rounded="card">
            <Stack spacing="sm">
              {(line_items || []).map((li, i) => (
                <Inline key={i} justify="space-between">
                  <Text variant="small">{li.label}</Text>
                  <Text variant="small">{money(li.amount)}</Text>
                </Inline>
              ))}
              <View style={styles.divider} />
              <Inline justify="space-between">
                <Text variant="smallMedium">Paid to business</Text>
                <Text variant="smallMedium">{money(totals?.paid_to_business)}</Text>
              </Inline>
              <Inline justify="space-between">
                <Text variant="bodyMedium">Total charged</Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: colors.success,
                    fontFamily: 'SpaceGrotesk_700Bold',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {money(totals?.total_charged)}
                </Text>
              </Inline>
            </Stack>
          </Surface>

          <Stack spacing="xs">
            <Text variant="label" color="secondary">Payment</Text>
            <Text variant="small">
              {payment?.method || 'stripe_card'} · {payment?.status || 'pending'}
            </Text>
            {payment?.processor_ref ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                Ref: {payment.processor_ref}
              </Text>
            ) : null}
          </Stack>

          <Button label="Download PDF" onPress={handleDownload} />
          <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            Opens in your browser. Save or share from there.
          </Text>
        </Stack>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.base,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  scroll: { padding: spacing.base, paddingBottom: spacing.xl },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
