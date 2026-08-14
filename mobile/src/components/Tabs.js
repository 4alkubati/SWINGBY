import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Text from './Text';
import { buttonTap } from '../services/haptics';
import { colors, spacing, radius, motion } from '../theme/tokens';

export default function Tabs({ tabs, activeIndex = 0, onChange, style }) {
  const [tabWidths, setTabWidths] = useState([]);
  const indicatorX = useSharedValue(0);

  const handleLayout = (index, event) => {
    const { x, width } = event.nativeEvent.layout;
    setTabWidths((prev) => {
      const next = [...prev];
      next[index] = { x, width };
      return next;
    });
  };

  const handlePress = (index) => {
    if (index === activeIndex) return;
    buttonTap();
    if (tabWidths[index]) {
      indicatorX.value = withSpring(tabWidths[index].x, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      });
    }
    onChange?.(index);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    const activeTab = tabWidths[activeIndex];
    return {
      transform: [{ translateX: indicatorX.value }],
      // `|| 0` collapsed the pill to nothing until onLayout had measured every
      // tab, so the selected state was missing on first paint. Falling back to
      // an even share keeps a pill on screen from the first frame; the measured
      // width takes over as soon as layout lands.
      width: activeTab?.width ?? `${100 / Math.max(tabs.length, 1)}%`,
    };
  });

  // Initialize indicator position
  React.useEffect(() => {
    if (tabWidths[activeIndex]) {
      indicatorX.value = withSpring(tabWidths[activeIndex].x, {
        stiffness: motion.spring.stiffness,
        damping: motion.spring.damping,
      });
    }
  }, [activeIndex, tabWidths]);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          // A control on `bg` has to announce itself. `surface` here measured
          // 1.06:1 against the page — the track was invisible, so the whole
          // switch read as empty space and got scrolled past. Lifted fill plus
          // a `borderStrong` outline (3.03:1) is what makes it a control.
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: radius.input,
          padding: spacing.xs,
          position: 'relative',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: spacing.xs,
            bottom: spacing.xs,
            // `accent` put the active label at 4.48:1 — just under AA. This is
            // the token that exists for exactly this case: a purple fill that
            // carries a `textPrimary` label (4.53:1).
            backgroundColor: colors.accentBtn,
            borderRadius: radius.chip,
          },
          indicatorStyle,
        ]}
      />
      {tabs.map((tab, index) => (
        <Pressable
          key={tab}
          onLayout={(e) => handleLayout(index, e)}
          onPress={() => handlePress(index)}
          accessibilityRole="tab"
          accessibilityLabel={tab}
          accessibilityState={{ selected: index === activeIndex }}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.xs,
            // D-W7 (walkthrough 2026-08-13). Screenshot 02: the label
            // "Needs action (2)" wrapped onto a second line, grew the pill past
            // the sliding indicator behind it, and collided with "Scheduled (2)"
            // and "Past (4)" either side. `flex: 1` sized the touch target but
            // nothing constrained the TEXT, so a longer string simply broke the
            // row. Every count in that row is dynamic, so the widest label is
            // whatever the data happens to be that day — this cannot be solved
            // by picking shorter copy.
            minWidth: 0,
          }}
        >
          <Text
            variant="smallMedium"
            color={index === activeIndex ? 'primary' : 'secondary'}
            // One line, shrink before truncating, and only truncate as a last
            // resort. A tab that reads "Needs acti…" is still legible; a tab row
            // that has reflowed into two rows is not.
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            ellipsizeMode="tail"
            style={{ textAlign: 'center' }}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
