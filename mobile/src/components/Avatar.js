import React from 'react';
import { View, Image } from 'react-native';
import Text from './Text';
import { colors, radius } from '../theme/tokens';

const sizeMap = { xs: 24, sm: 32, md: 48, lg: 64, xl: 96 };

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
}

const fontSizeMap = { xs: 10, sm: 12, md: 18, lg: 24, xl: 36 };

export default function Avatar({ source, name, size = 'md', showStatus, online, style }) {
  const dim = sizeMap[size] || size;
  const fontSize = fontSizeMap[size] || Math.round(dim * 0.38);
  const statusSize = Math.max(8, Math.round(dim * 0.22));

  return (
    <View
      style={[{ width: dim, height: dim, position: 'relative' }, style]}
      accessible={true}
      accessibilityLabel={name ? `${name} avatar` : 'User avatar'}
      accessibilityRole="image"
    >
      {source ? (
        <Image
          source={typeof source === 'string' ? { uri: source } : source}
          style={{
            width: dim,
            height: dim,
            borderRadius: radius.avatar,
            backgroundColor: colors.surfaceAlt,
          }}
          accessible={false}
        />
      ) : (
        <View
          style={{
            width: dim,
            height: dim,
            borderRadius: radius.avatar,
            backgroundColor: colors.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize, fontFamily: 'SpaceGrotesk_700Bold', color: colors.accent }}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {showStatus && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: statusSize,
            height: statusSize,
            borderRadius: statusSize / 2,
            backgroundColor: online ? colors.success : colors.textSecondary,
            borderWidth: 2,
            borderColor: colors.bg,
          }}
        />
      )}
    </View>
  );
}
