// The decision screen. Kira's ruling (2026-07-30): a cancelled job's refund is
// approved or declined "from reviewing the before and after and the voice memo",
// so this screen's job is to put that evidence in front of the decision and
// nothing else in the way of it.
//
// The money is read from the ledger via the queue payload (`held_amount`), never
// from the amount proposed at cancellation time — approving pays out what is
// actually held.
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import Surface from '../../components/Surface';
import Inline from '../../components/Inline';
import Button from '../../components/Button';
import ImageViewer from '../../components/ImageViewer';
import { SkeletonList } from '../../components/Skeleton';
import { api } from '../../services/api';
import * as haptics from '../../services/haptics';
import { colors, spacing, radius } from '../../theme/tokens';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Same lifecycle rule as ApproveWorkScreen: the player is mounted only once a url
// exists and is keyed on it, so expo-audio never has its native shared object
// swapped underneath a live status poll (that threw
// NativeSharedObjectNotFoundException on a real device).
function VoiceMemo({ note }) {
  const player = useAudioPlayer({ uri: note.url });
  const status = useAudioPlayerStatus(player);
  const playing = !!status?.playing;
  const duration = note.duration_seconds || status?.duration || 0;

  return (
    <Surface elevation="subtle" rounded="card" padding="base">
      <Text style={styles.sectionLabel}>VOICE MEMO</Text>
      <Inline spacing="md" align="center">
        <Pressable
          onPress={() => {
            haptics.buttonTap?.();
            if (playing) {
              player.pause();
              player.seekTo(0);
              return;
            }
            if (status?.didJustFinish) player.seekTo(0);
            player.play();
          }}
          style={styles.playBtn}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop voice memo' : 'Play voice memo'}
        >
          <Feather name={playing ? 'square' : 'play'} size={17} color={colors.textPrimary} />
        </Pressable>
        <Text variant="small" color="secondary">
          {duration ? `${Math.round(duration)}s recording` : 'Recording'}
          {playing && status?.currentTime != null
            ? ` · ${Math.floor(status.currentTime)}s`
            : ''}
        </Text>
      </Inline>
    </Surface>
  );
}

function PhotoStrip({ label, photos, onOpen, borderColor }) {
  if (!photos?.length) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Inline spacing="sm">
          {photos.map((p, i) => (
            <Pressable
              key={p.url || i}
              onPress={() => onOpen(photos.map((x) => x.url).filter(Boolean), i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${label} photo ${i + 1}`}
            >
              <Image
                source={{ uri: p.url }}
                style={[styles.thumb, borderColor && { borderColor }]}
              />
            </Pressable>
          ))}
        </Inline>
      </ScrollView>
    </View>
  );
}

export default function RefundReviewScreen({ navigation, route }) {
  const dispute = route.params?.dispute || {};
  const booking = dispute.bookings || {};
  const biz = booking.businesses || {};
  const bookingId = dispute.booking_id;

  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [proofError, setProofError] = useState(null);
  const [notes, setNotes] = useState('');
  const [partial, setPartial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewer, setViewer] = useState({ visible: false, images: [], index: 0 });

  const held = Number(dispute.held_amount || 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}/proof`);
        if (alive) setProof(res);
      } catch (err) {
        // A missing proof must not blank the screen — the decision can still be
        // made, it just has less to go on, and saying so is more useful than an
        // empty page.
        if (alive) setProofError(err?.message || 'Could not load the proof of work');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [bookingId]);

  const openViewer = useCallback((images, index) => {
    setViewer({ visible: true, images, index });
  }, []);

  async function decide(approve) {
    if (!notes.trim()) {
      Alert.alert(
        'Add a note first',
        'Write what you saw in the proof and why you reached this decision. It is stored on the record.'
      );
      return;
    }

    const amount = partial.trim() ? Number(partial) : null;
    if (approve && amount != null) {
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Check the amount', 'Enter a dollar figure greater than zero, or leave it blank to refund the full held amount.');
        return;
      }
      if (amount > held) {
        Alert.alert(
          'More than is held',
          `Only ${money(held)} is held against this booking. Enter that or less.`
        );
        return;
      }
    }

    const summary = approve
      ? `Refund ${money(amount != null ? amount : held)} to the client?`
      : `Decline the refund? ${money(held)} goes to the business.`;

    Alert.alert(approve ? 'Approve refund' : 'Decline refund', summary, [
      { text: 'Back', style: 'cancel' },
      {
        text: approve ? 'Approve' : 'Decline',
        style: approve ? 'default' : 'destructive',
        onPress: async () => {
          setSubmitting(true);
          try {
            await api.patch(`/disputes/${dispute.id}/resolve`, {
              resolution: notes.trim(),
              approve,
              ...(approve && amount != null ? { refund_amount: amount } : {}),
            });
            haptics.successTap?.();
            navigation.goBack();
          } catch (err) {
            haptics.errorTap?.();
            Alert.alert('Could not save the decision', err?.message || 'Try again.');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }

  const isMoneyDecision = !!dispute.needs_money_decision;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScreenHeader title="Review" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The money, first, because it is what the decision is about. */}
        <Surface elevation="subtle" rounded="card" padding="base" style={styles.block}>
          <Text style={styles.sectionLabel}>HELD PENDING THIS DECISION</Text>
          <Text style={styles.bigMoney}>{money(held)}</Text>
          <Text variant="caption" color="secondary">
            {booking.total_amount != null
              ? `Job total ${money(booking.total_amount)} · the business has already been allocated ${money(
                  Number(booking.total_amount) - held
                )} under the cancellation ladder`
              : 'No job total recorded'}
          </Text>
        </Surface>

        <Surface elevation="subtle" rounded="card" padding="base" style={styles.block}>
          <Text variant="smallMedium">
            {booking.service_posts?.title || booking.service_category || 'Job'}
          </Text>
          <Text variant="caption" color="secondary">
            {biz.business_name || 'Business'}
          </Text>
          {!!dispute.description && (
            <Text variant="small" color="secondary" style={{ marginTop: spacing.sm }}>
              {dispute.description}
            </Text>
          )}
        </Surface>

        {loading ? (
          <SkeletonList count={2} />
        ) : (
          <>
            {proofError ? (
              <Surface elevation="subtle" rounded="card" padding="base" style={styles.block}>
                <Inline spacing="sm" align="center">
                  <Feather name="alert-circle" size={15} color={colors.textSecondary} />
                  <Text variant="small" color="secondary" style={{ flex: 1 }}>
                    {proofError} — decide on the ledger and the reason given.
                  </Text>
                </Inline>
              </Surface>
            ) : (
              <>
                <PhotoStrip
                  label="CLIENT'S OWN PHOTOS"
                  photos={(proof?.client_photos || []).map((url) => ({ url }))}
                  onOpen={openViewer}
                />
                <PhotoStrip label="BEFORE" photos={proof?.before} onOpen={openViewer} />
                <PhotoStrip
                  label="AFTER"
                  photos={proof?.after}
                  onOpen={openViewer}
                  borderColor="rgba(46,189,133,0.3)"
                />
                {proof?.voice_note?.url ? (
                  <View style={styles.block}>
                    <VoiceMemo key={proof.voice_note.url} note={proof.voice_note} />
                  </View>
                ) : (
                  <Text variant="caption" color="secondary" style={styles.block}>
                    No voice memo was recorded for this job.
                  </Text>
                )}
              </>
            )}
          </>
        )}

        <Surface elevation="subtle" rounded="card" padding="base" style={styles.block}>
          <Text style={styles.sectionLabel}>DECISION NOTE</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="What the proof showed, and why."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={styles.input}
          />
          {isMoneyDecision && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                REFUND LESS THAN {money(held)}? (OPTIONAL)
              </Text>
              <TextInput
                value={partial}
                onChangeText={setPartial}
                placeholder={`Blank refunds the full ${money(held)}`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                style={[styles.input, styles.inputSingle]}
              />
            </>
          )}
        </Surface>

        <View style={{ gap: spacing.sm }}>
          <Button
            label={submitting ? 'Saving…' : 'Approve refund'}
            onPress={() => decide(true)}
            disabled={submitting}
          />
          <Button
            label="Decline"
            variant="secondary"
            onPress={() => decide(false)}
            disabled={submitting}
            style={{ borderColor: colors.danger + '4D' }}
          />
        </View>

        {!isMoneyDecision && (
          <Text variant="caption" color="secondary" style={{ marginTop: spacing.md }}>
            No money is held against this one — the decision is recorded, nothing is
            paid out either way.
          </Text>
        )}
      </ScrollView>

      <ImageViewer
        visible={viewer.visible}
        images={viewer.images}
        initialIndex={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  block: { marginBottom: spacing.md },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  bigMoney: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 30,
    color: colors.success,
    marginBottom: 4,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: radius.md ?? 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised ?? colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md ?? 12,
    backgroundColor: colors.bg,
    color: colors.textPrimary,
    padding: spacing.md,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  inputSingle: { minHeight: 0, height: 48, textAlignVertical: 'center' },
});
