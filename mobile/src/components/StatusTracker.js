import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

const STAGES = [
  { key: 'on_the_way', label: 'On my way' },
  { key: 'in_progress', label: 'Started' },
  { key: 'completed', label: 'Done' },
];

function stageIndex(bookingStatus) {
  if (bookingStatus === 'in_progress') return 1;
  if (bookingStatus === 'completed') return 2;
  return 0;
}

export default function StatusTracker({ bookingStatus, onAdvance }) {
  const current = stageIndex(bookingStatus);
  const isComplete = bookingStatus === 'completed';

  function handleTap(index) {
    if (index === current + 1 && !isComplete) {
      onAdvance(STAGES[index].key);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>JOB STATUS</Text>
      <View style={styles.track}>
        {STAGES.map((stage, index) => {
          const isPast = index < current;
          const isActive = index === current;
          const isNext = index === current + 1;

          return (
            <View key={stage.key} style={styles.stageWrapper}>
              {index > 0 && (
                <View style={[styles.connector, isPast && styles.connectorDone]} />
              )}
              <TouchableOpacity
                style={[
                  styles.stage,
                  isPast && styles.stageDone,
                  isActive && styles.stageActive,
                  isNext && !isComplete && styles.stageNext,
                ]}
                onPress={() => handleTap(index)}
                activeOpacity={isNext && !isComplete ? 0.8 : 1}
              >
                {isPast && (
                  <Feather name="check" size={11} color={colors.accentText} strokeWidth={2.6} />
                )}
                <Text style={[
                  styles.stageLabel,
                  isPast && styles.stageLabelDone,
                  isActive && styles.stageLabelActive,
                ]}>
                  {stage.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {!isComplete && current < 2 && (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>
            Tap "{STAGES[current + 1]?.label}" to advance
          </Text>
          <Feather name="arrow-right" size={12} color={colors.textTertiary} strokeWidth={2} />
        </View>
      )}
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
    marginHorizontal: spacing.lg,
    gap: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: colors.accent,
  },
  stage: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    minWidth: 82,
  },
  stageDone: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderAccent,
  },
  stageActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.borderAccent,
  },
  stageNext: {
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  stageLabelDone: { color: colors.accentText },
  stageLabelActive: { color: colors.accentText },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hint: { fontSize: 12, color: colors.textTertiary },
});
