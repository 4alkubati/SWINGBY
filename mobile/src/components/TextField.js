// Text field — the mock's canonical form.
//
// This used to be a Material-style floating label that started inside the box
// and animated up on focus. Every field frame in `SwingBy All Screens.dc.html`
// (Login, Signup, Profile Edit, Business Setup) draws the same thing instead:
// an uppercase 11px/600/+1.4 label ABOVE a 52px box. The floating variant also
// forced `paddingTop: 22` on the input, so the text sat off the optical centre
// of the field, and it swallowed the placeholder until focus.
//
// The prop surface is unchanged, so every existing caller keeps working.
import React, { useState, useRef } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from './Text';
import { colors, spacing, radius } from '../theme/tokens';

export default function TextField({
  label,
  value,
  onChangeText,
  error,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  right,
  style,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  // POLISH-TIPS §6 — focus swaps the border colour at a constant 1px width so
  // focusing never nudges layout.
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={style}>
      {label ? (
        <Text
          variant="label"
          style={{ color: error ? colors.danger : colors.textSecondary, marginBottom: 7 }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => inputRef.current?.focus()}
        accessibilityLabel={label}
        accessibilityRole="none"
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: spacing.base,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          height: multiline ? undefined : 52,
          minHeight: multiline ? 100 : 52,
          paddingVertical: multiline ? spacing.md : 0,
        }}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          accessibilityLabel={label}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={{
            flex: 1,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: multiline ? 22 : undefined,
            color: colors.textPrimary,
            padding: 0,
          }}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          {...props}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              strokeWidth={1.8}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : right}
      </Pressable>

      {error ? (
        <Text variant="caption" color="danger" style={{ marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
