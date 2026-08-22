import { View, ScrollView, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Button from '../../components/Button';
import Stack from '../../components/Stack';
import Inline from '../../components/Inline';
import Surface from '../../components/Surface';
import SwImage from '../../components/SwImage';
import ImageViewer from '../../components/ImageViewer';
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

// ─── Proof of work on the receipt (walkthrough M4) ────────────────────────────
// "Invoices off the Past tab: past jobs + invoice + before/after photos."
// The receipt is the artefact both sides keep, so the record of what was
// actually done belongs on it — not one screen away behind the approval flow
// that only exists while the job is live. The photos ride along in the invoice
// payload (invoices.py::_proof_photos), so this costs no extra request.

const PROOF_SECTIONS = [
  { key: 'before', label: 'Before' },
  { key: 'after', label: 'After' },
  // Photos the client attached to the original job post. Labelled apart so
  // they are never mistaken for the business's own record of the work — the
  // same distinction proof_of_work.py enforces via booking_photos.source.
  { key: 'client_supplied', label: 'From the job post' },
];

function ProofOfWork({ proof, onOpen, indexOf }) {
  const sections = PROOF_SECTIONS
    .map((s) => ({ ...s, photos: (proof?.[s.key] || []).filter((p) => p?.url) }))
    .filter((s) => s.photos.length > 0);

  // No photos is not an error and not an empty slot — some jobs simply never
  // had any. The section just doesn't exist rather than showing a hollow frame.
  if (sections.length === 0) return null;

  return (
    <Stack spacing="sm">
      <Text variant="label" color="secondary">Proof of work</Text>
      {sections.map((section) => (
        <Stack key={section.key} spacing="xs">
          <Text variant="caption" color="secondary">
            {section.label} · {section.photos.length}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.thumbRow}>
              {section.photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id || photo.url}
                  activeOpacity={0.85}
                  onPress={() => onOpen(indexOf(photo.url))}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${section.label} photo`}
                >
                  <SwImage source={{ uri: photo.url }} style={styles.thumb} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Stack>
      ))}
    </Stack>
  );
}

export default function InvoiceScreen({ navigation, route }) {
  const { bookingId } = route.params || {};

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);

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
    // The PDF opens in the system browser, which cannot attach an Authorization
    // header, so the token rides in the query string — the backend accepts it
    // ONLY on this route (deps.get_current_user_allow_query_token). It is a
    // short-lived Supabase JWT over HTTPS. POST-BETA: switch to an in-app
    // authenticated download (expo-file-system downloadAsync with the header +
    // expo-sharing) so no token is ever placed in a URL.
    const url = `${base}/bookings/${bookingId}/invoice.pdf?token=${encodeURIComponent(token || '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      // no-op
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Receipt" onBack={() => navigation.goBack()} />
        <View style={{ padding: spacing.base }}>
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Receipt" onBack={() => navigation.goBack()} />
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

  const {
    invoice_number, issued_at, client, business, employee,
    service, schedule, line_items, totals, payment, proof,
  } = data;

  // One flat, de-duplicated URI list backs the full-screen viewer, so swiping
  // runs Before → After → job-post photos in the order they are shown.
  const proofUris = PROOF_SECTIONS
    .flatMap((s) => (proof?.[s.key] || []).map((p) => p?.url))
    .filter(Boolean);
  const indexOfUri = (uri) => Math.max(proofUris.indexOf(uri), 0);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Receipt" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Stack spacing="lg">
          <Surface elevation="subtle" padding="base" rounded="card">
            <Stack spacing="xs">
              <Text variant="display3">SwingByy</Text>
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

          <ProofOfWork proof={proof} onOpen={setViewerIndex} indexOf={indexOfUri} />

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
                <Text variant="bodyMedium">
                  {payment?.capture_backed ? 'Total charged' : 'Total (not yet captured)'}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    // F105: an invoice must not imply money was collected when
                    // no charge exists behind it (invoices.py's own comment on
                    // `payment.capture_backed`). Mirrors ActiveBookingScreen's
                    // capture_backed gate on the same claim.
                    color: payment?.capture_backed ? colors.success : colors.textSecondary,
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

      <ImageViewer
        visible={viewerIndex !== null}
        images={proofUris}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.base, paddingBottom: spacing.xl },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  thumbRow: { flexDirection: 'row', gap: spacing.sm },
  thumb: {
    width: 92, height: 92,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
  },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
