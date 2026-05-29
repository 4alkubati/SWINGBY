// T62 — ProfileEditScreen
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { show as showToast } from '../services/toast';
import { RatingStarsDisplay } from '../components/RatingStars';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, updateUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();

    if (!trimFirst || trimFirst.length > 80) {
      showToast({ type: 'error', text1: 'First name must be 1–80 characters' });
      return;
    }
    if (!trimLast || trimLast.length > 80) {
      showToast({ type: 'error', text1: 'Last name must be 1–80 characters' });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.patch('/auth/me', {
        first_name: trimFirst,
        last_name: trimLast,
        phone: phone.trim() || null,
      });
      updateUser(updated);
      showToast({ type: 'success', text1: 'Profile updated' });
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', text1: 'Could not save changes', text2: err.message });
    } finally {
      setSaving(false);
    }
  }

  const initials = `${(user?.first_name ?? '').charAt(0)}${(user?.last_name ?? '').charAt(0)}`.toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color="#f0ede8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => showToast({ type: 'info', text1: 'Photo upload coming soon' })}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarInitials}>{initials || '?'}</Text>
            <View style={styles.avatarEditBadge}>
              <Feather name="camera" size={12} color="#ffffff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Rating (if available) */}
        {user?.avg_rating != null && (
          <View style={styles.ratingRow}>
            <RatingStarsDisplay rating={user.avg_rating} size={16} />
            <Text style={styles.ratingLabel}>{user.avg_rating.toFixed(1)} avg rating</Text>
          </View>
        )}

        {/* First name */}
        <View style={styles.field}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ali"
            placeholderTextColor="#3a424c"
            maxLength={80}
            returnKeyType="next"
          />
        </View>

        {/* Last name */}
        <View style={styles.field}>
          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Khalid"
            placeholderTextColor="#3a424c"
            maxLength={80}
            returnKeyType="next"
          />
        </View>

        {/* Email — read-only */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputReadOnly}>
            <Feather name="lock" size={15} color="#6b7280" style={styles.lockIcon} />
            <Text style={styles.inputReadOnlyText} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <Text style={styles.fieldHint}>Email — contact support to change</Text>
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 587 555 1234"
            placeholderTextColor="#3a424c"
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>

        {/* Bottom padding for sticky button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky save CTA */}
      <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#07080a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1d1f',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#131618',
    borderWidth: 2,
    borderColor: '#07080a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#f0ede8',
    minHeight: 48,
  },
  inputReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 48,
    opacity: 0.7,
  },
  lockIcon: {
    marginRight: 8,
  },
  inputReadOnlyText: {
    fontSize: 15,
    color: '#6b7280',
    flex: 1,
  },
  fieldHint: {
    fontSize: 11,
    color: '#3a424c',
    marginTop: -4,
  },
  stickyBottom: {
    paddingHorizontal: 22,
    paddingTop: 12,
    backgroundColor: '#07080a',
    borderTopWidth: 1,
    borderTopColor: '#1a1d1f',
  },
  saveBtn: {
    backgroundColor: '#FF5C00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
