import React, { useCallback } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { colors, radius, shadows, motion } from '../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BottomSheet({ visible, onClose, snapPoints = [0.4, 0.7], children }) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue({ y: 0 });
  const activeSnap = useSharedValue(0);

  const maxSnap = Math.max(...snapPoints);
  const sheetHeight = SCREEN_HEIGHT * maxSnap;

  React.useEffect(() => {
    if (visible) {
      const initialSnap = snapPoints[0];
      const targetY = SCREEN_HEIGHT - SCREEN_HEIGHT * initialSnap;
      translateY.value = withSpring(targetY, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
      backdropOpacity.value = withTiming(1, { duration: motion.entryDuration, easing: Easing.out(Easing.cubic) });
      activeSnap.value = 0;
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
      backdropOpacity.value = withTiming(0, { duration: motion.exitDuration, easing: Easing.in(Easing.cubic) });
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      translateY.value = Math.max(
        context.value.y + event.translationY,
        SCREEN_HEIGHT - sheetHeight
      );
    })
    .onEnd((event) => {
      if (event.velocityY > 500 || translateY.value > SCREEN_HEIGHT - SCREEN_HEIGHT * snapPoints[0] * 0.5) {
        translateY.value = withSpring(SCREEN_HEIGHT, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
        backdropOpacity.value = withTiming(0, { duration: motion.exitDuration });
        runOnJS(onClose)();
        return;
      }
      // Snap to nearest snap point
      const snapPositions = snapPoints.map((s) => SCREEN_HEIGHT - SCREEN_HEIGHT * s);
      let closest = snapPositions[0];
      let minDist = Math.abs(translateY.value - snapPositions[0]);
      for (let i = 1; i < snapPositions.length; i++) {
        const dist = Math.abs(translateY.value - snapPositions[i]);
        if (dist < minDist) {
          minDist = dist;
          closest = snapPositions[i];
        }
      }
      translateY.value = withSpring(closest, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.5,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          accessibilityHint="Dismisses this panel"
        />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityViewIsModal={true}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              height: sheetHeight,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
            },
            shadows.modal,
            sheetStyle,
          ]}
        >
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
