import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

const CATEGORIES = [
  'Cleaning', 'Plumbing', 'Electrical',
  'Landscaping', 'Painting', 'Carpentry', 'Moving',
];

export default function PostJobScreen() {
  const navigation = useNavigation();

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe what you need.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.post('/service-posts/', {
        title: description.trim(),
        category: category || 'General',
        budget: budget ? parseFloat(budget) : null,
        preferred_date: date.trim() || null,
        preferred_time: time.trim() || null,
        address: address.trim() || null,
      });

      // Clear form
      setDescription('');
      setCategory('');
      setAddress('');
      setBudget('');
      setDate('');
      setTime('');

      // Navigate to QuoteComparison to watch for incoming quotes.
      navigation.navigate('QuoteComparison', {
        postId: data.id,
        postTitle: data.title,
      });
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not post job. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>What do you need? *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="e.g. Deep clean of 2-bedroom apartment, fix leaking pipe, move furniture…"
            placeholderTextColor="#3a424c"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Category chips */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat === category ? '' : cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.field}>
          <Text style={styles.label}>Address (where's the job?)</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main St SW, Calgary"
            placeholderTextColor="#3a424c"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        {/* Budget + Date row */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Budget ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="150"
              placeholderTextColor="#3a424c"
              keyboardType="numeric"
              value={budget}
              onChangeText={setBudget}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Date (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="May 28"
              placeholderTextColor="#3a424c"
              value={date}
              onChangeText={setDate}
            />
          </View>
        </View>

        {/* Time */}
        <View style={styles.field}>
          <Text style={styles.label}>Preferred time (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="10:00 AM"
            placeholderTextColor="#3a424c"
            value={time}
            onChangeText={setTime}
          />
        </View>

        <TouchableOpacity
          style={[styles.postBtn, submitting && styles.postBtnDisabled]}
          activeOpacity={0.85}
          disabled={submitting}
          onPress={handleSubmit}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.postBtnText}>Post job → get quotes</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>
          Local businesses will respond with quotes. You pick the best one.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 32, gap: 14 },
  field: { gap: 8 },
  label: {
    fontSize: 11, color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: 0.8, fontWeight: '700',
  },
  input: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#f0ede8',
  },
  inputMultiline: { minHeight: 80, paddingTop: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipActive: { backgroundColor: 'rgba(255,92,0,0.15)', borderColor: '#FF5C00' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: '#FF8C42' },
  row: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1, gap: 8 },
  postBtn: {
    backgroundColor: '#FF5C00', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  hint: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
});
