import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function EmployeeManagementScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { employeeId } = route.params || {};
  const [employee, setEmployee] = useState(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const emps = await api.get('/employees/');
      const emp = (emps || []).find((e) => e.id === employeeId);
      if (emp) {
        setEmployee(emp);
        setRoleTitle(emp.role_title || '');
        setIsActive(emp.is_active !== false);
      }
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      if (!isActive && employee?.is_active) {
        await api.patch(`/employees/${employeeId}/deactivate`);
      } else if (isActive && !employee?.is_active) {
        await api.patch(`/employees/${employeeId}/reactivate`);
      }
      Alert.alert('Saved', 'Employee updated successfully.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  const fullName = employee?.user
    ? `${employee.user.first_name} ${employee.user.last_name}`
    : 'Employee';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Employee</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName)}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{employee?.user?.email || ''}</Text>
        </View>

        {/* Role title */}
        <View style={styles.field}>
          <Text style={styles.label}>Role title</Text>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Senior Cleaner", "Technician"'
            placeholderTextColor="#3a424c"
            value={roleTitle}
            onChangeText={setRoleTitle}
          />
        </View>

        {/* Active toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Active</Text>
            <Text style={styles.toggleSub}>Inactive employees won't appear to clients</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            thumbColor={isActive ? '#FF5C00' : '#6b7280'}
            trackColor={{ false: '#2a2e33', true: 'rgba(255,92,0,0.3)' }}
          />
        </View>

        {/* Stats */}
        {employee && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Jobs</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>—</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 40, gap: 16 },
  identityCard: {
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 18, padding: 20, alignItems: 'center', gap: 6,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a2a3a',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#60a5fa' },
  name: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  email: { fontSize: 13, color: '#9ca3af' },
  field: { gap: 8 },
  label: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#f0ede8',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 14, padding: 16,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  toggleSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statsCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 14, padding: 16, gap: 12,
  },
  statsTitle: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  statsRow: { flexDirection: 'row' },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  statLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#FF5C00', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#FF5C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
