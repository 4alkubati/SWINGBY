import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import StatusTracker from '../components/StatusTracker';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function JobManagementScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [assignPickerVisible, setAssignPickerVisible] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bData, eData] = await Promise.all([
        api.get(`/bookings/${bookingId}`),
        api.get('/employees/').catch(() => []),
      ]);
      setBooking(bData);
      setEmployees((eData || []).filter((e) => e.is_active));
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance(stage) {
    setAdvancing(true);
    try {
      if (stage === 'completed') {
        await api.patch(`/bookings/${bookingId}/complete`);
      } else {
        await api.patch(`/bookings/${bookingId}/confirm-date`);
      }
      await load();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update status.');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAssign(employeeId) {
    setAssigning(true);
    setAssignPickerVisible(false);
    try {
      await api.patch(`/bookings/${bookingId}/assign-employee`, {
        employee_id: employeeId,
      });
      await load();
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not assign employee.');
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF5C00" size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Booking not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

  const isDone = booking.status === 'completed';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {booking.service_type || 'Job'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5C00" />}
      >
        {/* Status tracker */}
        <StatusTracker bookingStatus={booking.status} onAdvance={handleAdvance} />
        {advancing && (
          <View style={styles.advancingRow}>
            <ActivityIndicator color="#FF5C00" size="small" />
            <Text style={styles.advancingText}>Updating status…</Text>
          </View>
        )}

        {/* Client info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client</Text>
          <Text style={styles.cardValue}>{booking.client_name || 'Client'}</Text>
          {booking.address && <Text style={styles.cardMeta}>{booking.address}</Text>}
          {date && <Text style={styles.cardMeta}>{date}{booking.scheduled_time ? ` · ${booking.scheduled_time}` : ''}</Text>}
          {booking.total_amount && (
            <Text style={[styles.cardMeta, styles.priceText]}>
              ${booking.total_amount} total
            </Text>
          )}
        </View>

        {/* Employee assignment */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>Assigned Employee</Text>
            {!isDone && (
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => setAssignPickerVisible(true)}
                disabled={assigning}
              >
                {assigning
                  ? <ActivityIndicator color="#FF5C00" size="small" />
                  : <Text style={styles.assignBtnText}>
                      {booking.employee_id ? 'Reassign' : '+ Assign'}
                    </Text>
                }
              </TouchableOpacity>
            )}
          </View>
          {booking.employee_id ? (
            <>
              <Text style={styles.cardValue}>{booking.employee_name || 'Assigned'}</Text>
              {booking.employee_role && <Text style={styles.cardMeta}>{booking.employee_role}</Text>}
            </>
          ) : (
            <Text style={styles.cardMeta}>No employee assigned yet</Text>
          )}
        </View>

        {/* Photo proof — shown when done */}
        {isDone && (
          <View style={styles.proofBox}>
            <Text style={styles.proofIcon}>📷</Text>
            <Text style={styles.proofTitle}>Upload proof of work</Text>
            <Text style={styles.proofSub}>Required to release final payment</Text>
            <TouchableOpacity style={styles.proofBtn} activeOpacity={0.8}>
              <Text style={styles.proofBtnText}>Choose photos</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat button */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() =>
            navigation.navigate('Chat', {
              bookingId: booking.id,
              otherPartyName: booking.client_name || 'Client',
            })
          }
          activeOpacity={0.8}
        >
          <Text style={styles.chatBtnText}>💬  Message client</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Employee picker modal */}
      <Modal
        visible={assignPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAssignPickerVisible(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Assign Employee</Text>
          {employees.length === 0 ? (
            <Text style={styles.modalEmpty}>No active employees found.</Text>
          ) : (
            <FlatList
              data={employees}
              keyExtractor={(e) => e.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const fullName = item.user
                  ? `${item.user.first_name} ${item.user.last_name}`
                  : 'Employee';
                const isCurrent = item.id === booking.employee_id;
                return (
                  <TouchableOpacity
                    style={[styles.empRow, isCurrent && styles.empRowActive]}
                    onPress={() => handleAssign(item.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.empAvatar}>
                      <Text style={styles.empAvatarText}>{initials(fullName)}</Text>
                    </View>
                    <View style={styles.empInfo}>
                      <Text style={styles.empName}>{fullName}</Text>
                      <Text style={styles.empRole}>{item.role_title || 'Staff'}</Text>
                    </View>
                    {isCurrent && <Text style={styles.empCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#9ca3af' },
  backLink: { fontSize: 15, color: '#FF5C00', fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff', flex: 1, textAlign: 'center' },
  content: { paddingTop: 16, paddingBottom: 40, gap: 14 },
  advancingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22,
  },
  advancingText: { fontSize: 13, color: '#9ca3af' },
  card: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 16, padding: 16, marginHorizontal: 22, gap: 4,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontSize: 11, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardValue: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  cardMeta: { fontSize: 13, color: '#9ca3af' },
  priceText: { color: '#FF8C42', fontWeight: '600' },
  assignBtn: {
    backgroundColor: 'rgba(255,92,0,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.3)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  assignBtnText: { fontSize: 12, fontWeight: '700', color: '#FF8C42' },
  proofBox: {
    marginHorizontal: 22, backgroundColor: '#0d0f10', borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: 'rgba(255,92,0,0.3)', borderRadius: 16,
    padding: 20, alignItems: 'center', gap: 6,
  },
  proofIcon: { fontSize: 28 },
  proofTitle: { fontSize: 14, fontWeight: '600', color: '#d1d5db' },
  proofSub: { fontSize: 12, color: '#6b7280' },
  proofBtn: {
    backgroundColor: '#FF5C00', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 6,
  },
  proofBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  chatBtn: {
    marginHorizontal: 22, backgroundColor: '#0d0f10', borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.3)', borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: '#FF5C00' },
  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0f1214', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: '#1e2226',
    padding: 24, maxHeight: '70%',
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: '#2a2e33', borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 16 },
  modalEmpty: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingVertical: 20 },
  empRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1d1f',
  },
  empRowActive: { backgroundColor: 'rgba(255,92,0,0.05)', borderRadius: 12, paddingHorizontal: 4 },
  empAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a2a3a',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  empAvatarText: { fontSize: 13, fontWeight: '700', color: '#60a5fa' },
  empInfo: { flex: 1 },
  empName: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  empRole: { fontSize: 12, color: '#9ca3af' },
  empCheck: { fontSize: 18, color: '#4ade80' },
});
