// T38 — Empty-state component
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

// ─── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  accent: '#FF5C00',
  white: '#ffffff',
  secondary: '#9ca3af',
  card: '#0d0f10',
  border: '#2a2e33',
  orangeGlow: 'rgba(255,92,0,0.35)',
};

export default function EmptyState({
  icon = 'inbox',
  title = 'Nothing here yet',
  body,
  action, // { label, onPress }
}) {
  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconWrapper}>
        <Feather name={icon} size={32} color={COLORS.accent} />
      </View>

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
    backgroundColor: 'rgba(255,92,0,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,92,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: COLORS.white,
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 8,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#FF5C00',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,92,0,0.35)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
    letterSpacing: 0.2,
  },
});
