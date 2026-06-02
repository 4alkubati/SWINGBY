// T70 — Error shake animation hook
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { errorTap } from '../services/haptics';

/**
 * Returns [shakeStyle, triggerShake].
 *
 * shakeStyle   — animated style with translateX; wrap your component in
 *                Animated.View and spread this style onto it.
 * triggerShake — call this when validation fails; fires errorTap() haptic
 *                then plays 6-pulse horizontal oscillation (~360 ms total).
 */
export function useShake() {
  const translateX = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const triggerShake = () => {
    errorTap();
    translateX.value = withSequence(
      withTiming(8,  { duration: 60, easing: Easing.inOut(Easing.cubic) }),
      withTiming(-8, { duration: 60, easing: Easing.inOut(Easing.cubic) }),
      withTiming(6,  { duration: 60, easing: Easing.inOut(Easing.cubic) }),
      withTiming(-6, { duration: 60, easing: Easing.inOut(Easing.cubic) }),
      withTiming(3,  { duration: 60, easing: Easing.inOut(Easing.cubic) }),
      withTiming(0,  { duration: 60, easing: Easing.inOut(Easing.cubic) }),
    );
  };

  return [shakeStyle, triggerShake];
}
