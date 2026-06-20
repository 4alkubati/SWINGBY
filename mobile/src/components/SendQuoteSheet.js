import {
  View, Text, TextInput, TouchableOpacity, Modal, StyleSheet,
  TouchableWithoutFeedback, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { api } from '../services/api';

export default function SendQuoteSheet({ visible, onClose, post }) {
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const amount = parseFloat(price);
    if (!amount || amount <= 0) {
      setError('Enter a valid price.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/interests/', {
        post_id: post.id,
        quoted_price: amount,
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setPrice('');
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to send quote.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setPrice('');
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

          {/* Job summary */}
          {post && (
            <View style={styles.jobSummary}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {post.title || post.description || 'Job'}
              </Text>
              {post.preferred_date && (
                <Text style={styles.jobMeta}>
                  {new Date(post.preferred_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  {post.preferred_time ? ` · ${post.preferred_time}` : ''}
                </Text>
              )}
            </View>
          )}

          <Text style={styles.fieldLabel}>Your quoted price</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencySign}>$</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0"
              placeholderTextColor="#3a424c"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              autoFocus
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.sendBtn, (loading || sent) && styles.sendBtnDisabled]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={loading || sent}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.sendBtnText}>{sent ? '✓ Quote sent!' : 'Send quote →'}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: '#0f1214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1e2226',
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2a2e33',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  jobSummary: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  jobTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  jobMeta: { fontSize: 13, color: '#9ca3af' },
  fieldLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  currencySign: { fontSize: 28, fontWeight: '700', color: '#FF5C00', marginRight: 4 },
  priceInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    paddingVertical: 10,
  },
  error: { fontSize: 13, color: '#f87171', fontWeight: '500' },
  sendBtn: {
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
