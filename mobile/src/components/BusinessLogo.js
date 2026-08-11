import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';
import Text from './Text';
import { colors } from '../theme/tokens';

// The face of a business, everywhere one is shown.
//
// Businesses are TILES; people are CIRCLES. That split already exists in the
// design system (Avatar `shape="tile"`, POLISH-TIPS §8) and this component is
// the business half of it, with the one thing Avatar has no opinion about:
// what happens when the image does not load.
//
// The monogram is not a placeholder. There are zero logos in the database on
// day one, so the initials tile is the COMMON case and is styled as a finished
// state — accentMuted ground, accentText Space Grotesk 700, same radius as the
// image it stands in for. Never a gray box, never a person glyph, never the
// torn-image icon: a failed remote load falls back to exactly the same tile a
// business with no logo gets, so a dead URL is indistinguishable from an
// honest blank rather than reading as breakage.

export function businessInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function BusinessLogo({
  uri,
  name,
  size = 48,
  radius,
  fontSize,
  style,
  accessibilityLabel,
}) {
  // A previous business's failed load must not blank the next one's logo when
  // the row is recycled in a FlatList.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);

  // Matches Avatar's tile radius formula, which at the 46/48px card sizes
  // resolves to the 14 the cards already used.
  const tileRadius = radius ?? Math.min(18, Math.round(size * 0.3));
  const showImage = !!uri && !failed;

  // Decorative by default: every caller (result row, featured card) already
  // publishes one composed accessibility label for the whole card, and a
  // second announcement for the logo would just make the row read twice.
  // (`accessible={false}` only, matching what the cards' hand-rolled tiles
  // already did — `no-hide-descendants` would additionally strip the monogram
  // out of the accessibility tree, and the tile is the only place some of
  // these surfaces render the business's initials at all.)
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image', accessibilityLabel }
    : { accessible: false };

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: tileRadius,
          backgroundColor: showImage ? colors.surfaceAlt : colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        },
        style,
      ]}
      {...a11y}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          style={{ width: size, height: size }}
          accessible={false}
        />
      ) : (
        // Kept, raised from 1.2: this is a fixed size×size tile with
        // overflow:hidden — a real circle/tile, not a flexible row. The
        // smallest live caller is 30px (ChatScreen header avatar), where the
        // baseline 11px monogram already sits close to the edge; 1.4 leaves
        // headroom without letters clipping out of the tile at that size.
        <Text
          style={{
            fontFamily: 'SpaceGrotesk_700Bold',
            fontSize: fontSize ?? Math.max(11, Math.round(size * 0.34)),
            color: colors.accentText,
            letterSpacing: -0.3,
          }}
          maxFontSizeMultiplier={1.4}
        >
          {businessInitials(name)}
        </Text>
      )}
    </View>
  );
}
