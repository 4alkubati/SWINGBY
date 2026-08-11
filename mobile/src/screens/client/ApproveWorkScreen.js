// ApproveWorkScreen — client review & release side of proof of work.
//
// Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §1 ("Client —
// review & release"), escrow semantics from PAYMENTS.md ("Release, refunds,
// disputes"). Walkthrough M5.
//
// Approving is the irreversible moment in the whole product: it moves money.
// So the amount is named in the release notice AND again in the confirm alert,
// it comes from the server's ledger rather than the booking total, and
// "Something's wrong" leaves the funds exactly where they are — held.
//
// Route params: { bookingId }
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import Text from '../../components/Text';
import SwImage from '../../components/SwImage';
import ImageViewer from '../../components/ImageViewer';
import ReportSheet from '../../components/ReportSheet';
import * as moderation from '../../services/moderation';
import { api } from '../../services/api';
import * as haptics from '../../services/haptics';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
import { colors, radius } from '../../theme/tokens';

// Local layout constants — theme/tokens.js belongs to another lane this cycle.
const COMPARE_HEIGHT = 150;
const COLUMN_GAP = 9;
const AFTER_BORDER = 'rgba(46,189,133,0.3)';
const WAVE_BARS = 34;

function money(cents) {
  const value = (Number(cents || 0) / 100).toFixed(2);
  // Whole dollars read better in a sentence; cents matter when they exist.
  return value.endsWith('.00') ? `$${value.slice(0, -3)}` : `$${value}`;
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── One swipeable column ────────────────────────────────────────────────────
// Each side pages through its OWN set, independently, so the client can hold a
// before shot still while swiping the afters (spec §1).
function CompareColumn({ label, labelColor, borderColor, photos, onOpen, emptyLabel }) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);

  const count = photos.length;

  return (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, { color: labelColor }]}>{label}</Text>

      <View
        style={[styles.compareTile, { borderColor }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {count === 0 ? (
          <View style={styles.compareEmpty}>
            <Feather name="image" size={20} color={colors.textTertiary} />
            <Text style={styles.compareEmptyText}>{emptyLabel}</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                if (!width) return;
                setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
              }}
              scrollEventThrottle={16}
            >
              {photos.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  onPress={() => onOpen(i)}
                  style={{ width: width || 1, height: COMPARE_HEIGHT }}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${label} photo ${i + 1} of ${count}, tap to view full screen`}
                >
                  <SwImage
                    source={{ uri }}
                    style={{ width: '100%', height: '100%' }}
                    accessibilityLabel=""
                  />
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.counterChip} pointerEvents="none">
              <Text style={styles.counterChipText}>
                {Math.min(index + 1, count)} / {count}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Voice note player ───────────────────────────────────────────────────────
// Real playback via expo-audio (see ProofOfWorkScreen for the capture side).
// `note.url` is a SIGNED, EXPIRING url minted per read by the API — never cache
// it across sessions, and treat a missing url as "no memo" rather than as a
// player that will fail when tapped.
// Mounted only once a url exists (see the call site), so the player is created
// with its final source and never has it swapped underneath it.
//
// It used to be rendered unconditionally and passed `null` until the proof
// loaded. When the url then arrived, expo-audio replaced the native shared
// object backing the player while `useAudioPlayerStatus` was still polling the
// previous one, and the next status read threw
// `NativeSharedObjectNotFoundException: Unable to find the native shared object
// associated with given JavaScript object`. The source is stable now, so there
// is no released object left for the status hook to read.
function VoiceNotePlayer({ note, recordedBy, onReport }) {
  const url = note.url;
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  const playing = !!status?.playing;
  // Prefer the recorded length from the row: it is what the business actually
  // captured, and it is on screen before the file has finished loading.
  const duration = note.duration_seconds || status?.duration || 0;
  const elapsed = playing ? (status?.currentTime ?? 0) : 0;
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const filledBars = Math.round(ratio * WAVE_BARS);

  function toggle() {
    haptics.buttonTap?.();
    if (playing) {
      player.pause();
      player.seekTo(0);
      return;
    }
    if (status?.didJustFinish) player.seekTo(0);
    player.play();
  }

  return (
    <View style={styles.section}>
      <View style={styles.voiceHeader}>
        <Text style={styles.sectionLabel}>VOICE NOTE</Text>
        {onReport && note?.id ? (
          <Pressable
            onPress={() => onReport(note.id)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('moderation.reportVoiceNote')}
          >
            <Feather name="more-horizontal" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.voiceCard}>
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.playBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop voice note' : 'Play voice note'}
        >
          <Feather
            name={playing ? 'square' : 'play'}
            size={17}
            color={colors.textPrimary}
          />
        </Pressable>

        <View style={styles.voiceBody}>
          <View style={styles.waveform} accessibilityElementsHidden>
            {Array.from({ length: WAVE_BARS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    backgroundColor: i < filledBars ? colors.accentText : colors.accentMuted,
                    height: 8 + ((i * 7) % 5) * 4.5,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.voiceMeta}>
            <Text style={styles.voiceLabel} numberOfLines={1}>
              Voice note{recordedBy ? ` from ${recordedBy}` : ''}
            </Text>
            <Text style={styles.voiceTimer}>
              {formatClock(playing ? elapsed : duration)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ApproveWorkScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route?.params ?? {};

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [proof, setProof] = useState(null);
  const [approving, setApproving] = useState(false);
  const [viewer, setViewer] = useState(null);
  // F028 — Guideline 1.2(b): report a specific proof-of-work photo or the
  // voice note. `targetType`/`targetId` mirror the pattern already used for
  // messages/reviews/businesses.
  const [reportTarget, setReportTarget] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!bookingId) {
      setStatus('error');
      return;
    }
    try {
      const res = await api.get(`/bookings/${bookingId}/proof`);
      if (!mounted.current) return;
      setProof(res);
      setStatus('ready');
    } catch {
      if (!mounted.current) return;
      setStatus('error');
    }
  }, [bookingId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  if (status === 'loading') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.centeredBody}>{i18n.t('common.loading')}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.stateCircle}>
          <Feather name="wifi-off" size={26} color={colors.textSecondary} />
        </View>
        <Text style={styles.centeredTitle}>Couldn't load the proof</Text>
        <Text style={styles.centeredBody}>
          Your payment is still held. Try again in a moment.
        </Text>
        <Pressable
          onPress={() => {
            setStatus('loading');
            load();
          }}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>{i18n.t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const businessName = proof?.business_name || 'The business';
  // Bug 6 — sentences below append their own trailing period right after this
  // name. A name that already ends in one ("Douglas Glen Cleaning Co.") came
  // out "Co.." — strip any trailing periods here once, rather than special-
  // casing the punctuation at every call site that follows the name with one.
  const businessNameForSentence = businessName.replace(/\.+$/, '');
  const releaseCents = proof?.release?.release_cents ?? 0;
  const releaseLabel = money(releaseCents);

  // Business-captured photos only in the AFTER column; BEFORE leads with the
  // client's own job-post photos, labelled, then the business's before shots
  // (walkthrough M5).
  //
  // F028 — `photoIds` rides alongside `photos`, index for index, for the
  // report affordance on ImageViewer. The client's own job-post photos
  // (proof.client_photos) are bare URLs on service_posts.image_urls, not a
  // booking_photos row — there is nothing to report per-photo there (a
  // client reporting their own photo makes no sense anyway), so those
  // entries carry a null id. Business-captured rows (proof.before /
  // proof.after) DO have a booking_photos.id. Built as one filtered array of
  // pairs, not two arrays each filtered on their own, so a dropped falsy URL
  // can never desync `photos` from `photoIds` at the same index.
  const beforePairs = [
    ...(proof?.client_photos || []).map((url) => ({ url, id: null })),
    ...(proof?.before || []).map((p) => ({ url: p.url, id: p.id ?? null })),
  ].filter((pair) => pair.url);
  const afterPairs = (proof?.after || [])
    .map((p) => ({ url: p.url, id: p.id ?? null }))
    .filter((pair) => pair.url);
  const beforePhotos = beforePairs.map((p) => p.url);
  const beforePhotoIds = beforePairs.map((p) => p.id);
  const afterPhotos = afterPairs.map((p) => p.url);
  const afterPhotoIds = afterPairs.map((p) => p.id);

  const notSubmitted = proof?.status !== 'submitted';
  const alreadyApproved = proof?.status === 'approved';

  function confirmApprove() {
    // Irreversible action — the alert names the amount, per spec §1.
    Alert.alert(
      'Release payment?',
      `${releaseLabel} goes to ${businessName} and this can't be undone. Only approve if the work is done.`,
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: `Release ${releaseLabel}`,
          style: 'destructive',
          onPress: doApprove,
        },
      ],
    );
  }

  async function doApprove() {
    setApproving(true);
    try {
      await api.post(`/bookings/${bookingId}/proof/approve`);
      haptics.successTap?.();
      toast.show({
        type: 'success',
        text1: 'Payment released',
        text2: `${releaseLabel} is on its way to ${businessNameForSentence}.`,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Nothing was released',
        err?.response?.data?.detail ||
          err?.message ||
          'Your payment is still held. Try again in a moment.',
      );
    } finally {
      if (mounted.current) setApproving(false);
    }
  }

  async function raiseIssue() {
    // Flag it first so nothing can release while they write the dispute up,
    // then hand off to the flow that owns disputes.
    try {
      await api.post(`/bookings/${bookingId}/proof/decline`);
    } catch {
      // Non-fatal: the dispute itself is what holds the funds. Keep going
      // rather than trapping someone on this screen.
    }
    navigation.navigate('DisputeFlow', { bookingId });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('common.back')}
          style={styles.headerBtn}
        >
          <Feather name="arrow-left" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approve work</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 180 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hero} numberOfLines={2}>
          {businessName} sent proof
        </Text>
        <Text style={styles.heroSub} numberOfLines={2}>
          {[proof?.service_category, proof?.submitted_at ? 'finished today' : null]
            .filter(Boolean)
            .join(' · ') || 'Review the photos before you release payment.'}
        </Text>

        {notSubmitted && !alreadyApproved ? (
          <View style={styles.emptyState}>
            <View style={styles.stateCircle}>
              <Feather name="clock" size={26} color={colors.textSecondary} />
            </View>
            <Text style={styles.centeredTitle}>No proof yet</Text>
            <Text style={styles.centeredBody}>
              {businessName} hasn't sent before-and-after photos. Your payment stays
              held until they do and you approve.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.compareRow}>
              <CompareColumn
                label="BEFORE"
                labelColor={colors.textSecondary}
                borderColor={colors.border}
                photos={beforePhotos}
                emptyLabel="No before photos"
                onOpen={(i) => setViewer({ images: beforePhotos, ids: beforePhotoIds, index: i })}
              />
              <CompareColumn
                label="AFTER"
                labelColor={colors.success}
                borderColor={AFTER_BORDER}
                photos={afterPhotos}
                emptyLabel="No after photos"
                onOpen={(i) => setViewer({ images: afterPhotos, ids: afterPhotoIds, index: i })}
              />
            </View>

            <View style={styles.swipeHint}>
              <Feather name="chevron-left" size={13} color={colors.textTertiary} />
              <Text style={styles.swipeHintText}>Swipe either side to compare</Text>
              <Feather name="chevron-right" size={13} color={colors.textTertiary} />
            </View>

            {proof?.voice_note?.url ? (
              <VoiceNotePlayer
                // Remount if the signed url is re-minted, rather than mutating
                // the source of a live player.
                key={proof.voice_note.url}
                note={proof.voice_note}
                recordedBy={proof?.business_name}
                onReport={(id) => setReportTarget({
                  targetType: moderation.REPORT_TARGETS.VOICE_NOTE,
                  targetId: id,
                })}
              />
            ) : null}

            <View style={styles.releaseNotice}>
              <Feather name="lock" size={16} color={colors.success} />
              <Text style={styles.releaseText}>
                Approving releases{' '}
                <Text style={styles.releaseAmount}>{releaseLabel}</Text> to {businessNameForSentence}.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {!notSubmitted && !alreadyApproved && (
        <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
          <Pressable
            onPress={confirmApprove}
            disabled={approving}
            style={({ pressed }) => [
              styles.cta,
              approving && { opacity: 0.4 },
              pressed && !approving && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Approve and release ${releaseLabel}`}
            accessibilityState={{ busy: approving }}
          >
            {approving ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.ctaLabel}>Approve &amp; release payment</Text>
            )}
          </Pressable>

          <Pressable
            onPress={raiseIssue}
            disabled={approving}
            style={({ pressed }) => [styles.plainBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel="Something's wrong, raise an issue"
          >
            <Text style={styles.plainBtnText}>Something's wrong</Text>
          </Pressable>
        </View>
      )}

      <ImageViewer
        visible={!!viewer}
        images={viewer?.images || []}
        initialIndex={viewer?.index || 0}
        onClose={() => setViewer(null)}
        reportIds={viewer?.ids}
        onReport={(id) => setReportTarget({
          targetType: moderation.REPORT_TARGETS.BOOKING_PHOTO,
          targetId: id,
        })}
      />

      <ReportSheet
        visible={!!reportTarget}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        onClose={() => setReportTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 8 },
  centeredTitle: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
  centeredBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stateCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 12 },
  secondaryBtn: {
    marginTop: 12,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: { width: 40, minHeight: 44, justifyContent: 'center' },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 20 },
  hero: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.8,
    color: colors.textPrimary,
    marginTop: 12,
  },
  heroSub: { fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginTop: 6 },

  compareRow: { flexDirection: 'row', gap: COLUMN_GAP, marginTop: 32 },
  column: { flex: 1 },
  columnLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.4, marginBottom: 12 },
  compareTile: {
    height: COMPARE_HEIGHT,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    overflow: 'hidden',
  },
  compareEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  compareEmptyText: { fontSize: 11.5, color: colors.textTertiary },
  counterChip: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: colors.overlayScrim,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  counterChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  swipeHintText: { fontSize: 11.5, color: colors.textTertiary },

  section: { marginTop: 32 },
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceBody: { flex: 1, gap: 8 },
  waveform: { flexDirection: 'row', alignItems: 'center', height: 26, gap: 2.5 },
  waveBar: { flex: 1, borderRadius: 999 },
  voiceMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  voiceLabel: { flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.textSecondary },
  voiceTimer: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },

  releaseNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 32,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    padding: 14,
  },
  releaseText: { flex: 1, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary },
  releaseAmount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.success,
    fontVariant: ['tabular-nums'],
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: 15.5, fontWeight: '600', color: colors.textPrimary },
  plainBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  plainBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
