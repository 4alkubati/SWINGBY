import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Switch, RefreshControl, Alert, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function BusinessProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { businessId, editMode: initialEditMode } = route.params || {};
  const [business, setBusiness] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(!!initialEditMode);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRadius, setEditRadius] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const resolvedId = businessId || user?.business_id;

  const load = useCallback(async () => {
    if (!resolvedId) { setLoading(false); return; }
    try {
      const [biz, emps, revs] = await Promise.all([
        api.get(`/businesses/${resolvedId}`),
        api.get('/employees/'),
        api.get(`/reviews/business/${resolvedId}`),
      ]);
      setBusiness(biz);
      setEmployees(emps || []);
      setReviews(revs || []);
      setEditName(biz.business_name || '');
      setEditCategory(biz.category || '');
      setEditRadius(String(biz.service_radius_km || 25));
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolvedId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/businesses/${resolvedId}`, {
        business_name: editName,
        category: editCategory,
        service_radius_km: parseInt(editRadius, 10),
      });
      await load();
      setEditMode(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await logout(); } finally { setLoggingOut(false); }
        },
      },
    ]);
  }

  async function toggleEmployee(emp) {
    try {
      if (emp.is_active) {
        await api.patch(`/employees/${emp.id}/deactivate`);
      } else {
        await api.patch(`/employees/${emp.id}/reactivate`);
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  const isOwner = user?.role === 'business_owner';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Profile</Text>
        {isOwner && !editMode && (
          <TouchableOpacity onPress={() => setEditMode(true)}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        )}
        {editMode && (
          <TouchableOpacity onPress={() => setEditMode(false)}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5C00" />}
      >
        {/* Identity */}
        <View style={styles.identityCard}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{initials(business?.business_name || '')}</Text>
          </View>

          {editMode ? (
            <View style={styles.editFields}>
              <Text style={styles.fieldLabel}>Business name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Business name"
                placeholderTextColor="#3a424c"
              />
              <Text style={styles.fieldLabel}>Category</Text>
              <TextInput
                style={styles.editInput}
                value={editCategory}
                onChangeText={setEditCategory}
                placeholder="e.g. Cleaning"
                placeholderTextColor="#3a424c"
              />
              <Text style={styles.fieldLabel}>Service radius (km)</Text>
              <TextInput
                style={styles.editInput}
                value={editRadius}
                onChangeText={setEditRadius}
                placeholder="25"
                placeholderTextColor="#3a424c"
                keyboardType="numeric"
              />
            </View>
          ) : (
            <>
              <Text style={styles.bizName}>{business?.business_name || '—'}</Text>
              {business?.license_status === 'verified' && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
              <View style={styles.statsRow}>
                <Text style={styles.stat}>
                  <Text style={styles.star}>★</Text> {business?.avg_rating?.toFixed(1) || '—'}
                </Text>
                <Text style={styles.statMuted}>{business?.review_count || 0} reviews</Text>
                <View style={styles.catTag}>
                  <Text style={styles.catTagText}>{business?.category || 'General'}</Text>
                </View>
              </View>
            </>
          )}

          {!editMode && !businessId && (
            <TouchableOpacity style={styles.bookBtn} activeOpacity={0.85}>
              <Text style={styles.bookBtnText}>Book directly →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Team */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Team</Text>
        </View>

        <View style={styles.teamGrid}>
          {employees.map((emp) => (
            <TouchableOpacity
              key={emp.id}
              style={styles.empCard}
              onPress={() => navigation.navigate('EmployeeProfile', { employeeId: emp.id, businessId: resolvedId })}
              activeOpacity={0.8}
            >
              <View style={styles.empAvatar}>
                <Text style={styles.empAvatarText}>{initials(emp.user?.first_name + ' ' + emp.user?.last_name || 'E')}</Text>
              </View>
              <Text style={styles.empName} numberOfLines={1}>
                {emp.user?.first_name || 'Employee'}
              </Text>
              <Text style={styles.empRole} numberOfLines={1}>{emp.role_title || 'Staff'}</Text>
              {editMode && (
                <Switch
                  value={emp.is_active}
                  onValueChange={() => toggleEmployee(emp)}
                  thumbColor={emp.is_active ? '#FF5C00' : '#6b7280'}
                  trackColor={{ false: '#2a2e33', true: 'rgba(255,92,0,0.3)' }}
                />
              )}
              {!editMode && !emp.is_active && (
                <Text style={styles.inactiveTag}>Inactive</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Reviews */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reviews</Text>
        </View>

        {reviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((rev) => (
              <View key={rev.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{rev.reviewer?.first_name || 'Client'}</Text>
                  <Text style={styles.reviewStars}>{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</Text>
                </View>
                {rev.comment ? <Text style={styles.reviewComment}>{rev.comment}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {editMode && (
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
        )}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.saveBtnDisabled]}
          onPress={handleLogout}
          activeOpacity={0.8}
          disabled={loggingOut}
        >
          {loggingOut
            ? <ActivityIndicator color="#f87171" />
            : <Text style={styles.logoutBtnText}>Log out</Text>
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
  editLink: { fontSize: 14, color: '#FF5C00', fontWeight: '600' },
  cancelLink: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  content: { paddingBottom: 40, gap: 4 },
  identityCard: {
    backgroundColor: '#0f1214', borderWidth: 1, borderColor: '#1e2226',
    borderRadius: 20, padding: 20, marginHorizontal: 22, marginTop: 8,
    alignItems: 'center', gap: 10,
  },
  bigAvatar: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: '#FF5C00',
    alignItems: 'center', justifyContent: 'center',
  },
  bigAvatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  bizName: { fontSize: 22, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5, textAlign: 'center' },
  verifiedBadge: {
    backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  verifiedText: { fontSize: 12, color: '#4ade80', fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { fontSize: 15, color: '#ffffff', fontWeight: '700' },
  star: { color: '#FF5C00' },
  statMuted: { fontSize: 13, color: '#9ca3af' },
  catTag: {
    backgroundColor: '#131618', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  catTagText: { fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  bookBtn: {
    backgroundColor: '#FF5C00', borderRadius: 14, paddingVertical: 12,
    paddingHorizontal: 28, marginTop: 4,
  },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  editFields: { width: '100%', gap: 8 },
  fieldLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  editInput: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#2a2e33',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#f0ede8',
  },
  sectionHeader: {
    paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1.2 },
  teamGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 22, gap: 12,
  },
  empCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 16, padding: 12, alignItems: 'center', gap: 6,
    width: '47%',
  },
  empAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#1a2a3a',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  empAvatarText: { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  empName: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  empRole: { fontSize: 11, color: '#9ca3af' },
  inactiveTag: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  reviewsList: { paddingHorizontal: 22, gap: 10 },
  reviewCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 14, padding: 14, gap: 6,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  reviewStars: { fontSize: 12, color: '#FF5C00' },
  reviewComment: { fontSize: 13, color: '#9ca3af', lineHeight: 18 },
  emptyCard: {
    marginHorizontal: 22, backgroundColor: '#0d0f10', borderWidth: 1,
    borderColor: '#1a1d1f', borderRadius: 14, padding: 20, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#6b7280' },
  saveBtn: {
    marginHorizontal: 22, backgroundColor: '#FF5C00', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  logoutBtn: {
    marginHorizontal: 22, marginTop: 24, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  logoutBtnText: { fontSize: 15, fontWeight: '600', color: '#f87171' },
});
