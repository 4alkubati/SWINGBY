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
// VOICE MEMO — real capture as of 2026-07-25.
// `expo-audio` (~1.1.1, the SDK 54 pairing; expo-av is deprecated) replaced the
// timer-driven stub that shipped in the first cut of this screen. It is a
// native module, so it only exists in a build made AFTER it was added — Expo Go
// and any older APK will not have it. The UI is unchanged from the spec:
// record/stop/playback, equal-flex waveform, tabular timer, 60 s hard cap,
// re-record replaces. The CTA is still never blocked on the memo (spec §1).
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
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import Text from '../../components/Text';
import ScreenHeader from '../../components/ScreenHeader';
import SwImage from '../../components/SwImage';
import ImageViewer from '../../components/ImageViewer';
import { api, BASE_URL, getAuthToken } from '../../services/api';
import * as haptics from '../../services/haptics';
import * as toast from '../../services/toast';
import i18n from '../../i18n';
// One "I'm done" — the same module the stage tracker on JobManagementScreen
// calls, so whichever control a business reaches first finishes the whole job.
import { finishJob, needsProofSubmit, FINISH_DONE } from '../../services/finishJob';
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

// expo-audio writes an .m4a (MPEG-4/AAC) on both platforms with the
// HIGH_QUALITY preset. Android reports that container as audio/mp4, iOS as
// audio/m4a — the upload endpoint accepts both, plus the extension fallbacks.
function fileFromRecording(uri) {
  const ext = (uri.split('.').pop() || 'm4a').toLowerCase().split('?')[0];
  const type = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
  return { uri, type, name: `voice_${Date.now()}.${ext}` };
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

// Owns the recorder for the card's whole life. This wrapper is deliberately
// NOT keyed by note.url — VoiceNoteCardBody below is. The recorder has
// nothing to do with which memo is currently playable; keying it too meant
// that every time a recording finished saving (note.url changing), React
// tore the recorder down and remounted a new one while
// useAudioRecorderState's 250 ms poller — created before the remount — was
// still reading the old, now-released native object.
// ERR_USING_RELEASED_SHARED_OBJECT, 25 times in one walkthrough. The record
// and save actions themselves always succeeded; only this re-render died.
function VoiceNoteCard({ note, saving, onRecorded, onDelete }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // 250 ms matches the old stub's tick, so the waveform advances at the same
  // rate the design was reviewed at.
  const recorderState = useAudioRecorderState(recorder, 250);

  const isRecording = !!recorderState?.isRecording;
  // Guards a re-entrant stop: the 60 s auto-stop effect and a fast double-tap
  // can both land inside stopRecording() before the first await returns.
  const stopping = useRef(false);

  const recordedSeconds = (recorderState?.durationMillis ?? 0) / 1000;

  const stopRecording = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;

    // Read the length BEFORE stopping — the recorder zeroes its duration once
    // it has stopped, and a memo saved as 0 s fails the API's ge=1 check.
    const seconds = Math.max(
      1,
      Math.min(MAX_VOICE_SECONDS, Math.round((recorderState?.durationMillis ?? 0) / 1000)),
    );

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('The recorder produced no file');
      await onRecorded(uri, seconds);
    } catch (err) {
      Alert.alert(
        "Couldn't save the recording",
        err?.message || 'Try recording it again.',
      );
    } finally {
      stopping.current = false;
    }
  }, [recorder, recorderState?.durationMillis, onRecorded]);

  // Hard cap at 60 s (spec §1). The native `forDuration` option would also stop
  // the recorder, but it does not tell JS that it did — this way the same code
  // path saves the memo whether the cap or the user stopped it.
  useEffect(() => {
    if (isRecording && recordedSeconds >= MAX_VOICE_SECONDS) {
      stopRecording();
    }
  }, [isRecording, recordedSeconds, stopRecording]);

  // Leaving mid-recording must not strand a live microphone session. This
  // now only fires when the card itself unmounts (the screen is left) —
  // the recorder lives above the url-keyed subtree, so a memo saving no
  // longer triggers it mid-session.
  useEffect(
    () => () => {
      if (recorder?.isRecording) recorder.stop().catch(() => {});
    },
    [recorder],
  );

  async function startRecording() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Microphone permission needed',
        'Allow microphone access to record a voice note about the job.',
      );
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      Alert.alert(
        "Couldn't start recording",
        err?.message || 'The microphone is unavailable right now.',
      );
    }
  }

  return (
    <VoiceNoteCardBody
      // Keyed on the url so the PLAYER remounts instead of expo-audio
      // releasing its native object out from under a live JS handle (see
      // the comment where this renders, in ProofOfWorkScreen below). The
      // recorder above this line is outside the remount, so it is untouched.
      key={note?.url || 'no-voice-note'}
      note={note}
      saving={saving}
      onDelete={onDelete}
      isRecording={isRecording}
      recordedSeconds={recordedSeconds}
      startRecording={startRecording}
      stopRecording={stopRecording}
    />
  );
}

function VoiceNoteCardBody({
  note,
  saving,
  onDelete,
  isRecording,
  recordedSeconds,
  startRecording,
  stopRecording,
}) {
  const hasNote = !!note?.url;
  const duration = note?.duration_seconds ?? 0;

  const player = useAudioPlayer(hasNote ? { uri: note.url } : null);
  const playerStatus = useAudioPlayerStatus(player);

  const playing = !!playerStatus?.playing;

  function handleRecordPress() {
    haptics.buttonTap?.();
    if (saving) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    if (hasNote) {
      if (playing) {
        player.pause();
        player.seekTo(0);
      } else {
        // A finished player sits at the end — rewind or play() is a no-op.
        if (playerStatus?.didJustFinish) player.seekTo(0);
        player.play();
      }
      return;
    }

    startRecording();
  }

  // While recording, the bar fills against the 60 s ceiling; while playing, it
  // tracks real playback position.
  const elapsed = isRecording ? recordedSeconds : playing ? (playerStatus?.currentTime ?? 0) : 0;
  const total = isRecording ? MAX_VOICE_SECONDS : duration || MAX_VOICE_SECONDS;
  const ratio = total > 0 ? Math.min(1, elapsed / total) : 0;
  const filledBars = Math.round(ratio * WAVE_BARS);

  const stateLabel = isRecording
    ? 'Recording…'
    : saving
      ? 'Saving…'
      : playing
        ? 'Playing'
        : hasNote
          ? 'Voice note saved'
          : 'Tap to record';
  const stateColor = isRecording ? colors.danger : colors.textSecondary;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>VOICE NOTE · OPTIONAL</Text>
        {hasNote && !isRecording && !saving && (
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
            disabled={saving}
            style={({ pressed }) => [
              styles.recordBtn,
              { backgroundColor: isRecording ? colors.danger : colors.accent },
              saving && { opacity: 0.55 },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!saving }}
            accessibilityLabel={
              isRecording
                ? 'Stop recording'
                : hasNote
                  ? playing
                    ? 'Stop playing the voice note'
                    : 'Play voice note'
                  : 'Record a voice note'
            }
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : isRecording ? (
              <View style={styles.recordStopSquare} />
            ) : (
              <Feather
                name={hasNote ? (playing ? 'square' : 'play') : 'mic'}
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
                {formatClock(hasNote && !isRecording && !playing ? duration : elapsed)} /{' '}
                {formatClock(MAX_VOICE_SECONDS)}
              </Text>
            </View>
          </View>
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
  const [savingVoice, setSavingVoice] = useState(false);
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

  // ONE "I'm done" (walkthrough item 2, 2026-08-06).
  //
  // This used to be "Send for approval", and it only submitted the proof —
  // which does not mark the job done, does not open the client's approval
  // window, and therefore leaves the money held with nobody able to release it.
  // The business had to know to go to the other screen's stage tracker and tap
  // "Mark complete" as well. Nobody knows that.
  //
  // Both halves now run through services/finishJob.js, which the stage tracker
  // calls too, so whichever control a business reaches first does the whole
  // thing.
  async function handleFinish() {
    if (submitting || alreadyDone) return;

    const willSendProof = needsProofSubmit(proof);
    Alert.alert(
      i18n.t('finish.confirmTitle'),
      willSendProof
        ? i18n.t('finish.confirmWithProof', {
            count: counts.before + counts.after,
          })
        : // Said plainly rather than enforced with a disabled button: a control
          // that refuses and does not explain is the same walkthrough class as
          // the ⋯ menu. They may genuinely have no photos, and a finished job
          // must not be un-finishable because of it.
          i18n.t('finish.confirmNoProof'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('finish.confirmCta'),
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await finishJob(bookingId, { proof });
              haptics.successTap?.();
              toast.show({
                type: 'success',
                text1: i18n.t('finish.doneToastTitle'),
                text2:
                  res.outcome === FINISH_DONE
                    ? i18n.t('finish.doneToastBodyProof')
                    : i18n.t('finish.doneToastBodyNoProof'),
              });
              navigation.goBack();
            } catch (err) {
              // The half-failure gets its own copy, because it is the exact
              // state this whole change exists to stop someone sitting in
              // without knowing.
              Alert.alert(
                err?.proofSentButNotComplete
                  ? i18n.t('finish.halfDoneTitle')
                  : i18n.t('finish.failedTitle'),
                err?.response?.data?.detail ||
                  err?.message ||
                  i18n.t('finish.failedBody'),
              );
            } finally {
              if (mounted.current) setSubmitting(false);
            }
          },
        },
      ],
    );
  }

  // Upload the file FIRST, then write the row. If the upload fails there is no
  // row — a memo row pointing at nothing would show the client a player that
  // plays silence and tell them the business documented the job when it didn't.
  async function handleVoiceRecorded(uri, seconds) {
    setSavingVoice(true);
    try {
      const up = await uploadWithProgress('/uploads/audio', fileFromRecording(uri), null);
      await api.put(`/bookings/${bookingId}/proof/voice-note`, {
        url: up.url,
        path: up.path,
        duration_seconds: seconds,
      });
      await load();
      haptics.successTap?.();
      toast.show({ type: 'success', text1: 'Voice note saved' });
    } catch (err) {
      Alert.alert(
        "Couldn't save the voice note",
        err?.response?.data?.detail || err?.message || 'Try recording it again.',
      );
    } finally {
      if (mounted.current) setSavingVoice(false);
    }
  }

  async function handleVoiceDelete() {
    const path = proof?.voice_note?.path;
    try {
      await api.delete(`/bookings/${bookingId}/proof/voice-note`);
      // Drop the object too — the row is the only reference to it, so skipping
      // this would leave the audio sitting in the bucket after the business
      // deliberately removed it.
      if (path) {
        await api
          .delete('/uploads/audio', { params: { path } })
          .catch(() => {});
      }
      await load();
    } catch {
      toast.show({ type: 'error', text1: "Couldn't remove the voice note" });
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Finish job" onBack={() => navigation.goBack()} />
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.centeredBody}>{i18n.t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Finish job" onBack={() => navigation.goBack()} />
        <View style={[styles.centered, { flex: 1 }]}>
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
      </View>
    );
  }

  // The job is finished from this screen's point of view once the proof has
  // gone. `submitted` covers "sent, client has not answered"; `approved` covers
  // "client already released". Neither should offer to finish it again.
  const alreadyDone = proof?.status === 'submitted' || proof?.status === 'approved';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Finish job" onBack={() => navigation.goBack()} />

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
                          disabled={alreadyDone}
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
          // Below, VoiceNoteCardBody owns an expo-audio player whose source
          // is derived from `note.url`. Changing that url in place (memo
          // loads, a new one is recorded, one is deleted) makes expo-audio
          // release the native shared object while useAudioPlayerStatus
          // still holds the old JS handle — the next status read then
          // throws NativeSharedObjectNotFoundException. VoiceNoteCard keys
          // VoiceNoteCardBody on the url internally so it remounts instead;
          // the recorder lives in the (unkeyed) VoiceNoteCard above it and
          // is untouched by that remount — see its comment.
          note={proof?.voice_note}
          saving={savingVoice}
          onRecorded={handleVoiceRecorded}
          onDelete={handleVoiceDelete}
        />
      </ScrollView>

      {/* Sticky footer CTA. Disabled = ONE opacity on the whole button; the
          label keeps its colour (POLISH-TIPS §6).

          It is NOT gated on the photo minimum any more. It used to be, which
          meant the only control on this screen that finishes a job refused —
          silently, with no reason on screen — until four photos existed. The
          minimum still governs whether PROOF can be sent (needsProofSubmit),
          and the confirm says which of the two is about to happen. */}
      <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
        {!canSubmit && !alreadyDone ? (
          <Text style={styles.footerHint}>
            {i18n.t('finish.photoHint', {
              before: counts.before_needed,
              after: counts.after_needed,
            })}
          </Text>
        ) : null}
        <Pressable
          onPress={handleFinish}
          disabled={submitting || alreadyDone}
          style={({ pressed }) => [
            styles.cta,
            (submitting || alreadyDone) && { opacity: 0.4 },
            pressed && !alreadyDone && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting || alreadyDone, busy: submitting }}
          accessibilityLabel={
            alreadyDone ? i18n.t('finish.ctaDone') : i18n.t('finish.ctaA11y')
          }
        >
          {submitting ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.ctaLabel}>
              {alreadyDone ? i18n.t('finish.ctaDone') : i18n.t('finish.cta')}
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
