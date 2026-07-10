import {
  View, TextInput, TouchableOpacity, Modal, StyleSheet,
  TouchableWithoutFeedback, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Text from './Text';
import { api } from '../services/api';
import { colors, spacing } from '../theme/tokens';

const lastPriceKey = (category) => `swingby_last_quote_${(category || 'general').toLowerCase()}`;

export default function SendQuoteSheet({ visible, onClose, post, onQuoted }) {
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const clientFirstName = post?.users?.first_name;

  // Pre-fill the last price quoted for this category — most businesses quote
  // the same service at the same rate; this saves the slowest input.
  useEffect(() => {
    if (!visible || !post) return;
    AsyncStorage.getItem(lastPriceKey(post.category))
      .then((v) => { if (v && !price) setPrice(v); })
      .catch(() => {});
  }, [visible, post?.id]);

  async function handleSend() {
    const amount = parseFloat(price);
    if (!amount || amount <= 0) {
      setError('Enter a valid price.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/interests/', {
        post_id: post.id,
        quoted_price: amount,
      });
      const interest = res?.interest;

      AsyncStorage.setItem(lastPriceKey(post.category), String(amount)).catch(() => {});

      // The note seeds the pre-booking chat thread with the client
      const trimmedNote = note.trim();
      if (trimmedNote && interest?.id) {
        try {
          await api.post('/messages/', {
            interest_id: interest.id,
            content: trimmedNote,
          });
        } catch {
          // quote already landed — a failed note must not fail the flow
        }
      }

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setPrice('');
        setNote('');
        onClose();
        if (interest?.id) onQuoted?.(interest, trimmedNote);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to send quote.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setPrice('');
    setNote('');
    setError('');
    setSent(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior="padding"
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {post && (
            <View style={styles.jobSummary}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {post.title || post.description || 'Job'}
              </Text>
              <Text style={styles.jobMeta}>
                {[
                  clientFirstName ? `for ${clientFirstName}` : null,
                  post.preferred_date
                    ? new Date(post.preferred_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
                    : null,
                  post.preferred_time || null,
                ].filter(Boolean).join(' · ') || null}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>YOUR QUOTED PRICE</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencySign}>$</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              autoFocus
            />
          </View>

          <Text style={styles.fieldLabel}>MESSAGE (OPTIONAL)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder={
              clientFirstName
                ? `Say hi to ${clientFirstName} — opens a chat`
                : 'Add a note — opens a chat with the client'
            }
            placeholderTextColor={colors.textTertiary}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.sendBtn, (loading || sent) && styles.sendBtnDisabled]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={loading || sent}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : sent ? (
              <View style={styles.sendBtnInner}>
                <Feather name="check" size={16} color="#fff" strokeWidth={2.4} />
                <Text style={styles.sendBtnText}>Quote sent</Text>
              </View>
            ) : (
              <View style={styles.sendBtnInner}>
                <Text style={styles.sendBtnText}>Send quote</Text>
                <Feather name="arrow-right" size={16} color="#fff" strokeWidth={2.2} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayScrim,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  jobSummary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  jobTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  jobMeta: { fontSize: 13, color: colors.textSecondary },
  fieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySign: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    color: colors.success,
    marginRight: 4,
    letterSpacing: -0.5,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 34,
    color: colors.textPrimary,
    paddingVertical: 10,
    letterSpacing: -1.2,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 44,
    maxHeight: 90,
  },
  error: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.1 },
});
