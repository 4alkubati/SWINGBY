// MOBILE-PRODUCT card, Goal 3 — MyJobs edit UI (carryover: backend PATCH
// already existed at PATCH /service-posts/{post_id}, commit c96f995, but
// no mobile UI called it). Owner-only, open-status-only on the backend —
// this sheet is only ever shown for a post the caller owns while it's
// still 'open' (guarded by the caller, MyJobsScreen).
//
// preferred_date is deliberately NOT edited here: its DB column
// (docs/service_posts_preferred_date.sql) is filed but not yet applied,
// so sending it would risk a 400 on environments where the column doesn't
// exist yet. Same style/pattern as SendQuoteSheet.js.
import {
  View, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet,
  TouchableWithoutFeedback, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import Text from './Text';
import { api } from '../services/api';
import { colors, spacing } from '../theme/tokens';

export default function EditPostSheet({ visible, onClose, post, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && post) {
      setTitle(post.title || '');
      setDescription(post.description || '');
      setBudget(post.budget != null ? String(post.budget) : '');
      setAddress(post.address || '');
      setError('');
    }
  }, [visible, post]);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setError('Title needs at least 3 characters.');
      return;
    }
    const amount = parseFloat(budget);
    if (!amount || amount <= 0) {
      setError('Enter a valid budget.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.patch(`/service-posts/${post.id}`, {
        title: trimmedTitle,
        description: description.trim() || null,
        budget: amount,
        address: address.trim() || null,
      });
      onSaved?.(res?.post || { ...post, title: trimmedTitle, description, budget: amount, address });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrapper}>
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.handle} />
          <Text style={styles.heading}>Edit post</Text>

          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            placeholder="What do you need done?"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
          />

          <Text style={styles.fieldLabel}>BUDGET</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencySign}>$</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.fieldLabel}>ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="Add an address (optional)"
            placeholderTextColor={colors.textTertiary}
            value={address}
            onChangeText={setAddress}
            maxLength={300}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.saveBtnInner}>
                <Text style={styles.saveBtnText}>Save changes</Text>
                <Feather name="check" size={16} color="#fff" strokeWidth={2.4} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} disabled={loading} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
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
    maxHeight: '88%',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sheetContent: {
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
    marginBottom: 4,
  },
  heading: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 70,
    maxHeight: 120,
    textAlignVertical: 'top',
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
    fontSize: 22,
    color: colors.success,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  error: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.1 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
