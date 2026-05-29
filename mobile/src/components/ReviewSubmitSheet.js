// T46 — ReviewSubmitSheet
// Bottom-sheet modal for submitting a post-booking review.
// Props:
//   visible        — boolean
//   onClose        — () => void
//   bookingId      — string
//   revieweeName   — string
//   revieweeAvatar — string | null (URL, unused in this design; initials shown instead)
//   onSubmitted    — () => void (called on success before onClose)
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import * as toast from '../services/toast';
import * as haptics from '../services/haptics';
import { RatingStarsInput } from './RatingStars';

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
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{toInitials(revieweeName)}</Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.name}>{revieweeName}</Text>
          <Text style={styles.sub}>How did they do?</Text>

          {/* Stars — large, 40pt */}
          <View style={styles.starsWrap}>
            <RatingStarsInput value={rating} onChange={setRating} size={40} />
          </View>

          {rating > 0 && (
            <Text style={styles.ratingHint}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
            </Text>
          )}

          {/* Comment */}
          <TextInput
            style={styles.commentInput}
            placeholder="Leave an optional comment…"
            placeholderTextColor="#3a424c"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{comment.length} / 2000</Text>

          {/* CTA */}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d0f10',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1a1d1f',
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2e33',
    marginBottom: 4,
  },

  avatarWrap: {
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 24, fontWeight: '700', color: '#ffffff' },

  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: -4,
  },
  sub: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: -8,
    textAlign: 'center',
  },

  starsWrap: {
    paddingVertical: 4,
  },
  ratingHint: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8C42',
    marginTop: -8,
    textAlign: 'center',
  },

  commentInput: {
    width: '100%',
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#f0ede8',
    minHeight: 90,
    lineHeight: 21,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#3a424c',
    marginTop: -10,
  },

  submitBtn: {
    width: '100%',
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    marginTop: 4,
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
