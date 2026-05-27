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

export default function CategoryScroll({ activeCategory, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.cat, activeCategory === cat.id && styles.catActive]}
          onPress={() => onSelect(cat.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.emoji}>{cat.emoji}</Text>
          <Text style={[styles.label, activeCategory === cat.id && styles.labelActive]}>
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
