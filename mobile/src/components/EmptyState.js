// T38 — Empty-state component
// T72 — Idle pulse animation on icon wrapper
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { colors, spacing, radius } from '../theme/tokens';

export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  body,
  action, // { label, onPress }
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse (1.05 → 1.0 → 1.05 …)
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Animated.View style={[styles.iconWrapper, pulseStyle]}>
        <Feather name={icon} size={32} color={colors.accentText} strokeWidth={1.8} />
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Body */}
      {!!body && <Text style={styles.body}>{body}</Text>}

      {/* Optional CTA */}
      {action && (
        <TouchableOpacity
          style={styles.button}
          onPress={action.onPress}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.buttonLabel}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.button,
    paddingVertical: 13,
    paddingHorizontal: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
});
