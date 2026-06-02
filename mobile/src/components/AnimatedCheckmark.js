// T71 — Animated checkmark component
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { successTap } from '../services/haptics';
import { colors } from '../theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function AnimatedCheckmark({
  size = 64,
  color = colors.success,
  strokeWidth = 3,
  delay = 0,
  onComplete,
}) {
  const circleProgress = useSharedValue(0);
  const checkProgress = useSharedValue(0);

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  // Checkmark path: enters bottom-left, hits midpoint, exits top-right
  const checkPath = `M ${center * 0.6} ${center} L ${center * 0.85} ${center * 1.2} L ${center * 1.4} ${center * 0.7}`;
  const checkLength = size * 0.6; // approximate stroke length

  useEffect(() => {
    // Phase 1: draw the circle (300ms)
    circleProgress.value = withDelay(
      delay,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 2: draw the checkmark (300ms), then fire haptic + callback
    checkProgress.value = withDelay(
      delay + 300,
      withTiming(
        1,
        { duration: 300, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(successTap)();
            if (onComplete) runOnJS(onComplete)();
          }
        },
      ),
    );
  }, []);

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - circleProgress.value),
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: checkLength * (1 - checkProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={circleProps}
          strokeLinecap="round"
        />
        <AnimatedPath
          d={checkPath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={checkLength}
          animatedProps={checkProps}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
