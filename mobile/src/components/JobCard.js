import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'In Progress', color: '#FF8C42', bg: 'rgba(255,92,0,0.12)' },
  completed:   { label: 'Done',        color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function JobCard({ booking, onPress }) {
  const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
  const clientName = booking.client_name || booking.client_id || 'Client';
  const date = booking.scheduled_date
    ? new Date(booking.scheduled_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '—';
  const time = booking.scheduled_time || '';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(clientName)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>{clientName}</Text>
      <Text style={styles.meta} numberOfLines={1}>{booking.service_type || 'Service'}</Text>
      <Text style={styles.date}>{date}{time ? ` · ${time}` : ''}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1214',
    borderWidth: 1,
    borderColor: '#1e2226',
    borderRadius: 18,
    padding: 14,
    width: 160,
    gap: 6,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  name: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  meta: { fontSize: 12, color: '#9ca3af' },
  date: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
});
