// PhotoAnnotator — draw on a job photo to show what was done.
//
// Kira's call (2026-08-06): the markup is BURNED IN to a new image rather than
// stored as stroke data. The reason is reach. A flattened JPEG shows up
// correctly in every surface that already renders a photo — the invoice, the
// dispute queue, refund review, chat, and the web app — with no changes to any
// of them. Stroke data would have to be re-rendered by each of those
// separately, which is precisely the "built but never wired" pattern this repo
// keeps paying for.
//
// The original is never touched. Saving uploads a SECOND photo row in the same
// phase, so before/after evidence keeps its unedited copy and the annotated one
// sits beside it. That also means markup is not editable after the fact — it is
// a new photo, not a layer. Accepted trade-off; a dispute wants a flat,
// tamper-evident image anyway.
//
// Resolution note: captureRef photographs the on-screen view, so the saved
// image is at screen scale rather than the camera's original resolution. Good
// enough to read markup on; do not use this path to re-upload an unannotated
// photo, which would silently downscale it.
import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  PanResponder,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

// High-visibility on photographs of real work — dirt, grass, drywall, asphalt.
// White leads because it reads on almost everything; the rest cover the cases
// where white does not (snow, pale tile, a bright sky).
const PENS = [
  { key: 'white', value: '#FFFFFF', label: 'White' },
  { key: 'red', value: colors.danger, label: 'Red' },
  { key: 'amber', value: colors.warning, label: 'Amber' },
  { key: 'green', value: colors.success, label: 'Green' },
  { key: 'purple', value: colors.accent, label: 'Purple' },
];

const STROKE_WIDTH = 5;

export default function PhotoAnnotator({ visible, uri, onCancel, onSave }) {
  const insets = useSafeAreaInsets();
  const shotRef = useRef(null);

  const [strokes, setStrokes] = useState([]);
  const [current, setCurrent] = useState(null);
  const [pen, setPen] = useState(PENS[0].value);
  const [saving, setSaving] = useState(false);

  // `current` is mirrored into a ref because PanResponder closes over the
  // handlers once; reading state inside onPanResponderMove would see the value
  // captured at creation time and every stroke would restart from its origin.
  const currentRef = useRef(null);
  const penRef = useRef(pen);
  penRef.current = pen;

  function reset() {
    setStrokes([]);
    setCurrent(null);
    currentRef.current = null;
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const next = {
          d: `M${locationX.toFixed(1)},${locationY.toFixed(1)}`,
          color: penRef.current,
        };
        currentRef.current = next;
        setCurrent(next);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const prev = currentRef.current;
        if (!prev) return;
        const next = {
          ...prev,
          d: `${prev.d} L${locationX.toFixed(1)},${locationY.toFixed(1)}`,
        };
        currentRef.current = next;
        setCurrent(next);
      },
      onPanResponderRelease: () => {
        const done = currentRef.current;
        currentRef.current = null;
        setCurrent(null);
        // A tap with no drag produces a move-less path that renders nothing.
        // Dropping it keeps Undo meaningful — otherwise the first Undo after a
        // stray tap appears to do nothing.
        if (done && done.d.includes('L')) {
          setStrokes((s) => [...s, done]);
        }
      },
    }),
  ).current;

  async function handleSave() {
    if (!strokes.length || saving) return;
    setSaving(true);
    try {
      const out = await captureRef(shotRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
      });
      await onSave(out);
      reset();
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    reset();
    onCancel?.();
  }

  const canSave = strokes.length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel markup"
            hitSlop={12}
            style={styles.iconBtn}
          >
            <Feather name="x" size={20} color={colors.textPrimary} />
          </Pressable>

          <Text variant="bodyMedium">Mark up photo</Text>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save marked-up photo"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.accentText} />
            ) : (
              <Text variant="bodyMedium" style={{ color: colors.accentText }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.canvasWrap}>
          <ViewShot ref={shotRef} style={styles.canvas}>
            <Image source={{ uri }} style={styles.photo} resizeMode="contain" />
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {strokes.map((s, i) => (
                <Path
                  key={i}
                  d={s.d}
                  stroke={s.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {current && (
                <Path
                  d={current.d}
                  stroke={current.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>
          </ViewShot>

          {/* The touch surface sits ABOVE ViewShot so the capture never
              photographs a pressed state or a highlight. */}
          <View
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Drawing area"
            {...pan.panHandlers}
          />
        </View>

        <View style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.pens}>
            {PENS.map((p) => {
              const active = pen === p.value;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => setPen(p.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label} pen`}
                  accessibilityState={{ selected: active }}
                  // Flattened to a single object rather than left as an array
                  // with an inline literal: Pressable's style pipeline runs a
                  // dev-only style validator that RN 0.81 does not expose under
                  // jest-expo, and an inline object in the array trips it
                  // ("getUseOfValueInStyleWarning is not a function"), taking
                  // the whole render down. Same pixels, one object.
                  style={StyleSheet.flatten([
                    styles.pen,
                    { backgroundColor: p.value },
                    active && styles.penActive,
                  ])}
                />
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => setStrokes((s) => s.slice(0, -1))}
              disabled={!strokes.length}
              accessibilityRole="button"
              accessibilityLabel="Undo last stroke"
              accessibilityState={{ disabled: !strokes.length }}
              hitSlop={8}
              style={[styles.iconBtn, !strokes.length && styles.dim]}
            >
              <Feather name="corner-up-left" size={18} color={colors.textPrimary} />
            </Pressable>

            <Pressable
              onPress={reset}
              disabled={!strokes.length}
              accessibilityRole="button"
              accessibilityLabel="Clear all markup"
              accessibilityState={{ disabled: !strokes.length }}
              hitSlop={8}
              style={[styles.iconBtn, !strokes.length && styles.dim]}
            >
              <Feather name="trash-2" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  dim: {
    opacity: 0.35,
  },
  saveBtn: {
    minWidth: 72,
    height: 44,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.accentBtn,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  canvasWrap: {
    flex: 1,
    margin: spacing.base,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  pens: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pen: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    // A boundary that clears 3:1 on bg — a white pen on near-black would
    // otherwise be the only swatch with a visible edge (WCAG 1.4.11).
    borderColor: colors.borderStrong,
  },
  penActive: {
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
