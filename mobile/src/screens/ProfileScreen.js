import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateMe } from '../services/auth';

function initials(user) {
  if (!user) return '?';
  return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
}

const ROLE_LABEL = {
  client: 'Client',
  business_owner: 'Business Owner',
  employee: 'Employee',
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // edit fields
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  function confirmLogout() {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out', style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
          },
        },
      ]
    );
  }

  function startEdit() {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setPhone(user?.phone || '');
    setEditMode(true);
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', 'First and last name cannot be blank.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };
      if (phone.trim()) payload.phone = phone.trim();
      const res = await updateMe(payload);
      updateUser(res.user || payload);
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight}>
          {!editMode && (
            <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar + identity */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user)}</Text>
          </View>

          {editMode ? (
            <View style={styles.editFields}>
              <View style={styles.editRow}>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>First name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First"
                    placeholderTextColor="#3a424c"
                  />
                </View>
                <View style={styles.editHalf}>
                  <Text style={styles.editLabel}>Last name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor="#3a424c"
                  />
                </View>
              </View>
              <Text style={styles.editLabel}>Phone</Text>
              <TextInput
                style={styles.editInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 403 555 0100"
                placeholderTextColor="#3a424c"
                keyboardType="phone-pad"
              />
            </View>
          ) : (
            <>
              <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </>
          )}

          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{ROLE_LABEL[user?.role] || user?.role}</Text>
          </View>
        </View>

        {editMode ? (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setEditMode(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save changes</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Info rows */}
            <View style={styles.infoCard}>
              {user?.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{user.phone}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Member since</Text>
                <Text style={styles.infoValue}>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
                    : '—'}
                </Text>
              </View>
            </View>

            {/* App info */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>App version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Region</Text>
                <Text style={styles.infoValue}>Calgary, AB</Text>
              </View>
            </View>

            {/* Logout */}
            <TouchableOpacity
              style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
              onPress={confirmLogout}
              activeOpacity={0.8}
              disabled={loggingOut}
            >
              {loggingOut
                ? <ActivityIndicator color="#f87171" />
                : <Text style={styles.logoutText}>Log out</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: {
    backgroundColor: 'rgba(255,92,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,92,0,0.3)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontSize: 13, color: '#FF8C42', fontWeight: '600' },
  bellIcon: { fontSize: 22 },
  content: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40, gap: 14 },
  identityCard: {
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 8,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF5C00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  email: { fontSize: 14, color: '#9ca3af' },
  rolePill: {
    backgroundColor: 'rgba(255,92,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,92,0,0.25)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  roleText: { fontSize: 12, color: '#FF8C42', fontWeight: '600' },
  editFields: { width: '100%', gap: 10 },
  editRow: { flexDirection: 'row', gap: 10 },
  editHalf: { flex: 1, gap: 5 },
  editLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  editInput: {
    backgroundColor: '#131618', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#f0ede8',
  },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  saveBtn: {
    flex: 2, backgroundColor: '#FF5C00', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  infoCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f', borderRadius: 16,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#111315',
  },
  infoLabel: { fontSize: 14, color: '#9ca3af' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#ffffff' },
  logoutBtn: {
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#f87171' },
});
