import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function QuoteCard({ quote, isRecommended, onSelect, onViewProfile }) {
  const businessName = quote.business_name || 'Business';

  return (
    <View style={[styles.container, isRecommended && styles.containerRecommended]}>
      {isRecommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>BEST VALUE</Text>
        </View>
      )}

      <TouchableOpacity onPress={onViewProfile} activeOpacity={0.85} style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(businessName)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>{businessName}</Text>
      </TouchableOpacity>

      <View style={styles.stats}>
        <View style={styles.statInline}>
          <Feather name="star" size={12} color={colors.accentText} strokeWidth={2} />
          <Text style={styles.stat}>{quote.avg_rating?.toFixed(1) || '—'}</Text>
        </View>
        <Text style={styles.statMuted}>{quote.job_count || 0} jobs</Text>
        {quote.distance_km != null && (
          <Text style={styles.statMuted}>{Number(quote.distance_km).toFixed(1)} km</Text>
        )}
      </View>

      <Text style={styles.price}>${quote.quoted_price}</Text>

      <TouchableOpacity
        style={[styles.selectBtn, isRecommended && styles.selectBtnActive]}
        onPress={onSelect}
        activeOpacity={0.85}
      >
        <Text style={[styles.selectBtnText, isRecommended && styles.selectBtnTextActive]}>
          Select
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: spacing.base,
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
    flex: 1,
  },
  containerRecommended: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.accentMuted,
  },
  recommendedBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 2,
  },
  recommendedText: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  identity: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: colors.accentText,
    letterSpacing: -0.3,
  },
  name: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  stats: { alignItems: 'center', gap: 2 },
  statInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  statMuted: { fontSize: 11, color: colors.textSecondary },
  price: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    color: colors.success,
    letterSpacing: -1,
    marginVertical: 2,
  },
  selectBtn: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.1 },
  selectBtnTextActive: { color: '#ffffff' },
});
