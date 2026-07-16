// UBER-3 — confirm-date handshake card.
// Kira's design decision: confirm-date is a HANDSHAKE inside the chat thread.
// When a booking has proposed_date_1..3 set and no confirmed_date, the client
// sees a pinned card with one chip per proposed date; tapping a chip calls
// PATCH /bookings/{bookingId}/confirm-date and flips the card to a confirmed
// state. Renders nothing for non-clients, bookings without proposed dates, or
// on fetch failure — this is a bonus affordance, never a blocking one.
//
// Usage:
//   <ConfirmDateCard bookingId={bookingId} />                      // self-fetches
//   <ConfirmDateCard bookingId={bookingId} booking={alreadyFetched}
//                     onConfirmed={() => refetchParent()} />        // reuses parent data
import React, { useState, useEffect, useCallback } from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import * as toast from '../services/toast';
import i18n from '../i18n';
import Text from './Text';
import Surface from './Surface';
import Inline from './Inline';
import Stack from './Stack';
import { colors, spacing, radius } from '../theme/tokens';

function formatChip(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ConfirmDateCard({ bookingId, booking: bookingProp, onConfirmed, style }) {
  const { user } = useAuth();
  const [booking, setBooking] = useState(bookingProp || null);
  const [status, setStatus] = useState(bookingProp ? 'ready' : 'loading');
  const [confirmingDate, setConfirmingDate] = useState(null);

  useEffect(() => {
    if (bookingProp) {
      setBooking(bookingProp);
      setStatus('ready');
      return;
    }
    if (!bookingId) {
      setStatus('hidden');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    api.get(`/bookings/${bookingId}`)
      .then((data) => {
        if (cancelled) return;
        setBooking(data);
        setStatus('ready');
      })
      .catch(() => {
        // Resilient by design — no proposed dates / no access / network hiccup
        // should just mean the card doesn't render, not an error state.
        if (!cancelled) setStatus('hidden');
      });
    return () => { cancelled = true; };
  }, [bookingId, bookingProp]);

  const handleAccept = useCallback(async (dateIso) => {
    if (confirmingDate) return;
    setConfirmingDate(dateIso);
    try {
      await api.patch(`/bookings/${bookingId}/confirm-date`, { confirmed_date: dateIso });
      setBooking((prev) => (prev ? { ...prev, confirmed_date: dateIso, status: 'in_progress' } : prev));
      toast.show({ type: 'success', text1: i18n.t('booking.dateConfirmedToast') });
      onConfirmed?.(dateIso);
    } catch (err) {
      toast.show({
        type: 'error',
        text1: i18n.t('booking.confirmDateErrorToast'),
        text2: err?.message || '',
      });
    } finally {
      setConfirmingDate(null);
    }
  }, [bookingId, confirmingDate, onConfirmed]);

  // Only the client accepts a proposed date — the business proposes them.
  if (user?.role !== 'client') return null;
  if (status !== 'ready' || !booking) return null;

  if (booking.confirmed_date) {
    return (
      <Surface elevation="subtle" style={[{ marginBottom: spacing.md }, style]}>
        <Inline spacing="sm" align="center">
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text variant="smallMedium">
            {i18n.t('booking.confirmedFor', { date: formatChip(booking.confirmed_date) })}
          </Text>
        </Inline>
      </Surface>
    );
  }

  const proposedDates = [booking.proposed_date_1, booking.proposed_date_2, booking.proposed_date_3]
    .filter(Boolean);

  if (proposedDates.length === 0) return null;

  return (
    <Surface elevation="subtle" style={[{ marginBottom: spacing.md }, style]}>
      <Stack spacing="sm">
        <Text variant="smallMedium">{i18n.t('booking.proposedDatesHeading')}</Text>
        <Inline spacing="sm" wrap>
          {proposedDates.map((d) => (
            <Pressable
              key={d}
              onPress={() => handleAccept(d)}
              disabled={!!confirmingDate}
              accessibilityRole="button"
              accessibilityLabel={`Accept ${formatChip(d)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.chip,
                borderWidth: 1,
                borderColor: colors.borderAccent,
                backgroundColor: colors.accentMuted,
                opacity: confirmingDate && confirmingDate !== d ? 0.5 : 1,
              }}
            >
              <Text variant="caption" color="accent">{formatChip(d)}</Text>
              {confirmingDate === d
                ? <ActivityIndicator size="small" color={colors.accentText} />
                : <Feather name="check" size={13} color={colors.accentText} />}
            </Pressable>
          ))}
        </Inline>
      </Stack>
    </Surface>
  );
}
