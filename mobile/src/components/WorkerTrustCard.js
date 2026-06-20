import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'On the way',  color: '#FF8C42', bg: 'rgba(255,92,0,0.12)' },
  completed:   { label: 'Done',        color: '#4ade80', bg: 'rgba(34,197,94,0.12)' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

export default function WorkerTrustCard({ booking, onViewBusiness }) {
  const workerName = booking?.employee_name || booking?.business_name || 'Your provider';
  const companyName = booking?.business_name || '';
  const roleTitle = booking?.employee_role || '';
  const rating = booking?.avg_rating;
  const jobCount = booking?.job_count;
  const status = STATUS_CONFIG[booking?.status] || STATUS_CONFIG.confirmed;

  return (
    <View style={styles.container}>
      {/* Large avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(workerName)}</Text>
      </View>

      {/* Status pill */}
      <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
      </View>

      {/* Identity */}
      <Text style={styles.workerName}>{workerName}</Text>
      {roleTitle ? <Text style={styles.roleTitle}>{roleTitle}</Text> : null}

      {/* Company */}
      {companyName ? (
        <TouchableOpacity onPress={onViewBusiness} activeOpacity={0.7}>
          <Text style={styles.company}>{companyName} →</Text>
        </TouchableOpacity>
      ) : null}

      {/* Stats */}
      {(rating || jobCount) ? (
        <View style={styles.statsRow}>
          {rating != null && (
            <Text style={styles.stat}><Text style={styles.star}>★</Text> {Number(rating).toFixed(1)}</Text>
          )}
          {jobCount != null && (
            <Text style={styles.statMuted}>{jobCount} jobs</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1214',
    borderWidth: 1,
    borderColor: '#1e2226',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 22,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  workerName: { fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  roleTitle: { fontSize: 13, color: '#9ca3af' },
  company: { fontSize: 13, color: '#FF8C42', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  stat: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  star: { color: '#FF5C00' },
  statMuted: { fontSize: 14, color: '#9ca3af' },
});
