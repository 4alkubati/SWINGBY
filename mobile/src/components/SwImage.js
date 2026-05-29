// T50 — SwImage: thin expo-image wrapper with SwingBy defaults
// Wave 9 will migrate existing <Image /> usages to <SwImage />.
import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

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
 */
export default function SwImage({
  source,
  style,
  placeholderHash,
  contentFit = 'cover',
  transition = 200,
  cachePolicy = 'memory-disk',
  ...rest
}) {
  return (
    <Image
      source={source}
      placeholder={placeholderHash ? { blurhash: placeholderHash } : undefined}
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
      style={[styles.base, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#131618', // subtle bg while loading — matches skeleton bg
  },
});
