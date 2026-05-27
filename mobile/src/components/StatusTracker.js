import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
      <Text style={styles.title}>Job Status</Text>
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
                activeOpacity={isNext && !isComplete ? 0.7 : 1}
              >
                <Text style={[
                  styles.stageLabel,
                  isPast && styles.stageLabelDone,
                  isActive && styles.stageLabelActive,
                ]}>
                  {isPast ? '✓ ' : ''}{stage.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {!isComplete && current < 2 && (
        <Text style={styles.hint}>
          Tap "{STAGES[current + 1]?.label}" to advance →
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0f10',
    borderWidth: 1,
    borderColor: '#1a1d1f',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 22,
    gap: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    backgroundColor: '#2a2e33',
    marginHorizontal: 4,
  },
  connectorDone: {
    backgroundColor: '#4ade80',
  },
  stage: {
    backgroundColor: '#131618',
    borderWidth: 1,
    borderColor: '#2a2e33',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  stageDone: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  stageActive: {
    backgroundColor: 'rgba(255,92,0,0.15)',
    borderColor: 'rgba(255,92,0,0.5)',
  },
  stageNext: {
    borderColor: '#2a2e33',
    borderStyle: 'dashed',
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'center',
  },
  stageLabelDone: { color: '#4ade80' },
  stageLabelActive: { color: '#FF8C42' },
  hint: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
});
