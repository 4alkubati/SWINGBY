// T50 — SwImage: thin expo-image wrapper with SwingBy defaults
// Wave 9 will migrate existing <Image /> usages to <SwImage />.
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

/**
 * SwImage — drop-in replacement for React Native Image.
 *
 * Props (in addition to all expo-image props):
 *  - source          (required) URI string, require(), or expo-image source object
 *  - style           ViewStyle
 *  - placeholderHash BlurhashString — shown while loading
 *  - contentFit      default "cover"
 *  - transition      default 200ms
 *  - cachePolicy     default "memory-disk"
 *  - accessibilityLabel  Describe the image content for screen readers.
 *                        Pass an empty string "" for purely decorative images
 *                        (sets accessible={false} automatically).
 */
export default function SwImage({
  source,
  style,
  placeholderHash,
  contentFit = 'cover',
  transition = 200,
  cachePolicy = 'memory-disk',
  accessibilityLabel,
  ...rest
}) {
  const isDecorative = accessibilityLabel === '' || accessibilityLabel === undefined;

  return (
    <Image
      source={source}
      placeholder={placeholderHash ? { blurhash: placeholderHash } : undefined}
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
      style={[styles.base, style]}
      accessible={!isDecorative}
      accessibilityLabel={isDecorative ? undefined : accessibilityLabel}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
  },
});
