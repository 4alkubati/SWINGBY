// ProofOfWorkScreen — business capture side of proof of work.
//
// Spec: design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §1 ("Business —
// capture"). Walkthrough items M5 (client photos pre-fill BEFORE, labelled) and
// M6 (voice memo).
//
// This is the screen that closes the escrow loop from the provider's side: show
// what you did, send it, and the client's approval is what releases the money.
//
// Route params: { bookingId, businessName? }
//
// ⚠ VOICE MEMO — AUDIO CAPTURE IS STUBBED. ⚠
// There is no audio dependency in mobile/package.json (no expo-av, no
// expo-audio) and this lane may not add one. The memo UI below is fully built
// and interactive — record/stop/playback, equal-flex waveform, tabular timer,
// 60 s hard cap, re-record replaces — but it is driven by a timer, not a
// microphone. See RECORDER_TODO. The screen shows an on-screen notice so the
// state is never mistaken for a real recording, and the CTA is never blocked on
// the memo either way (spec §1).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

import Text from '../../components/Text';
import SwImage from '../../components/SwImage';
import ImageViewer from '../../components/ImageViewer';
import { api, BASE_URL, getAuthToken } from '../../services/api';
import * as haptics from '../../services/haptics';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
import { colors, radius } from '../../theme/tokens';

// Local layout constants. theme/tokens.js is owned by another lane this cycle,
// so anything not already a token stays here rather than being added there.
const TILE_HEIGHT = 104;
const TILE_RADIUS = 14;
const TILE_GAP = 9;
const COLUMNS = 3;
const MAX_VOICE_SECONDS = 60;
const MIN_PER_PHASE = 2;

const PHASES = [
  { key: 'before', label: 'BEFORE' },
  { key: 'after', label: 'AFTER' },
];

// ─── Upload with real per-tile progress ──────────────────────────────────────
// services/api.js `uploadFile` uses fetch(), which reports no progress. The spec
// asks for per-tile progress, and React Native's XMLHttpRequest does expose
// upload.onprogress — so this is a local uploader, not a new dependency.
function uploadWithProgress(endpoint, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${endpoint}`);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress?.(Math.min(0.99, e.loaded / e.total));
        }
      };
    }

    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('Server returned an invalid response'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(body);
      } else {
        reject(new Error(typeof body?.detail === 'string' ? body.detail : 'Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(form);
  });
}

function fileFromAsset(asset) {
  const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
  return {
    uri: asset.uri,
    type: asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    name: asset.fileName || `proof_${Date.now()}.${ext}`,
  };
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── Photo tile ──────────────────────────────────────────────────────────────
function PhotoTile({ item, onRetry, onOpen }) {
  const failed = item.state === 'failed';
  const uploading = item.state === 'uploading';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        styles.tileFilled,
        pressed && !uploading && { opacity: 0.9 },
      ]}
      onPress={failed ? onRetry : onOpen}
      accessibilityRole="button"
      accessibilityLabel={
        failed ? 'Upload failed, tap to retry' : `${item.phase} photo`
      }
    >
      <SwImage source={{ uri: item.uri }} style={styles.tileImage} accessibilityLabel="" />

      {item.clientSupplied && (
        <View style={styles.tileBadge}>
          <Text style={styles.tileBadgeText} numberOfLines={1}>
            From your job post
          </Text>
        </View>
      )}

      {uploading && (
        <View style={styles.tileOverlay}>
          <ActivityIndicator size="small" color={colors.textPrimary} />
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round((item.progress || 0) * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}

      {failed && (
        <View style={styles.tileOverlay}>
          <Feather name="refresh-cw" size={18} color={colors.danger} />
          <Text style={styles.tileRetryText}>Retry</Text>
        </View>
      )}
    </Pressable>
  );
}

function AddTile({ onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        styles.tileAdd,
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.4 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add photo"
    >
      <Feather name="plus" size={18} color={colors.accentText} />
      <Text style={styles.addLabel}>Add</Text>
    </Pressable>
  );
}

// A real, invisible column so three tiles never stretch into two (spec §1).
function TileSpacer() {
  return <View style={styles.tile} pointerEvents="none" />;
}

// ─── Voice memo card ─────────────────────────────────────────────────────────
const WAVE_BARS = 34;

function VoiceNoteCard({ note, onRecordedStub, onDelete }) {
  const [mode, setMode] = useState('idle'); // idle | recording | playing
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);

  const duration = note?.duration_seconds ?? 0;
  const hasNote = !!note;

  useEffect(() => () => clearInterval(timer.current), []);

  function stopTimer() {
    clearInterval(timer.current);
    timer.current = null;
  }

  function handleRecordPress() {
    haptics.buttonTap?.();

    if (mode === 'recording') {
      stopTimer();
      const captured = Math.max(1, Math.round(elapsed));
      setMode('idle');
      setElapsed(0);
      // RECORDER_TODO — hand `captured` plus a real audio file to
      // PUT /bookings/:id/proof/voice-note once an audio dependency exists.
      onRecordedStub(captured);
      return;
    }

    if (mode === 'playing') {
      stopTimer();
      setMode('idle');
      setElapsed(0);
      return;
    }

    if (hasNote) {
      // Playback of a saved memo — also stubbed; it walks the waveform so the
      // player's behaviour is reviewable.
      setMode('playing');
      setElapsed(0);
      timer.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 0.25 >= duration) {
            stopTimer();
            setMode('idle');
            return 0;
          }
          return prev + 0.25;
        });
      }, 250);
      return;
    }

    setMode('recording');
    setElapsed(0);
    timer.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.25;
        if (next >= MAX_VOICE_SECONDS) {
          // Hard cap at 60 s — stop dead rather than trimming later.
          stopTimer();
          setMode('idle');
          onRecordedStub(MAX_VOICE_SECONDS);
          return 0;
        }
        return next;
      });
    }, 250);
  }

  const total = mode === 'recording' ? MAX_VOICE_SECONDS : duration || MAX_VOICE_SECONDS;
  const ratio = total > 0 ? Math.min(1, elapsed / total) : 0;
  const filledBars = Math.round(ratio * WAVE_BARS);

  const stateLabel =
    mode === 'recording' ? 'Recording…' : hasNote ? 'Voice note saved' : 'Tap to record';
  const stateColor = mode === 'recording' ? colors.danger : colors.textSecondary;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>VOICE NOTE · OPTIONAL</Text>
        {hasNote && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Delete voice note"
          >
            <Text style={styles.sectionAction}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.voiceCard}>
        <View style={styles.voiceRow}>
          <Pressable
            onPress={handleRecordPress}
            style={({ pressed }) => [
              styles.recordBtn,
              {
                backgroundColor:
                  mode === 'recording' ? colors.danger : colors.accent,
              },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'recording'
                ? 'Stop recording'
                : hasNote
                  ? 'Play voice note'
                  : 'Record a voice note'
            }
          >
            {mode === 'recording' ? (
              <View style={styles.recordStopSquare} />
            ) : (
              <Feather
                name={hasNote && mode !== 'playing' ? 'play' : 'mic'}
                size={18}
                color={colors.textPrimary}
              />
            )}
          </Pressable>

          <View style={styles.voiceBody}>
            <View style={styles.waveform} accessibilityElementsHidden>
              {Array.from({ length: WAVE_BARS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      backgroundColor:
                        i < filledBars ? colors.accentText : colors.accentMuted,
                      // Deterministic pseudo-random heights: a flat bar row
                      // reads as a progress bar, not a waveform.
                      height: 8 + ((i * 7) % 5) * 4.5,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.voiceMeta}>
              <Text style={[styles.voiceState, { color: stateColor }]}>{stateLabel}</Text>
              <Text style={styles.voiceTimer}>
                {formatClock(mode === 'idle' && hasNote ? duration : elapsed)} /{' '}
                {formatClock(MAX_VOICE_SECONDS)}
              </Text>
            </View>
          </View>
        </View>

        {/* Loud, on-screen, and shipped — nobody at a demo should mistake the
            stub for a working microphone. */}
        <View style={styles.stubNotice}>
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={styles.stubNoticeText}>
            Preview only — audio capture needs a dev build. Nothing is recorded yet.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ProofOfWorkScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route?.params ?? {};

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [proof, setProof] = useState(null);
  const [pending, setPending] = useState([]); // in-flight/failed uploads
  const [submitting, setSubmitting] = useState(false);
  const [viewer, setViewer] = useState(null);
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

  // Saved photos, split by phase. The client's own job-post photos lead the
  // BEFORE set, labelled — walkthrough M5. They never count toward the minimum;
  // the server enforces that too.
  const byPhase = useMemo(() => {
    const clientShots = (proof?.client_photos || []).map((url, i) => ({
      id: `client-${i}`,
      uri: url,
      phase: 'before',
      state: 'done',
      clientSupplied: true,
    }));
    const saved = (phase) =>
      (proof?.[phase] || []).map((p) => ({
        id: p.id,
        uri: p.url,
        phase,
        state: 'done',
        clientSupplied: false,
      }));

    return {
      before: [...clientShots, ...saved('before'), ...pending.filter((p) => p.phase === 'before')],
      after: [...saved('after'), ...pending.filter((p) => p.phase === 'after')],
    };
  }, [proof, pending]);

  const counts = proof?.counts ?? {
    before: 0,
    after: 0,
    before_needed: MIN_PER_PHASE,
    after_needed: MIN_PER_PHASE,
    can_submit: false,
  };
  const canSubmit = !!counts.can_submit && !submitting;

  async function pickAndUpload(phase) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Photos permission needed',
        'Allow photo access so you can show the work you did.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;

    for (const asset of result.assets) {
      startUpload(phase, asset);
    }
  }

  function startUpload(phase, asset) {
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id: localId,
      uri: asset.uri,
      phase,
      state: 'uploading',
      progress: 0,
      asset,
    };
    setPending((prev) => [...prev, entry]);
    runUpload(entry);
  }

  async function runUpload(entry) {
    const patch = (changes) =>
      setPending((prev) => prev.map((p) => (p.id === entry.id ? { ...p, ...changes } : p)));

    patch({ state: 'uploading', progress: 0 });

    try {
      const up = await uploadWithProgress('/uploads/image', fileFromAsset(entry.asset), (pct) =>
        patch({ progress: pct }),
      );
      await api.post(`/bookings/${bookingId}/photos`, {
        phase: entry.phase,
        url: up.url,
        path: up.path,
      });
      // Refetch so counts come from the server, not from local arithmetic —
      // the server is the one that decides whether this unlocks the CTA.
      await load();
      setPending((prev) => prev.filter((p) => p.id !== entry.id));
    } catch (err) {
      patch({ state: 'failed', progress: 0, error: err?.message });
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post(`/bookings/${bookingId}/proof/submit`);
      haptics.successTap?.();
      toast.show({
        type: 'success',
        text1: 'Sent for approval',
        text2: 'Payment releases when the client approves.',
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        "Couldn't send",
        err?.response?.data?.detail || err?.message || 'Try again in a moment.',
      );
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  async function handleVoiceStub(seconds) {
    // RECORDER_TODO — with a real recorder this uploads the audio file first,
    // then PUTs { url, path, duration_seconds }. Until then the endpoint is not
    // called at all: writing a row with no audio behind it would be a lie in
    // the database, which is worse than the feature being absent.
    Alert.alert(
      'Voice notes need a dev build',
      `Captured ${seconds}s in the preview. Recording ships once an audio module is added — nothing was saved.`,
    );
  }

  async function handleVoiceDelete() {
    try {
      await api.delete(`/bookings/${bookingId}/proof/voice-note`);
      await load();
    } catch {
      toast.show({ type: 'error', text1: "Couldn't remove the voice note" });
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
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
        <View style={styles.errorCircle}>
          <Feather name="wifi-off" size={26} color={colors.textSecondary} />
        </View>
        <Text style={styles.centeredTitle}>Couldn't load this job</Text>
        <Text style={styles.centeredBody}>
          Check your connection and try again — nothing you added is lost.
        </Text>
        <Pressable
          onPress={() => {
            setStatus('loading');
            load();
          }}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <Text style={styles.retryBtnText}>{i18n.t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  const alreadySubmitted = proof?.status === 'submitted' || proof?.status === 'approved';

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
        <Text style={styles.headerTitle}>Finish job</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hero}>Show your work</Text>
        <Text style={styles.heroSub}>
          The client approves from these, and payment releases. Two photos minimum.
        </Text>

        {PHASES.map(({ key, label }) => {
          const items = byPhase[key];
          const need = key === 'before' ? counts.before_needed : counts.after_needed;
          const have = key === 'before' ? counts.before : counts.after;
          const satisfied = need === 0;

          // Slots: every saved/pending photo, then one add tile, padded with
          // invisible spacers so a short row keeps three-column widths.
          const slots = [...items, { kind: 'add' }];
          while (slots.length % COLUMNS !== 0) slots.push({ kind: 'spacer' });
          const rows = [];
          for (let i = 0; i < slots.length; i += COLUMNS) {
            rows.push(slots.slice(i, i + COLUMNS));
          }

          return (
            <View key={key} style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>{label}</Text>
                <Text
                  style={[
                    styles.sectionCount,
                    { color: satisfied ? colors.success : colors.warning },
                  ]}
                >
                  {satisfied ? `${have} added` : `${need} more needed`}
                </Text>
              </View>

              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.tileRow}>
                  {row.map((slot, colIndex) => {
                    if (slot.kind === 'spacer') {
                      return <TileSpacer key={`spacer-${rowIndex}-${colIndex}`} />;
                    }
                    if (slot.kind === 'add') {
                      return (
                        <AddTile
                          key={`add-${key}`}
                          onPress={() => pickAndUpload(key)}
                          disabled={alreadySubmitted}
                        />
                      );
                    }
                    return (
                      <PhotoTile
                        key={slot.id}
                        item={slot}
                        onRetry={() => runUpload(slot)}
                        onOpen={() =>
                          setViewer({
                            images: items.map((it) => it.uri),
                            index: items.findIndex((it) => it.id === slot.id),
                          })
                        }
                      />
                    );
                  })}
                </View>
              ))}

              {key === 'before' && (proof?.client_photos || []).length > 0 && (
                <Text style={styles.sectionHint}>
                  Photos from the job post are shown first. Your own before shots are
                  what count.
                </Text>
              )}
            </View>
          );
        })}

        <VoiceNoteCard
          note={proof?.voice_note}
          onRecordedStub={handleVoiceStub}
          onDelete={handleVoiceDelete}
        />
      </ScrollView>

      {/* Sticky footer CTA. Disabled = ONE opacity on the whole button; the
          label keeps its colour (POLISH-TIPS §6). */}
      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || alreadySubmitted}
          style={({ pressed }) => [
            styles.cta,
            (!canSubmit || alreadySubmitted) && { opacity: 0.4 },
            pressed && canSubmit && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || alreadySubmitted, busy: submitting }}
          accessibilityLabel="Send for approval"
        >
          {submitting ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.ctaLabel}>
              {alreadySubmitted ? 'Sent for approval' : 'Send for approval'}
            </Text>
          )}
        </Pressable>
      </View>

      <ImageViewer
        visible={!!viewer}
        images={viewer?.images || []}
        initialIndex={viewer?.index || 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 8 },
  centeredTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 4,
  },
  centeredBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
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
  retryBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

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
  heroSub: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  section: { marginTop: 32 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  sectionCount: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  sectionAction: { fontSize: 12.5, fontWeight: '600', color: colors.accentText },
  sectionHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
  },

  tileRow: { flexDirection: 'row', gap: TILE_GAP, marginBottom: TILE_GAP },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    borderRadius: TILE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileFilled: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileAdd: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentMuted,
    gap: 4,
  },
  tileImage: { ...StyleSheet.absoluteFillObject },
  addLabel: { fontSize: 11, fontWeight: '600', color: colors.accentText },
  tileBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    right: 6,
    backgroundColor: colors.overlayScrim,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tileBadgeText: { fontSize: 9.5, fontWeight: '600', color: colors.textSecondary },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,8,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  tileRetryText: { fontSize: 11, fontWeight: '600', color: colors.danger },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 999, backgroundColor: colors.accent },

  voiceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordStopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: colors.textPrimary,
  },
  voiceBody: { flex: 1, gap: 8 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    gap: 2.5,
  },
  waveBar: { flex: 1, borderRadius: 999 },
  voiceMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceState: { fontSize: 11.5, fontWeight: '600' },
  voiceTimer: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  stubNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(246,178,59,0.14)',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  stubNoticeText: { flex: 1, fontSize: 11.5, lineHeight: 18, color: colors.warning },

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
});
