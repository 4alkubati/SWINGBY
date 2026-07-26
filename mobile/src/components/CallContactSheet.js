// CallContactSheet — tap Call, SEE the number, copy it, then dial.
//
// Kira's ruling (2026-07-25): "when the customer needs to call the business or
// the employee they should be able to click on call then use copy the phone and
// call them."
//
// The old behaviour fired `tel:` straight from the Call button. That is a blind
// hand-off: the number is never shown, so if the dialer fails, the device has no
// SIM, or the client wants the number in their own contacts, they get nothing.
// This surfaces every reachable party with the number in plain sight, a copy
// action, and dialling as one option rather than the only one.
//
// Deliberately NOT a verification surface. Numbers here are self-reported —
// phone verification was ruled out for now (email/Google sign-in is the identity
// story), so nothing in this sheet claims a number is confirmed.
import React, { useState } from 'react';
import { View, Modal, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import Text from './Text';
import * as haptics from '../services/haptics';
import * as toast from '../services/toast';
import { colors, radius } from '../theme/tokens';

/** Digits only — `tel:` chokes on the spaces and brackets people type. */
function dialable(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

/** Render a NA number as (403) 555-0142; anything else is shown as entered. */
export function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) {
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return String(phone || '');
}

/**
 * @param {object[]} contacts  [{ key, name, role, phone }] — entries with no
 *                             phone are filtered out by the caller's builder.
 */
function ContactRow({ contact }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    haptics.buttonTap?.();
    try {
      await Clipboard.setStringAsync(String(contact.phone));
      setCopied(true);
      toast.show({ type: 'success', text1: 'Number copied' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.show({ type: 'error', text1: "Couldn't copy the number" });
    }
  }

  function handleDial() {
    haptics.buttonTap?.();
    const target = dialable(contact.phone);
    if (!target) return;
    Linking.openURL(`tel:${target}`).catch(() =>
      // Not a dead end any more: the number is on screen and copyable, so say
      // so instead of just reporting failure.
      Alert.alert(
        'Could not open the dialer',
        'Your device could not start a call. The number is on screen — copy it and dial manually.',
      ),
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.avatar}>
          <Feather name="user" size={14} color={colors.accentText} />
        </View>
        <View style={styles.rowText}>
          <Text variant="smallMedium" numberOfLines={1}>
            {contact.name}
          </Text>
          {!!contact.role && <Text style={styles.role}>{contact.role}</Text>}
        </View>
      </View>

      {/* The number itself — selectable so it can be grabbed by hand too. */}
      <Text style={styles.number} selectable accessibilityLabel={`Phone number ${contact.phone}`}>
        {formatPhone(contact.phone)}
      </Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${contact.name}'s number`}
        >
          <Feather
            name={copied ? 'check' : 'copy'}
            size={14}
            color={copied ? colors.success : colors.textSecondary}
          />
          <Text style={[styles.btnGhostText, copied && { color: colors.success }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleDial}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${contact.name}`}
        >
          <Feather name="phone" size={14} color={colors.textPrimary} />
          <Text style={styles.btnPrimaryText}>Call</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CallContactSheet({ visible, onClose, contacts = [], onMessage }) {
  const reachable = contacts.filter((c) => c && c.phone);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>
          {reachable.length > 1 ? 'Who do you want to call?' : 'Call'}
        </Text>

        {reachable.length === 0 ? (
          // Was a bare "No number available" alert. Give them the way out that
          // always works instead of a dead end.
          <View style={styles.empty}>
            <Feather name="phone-off" size={18} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              No phone number on file for this provider yet. Messaging them always reaches them.
            </Text>
            {!!onMessage && (
              <Pressable
                onPress={() => {
                  onClose?.();
                  onMessage();
                }}
                style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Message the provider"
              >
                <Feather name="message-circle" size={14} color={colors.textPrimary} />
                <Text style={styles.btnPrimaryText}>Message instead</Text>
              </Pressable>
            )}
          </View>
        ) : (
          reachable.map((c) => <ContactRow key={c.key || c.phone} contact={c} />)
        )}

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  row: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius?.md ?? 14,
    padding: 14,
    gap: 10,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  role: { fontSize: 11.5, color: colors.textSecondary, marginTop: 1 },
  number: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 9 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 14 },
  emptyText: {
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  close: { height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
