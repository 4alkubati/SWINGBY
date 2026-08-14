// SendTermsSheet — the business writes the scope of work the client will agree
// to, from inside the thread (walkthrough M11).
//
// Uses React Native's own Modal rather than components/BottomSheet, for the
// same reason ImageViewer does: this sheet is mostly a keyboard and two text
// inputs, and a pan-gesture sheet fights the keyboard on Android.
//
// The copy does the honest work here. Once the client taps "I agree" the
// wording is frozen for both sides — the writer needs to know that BEFORE they
// send, not after.
import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../../components/Text';
import { colors, spacing, radius } from '../../theme/tokens';

const MAX_TITLE = 120;
const MAX_BODY = 4000;

export default function SendTermsSheet({ visible, sending = false, onClose, onSend }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const canSend = !!title.trim() && !!body.trim() && !sending;

  function handleClose() {
    if (sending) return;
    onClose?.();
  }

  async function handleSend() {
    if (!canSend) return;
    const ok = await onSend?.({ title: title.trim(), terms_text: body.trim() });
    // Only clear the draft once the send actually landed — a failed send that
    // wiped what the business typed would be worse than the failure.
    if (ok) {
      setTitle('');
      setBody('');
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <View style={styles.tile}>
                <Feather name="file-text" size={16} strokeWidth={1.8} color={colors.accentText} />
              </View>
              <Text variant="bodyMedium" style={{ flex: 1 }}>
                Terms to agree
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Feather name="x" size={20} strokeWidth={1.8} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.form}
            >
              <Text variant="caption" style={styles.label}>
                WHAT THE JOB IS
              </Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                // D-W8 (walkthrough 2026-08-13): these placeholders were
                // hardcoded for a PAINTING job and shown on a MOVING job
                // (screenshot 04 — "Hallway repaint" over "I need help
                // moving"). A placeholder that describes someone else's trade
                // reads as the app not knowing what job it is looking at.
                // Category-neutral copy works for every trade on the platform.
                placeholder="What this job covers"
                placeholderTextColor={colors.textTertiary}
                maxLength={MAX_TITLE}
                returnKeyType="next"
                accessibilityLabel="Title of the terms"
              />

              <Text variant="caption" style={styles.label}>
                WHAT'S INCLUDED — AND WHAT ISN'T
              </Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={body}
                onChangeText={setBody}
                placeholder={
                  'What you will do.\nWhat is included in the price.\nAnything that is not included.'
                }
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                maxLength={MAX_BODY}
                accessibilityLabel="The terms the client will agree to"
              />

              <Text variant="caption" style={styles.note}>
                No prices here — the quote and the pay sheet own what gets
                charged. Once the client agrees, this wording is locked for both
                of you, with their name and the time recorded against it.
              </Text>
            </ScrollView>

            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send these terms"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.cta,
                !canSend && styles.ctaDisabled,
                pressed && canSend && styles.ctaPressed,
              ]}
            >
              <Text variant="caption" style={styles.ctaLabel}>
                {sending ? 'Sending…' : 'Send for agreement'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '88%',
    gap: spacing.base,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  form: { gap: spacing.sm, paddingBottom: spacing.sm },
  // POLISH-TIPS §1 — uppercase section labels are 11px / 600 / 1.4px tracking.
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  inputMultiline: { minHeight: 132, maxHeight: 240 },
  note: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  cta: {
    height: 48,
    borderRadius: radius.button,
    backgroundColor: colors.accentBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  ctaLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
});
