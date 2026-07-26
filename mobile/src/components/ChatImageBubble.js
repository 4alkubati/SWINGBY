// ChatImageBubble — a photo shared inside a message thread (walkthrough M11).
//
// There is no handoff frame for this one. It is built to the message bubble
// that already exists in messages/ChatScreen.js (radius 18 with a 4px tail on
// the sender's side, `surface` + 1px `border` for received) so a photo reads as
// the same object as a text message, just with the picture where the words go.
// POLISH-TIPS §3: depth is border + fill, never a shadow on a resting bubble.
//
// States, all of which have to look deliberate (POLISH-TIPS §10.5):
//   uploading  local file, dimmed, spinner over it — it is already in the
//              thread, which is the whole point of an optimistic send
//   failed     amber warning + "Tap to retry", bubble stays put
//   sent       remote image, tap opens the shared full-screen ImageViewer
//
// The image is NEVER the accent colour's job: an image bubble is a neutral
// surface on both sides. Tinting a photo purple would burn the one scarce
// accent this screen is allowed (POLISH-TIPS §2).
import React from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import SwImage from './SwImage';
import Text from './Text';
import { colors, spacing } from '../theme/tokens';

// Bubble width. 240 keeps a portrait photo comfortably under half the screen
// height on a 390pt device while staying inside the 80% max-width that text
// bubbles use.
const IMAGE_WIDTH = 240;
const MIN_HEIGHT = 130;
const MAX_HEIGHT = 320;

// Server-side default caption for an uncaptioned photo (backend sets
// content = "Photo" so the inbox preview says something). It is a label, not
// something the user typed, so it is not rendered as a caption.
const DEFAULT_CAPTION = 'Photo';

export function imageBubbleHeight(width, height) {
  if (!width || !height) return 180;
  const scaled = (IMAGE_WIDTH * height) / width;
  if (!Number.isFinite(scaled)) return 180;
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(scaled)));
}

function timeStr(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatImageBubble({ item, isMine, onPress, onRetry }) {
  const uri = item?._localUri || item?.attachment_url;
  const uploading = !!item?._optimistic && !item?._failed;
  const failed = !!item?._failed;
  const caption =
    item?.content && item.content !== DEFAULT_CAPTION ? item.content : null;
  const height = imageBubbleHeight(item?.attachment_width, item?.attachment_height);

  const label = caption
    ? `Photo: ${caption}`
    : isMine
      ? 'Photo you sent'
      : 'Photo they sent';

  return (
    <View style={[styles.wrap, isMine ? styles.wrapMine : styles.wrapTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Pressable
          onPress={failed ? onRetry : uploading ? undefined : onPress}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={failed ? 'Photo failed to send — tap to retry' : label}
          style={({ pressed }) => [pressed && !uploading && { opacity: 0.9 }]}
        >
          <View style={[styles.imageFrame, { height }]}>
            {uri ? (
              <SwImage
                source={{ uri }}
                style={{ width: IMAGE_WIDTH, height }}
                contentFit="cover"
                // The Pressable above is the accessible element and already
                // announces the photo; labelling the image too makes a screen
                // reader say it twice.
                accessibilityLabel=""
              />
            ) : (
              <View style={[styles.missing, { height }]}>
                <Feather name="image" size={22} color={colors.textTertiary} strokeWidth={1.8} />
              </View>
            )}

            {uploading && (
              <View style={styles.overlay}>
                <ActivityIndicator size="small" color={colors.textPrimary} />
              </View>
            )}

            {failed && (
              <View style={styles.overlay}>
                <Feather
                  name="alert-triangle"
                  size={20}
                  color={colors.warning}
                  strokeWidth={1.8}
                />
                <Text variant="caption" style={styles.retryText}>
                  Tap to retry
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        {!!caption && (
          <Text variant="caption" style={styles.caption} numberOfLines={4}>
            {caption}
          </Text>
        )}

        <Text variant="caption" style={styles.time}>
          {uploading ? 'sending…' : failed ? 'not sent' : timeStr(item?.sent_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  wrapMine: { justifyContent: 'flex-end' },
  wrapTheirs: { justifyContent: 'flex-start' },

  // 4px of padding so the photo's own corners sit inside the bubble's border
  // instead of fighting it — nesting a same-radius fill inside a border is what
  // makes an "invisible edge" (POLISH-TIPS §3).
  bubble: {
    padding: 4,
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  bubbleMine: { borderBottomLeftRadius: 18, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4, borderBottomRightRadius: 18 },

  imageFrame: {
    width: IMAGE_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  missing: {
    width: IMAGE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(7,8,10,0.55)',
  },
  retryText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },

  caption: {
    paddingHorizontal: spacing.sm,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  time: {
    alignSelf: 'flex-end',
    paddingRight: spacing.sm,
    paddingBottom: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textTertiary,
  },
});
