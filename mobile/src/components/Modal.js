import React from 'react';
import { View, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { colors, radius, shadows, spacing, motion } from '../theme/tokens';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Modal({ visible, onClose, title, children }) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
      backdropOpacity.value = withTiming(1, { duration: motion.entryDuration, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: motion.exitDuration, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: motion.exitDuration });
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 500) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: motion.exitDuration });
        backdropOpacity.value = withTiming(0, { duration: motion.exitDuration });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { stiffness: motion.spring.stiffness, damping: motion.spring.damping });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.6,
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          accessibilityHint="Dismisses this dialog"
        />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityViewIsModal={true}
          accessibilityRole="none"
          style={[
            {
              position: 'absolute',
              top: 48,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
            },
            shadows.modal,
            sheetStyle,
          ]}
        >
          <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          {title && (
            <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.base }}>
              <Animated.Text
                style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: colors.textPrimary }}
                accessibilityRole="header"
                maxFontSizeMultiplier={1.4}
              >
                {title}
              </Animated.Text>
            </View>
          )}
          <View style={{ flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.base }}>
            {children}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
