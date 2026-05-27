import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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

      <TouchableOpacity onPress={onViewProfile} activeOpacity={0.8}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(businessName)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>{businessName}</Text>
      </TouchableOpacity>

      <View style={styles.stats}>
        <Text style={styles.stat}>
          <Text style={styles.star}>★</Text> {quote.avg_rating?.toFixed(1) || '—'}
        </Text>
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
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
    flex: 1,
  },
  containerRecommended: {
    borderColor: 'rgba(255,92,0,0.4)',
    backgroundColor: 'rgba(255,92,0,0.05)',
  },
  recommendedBadge: {
    backgroundColor: 'rgba(255,92,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  recommendedText: { fontSize: 9, color: '#FF8C42', fontWeight: '700' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  name: { fontSize: 13, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
  stats: { alignItems: 'center', gap: 2 },
  stat: { fontSize: 13, color: '#ffffff', fontWeight: '600' },
  star: { color: '#FF5C00' },
  statMuted: { fontSize: 11, color: '#9ca3af' },
  price: { fontSize: 26, fontWeight: '700', color: '#FF5C00' },
  selectBtn: {
    width: '100%',
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectBtnActive: {
    backgroundColor: '#FF5C00',
    borderColor: '#FF5C00',
  },
  selectBtnText: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  selectBtnTextActive: { color: '#ffffff' },
});
