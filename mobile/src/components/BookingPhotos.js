import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Image, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Pressable, StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { api, uploadFile } from '../services/api';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import Button from './Button';
import ImageViewer from './ImageViewer';
import PhotoAnnotator from './PhotoAnnotator';
import { colors, spacing, radius } from '../theme/tokens';

const PHASES = ['before', 'after'];

const PHASE_LABEL = { before: 'Before', after: 'After' };

/**
 * BookingPhotos — shows before/after photos for a booking.
 *
 * Props:
 *   bookingId  — uuid
 *   canAttach  — boolean (provider-side only)
 *   phase      — optional 'before' | 'after' filter (default: both)
 */
export default function BookingPhotos({ bookingId, canAttach = false, phase }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [uploading, setUploading] = useState(false);
  // null = viewer closed. Otherwise the index into `orderedUrls` below, which is
  // flattened in the same order the thumbnails render so swiping in the viewer
  // walks Before → After exactly as the eye does.
  const [viewerIndex, setViewerIndex] = useState(null);
  // The photo currently being marked up, or null. Provider-side only.
  const [annotating, setAnnotating] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const q = phase ? `?phase=${phase}` : '';
      const res = await api.get(`/bookings/${bookingId}/photos${q}`);
      if (!mounted.current) return;
      setItems(res.items || []);
      setStatus('ready');
    } catch {
      if (!mounted.current) return;
      setStatus('error');
    }
  }, [bookingId, phase]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  async function handleAttach(targetPhase) {
    if (!canAttach) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Photos permission required', 'Allow access to attach proof photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
    const mimeType = asset.mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    await attachFile({
      uri: asset.uri,
      mimeType,
      name: asset.fileName || `photo_${Date.now()}.${ext}`,
      targetPhase,
    });
  }

  // Shared by the picker and by saved markup, so both paths upload and attach
  // through exactly one code path.
  async function attachFile({ uri, mimeType, name, targetPhase, caption }) {
    setUploading(true);
    try {
      const up = await uploadFile('/uploads/image', { uri, type: mimeType, name });

      await api.post(`/bookings/${bookingId}/photos`, {
        phase: targetPhase,
        url: up.url,
        path: up.path,
        ...(caption ? { caption } : {}),
      });

      await load();
    } catch (err) {
      Alert.alert('Upload failed', err?.message || 'Try again.');
    } finally {
      if (mounted.current) setUploading(false);
    }
  }

  if (status === 'loading') {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Inline justify="center" spacing="sm">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text variant="small" color="secondary">Loading photos…</Text>
        </Inline>
      </Surface>
    );
  }

  if (status === 'error') {
    return (
      <Surface elevation="subtle" rounded="card" padding="base">
        <Text variant="small" color="secondary">Could not load photos.</Text>
      </Surface>
    );
  }

  const visiblePhases = phase ? [phase] : PHASES;
  const byPhase = Object.fromEntries(visiblePhases.map((p) => [p, []]));
  for (const it of items) {
    if (byPhase[it.phase]) byPhase[it.phase].push(it);
  }

  const totalCount = items.length;

  // One flat, ordered list of URLs for the lightbox, plus the index each
  // thumbnail maps to. Built from `byPhase` rather than `items` so it cannot
  // drift from render order if the API returns the phases interleaved.
  const orderedUrls = [];
  const indexOfPhoto = new Map();
  for (const p of visiblePhases) {
    for (const ph of byPhase[p]) {
      indexOfPhoto.set(ph.id, orderedUrls.length);
      orderedUrls.push(ph.url);
    }
  }

  return (
    <Surface elevation="subtle" rounded="card" padding="base">
      <Stack spacing="sm">
        <Inline justify="space-between" align="center">
          <Text variant="bodyMedium">Proof of work</Text>
          {!totalCount && (
            <Text variant="small" color="secondary">No photos yet</Text>
          )}
        </Inline>

        {visiblePhases.map((p) => {
          const phasePhotos = byPhase[p];
          return (
            <Stack key={p} spacing="xs">
              <Inline justify="space-between" align="center">
                <Text variant="label" color="secondary">{PHASE_LABEL[p]}</Text>
                {canAttach && (
                  <TouchableOpacity
                    onPress={() => handleAttach(p)}
                    disabled={uploading}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${PHASE_LABEL[p]} photo`}
                    style={styles.addBtn}
                  >
                    <Feather name="plus" size={14} color={colors.accent} />
                    <Text variant="caption" color="accent">Add</Text>
                  </TouchableOpacity>
                )}
              </Inline>
              {phasePhotos.length === 0 ? (
                <Text variant="caption" color="secondary">No {PHASE_LABEL[p].toLowerCase()} photos yet.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.thumbRow}>
                    {phasePhotos.map((ph) => (
                      <View key={ph.id}>
                        <Pressable
                          onPress={() => setViewerIndex(indexOfPhoto.get(ph.id) ?? 0)}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`${PHASE_LABEL[p]} photo, tap to view full screen`}
                          style={({ pressed }) => [pressed && styles.thumbPressed]}
                        >
                          <Image
                            source={{ uri: ph.url }}
                            style={styles.thumb}
                          />
                        </Pressable>

                        {/* Markup is a separate target from viewing, so tapping
                            a photo never surprises anyone into an editor. */}
                        {canAttach && (
                          <TouchableOpacity
                            onPress={() => setAnnotating({ url: ph.url, phase: p })}
                            disabled={uploading}
                            accessibilityRole="button"
                            accessibilityLabel={`Mark up this ${PHASE_LABEL[p].toLowerCase()} photo`}
                            hitSlop={8}
                            style={styles.markupBadge}
                          >
                            <Feather name="edit-2" size={12} color={colors.textPrimary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </Stack>
          );
        })}

        {uploading && (
          <Inline justify="center" spacing="sm">
            <ActivityIndicator size="small" color={colors.accent} />
            <Text variant="small" color="secondary">Uploading…</Text>
          </Inline>
        )}
      </Stack>

      <ImageViewer
        visible={viewerIndex !== null}
        images={orderedUrls}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />

      <PhotoAnnotator
        visible={annotating !== null}
        uri={annotating?.url}
        onCancel={() => setAnnotating(null)}
        onSave={async (markedUri) => {
          const target = annotating;
          setAnnotating(null);
          if (!target) return;
          // Uploaded as a NEW photo in the same phase — the original is never
          // replaced, so the unedited evidence survives alongside the markup.
          await attachFile({
            uri: markedUri,
            mimeType: 'image/jpeg',
            name: `markup_${Date.now()}.jpg`,
            targetPhase: target.phase,
            caption: 'Marked up',
          });
        }}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  thumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbPressed: {
    opacity: 0.8,
  },
  markupBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    // Sits on top of arbitrary photo content, so it needs its own boundary to
    // stay findable on a light image (WCAG 1.4.11).
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
});
