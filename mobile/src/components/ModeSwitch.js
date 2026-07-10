import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

export default function ModeSwitch({ mode, onModeChange }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      <TouchableOpacity
        style={[styles.btn, mode === 'browse' && styles.btnActive]}
        onPress={() => onModeChange('browse')}
        activeOpacity={0.85}
        accessibilityRole="tab"
        accessibilityLabel="Browse services"
        accessibilityState={{ selected: mode === 'browse' }}
      >
        <Text style={[styles.btnText, mode === 'browse' && styles.btnTextActive]} maxFontSizeMultiplier={1.3}>
          Browse
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, mode === 'post' && styles.btnActive]}
        onPress={() => onModeChange('post')}
        activeOpacity={0.85}
        accessibilityRole="tab"
        accessibilityLabel="Post a job"
        accessibilityState={{ selected: mode === 'post' }}
      >
        <Text style={[styles.btnText, mode === 'post' && styles.btnTextActive]} maxFontSizeMultiplier={1.3}>
          Post a Job
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnActive: {
    backgroundColor: colors.accentMuted,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  btnTextActive: {
    color: colors.accentText,
  },
});
