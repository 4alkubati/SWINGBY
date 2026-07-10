import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme/tokens';

export default function SearchField({ value, onChangeText, placeholder = 'Search...', debounceMs = 300, style, showMic = false, ...props }) {
  const [localValue, setLocalValue] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== localValue) setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((text) => {
    setLocalValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChangeText?.(text);
    }, debounceMs);
  }, [onChangeText, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    onChangeText?.('');
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.base,
          height: 52,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Feather name="search" size={18} color={colors.textSecondary} accessibilityElementsHidden={true} importantForAccessibility="no" />
      <TextInput
        value={localValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={placeholder}
        accessibilityRole="search"
        style={{
          flex: 1,
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          color: colors.textPrimary,
          padding: 0,
        }}
        selectionColor={colors.accent}
        returnKeyType="search"
        {...props}
      />
      {localValue.length > 0 ? (
        <Pressable
          onPress={handleClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Feather name="x-circle" size={18} color={colors.textSecondary} accessibilityElementsHidden={true} importantForAccessibility="no" />
        </Pressable>
      ) : showMic ? (
        <Feather name="mic" size={18} color={colors.textSecondary} accessibilityElementsHidden={true} importantForAccessibility="no" />
      ) : null}
    </View>
  );
}
