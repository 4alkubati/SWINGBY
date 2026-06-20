import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function NearbyCard({ name, initials, rating, jobs, distance, avatarStyle, onPress }) {
  const isGreen = avatarStyle === 'green';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${name}, rated ${rating} stars, ${jobs} jobs, ${distance} away`}
      accessibilityHint="Opens business profile"
    >
      <View style={[styles.avatar, isGreen ? styles.avatarGreen : styles.avatarBlue]} accessible={false}>
        <Text style={[styles.avatarText, isGreen ? styles.avatarTextGreen : styles.avatarTextBlue]} accessibilityElementsHidden={true} importantForAccessibility="no">
          {initials}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} allowFontScaling={true}>{name}</Text>
        <Text style={styles.meta} allowFontScaling={true} maxFontSizeMultiplier={1.3} accessibilityElementsHidden={true} importantForAccessibility="no">
          <Text style={styles.star}>★ {rating}</Text>
          <Text>{` · ${jobs} jobs`}</Text>
        </Text>
      </View>
      <View style={styles.distPill}>
        <Text style={styles.distText} allowFontScaling={true} maxFontSizeMultiplier={1.2} accessibilityElementsHidden={true} importantForAccessibility="no">{distance}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarGreen: {
    backgroundColor: '#0f2a1a',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  avatarBlue: {
    backgroundColor: '#0f1a2a',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
  avatarTextGreen: {
    color: '#4ade80',
  },
  avatarTextBlue: {
    color: '#60a5fa',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
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
  distPill: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
});
