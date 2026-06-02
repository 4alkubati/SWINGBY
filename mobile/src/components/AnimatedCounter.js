// T73 — Counter increment animation component
import { useEffect, useState } from 'react';
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import Text from './Text';

/**
 * Animates a number counting up (or down) to `value` over `duration` ms.
 *
 * Props:
 *   value     — target number
 *   prefix    — prepended string, e.g. "$" or "+"
 *   suffix    — appended string, e.g. "%" or " pts"
 *   duration  — animation duration in ms (default 600)
 *   variant   — Text variant (default "h1")
 *   color     — Text color token or raw hex string (default "primary")
 */
export default function AnimatedCounter({
  value = 0,
  prefix = '',
  suffix = '',
  duration = 600,
  variant = 'h1',
  color = 'primary',
}) {
  const animValue = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  // Bridge from worklet context back to React state so we can render
  // the rounded integer into a plain Text component.
  useAnimatedReaction(
    () => Math.round(animValue.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplay)(current);
      }
    },
    [animValue],
  );

  useEffect(() => {
    animValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration]);

  return (
    <Text variant={variant} color={color}>
      {prefix}{display}{suffix}
    </Text>
  );
}
