import React, { useState, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Text from './Text';
import { colors, spacing, radius, motion } from '../theme/tokens';

export default function TextField({
  label,
  value,
  onChangeText,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  style,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);
  const labelPosition = useSharedValue(value ? 1 : 0);

  const hasValue = value && value.length > 0;

  const handleFocus = () => {
    setFocused(true);
    labelPosition.value = withTiming(1, {
      duration: motion.entryDuration,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handleBlur = () => {
    setFocused(false);
    if (!hasValue) {
      labelPosition.value = withTiming(0, {
        duration: motion.exitDuration,
        easing: Easing.in(Easing.cubic),
      });
    }
  };

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: labelPosition.value === 1 ? -12 : 8 },
      { scale: labelPosition.value === 1 ? 0.8 : 1 },
    ],
  }));

  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={style}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityLabel={label}
        accessibilityRole="none"
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: borderColor,
          paddingHorizontal: spacing.base,
          paddingTop: label ? 22 : spacing.md,
          paddingBottom: label ? 8 : spacing.md,
          minHeight: multiline ? 100 : undefined,
        }}
      >
        {label && (
          <Animated.Text
            allowFontScaling={false}
            style={[
              {
                position: 'absolute',
                left: spacing.base,
                top: 16,
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                color: error ? colors.danger : focused ? colors.accent : colors.textSecondary,
              },
              labelAnimatedStyle,
            ]}
          >
            {label}
          </Animated.Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={secureTextEntry && !showPassword}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            accessibilityLabel={label}
            style={{
              flex: 1,
              fontFamily: 'Inter_400Regular',
              fontSize: 16,
              color: colors.textPrimary,
              padding: 0,
            }}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.accent}
            {...props}
          />
          {secureTextEntry && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text variant="small" color="secondary">{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
      {error && (
        <Text variant="caption" color="danger" style={{ marginTop: spacing.xs, marginLeft: spacing.xs }}>
          {error}
        </Text>
      )}
    </View>
  );
}
