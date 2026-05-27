import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { api } from '../services/api';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ReviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId, workerId, workerName } = route.params || {};
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reviews/', {
        booking_id: bookingId,
        reviewee_id: workerId,
        reviewee_type: 'business',
        rating,
        comment: comment.trim() || null,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave a review</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {/* Worker identity */}
        <View style={styles.workerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(workerName || 'Provider')}</Text>
          </View>
          <Text style={styles.workerName}>{workerName || 'Your provider'}</Text>
          <Text style={styles.workerSub}>How was your experience?</Text>
        </View>

        {/* Star selector */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              activeOpacity={0.7}
              style={styles.starBtn}
            >
              <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
            </TouchableOpacity>
          ))}
        </View>
        {rating > 0 && (
          <Text style={styles.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
          </Text>
        )}

        {/* Comment */}
        <View style={styles.commentField}>
          <Text style={styles.commentLabel}>Comment (optional)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Tell others about your experience…"
            placeholderTextColor="#3a424c"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting || rating === 0}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit review</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 24, gap: 24 },
  workerCard: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF5C00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  workerName: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  workerSub: { fontSize: 14, color: '#9ca3af' },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  starBtn: { padding: 4 },
  star: { fontSize: 44, color: '#2a2e33' },
  starActive: { color: '#FF5C00' },
  ratingLabel: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#FF8C42' },
  commentField: { gap: 8 },
  commentLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  commentInput: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 14, padding: 14, fontSize: 14, color: '#f0ede8', minHeight: 100,
  },
  submitBtn: {
    backgroundColor: '#FF5C00', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
