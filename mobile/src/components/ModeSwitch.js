import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ModeSwitch({ mode, onModeChange }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      <TouchableOpacity
        style={[styles.btn, mode === 'browse' && styles.btnActive]}
        onPress={() => onModeChange('browse')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityLabel="Browse services"
        accessibilityState={{ selected: mode === 'browse' }}
      >
        <Text style={[styles.btnText, mode === 'browse' && styles.btnTextActive]} allowFontScaling={true} maxFontSizeMultiplier={1.3}>
          Browse
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, mode === 'post' && styles.btnActive]}
        onPress={() => onModeChange('post')}
        activeOpacity={0.8}
        accessibilityRole="tab"
        accessibilityLabel="Post a job"
        accessibilityState={{ selected: mode === 'post' }}
      >
        <Text style={[styles.btnText, mode === 'post' && styles.btnTextActive]} allowFontScaling={true} maxFontSizeMultiplier={1.3}>
          Post a Job
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginTop: 14,
    backgroundColor: '#0d0f10',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1a1d1f',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnActive: {
    backgroundColor: '#FF5C00',
    shadowColor: '#FF5C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  btnTextActive: {
    color: '#ffffff',
  },
});
