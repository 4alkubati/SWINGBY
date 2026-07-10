import React, { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import { api } from '../services/api';
import * as toast from '../services/toast';
import * as haptics from '../services/haptics';
import { RatingStarsInput } from './RatingStars';
import { colors, spacing } from '../theme/tokens';

function toInitials(name) {
  return (name || '??').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ReviewSubmitSheet({
  visible,
  onClose,
  bookingId,
  revieweeName = 'Service Provider',
  revieweeAvatar = null,
  onSubmitted,
}) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = rating > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post('/reviews/', {
        booking_id: bookingId,
        rating,
        comment: comment.trim() || undefined,
      });
      await haptics.successTap();
      toast.show({ type: 'success', text1: 'Thanks for your review!' });
      if (onSubmitted) onSubmitted();
      onClose();
    } catch (err) {
      toast.show({ type: 'error', text1: 'Could not submit review', text2: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setRating(0);
    setComment('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior="padding"
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />

          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{toInitials(revieweeName)}</Text>
          </View>

          <Text style={styles.name}>{revieweeName}</Text>
          <Text style={styles.sub}>How did they do?</Text>

          <View style={styles.starsWrap}>
            <RatingStarsInput value={rating} onChange={setRating} size={40} />
          </View>

          {rating > 0 && (
            <Text style={styles.ratingHint}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
            </Text>
          )}

          <TextInput
            style={styles.commentInput}
            placeholder="Leave an optional comment…"
            placeholderTextColor={colors.textTertiary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{comment.length} / 2000</Text>

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.submitBtnText}>Submit review</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlayScrim,
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    alignItems: 'center',
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.accentText,
    letterSpacing: -0.4,
  },
  name: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: -4,
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -8,
    textAlign: 'center',
  },
  starsWrap: {
    paddingVertical: 4,
  },
  ratingHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentText,
    marginTop: -8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  commentInput: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 90,
    lineHeight: 21,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: -10,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.1 },
});
