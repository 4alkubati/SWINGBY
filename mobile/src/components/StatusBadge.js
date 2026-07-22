import { View, StyleSheet } from 'react-native';
import Text from './Text';
import { colors, radius, spacing } from '../theme/tokens';

// Non-interactive status pill used by the job/booking/post/quote rows. Kept
// deliberately distinct from action buttons: a StatusBadge NEVER responds to
// touch — it only communicates state. Actions live in the row's action bar.
//
// `tone` picks a semantic color pair; the caller supplies the label so the
// same badge serves three separate state machines (booking / post / interest)
// without collapsing their vocabularies into one shared lookup.
const TONES = {
  accent:  { bg: colors.accentMuted,           text: colors.accentText },
  success: { bg: 'rgba(46,189,133,0.14)',      text: colors.success },
  warning: { bg: 'rgba(246,178,59,0.14)',      text: colors.warning },
  danger:  { bg: 'rgba(255,92,92,0.14)',       text: colors.danger },
  muted:   { bg: colors.surfaceAlt,            text: colors.textSecondary },
};

export default function StatusBadge({ label, tone = 'muted', style }) {
  const t = TONES[tone] || TONES.muted;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      <Text variant="label" style={{ color: t.text }} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
});
