import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Image, ScrollView, ActivityIndicator, Alert, TouchableOpacity, StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

import { api, uploadFile } from '../services/api';
import Text from './Text';
import Stack from './Stack';
import Inline from './Inline';
import Surface from './Surface';
import Button from './Button';
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

    setUploading(true);
    try {
      const up = await uploadFile('/uploads/image', {
        uri: asset.uri,
        type: mimeType,
        name: asset.fileName || `photo_${Date.now()}.${ext}`,
      });

      await api.post(`/bookings/${bookingId}/photos`, {
        phase: targetPhase,
        url: up.url,
        path: up.path,
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
                      <Image
                        key={ph.id}
                        source={{ uri: ph.url }}
                        style={styles.thumb}
                        accessibilityLabel={`${PHASE_LABEL[p]} photo`}
                      />
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
    </Surface>
  );
}

const styles = StyleSheet.create({
  thumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
