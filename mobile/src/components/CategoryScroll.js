import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';

const CATEGORIES = [
  { id: 'cleaning', label: 'Cleaning', emoji: '✨' },
  { id: 'plumbing', label: 'Plumbing', emoji: '🔧' },
  { id: 'moving', label: 'Moving', emoji: '🚚' },
  { id: 'electrical', label: 'Electric', emoji: '⚡' },
  { id: 'lawn', label: 'Lawn', emoji: '🌿' },
  { id: 'painting', label: 'Painting', emoji: '🎨' },
  { id: 'carpentry', label: 'Carpentry', emoji: '🪚' },
];

const ALL_CATEGORY = { id: 'all', label: 'All', emoji: '🔍' };

// prependAll — when true, inserts an "All" chip before the 7 categories.
// Used by SearchScreen and NearbyMapScreen.
export default function CategoryScroll({ activeCategory, onSelect, prependAll = false }) {
  const items = prependAll ? [ALL_CATEGORY, ...CATEGORIES] : CATEGORIES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {items.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.cat, activeCategory === cat.id && styles.catActive]}
          onPress={() => onSelect(cat.id)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={cat.label}
          accessibilityState={{ selected: activeCategory === cat.id }}
        >
          <Text style={styles.emoji} accessibilityElementsHidden={true} importantForAccessibility="no">{cat.emoji}</Text>
          <Text style={[styles.label, activeCategory === cat.id && styles.labelActive]} allowFontScaling={true} maxFontSizeMultiplier={1.3}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    gap: 10,
    flexDirection: 'row',
  },
  cat: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 70,
    gap: 7,
  },
  catActive: {
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    borderColor: 'rgba(255, 92, 0, 0.35)',
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  labelActive: {
    color: '#FF8C42',
  },
});
