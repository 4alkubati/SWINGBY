import { View, Text, StyleSheet } from 'react-native';

export default function FeaturedCard({ name, initials, rating, jobs, distance, category, verified }) {
  const a11yLabel = [
    name,
    verified ? 'Verified provider' : null,
    `Rated ${rating} stars`,
    `${jobs} jobs`,
    distance ? `${distance} away` : null,
    category,
  ].filter(Boolean).join(', ');

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={a11yLabel}
      accessibilityRole="none"
    >
      <View style={styles.avatar} accessible={false}>
        <Text style={styles.avatarText} accessibilityElementsHidden={true} importantForAccessibility="no">{initials}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1} allowFontScaling={true}>{name}</Text>
          <View style={styles.badge} accessible={false}>
            <Text style={styles.badgeText} accessibilityElementsHidden={true} importantForAccessibility="no">TOP RATED</Text>
          </View>
        </View>
        <Text style={styles.meta} allowFontScaling={true} maxFontSizeMultiplier={1.3} accessibilityElementsHidden={true} importantForAccessibility="no">
          <Text style={styles.star}>★ {rating}</Text>
          <Text>{` · ${jobs} jobs · ${distance}`}</Text>
        </Text>
        <View style={styles.tags}>
          {verified && (
            <View style={[styles.tag, styles.tagVerified]} accessible={false}>
              <Text style={[styles.tagText, styles.tagTextVerified]} accessibilityElementsHidden={true} importantForAccessibility="no">Verified</Text>
            </View>
          )}
          {category ? (
            <View style={styles.tag} accessible={false}>
              <Text style={styles.tagText} accessibilityElementsHidden={true} importantForAccessibility="no">{category}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1214',
    borderWidth: 1,
    borderColor: '#1e2226',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    gap: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#FF5C00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#ffffff',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(255, 92, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    color: '#FF8C42',
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  star: {
    color: '#FF5C00',
    fontWeight: '700',
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagVerified: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  tagText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  tagTextVerified: {
    color: '#4ade80',
  },
});
