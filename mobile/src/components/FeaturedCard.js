import { View, Text, StyleSheet } from 'react-native';

export default function FeaturedCard({ name, initials, rating, jobs, distance, category, verified }) {
  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TOP RATED</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          <Text style={styles.star}>★ {rating}</Text>
          <Text>{` · ${jobs} jobs · ${distance}`}</Text>
        </Text>
        <View style={styles.tags}>
          {verified && (
            <View style={[styles.tag, styles.tagVerified]}>
              <Text style={[styles.tagText, styles.tagTextVerified]}>✓ Verified</Text>
            </View>
          )}
          {category ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{category}</Text>
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
