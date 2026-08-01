import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';
import { FLOW, STAGE_LABEL, stageIndex } from '../utils/jobStages';

/**
 * The JOB STATUS tracker — a PROGRESS INDICATOR, not a control.
 *
 * P1 (2026-07-31): this used to be tappable, and its hint read
 *
 *     Tap "On the way" — On my way →
 *
 * directly above a "Live status" card whose primary button performs exactly
 * that transition. Two controls, one action, three lines apart: the stepper
 * telling you to tap it and the CTA below doing it. A provider standing on a
 * driveway should not have to work out which of two things to press.
 *
 * The CTA won because it confirms first (LiveStatusActions.confirmAndPost) and
 * because it is the only one of the two that can show progress. This shows
 * where the job is; the button moves it.
 *
 * Driven by the booking's EVENTS, not by `booking.status`. It used to read
 * `booking.status` and map it onto its own three-stage list whose first key,
 * `on_the_way`, was not a booking status at all — while the tap it offered
 * posted an `en_route` event. Reading one thing and writing another meant the
 * tracker never advanced, stayed tappable on stage 0 forever, and appended a
 * duplicate event on every tap. That is where the three "On the way" rows in
 * the 2026-07-29 walkthrough came from. Not being a control at all removes the
 * whole class.
 *
 * `events` is the caller's array from GET /bookings/{id}/events — the same one
 * the timeline and the action button render, fetched once by the screen.
 */
export default function StatusTracker({ events }) {
  const current = stageIndex(events); // -1 before the first event
  const isComplete = current === FLOW.length - 1;
  const nextIndex = current + 1;
  const canAdvance = !isComplete;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>JOB STATUS</Text>
      <View style={styles.track}>
        {FLOW.map((stage, index) => {
          const isPast = index < current;
          const isActive = index === current;
          const isNext = index === nextIndex;

          return (
            <View key={stage} style={styles.stageWrapper}>
              {index > 0 && (
                <View style={[styles.connector, isPast && styles.connectorDone]} />
              )}
              <View
                style={[
                  styles.stage,
                  isPast && styles.stageDone,
                  isActive && styles.stageActive,
                  isNext && canAdvance && styles.stageNext,
                ]}
                accessibilityRole="text"
                accessibilityLabel={`${STAGE_LABEL[stage]}${
                  isPast || isActive ? ' — done' : isNext ? ' — next' : ''
                }`}
              >
                {isPast && (
                  <Feather name="check" size={11} color={colors.accentText} strokeWidth={2.6} />
                )}
                <Text style={[
                  styles.stageLabel,
                  isPast && styles.stageLabelDone,
                  isActive && styles.stageLabelActive,
                ]}>
                  {STAGE_LABEL[stage]}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {/* States what happens next. It does NOT tell you to tap anything —
          the button in the Live status card below is the only way to move a
          job forward (P1). */}
      {canAdvance && (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>
            Next: {STAGE_LABEL[FLOW[nextIndex]]}
          </Text>
          <Feather name="arrow-down" size={12} color={colors.textTertiary} strokeWidth={2} />
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    // Four stages share this row now, not three — the tracker speaks the same
    // vocabulary as the timeline, which always had `arrived`.
    minWidth: 60,
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
