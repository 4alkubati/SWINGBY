import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import WorkerTrustCard from '../components/WorkerTrustCard';

export default function ActiveBookingScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/bookings/${bookingId}`);
      setBooking(data);
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

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
          <Text style={styles.back}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
    : null;

  const isConfirmed = booking.status === 'confirmed' || booking.status === 'in_progress';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your booking</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#FF5C00" />}
      >
        {/* Worker card */}
        <WorkerTrustCard
          booking={booking}
          onViewBusiness={() =>
            navigation.navigate('BusinessProfile', { businessId: booking.business_id })
          }
        />

        {/* Job details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Job Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{booking.service_type || '—'}</Text>
          </View>
          {date && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{date}</Text>
            </View>
          )}
          {booking.scheduled_time && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{booking.scheduled_time}</Text>
            </View>
          )}
          {booking.address && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{booking.address}</Text>
            </View>
          )}
          {booking.total_amount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={[styles.detailValue, styles.detailPrice]}>${booking.total_amount}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Chat button — only if confirmed */}
      {isConfirmed && (
        <View style={[styles.chatBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() =>
              navigation.navigate('Chat', {
                bookingId: booking.id,
                otherPartyName: booking.business_name || 'Provider',
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.chatBtnText}>💬  Open chat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080a' },
  loader: { flex: 1, backgroundColor: '#07080a', alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#9ca3af' },
  back: { fontSize: 15, color: '#FF5C00', fontWeight: '600' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: { fontSize: 24, color: '#9ca3af', width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  detailsCard: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: '#1a1d1f',
    borderRadius: 18, padding: 16, marginHorizontal: 22, gap: 12,
  },
  detailsTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14, color: '#9ca3af' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#ffffff', textAlign: 'right', flex: 1, marginLeft: 12 },
  detailPrice: { color: '#FF5C00', fontSize: 16 },
  chatBarWrapper: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#111315',
    backgroundColor: '#07080a',
  },
  chatBtn: {
    backgroundColor: '#0d0f10', borderWidth: 1, borderColor: 'rgba(255,92,0,0.35)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: '#FF5C00' },
});
