// UBER-3 / HANDSHAKE-2WAY — the confirm-date handshake card.
// Kira's design decision (2026-07-17): the handshake lives in the chat thread
// and runs BOTH ways — after a quote is accepted the client proposes times
// from their side and the business approves; the business can counter-propose
// (via this card or assign-employee) and the client approves. Whoever proposed
// waits; the OTHER side accepts.
//
// States:
//   confirmed_date set            → confirmed banner (both roles)
//   proposals + you proposed      → "waiting for the other side" (chips inert)
//   proposals + other side did    → tappable chips → PATCH /confirm-date
//   no proposals, awaiting date   → "Propose a time" → up to 3 slots
//                                   → PATCH /propose-dates
// Renders nothing for employees/admins, non-schedulable bookings, or on fetch
// failure — this is a bonus affordance, never a blocking one.
//
// Usage:
//   <ConfirmDateCard bookingId={bookingId} />                      // self-fetches
//   <ConfirmDateCard bookingId={bookingId} booking={alreadyFetched}
//                     onConfirmed={() => refetchParent()} />        // reuses parent data
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Platform, Pressable, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import * as toast from '../services/toast';
import i18n from '../i18n';
import Text from './Text';
import Surface from './Surface';
import Inline from './Inline';
import Stack from './Stack';
import Button from './Button';
import { colors, spacing, radius } from '../theme/tokens';

function formatChip(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const chipStyle = (interactive, dimmed) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: radius.chip,
  borderWidth: 1,
  borderColor: interactive ? colors.borderAccent : colors.border,
  backgroundColor: interactive ? colors.accentMuted : 'transparent',
  opacity: dimmed ? 0.5 : 1,
});

export default function ConfirmDateCard({ bookingId, booking: bookingProp, onConfirmed, style }) {
  const { user } = useAuth();
  const [booking, setBooking] = useState(bookingProp || null);
  const [status, setStatus] = useState(bookingProp ? 'ready' : 'loading');
  const [confirmingDate, setConfirmingDate] = useState(null);
  // Propose-flow state: picked slots + the in-progress picker step.
  const [slots, setSlots] = useState([]);
  const [pickerStep, setPickerStep] = useState(null); // null | 'date' | 'time' (android) | 'datetime' (ios)
  const [draft, setDraft] = useState(new Date());
  const [sending, setSending] = useState(false);

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

  const handleSendProposal = useCallback(async () => {
    if (sending || slots.length === 0) return;
    setSending(true);
    try {
      const body = {
        proposed_date_1: slots[0],
        proposed_date_2: slots[1] || null,
        proposed_date_3: slots[2] || null,
      };
      const res = await api.patch(`/bookings/${bookingId}/propose-dates`, body);
      setBooking((prev) => (prev
        ? { ...prev, ...body, date_proposed_by: user?.id, ...(res?.booking || {}) }
        : prev));
      setSlots([]);
      toast.show({ type: 'success', text1: i18n.t('booking.proposalSentToast') });
      onConfirmed?.();
    } catch (err) {
      toast.show({
        type: 'error',
        text1: i18n.t('booking.proposeErrorToast'),
        text2: err?.message || '',
      });
    } finally {
      setSending(false);
    }
  }, [bookingId, slots, sending, user, onConfirmed]);

  const openPicker = useCallback(() => {
    const base = new Date(Date.now() + 24 * 60 * 60 * 1000);
    base.setMinutes(0, 0, 0);
    setDraft(base);
    setPickerStep(Platform.OS === 'ios' ? 'datetime' : 'date');
  }, []);

  const onPickerChange = useCallback((event, selected) => {
    if (event?.type === 'dismissed' || !selected) {
      setPickerStep(null);
      return;
    }
    if (Platform.OS === 'android') {
      if (pickerStep === 'date') {
        setDraft(selected);
        setPickerStep('time');
        return;
      }
      const combined = new Date(draft);
      combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setSlots((prev) => [...prev, combined.toISOString()].slice(0, 3));
      setPickerStep(null);
      return;
    }
    // iOS datetime spinner: keep the draft until "Done"
    setDraft(selected);
  }, [pickerStep, draft]);

  const confirmIosPick = useCallback(() => {
    setSlots((prev) => [...prev, draft.toISOString()].slice(0, 3));
    setPickerStep(null);
  }, [draft]);

  // Only the two handshake parties see the card.
  if (user?.role !== 'client' && user?.role !== 'business_owner') return null;
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

  if (proposedDates.length > 0) {
    // Legacy rows (proposer untracked) came from assign-employee → business proposed.
    const iProposed = booking.date_proposed_by
      ? booking.date_proposed_by === user?.id
      : user?.role === 'business_owner';

    if (iProposed) {
      return (
        <Surface elevation="subtle" style={[{ marginBottom: spacing.md }, style]}>
          <Stack spacing="sm">
            <Inline spacing="sm" align="center">
              <Feather name="clock" size={14} color={colors.textSecondary} />
              <Text variant="smallMedium">{i18n.t('booking.waitingOtherSide')}</Text>
            </Inline>
            <Inline spacing="sm" wrap>
              {proposedDates.map((d) => (
                <View key={d} style={chipStyle(false, false)}>
                  <Text variant="caption" color="secondary">{formatChip(d)}</Text>
                </View>
              ))}
            </Inline>
          </Stack>
        </Surface>
      );
    }

    return (
      <Surface elevation="subtle" style={[{ marginBottom: spacing.md }, style]}>
        <Stack spacing="sm">
          <Text variant="smallMedium">{i18n.t('booking.proposedTimesHeading')}</Text>
          <Inline spacing="sm" wrap>
            {proposedDates.map((d) => (
              <Pressable
                key={d}
                onPress={() => handleAccept(d)}
                disabled={!!confirmingDate}
                accessibilityRole="button"
                accessibilityLabel={`Accept ${formatChip(d)}`}
                style={chipStyle(true, confirmingDate && confirmingDate !== d)}
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

  // No proposals yet — offer to start the handshake while the booking awaits a date.
  if (booking.status !== 'confirmed') return null;

  return (
    <Surface elevation="subtle" style={[{ marginBottom: spacing.md }, style]}>
      <Stack spacing="sm">
        <Text variant="smallMedium">{i18n.t('booking.proposeTimesHeading')}</Text>
        {slots.length > 0 && (
          <Inline spacing="sm" wrap>
            {slots.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSlots((prev) => prev.filter((x) => x !== s))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${formatChip(s)}`}
                style={chipStyle(true, false)}
              >
                <Text variant="caption" color="accent">{formatChip(s)}</Text>
                <Feather name="x" size={13} color={colors.accentText} />
              </Pressable>
            ))}
          </Inline>
        )}
        <Inline spacing="sm" wrap>
          {slots.length < 3 && (
            <Pressable
              onPress={openPicker}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(slots.length ? 'booking.addAnotherTime' : 'booking.proposeTimes')}
              style={chipStyle(true, false)}
            >
              <Feather name="plus" size={13} color={colors.accentText} />
              <Text variant="caption" color="accent">
                {i18n.t(slots.length ? 'booking.addAnotherTime' : 'booking.proposeTimes')}
              </Text>
            </Pressable>
          )}
        </Inline>
        {slots.length > 0 && (
          <Button
            label={i18n.t('booking.sendProposal')}
            onPress={handleSendProposal}
            loading={sending}
          />
        )}
      </Stack>

      {Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="slide"
          visible={pickerStep === 'datetime'}
          onRequestClose={() => setPickerStep(null)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.base }}>
                <TouchableOpacity onPress={() => setPickerStep(null)}>
                  <Text variant="body" color="secondary">{i18n.t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIosPick}>
                  <Text variant="body" color="accent" style={{ fontWeight: '600' }}>{i18n.t('common.done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={onPickerChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        !!pickerStep && (
          <DateTimePicker
            value={draft}
            mode={pickerStep}
            display="default"
            minimumDate={pickerStep === 'date' ? new Date() : undefined}
            onChange={onPickerChange}
          />
        )
      )}
    </Surface>
  );
}
