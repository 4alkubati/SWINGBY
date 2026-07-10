import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',  color: colors.accentText, bg: colors.accentMuted },
  in_progress: { label: 'On the way', color: colors.accentText, bg: colors.accentMuted },
  completed:   { label: 'Done',       color: colors.success,    bg: 'rgba(46,189,133,0.15)' },
  cancelled:   { label: 'Cancelled',  color: colors.textTertiary, bg: colors.surfaceAlt },
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
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(workerName)}</Text>
      </View>

      <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
      </View>

      <Text style={styles.workerName}>{workerName}</Text>
      {roleTitle ? <Text style={styles.roleTitle}>{roleTitle}</Text> : null}

      {companyName ? (
        <TouchableOpacity onPress={onViewBusiness} activeOpacity={0.75} style={styles.companyRow}>
          <Text style={styles.company}>{companyName}</Text>
          <Feather name="chevron-right" size={14} color={colors.accentText} strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}

      {(rating || jobCount) ? (
        <View style={styles.statsRow}>
          {rating != null && (
            <View style={styles.statInline}>
              <Feather name="star" size={13} color={colors.accentText} strokeWidth={2} />
              <Text style={styles.stat}>{Number(rating).toFixed(1)}</Text>
            </View>
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.accentText,
    letterSpacing: -0.4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  workerName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  roleTitle: { fontSize: 13, color: colors.textSecondary },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  company: { fontSize: 13, color: colors.accentText, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4, alignItems: 'center' },
  statInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  statMuted: { fontSize: 13, color: colors.textSecondary },
});
