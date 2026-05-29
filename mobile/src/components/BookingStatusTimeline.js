// T47 — BookingStatusTimeline component
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

// ─── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  accent: '#FF5C00',
  orangeGlow: 'rgba(255,92,0,0.35)',
  completed: '#FF5C00',
  pending: '#2a2e33',
  current: '#FF5C00',
  cancelled: '#3a424c',
  white: '#ffffff',
  secondary: '#9ca3af',
  ghost: '#3a424c',
  connector: '#2a2e33',
};

const STAGES = [
  { key: 'confirmed', label: 'CONFIRMED' },
  { key: 'on_the_way', label: 'ON THE WAY' },
  { key: 'in_progress', label: 'IN PROGRESS' },
  { key: 'completed', label: 'DONE' },
];

const ORDER = ['confirmed', 'on_the_way', 'in_progress', 'completed'];

function getStageIndex(status) {
  const idx = ORDER.indexOf(status);
  return idx === -1 ? -1 : idx; // -1 = cancelled
}

function StageCircle({ state }) {
  // state: 'done' | 'current' | 'pending' | 'cancelled'
  const isCancelled = state === 'cancelled';
  const isDone = state === 'done';
  const isCurrent = state === 'current';

  const circleColor = isCancelled
    ? COLORS.cancelled
    : isDone || isCurrent
    ? COLORS.accent
    : COLORS.pending;

  const borderColor = isCancelled
    ? COLORS.ghost
    : isDone || isCurrent
    ? COLORS.accent
    : COLORS.connector;

  return (
    <View
      style={[
        styles.circle,
        { backgroundColor: circleColor, borderColor },
        isCurrent && styles.glowCircle,
      ]}
    >
      {isDone && (
        <Feather name="check" size={9} color="#ffffff" />
      )}
      {isCurrent && !isDone && (
        <View style={styles.dot} />
      )}
    </View>
  );
}

export default function BookingStatusTimeline({ currentStatus }) {
  const isCancelled = currentStatus === 'cancelled';
  const currentIdx = isCancelled ? -1 : getStageIndex(currentStatus);

  return (
    <View style={styles.container}>
      {STAGES.map((stage, i) => {
        let stageState;
        if (isCancelled) {
          stageState = 'cancelled';
        } else if (i < currentIdx) {
          stageState = 'done';
        } else if (i === currentIdx) {
          stageState = 'current';
        } else {
          stageState = 'pending';
        }

        const isLast = i === STAGES.length - 1;
        const connectorDone = !isCancelled && i < currentIdx;

        return (
          <React.Fragment key={stage.key}>
            {/* Stage column */}
            <View style={styles.stageCol}>
              <StageCircle state={stageState} />
              <Text
                style={[
                  styles.label,
                  isCancelled
                    ? { color: COLORS.ghost }
                    : stageState === 'done' || stageState === 'current'
                    ? { color: COLORS.white }
                    : { color: COLORS.secondary },
                ]}
              >
                {stage.label}
              </Text>
            </View>

            {/* Connector line */}
            {!isLast && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: isCancelled
                      ? COLORS.ghost
                      : connectorDone
                      ? COLORS.accent
                      : COLORS.connector,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stageCol: {
    alignItems: 'center',
    flex: 0,
    minWidth: 60,
  },
  circle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  connector: {
    flex: 1,
    height: 2,
    marginBottom: 18, // align with circle vertically
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: 'center',
  },
});
